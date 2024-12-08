import {
    assert,
    ByteString,
    method,
    prop,
    PubKey,
    Sig,
    SmartContract,
    Utils,
    toByteString,
    FixedArray,
    pubKey2Addr,
    hash256
} from 'scrypt-ts'

interface ValidationResult {
    isValid: boolean
    error?: ByteString
}

interface LoanData {
    borrower: PubKey
    amount: bigint
    collateralAmount: bigint
    interestRate: bigint
    startTime: bigint
    duration: bigint
    isSecured: boolean
    repaidAmount: bigint
    lastPaymentTime: bigint
}

interface CreditScore {
    score: bigint
    consecutiveOnTimePayments: bigint
    totalLoans: bigint
    defaultedLoans: bigint
    lastUpdateTime: bigint
}

interface CreditScoreEntry {
    pubKey: PubKey
    score: CreditScore
    isActive: boolean
}

interface DepositData {
    amount: bigint
    depositTime: bigint
    lockInEndTime: bigint
    expectedInterest: bigint
    withdrawn: boolean
}

export class LendingPool extends SmartContract {
    // Existing constants
    static readonly MAX_LOANS = 10
    static readonly MAX_DEPOSITS = 10

    // Time constants
    static readonly DAYS_IN_WEEK = 7n
    static readonly MIN_DURATION_WEEKS = 1n
    static readonly MAX_DURATION_WEEKS = 8n
    static readonly SECONDS_IN_DAY = 86400n
    static readonly WEEKS_IN_YEAR = 52n
    static readonly LOCK_IN_WEEKS = 8n
    
    // Financial constants
    static readonly DAILY_PENALTY_BPS = 100n
    static readonly DEPOSIT_APY_BPS = 900n
    static readonly DEPOSIT_APY_MULTIPLIER = 9n
    static readonly BASE_INTEREST_RATE_SECURED = 1000n
    static readonly BASE_INTEREST_RATE_UNSECURED = 1500n
    static readonly COLLATERAL_RATIO = 150n
    
    // System limits
    static readonly MAX_REWARD_PER_PAYMENT = 1000n
    static readonly MAX_LOAN_AMOUNT = 100000000000n
    static readonly MIN_LOAN_AMOUNT = 1000000n

    // Credit score constants
    static readonly INITIAL_CREDIT_SCORE = 400n
    static readonly MIN_CREDIT_SCORE_FOR_UNSECURED = 550n
    static readonly EARLY_PAYMENT_MULTIPLIER = 130n
    static readonly LATE_PAYMENT_MULTIPLIER = 120n
    static readonly DEFAULT_MULTIPLIER = 130n
    static readonly CREDIT_SCORE_CHANGE_BASE = 10n
    static readonly MIN_PAYMENTS_HISTORY = 5n
    static readonly MIN_CLEAN_LOANS = 3n

    @prop()
    owner: PubKey

    @prop(true)
    loans: FixedArray<LoanData, typeof LendingPool.MAX_LOANS>

    @prop(true)
    deposits: FixedArray<DepositData, typeof LendingPool.MAX_DEPOSITS>

    @prop()
    rewardPool: PubKey

    @prop()
    baseRewardRate: bigint

    @prop(true)
    creditScores: FixedArray<CreditScoreEntry, typeof LendingPool.MAX_LOANS>

    constructor(
        owner: PubKey,
        rewardPool: PubKey,
        baseRewardRate: bigint
    ) {
        super(...arguments)
        this.owner = owner
        this.rewardPool = rewardPool
        this.baseRewardRate = baseRewardRate
        
        // Initialize empty loans array
        const defaultLoan: LoanData = {
            borrower: PubKey(toByteString('0000000000000000000000000000000000000000')),
            amount: 0n,
            collateralAmount: 0n,
            interestRate: 0n,
            startTime: 0n,
            duration: 0n,
            isSecured: false,
            repaidAmount: 0n,
            lastPaymentTime: 0n
        }
        this.loans = [
            defaultLoan, defaultLoan, defaultLoan, defaultLoan, defaultLoan,
            defaultLoan, defaultLoan, defaultLoan, defaultLoan, defaultLoan
        ] as FixedArray<LoanData, typeof LendingPool.MAX_LOANS>

        // Initialize empty deposits array
        const defaultDeposit: DepositData = {
            amount: 0n,
            depositTime: 0n,
            lockInEndTime: 0n,
            expectedInterest: 0n,
            withdrawn: false
        }
        this.deposits = [
            defaultDeposit, defaultDeposit, defaultDeposit, defaultDeposit, defaultDeposit,
            defaultDeposit, defaultDeposit, defaultDeposit, defaultDeposit, defaultDeposit
        ] as FixedArray<DepositData, typeof LendingPool.MAX_DEPOSITS>

        // Initialize credit scores array
        const defaultCreditScore: CreditScoreEntry = {
            pubKey: PubKey(toByteString('0000000000000000000000000000000000000000')),
            score: {
                score: 0n,
                consecutiveOnTimePayments: 0n,
                totalLoans: 0n,
                defaultedLoans: 0n,
                lastUpdateTime: 0n
            },
            isActive: false
        }
        this.creditScores = [
            defaultCreditScore, defaultCreditScore, defaultCreditScore, defaultCreditScore, defaultCreditScore,
            defaultCreditScore, defaultCreditScore, defaultCreditScore, defaultCreditScore, defaultCreditScore
        ] as FixedArray<CreditScoreEntry, typeof LendingPool.MAX_LOANS>
    }

