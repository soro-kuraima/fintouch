// /services/MockLendingService.ts

export interface CreditScore {
    score: number;
    consecutiveOnTimePayments: number;
    totalLoans: number;
    defaultedLoans: number;
    lastUpdateTime: number;
}

export interface Loan {
    id: string;
    borrower: string;
    amount: string;          // Changed from bigint to string
    collateralAmount: string; // Changed from bigint to string
    interestRate: string;     // Changed from bigint to string
    startTime: number;
    duration: number;
    isSecured: boolean;
    repaidAmount: string;    // Changed from bigint to string
    lastPaymentTime: number;
    status: 'active' | 'repaid' | 'defaulted';
}

export interface Deposit {
    id: string;
    amount: string;          // Changed from bigint to string
    depositTime: number;
    lockInEndTime: number;
    expectedInterest: string; // Changed from bigint to string
    withdrawn: boolean;
}

export class MockLendingService {
    private static CONSTANTS = {
        INITIAL_CREDIT_SCORE: 400,
        MIN_CREDIT_SCORE_FOR_UNSECURED: 550,
        BASE_INTEREST_RATE: '1000', // Changed from 1000n to '1000'
        DEPOSIT_APY: '900',         // Changed from 900n to '900'
    };

    private static async delay(ms: number = 1000): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    static async createLoan(params: {
        address: string;
        amount: bigint;
        duration: number;
        collateralAmount: bigint;
    }): Promise<Loan> {
        await this.delay();
        
        const loan: Loan = {
            id: `loan_${Date.now()}`,
            borrower: params.address,
            amount: params.amount.toString(),
            collateralAmount: params.collateralAmount.toString(),
            interestRate: this.CONSTANTS.BASE_INTEREST_RATE,
            startTime: Date.now(),
            duration: params.duration,
            isSecured: params.collateralAmount > 0n,
            repaidAmount: '0',
            lastPaymentTime: Date.now(),
            status: 'active'
        };

        const loans = this.getStoredLoans(params.address);
        loans.push(loan);
        localStorage.setItem(`loans_${params.address}`, JSON.stringify(loans));

        return loan;
    }

    static async repayLoan(params: {
        address: string;
        loanId: string;
        amount: bigint;
    }): Promise<Loan> {
        await this.delay();

        const loans = this.getStoredLoans(params.address);
        const loanIndex = loans.findIndex(l => l.id === params.loanId);
        if (loanIndex === -1) throw new Error('Loan not found');

        const loan = loans[loanIndex];
        const newRepaidAmount = BigInt(loan.repaidAmount) + params.amount;
        loan.repaidAmount = newRepaidAmount.toString();
        loan.lastPaymentTime = Date.now();

        // Update credit score
        const creditScore = await this.fetchCreditScore(params.address);
        creditScore.consecutiveOnTimePayments += 1;
        creditScore.score = Math.min(1000, creditScore.score + 10);
        localStorage.setItem(`creditScore_${params.address}`, JSON.stringify(creditScore));

        // Check if loan is fully repaid
        if (BigInt(loan.repaidAmount) >= BigInt(loan.amount)) {
            loan.status = 'repaid';
        }

        loans[loanIndex] = loan;
        localStorage.setItem(`loans_${params.address}`, JSON.stringify(loans));

        return loan;
    }

    static async createDeposit(params: {
        address: string;
        amount: bigint;
    }): Promise<Deposit> {
        await this.delay();

        const expectedInterest = (params.amount * BigInt(this.CONSTANTS.DEPOSIT_APY)) / 10000n;

        const deposit: Deposit = {
            id: `deposit_${Date.now()}`,
            amount: params.amount.toString(),
            depositTime: Date.now(),
            lockInEndTime: Date.now() + (8 * 7 * 24 * 60 * 60 * 1000), // 8 weeks
            expectedInterest: expectedInterest.toString(),
            withdrawn: false
        };

        const deposits = this.getStoredDeposits(params.address);
        deposits.push(deposit);
        localStorage.setItem(`deposits_${params.address}`, JSON.stringify(deposits));

        return deposit;
    }

    // ... keep other methods the same ...

    private static getStoredLoans(address: string): Loan[] {
        const stored = localStorage.getItem(`loans_${address}`);
        return stored ? JSON.parse(stored) : [];
    }

    private static getStoredDeposits(address: string): Deposit[] {
        const stored = localStorage.getItem(`deposits_${address}`);
        return stored ? JSON.parse(stored) : [];
    }
}