    @method()
    private initializeCreditScore(depositor: PubKey): void {
        // Check if already exists
        for (let i = 0; i < LendingPool.MAX_LOANS; i++) {
            if (this.creditScores[i].pubKey === depositor) {
                return
            }
        }

        // Find empty slot and initialize
        for (let i = 0; i < LendingPool.MAX_LOANS; i++) {
            if (!this.creditScores[i].isActive) {
                this.creditScores[i] = {
                    pubKey: depositor,
                    score: {
                        score: LendingPool.INITIAL_CREDIT_SCORE,
                        consecutiveOnTimePayments: 0n,
                        totalLoans: 0n,
                        defaultedLoans: 0n,
                        lastUpdateTime: this.ctx.locktime
                    },
                    isActive: true
                }
                return
            }
        }
    }

    @method()
    private updateCreditScore(
        borrower: PubKey, 
        paymentTime: bigint,
        dueTime: bigint,
        isDefault: boolean
    ): void {
        for (let i = 0; i < LendingPool.MAX_LOANS; i++) {
            if (this.creditScores[i].pubKey === borrower && this.creditScores[i].isActive) {
                const creditScore = this.creditScores[i].score
                const halfDuration = (dueTime - creditScore.lastUpdateTime) / 2n
                
                let scoreChange = LendingPool.CREDIT_SCORE_CHANGE_BASE

                if (isDefault) {
                    scoreChange = -scoreChange * LendingPool.DEFAULT_MULTIPLIER / 100n
                    creditScore.defaultedLoans += 1n
                    creditScore.consecutiveOnTimePayments = 0n
                } else if (paymentTime > dueTime) {
                    scoreChange = -scoreChange * LendingPool.LATE_PAYMENT_MULTIPLIER / 100n
                    creditScore.consecutiveOnTimePayments = 0n
                } else if (paymentTime <= creditScore.lastUpdateTime + halfDuration) {
                    scoreChange = scoreChange * LendingPool.EARLY_PAYMENT_MULTIPLIER / 100n
                    creditScore.consecutiveOnTimePayments += 1n
                } else {
                    creditScore.consecutiveOnTimePayments += 1n
                }

                creditScore.score = creditScore.score + scoreChange
                creditScore.totalLoans += 1n
                creditScore.lastUpdateTime = this.ctx.locktime

                this.creditScores[i] = {
                    pubKey: borrower,
                    score: creditScore,
                    isActive: true
                }
                return
            }
        }
    }

    @method()
    private checkUnsecuredLoanEligibility(borrower: PubKey): boolean {
        let isEligible = false
        
        for (let i = 0; i < LendingPool.MAX_LOANS; i++) {
            if (this.creditScores[i].pubKey === borrower && this.creditScores[i].isActive) {
                const creditScore = this.creditScores[i].score
                
                const hasMinScore = creditScore.score >= LendingPool.MIN_CREDIT_SCORE_FOR_UNSECURED
                const hasPaymentHistory = creditScore.consecutiveOnTimePayments >= LendingPool.MIN_PAYMENTS_HISTORY
                const hasMinLoans = creditScore.totalLoans >= LendingPool.MIN_CLEAN_LOANS
                const noDefaults = creditScore.defaultedLoans === 0n

                isEligible = hasMinScore && hasPaymentHistory && hasMinLoans && noDefaults
            }
        }
        
        return isEligible
    }

    @method()
    private calculateUnsecuredLoanLimit(borrower: PubKey): bigint {
        let loanLimit = 0n
        
        for (let i = 0; i < LendingPool.MAX_LOANS; i++) {
            if (this.creditScores[i].pubKey === borrower && this.creditScores[i].isActive) {
                const creditScore = this.creditScores[i].score
                
                const scoreMultiplier = (creditScore.score - LendingPool.MIN_CREDIT_SCORE_FOR_UNSECURED) / 100n + 1n
                const historyMultiplier = creditScore.consecutiveOnTimePayments / 5n + 1n
                
                loanLimit = LendingPool.MIN_LOAN_AMOUNT * scoreMultiplier * historyMultiplier
                
                if (loanLimit > LendingPool.MAX_LOAN_AMOUNT) {
                    loanLimit = LendingPool.MAX_LOAN_AMOUNT
                }
            }
        }
        
        return loanLimit
    }

    @method()
    public deposit(
        slotIdx: bigint,
        depositor: PubKey,
        amount: bigint,
        sig: Sig
    ) {
        // Verify signature
        assert(this.checkSig(sig, depositor), 'Invalid depositor signature')
        
        // Validate slot index
        assert(slotIdx >= 0n && slotIdx < BigInt(LendingPool.MAX_DEPOSITS), 'Invalid slot index')
        
        // Validate deposit
        assert(amount > 0n, 'Deposit amount must be positive')
        assert(amount <= LendingPool.MAX_LOAN_AMOUNT, 'Deposit exceeds maximum allowed')
        assert(BigInt(this.ctx.utxo.value) >= amount, 'Insufficient deposit amount')

        // Initialize credit score for new depositor
        this.initializeCreditScore(depositor)

        const currentTime = this.ctx.locktime
        const interestAmount = this.calculateDepositInterest(amount)
        
        // Update deposit slot
        this.deposits[Number(slotIdx)] = {
            amount: amount,
            depositTime: currentTime,
            lockInEndTime: currentTime + (LendingPool.LOCK_IN_WEEKS * LendingPool.SECONDS_IN_DAY * LendingPool.DAYS_IN_WEEK),
            expectedInterest: interestAmount,
            withdrawn: false
        }

        // Build and verify outputs
        let outputs = this.buildStateOutput(this.ctx.utxo.value)
        outputs += this.buildChangeOutput()
        assert(hash256(outputs) == this.ctx.hashOutputs, 'Invalid outputs')
    }

    @method()
    public borrow(
        slotIdx: bigint,
        borrower: PubKey,
        amount: bigint,
        duration: bigint,
        isSecured: boolean,
        collateralAmount: bigint,
        sig: Sig
    ) {
        // Verify signature
        assert(this.checkSig(sig, borrower), 'Invalid borrower signature')
        
        // Validate slot index
        assert(slotIdx >= 0n && slotIdx < BigInt(LendingPool.MAX_LOANS), 'Invalid slot index')
        assert(this.loans[Number(slotIdx)].amount === 0n, 'Slot not empty')

        // For unsecured loans, check credit score eligibility
        if (!isSecured) {
            assert(this.checkUnsecuredLoanEligibility(borrower), 'Not eligible for unsecured loan')
            const loanLimit = this.calculateUnsecuredLoanLimit(borrower)
            assert(amount <= loanLimit, 'Amount exceeds unsecured loan limit')
        }

        // Validate loan parameters
        const validation = this.validateLoanParams(amount, duration, isSecured, collateralAmount)
        assert(validation.isValid, validation.error || 'Invalid loan parameters')

        // Check for existing loans
        for (let i = 0; i < LendingPool.MAX_LOANS; i++) {
            const loan = this.loans[i]
            if (loan.borrower === borrower && loan.amount > 0n) {
                assert(false, 'Borrower already has an active loan')
            }
        }

        // For secured loans, check deposit
        if (isSecured) {
            let foundDeposit = false
            for (let i = 0; i < LendingPool.MAX_DEPOSITS; i++) {
                const deposit = this.deposits[i]
                if (deposit.amount >= collateralAmount && !deposit.withdrawn) {
                    foundDeposit = true
                }
            }
            assert(foundDeposit, 'Insufficient deposit for collateral')
        }

        // Create loan
        const interestRate = this.calculateInterestRate(isSecured)
        this.loans[Number(slotIdx)] = {
            borrower: borrower,
            amount: amount,
            collateralAmount: collateralAmount,
            interestRate: interestRate,
            startTime: this.ctx.locktime,
            duration: duration,
            isSecured: isSecured,
            repaidAmount: 0n,
            lastPaymentTime: this.ctx.locktime
        }

        // Build outputs
        let outputs = this.buildStateOutput(this.ctx.utxo.value - amount)
        outputs += Utils.buildAddressOutput(
            pubKey2Addr(borrower),
            amount
        )
        outputs += this.buildChangeOutput()
        
        assert(hash256(outputs) == this.ctx.hashOutputs, 'Invalid outputs')
    }

    @method()
    public repay(
        slotIdx: bigint,
        borrower: PubKey,
        repaymentAmount: bigint,
        sig: Sig
    ) {
        // Verify signature
        assert(this.checkSig(sig, borrower), 'Invalid borrower signature')
        
        // Validate slot index and amount
        assert(slotIdx >= 0n && slotIdx < BigInt(LendingPool.MAX_LOANS), 'Invalid slot index')
        assert(repaymentAmount > 0n, 'Repayment amount must be positive')

        const loan = this.loans[Number(slotIdx)]
        const totalDue = this.calculateTotalDue(loan)
        const newRepaidAmount = loan.repaidAmount + repaymentAmount
        const isFullRepayment = newRepaidAmount >= totalDue

        // Update credit score
        this.updateCreditScore(
            borrower,
            this.ctx.locktime,
            loan.startTime + loan.duration,
            false
        )

        if (isFullRepayment) {
            // Clear loan slot
            this.loans[Number(slotIdx)] = {
                borrower: PubKey(toByteString('0000000000000000000000000000000000000000')),
                amount: 0n,
                collateralAmount: 0n,
                interestRate: 0n,
                startTime: 0n,
                duration: 0n,
                isSecured: false,
                repaidAmount: 0n,
                lastPaymentTime: 0n
            }

            if (loan.isSecured) {
                let outputs = this.buildStateOutput(this.ctx.utxo.value - loan.collateralAmount)
                outputs += Utils.buildAddressOutput(
                    pubKey2Addr(borrower),
                    loan.collateralAmount
                )
                outputs += this.buildChangeOutput()
                assert(hash256(outputs) == this.ctx.hashOutputs, 'Invalid outputs')
            }
        } else {
            // Update loan for partial repayment
            this.loans[Number(slotIdx)] = {
                borrower: loan.borrower,
                amount: loan.amount,
                collateralAmount: loan.collateralAmount,
                interestRate: loan.interestRate,
                startTime: loan.startTime,
                duration: loan.duration,
                isSecured: loan.isSecured,
                repaidAmount: newRepaidAmount,
                lastPaymentTime: this.ctx.locktime
            }
            
            let outputs = this.buildStateOutput(this.ctx.utxo.value)
            outputs += this.buildChangeOutput()
            assert(hash256(outputs) == this.ctx.hashOutputs, 'Invalid outputs')
        }

        assert(true, 'Repayment successful');
    }

    @method()
    public liquidate(
        slotIdx: bigint,
        sig: Sig
    ) {
        // 
        assert(this.checkSig(sig, this.owner), 'Only owner can liquidate')
        
        // Validate slot index
        assert(slotIdx >= 0n && slotIdx < BigInt(LendingPool.MAX_LOANS), 'Invalid slot index')


        const loan = this.loans[Number(slotIdx)]
        assert(loan.amount > 0n, 'No active loan found')

        // Update credit score for default
        this.updateCreditScore(
            loan.borrower,
            this.ctx.locktime,
            loan.startTime + loan.duration,
            true
        )

        const currentTime = this.ctx.locktime
        const dueTime = loan.startTime + loan.duration
        assert(currentTime > dueTime, 'Loan not past due')

        // Calculate remaining amount due
        const totalDue = this.calculateTotalDue(loan)
        const remainingDue = totalDue - loan.repaidAmount

        let outputs: ByteString = toByteString('')
        if (loan.isSecured) {
            // For secured loans, distribute collateral
            const collateralValue = loan.collateralAmount

            // Clear loan slot
            this.loans[Number(slotIdx)] = {
                borrower: PubKey(toByteString('0000000000000000000000000000000000000000')),
                amount: 0n,
                collateralAmount: 0n,
                interestRate: 0n,
                startTime: 0n,
                duration: 0n,
                isSecured: false,
                repaidAmount: 0n,
                lastPaymentTime: 0n
            }

            // Build outputs for collateral distribution
            outputs = this.buildStateOutput(this.ctx.utxo.value - collateralValue)
            outputs += Utils.buildAddressOutput(
                pubKey2Addr(this.owner),
                collateralValue
            )
        } else {
            // For unsecured loans, just clear the loan
            this.loans[Number(slotIdx)] = {
                borrower: PubKey(toByteString('0000000000000000000000000000000000000000')),
                amount: 0n,
                collateralAmount: 0n,
                interestRate: 0n,
                startTime: 0n,
                duration: 0n,
                isSecured: false,
                repaidAmount: 0n,
                lastPaymentTime: 0n
            }

            outputs = this.buildStateOutput(this.ctx.utxo.value)
        }

        outputs += this.buildChangeOutput()
        assert(hash256(outputs) == this.ctx.hashOutputs, 'Invalid outputs')
    }

    @method()
    private calculateDepositInterest(amount: bigint): bigint {
        return (amount * LendingPool.DEPOSIT_APY_MULTIPLIER * LendingPool.LOCK_IN_WEEKS) / 
               (LendingPool.WEEKS_IN_YEAR * 100n)
    }

    @method()
    private calculateInterestRate(isSecured: boolean): bigint {
        return isSecured ? LendingPool.BASE_INTEREST_RATE_SECURED : LendingPool.BASE_INTEREST_RATE_UNSECURED
    }

    @method()
    private calculateTotalDue(loan: LoanData): bigint {
        const currentTime = this.ctx.locktime
        const duration = currentTime - loan.startTime
        const interest = (loan.amount * loan.interestRate * duration) / 
                        (365n * LendingPool.SECONDS_IN_DAY * 10000n)
        
        let result: bigint = loan.amount + interest
        
        if (currentTime > loan.startTime + loan.duration) {
            const daysLate = (currentTime - (loan.startTime + loan.duration)) / LendingPool.SECONDS_IN_DAY
            const penaltyDays = daysLate > 7n ? 7n : daysLate
            const penalty = (loan.amount * LendingPool.DAILY_PENALTY_BPS * penaltyDays) / 10000n
            result = loan.amount + interest + penalty
        }
        
        return result
    }

    @method()
    private validateLoanParams(
        amount: bigint,
        duration: bigint,
        isSecured: boolean,
        collateralAmount: bigint
    ): ValidationResult {
        let isValid = true
        let error: ByteString = toByteString('')
        
        if (amount < LendingPool.MIN_LOAN_AMOUNT) {
            isValid = false
            error = toByteString('00') // Loan amount too small
        }

        if (amount > LendingPool.MAX_LOAN_AMOUNT) {
            isValid = false
            error = toByteString('01') // Loan amount too large
        }

        if (duration < LendingPool.MIN_DURATION_WEEKS * LendingPool.DAYS_IN_WEEK * LendingPool.SECONDS_IN_DAY) {
            isValid = false
            error = toByteString('02') // Duration too short
        }

        if (isSecured && collateralAmount < (amount * LendingPool.COLLATERAL_RATIO) / 100n) {
            isValid = false
            error = toByteString('03') // Insufficient collateral
        }

        return { isValid, error }
    }

    @method()
    public distributeRewards(
        slotIdx: bigint,
        borrower: PubKey,
        sig: Sig
    ) {
        // Verify signature
        assert(this.checkSig(sig, borrower), 'Invalid signature')
        
        // Validate slot index
        assert(slotIdx >= 0n && slotIdx < BigInt(LendingPool.MAX_LOANS), 'Invalid slot index')

        // Get loan
        const loan = this.loans[Number(slotIdx)]
        assert(loan.amount > 0n, 'No active loan found')
        assert(loan.borrower === borrower, 'Invalid borrower')

        // Calculate reward
        const currentTime = this.ctx.locktime
        const dueTime = loan.startTime + loan.duration
        const reward = this.calculateReward(
            loan.amount,
            currentTime,
            dueTime,
            loan.repaidAmount >= this.calculateTotalDue(loan)
        )

        // Build outputs with reward distribution
        let outputs = this.buildStateOutput(this.ctx.utxo.value - reward)
        outputs += Utils.buildAddressOutput(
            pubKey2Addr(borrower),
            reward
        )
        outputs += this.buildChangeOutput()
        
        assert(hash256(outputs) == this.ctx.hashOutputs, 'Invalid outputs')
    }

    @method()
    private calculateReward(
        loanAmount: bigint,
        paymentTime: bigint,
        dueTime: bigint,
        isFullRepayment: boolean
    ): bigint {
        // Early payment bonus: up to 50% extra rewards
        const timeBonus = dueTime > paymentTime ? 
            (((dueTime - paymentTime) * 50n) / (7n * 24n * 3600n)) : 0n

        // Full payment bonus: 25% extra
        const fullPaymentBonus: bigint = isFullRepayment ? 25n : 0n

        // Calculate total bonus
        const totalBonus = 100n + timeBonus + fullPaymentBonus

        // Calculate base reward
        let reward = (loanAmount * this.baseRewardRate * totalBonus) / 10000n

        // Cap reward at maximum
        if (reward > LendingPool.MAX_REWARD_PER_PAYMENT) {
            reward = LendingPool.MAX_REWARD_PER_PAYMENT
        }

        return reward
    }
}

