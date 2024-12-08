import { expect, use } from 'chai'
import { LendingPool } from '../src/contracts/contracts'
import { getDefaultSigner } from './utils/txHelper'
import { PubKey, toByteString, bsv, findSig, MethodCallOptions } from 'scrypt-ts'
import chaiAsPromised from 'chai-as-promised'
import { myPrivateKey } from './utils/privateKey'

use(chaiAsPromised)

describe('LendingPool', () => {
    let instance: LendingPool
    
    // Use the same private key for all roles in testing
    const ownerPrivateKey = myPrivateKey
    const ownerPublicKey = bsv.PublicKey.fromPrivateKey(ownerPrivateKey)
    const borrowerPrivateKey = myPrivateKey
    const borrowerPublicKey = bsv.PublicKey.fromPrivateKey(borrowerPrivateKey)
    const depositorPrivateKey = myPrivateKey
    const depositorPublicKey = bsv.PublicKey.fromPrivateKey(depositorPrivateKey)

    before(async () => {
        await LendingPool.loadArtifact()
        
        instance = new LendingPool(
            PubKey(toByteString(ownerPublicKey.toString())),
            PubKey(toByteString(ownerPublicKey.toString())), // rewardPool
            50n // baseRewardRate
        )
        await instance.connect(getDefaultSigner())
    })

    async function deployContract() {
        return instance.deploy(1000000) // Deploy with initial balance
    }

    describe('Deployment', () => {
        it('should deploy successfully', async () => {
            const deployTx = await deployContract()
            return expect(deployTx.id).to.not.be.empty
        })
    })

    describe('Deposits', () => {
        beforeEach(async () => {
            await deployContract()
        })

        it('should accept a valid deposit', async () => {
            const amount = 1000000n // 0.01 BSV
            const slotIdx = 0n
            
            const callContract = async () => {
                await instance.methods.deposit(
                    slotIdx,
                    PubKey(toByteString(depositorPublicKey.toString())),
                    amount,
                    (sigResps) => findSig(sigResps, depositorPublicKey),
                    {
                        pubKeyOrAddrToSign: depositorPublicKey,
                        amount: Number(amount),
                        changeAddress: await instance.signer.getDefaultAddress()
                    } as MethodCallOptions<LendingPool>
                )
            }

            await callContract()
            const deposit = instance.deposits[Number(slotIdx)]
            expect(deposit.amount).to.equal(amount)
            expect(deposit.withdrawn).to.be.false
        })

        it('should reject deposit exceeding maximum allowed', async () => {
            const amount = LendingPool.MAX_LOAN_AMOUNT + 1n
            const slotIdx = 0n
            
            const callContract = async () => {
                await instance.methods.deposit(
                    slotIdx,
                    PubKey(toByteString(depositorPublicKey.toString())),
                    amount,
                    (sigResps) => findSig(sigResps, depositorPublicKey),
                    {
                        pubKeyOrAddrToSign: depositorPublicKey,
                        amount: Number(amount),
                        changeAddress: await instance.signer.getDefaultAddress()
                    } as MethodCallOptions<LendingPool>
                )
            }
            await expect(callContract()).to.be.rejected
        })

        it('should reject invalid slot index', async () => {
            const amount = 1000000n
            const slotIdx = 10n // Invalid index
            
            const callContract = async () => {
                await instance.methods.deposit(
                    slotIdx,
                    PubKey(toByteString(depositorPublicKey.toString())),
                    amount,
                    (sigResps) => findSig(sigResps, depositorPublicKey),
                    {
                        pubKeyOrAddrToSign: depositorPublicKey,
                        amount: Number(amount),
                        changeAddress: await instance.signer.getDefaultAddress()
                    } as MethodCallOptions<LendingPool>
                )
            }
            await expect(callContract()).to.be.rejected
        })
    })

    describe('Loans', () => {
        beforeEach(async () => {
            await deployContract()
            // Setup initial deposit
            const depositAmount = 5000000n
            const callDeposit = async () => {
                await instance.methods.deposit(
                    0n,
                    PubKey(toByteString(depositorPublicKey.toString())),
                    depositAmount,
                    (sigResps) => findSig(sigResps, depositorPublicKey),
                    {
                        pubKeyOrAddrToSign: depositorPublicKey,
                        amount: Number(depositAmount),
                        changeAddress: await instance.signer.getDefaultAddress()
                    } as MethodCallOptions<LendingPool>
                )
            }
            await callDeposit()
        })

        it('should create a valid loan', async () => {
            const amount = 1000000n
            const duration = LendingPool.MIN_DURATION_WEEKS * LendingPool.DAYS_IN_WEEK * LendingPool.SECONDS_IN_DAY
            const isSecured = true
            const collateralAmount = 1500000n
            const slotIdx = 0n
            
            const callContract = async () => {
                await instance.methods.borrow(
                    slotIdx,
                    PubKey(toByteString(borrowerPublicKey.toString())),
                    amount,
                    duration,
                    isSecured,
                    collateralAmount,
                    (sigResps) => findSig(sigResps, borrowerPublicKey),
                    {
                        pubKeyOrAddrToSign: borrowerPublicKey,
                        amount: Number(collateralAmount),
                        changeAddress: await instance.signer.getDefaultAddress()
                    } as MethodCallOptions<LendingPool>
                )
            }

            await callContract()
            const loan = instance.loans[Number(slotIdx)]
            expect(loan.amount).to.equal(amount)
            expect(loan.isSecured).to.be.true
        })

        // ... other loan tests with similar updates ...
    })

    describe('Repayments', () => {
        let loanSlotIdx: bigint
        let loanAmount: bigint

        beforeEach(async () => {
            await deployContract()
            // Setup initial deposit and loan
            const depositAmount = 5000000n
            const callDeposit = async () => {
                await instance.methods.deposit(
                    0n,
                    PubKey(toByteString(depositorPublicKey.toString())),
                    depositAmount,
                    (sigResps) => findSig(sigResps, depositorPublicKey),
                    {
                        pubKeyOrAddrToSign: depositorPublicKey,
                        amount: Number(depositAmount),
                        changeAddress: await instance.signer.getDefaultAddress()
                    } as MethodCallOptions<LendingPool>
                )
            }
            await callDeposit()

            loanSlotIdx = 0n
            loanAmount = 1000000n
            const duration = LendingPool.MIN_DURATION_WEEKS * LendingPool.DAYS_IN_WEEK * LendingPool.SECONDS_IN_DAY
            const callBorrow = async () => {
                await instance.methods.borrow(
                    loanSlotIdx,
                    PubKey(toByteString(borrowerPublicKey.toString())),
                    loanAmount,
                    duration,
                    true,
                    1500000n,
                    (sigResps) => findSig(sigResps, borrowerPublicKey),
                    {
                        pubKeyOrAddrToSign: borrowerPublicKey,
                        amount: 1500000,
                        changeAddress: await instance.signer.getDefaultAddress()
                    } as MethodCallOptions<LendingPool>
                )
            }
            await callBorrow()
        })

        it('should accept valid repayment', async () => {
            const repaymentAmount = loanAmount + 100000n // Principal + interest
            
            const callContract = async () => {
                await instance.methods.repay(
                    loanSlotIdx,
                    PubKey(toByteString(borrowerPublicKey.toString())),
                    repaymentAmount,
                    (sigResps) => findSig(sigResps, borrowerPublicKey),
                    {
                        pubKeyOrAddrToSign: borrowerPublicKey,
                        amount: Number(repaymentAmount),
                        changeAddress: await instance.signer.getDefaultAddress()
                    } as MethodCallOptions<LendingPool>
                )
            }

            await callContract()
            const loan = instance.loans[Number(loanSlotIdx)]
            expect(loan.repaidAmount).to.equal(repaymentAmount)
        })

        // ... other repayment tests with similar updates ...
    })

    describe('Withdrawals', () => {
        let depositSlotIdx: bigint
        let depositAmount: bigint

        beforeEach(async () => {
            await deployContract()
            depositSlotIdx = 0n
            depositAmount = 1000000n
            
            const callDeposit = async () => {
                await instance.methods.deposit(
                    depositSlotIdx,
                    PubKey(toByteString(depositorPublicKey.toString())),
                    depositAmount,
                    (sigResps) => findSig(sigResps, depositorPublicKey),
                    {
                        pubKeyOrAddrToSign: depositorPublicKey,
                        amount: Number(depositAmount),
                        changeAddress: await instance.signer.getDefaultAddress()
                    } as MethodCallOptions<LendingPool>
                )
            }
            await callDeposit()
        })

        it('should allow withdrawal after lock-in period', async () => {
            // Fast forward time
            const currentTime = Math.floor(Date.now() / 1000)
            const futureTime = currentTime + Number(LendingPool.LOCK_IN_WEEKS * 7n * 24n * 3600n)
            instance.ctx.locktime = BigInt(futureTime)

            const callContract = async () => {
                await instance.methods.withdrawDeposit(
                    depositSlotIdx,
                    PubKey(toByteString(depositorPublicKey.toString())),
                    (sigResps) => findSig(sigResps, depositorPublicKey),
                    {
                        pubKeyOrAddrToSign: depositorPublicKey,
                        amount: Number(depositAmount), // Include withdrawal amount
                        changeAddress: await instance.signer.getDefaultAddress()
                    } as MethodCallOptions<LendingPool>
                )
            }

            await callContract()
            const deposit = instance.deposits[Number(depositSlotIdx)]
            expect(deposit.withdrawn).to.be.true
        })

        // ... other withdrawal tests with similar updates ...
    })

    describe('Liquidation', () => {
        // ... existing liquidation setup and tests remain the same ...

        it('should reject liquidation of non-existent loan', async () => {
            const invalidSlotIdx = 5n
            
            const callContract = async () => {
                await instance.methods.liquidate(
                    invalidSlotIdx,
                    (sigResps) => findSig(sigResps, ownerPublicKey),
                    {
                        pubKeyOrAddrToSign: ownerPublicKey,
                        amount: 1500000,
                        changeAddress: await instance.signer.getDefaultAddress()
                    } as MethodCallOptions<LendingPool>
                )
            }
            await expect(callContract()).to.be.rejected
        })

        it('should reject liquidation of repaid loan', async () => {
            // Repay the loan first
            let loanSlotIdx = 0n;
            const repaymentAmount = 1100000n // Principal + interest
            await instance.methods.repay(
                loanSlotIdx,
                PubKey(toByteString(borrowerPublicKey.toString())),
                repaymentAmount,
                (sigResps) => findSig(sigResps, borrowerPublicKey),
                {
                    pubKeyOrAddrToSign: borrowerPublicKey,
                    amount: Number(repaymentAmount),
                    changeAddress: await instance.signer.getDefaultAddress()
                } as MethodCallOptions<LendingPool>
            )

            // Attempt liquidation
            const callContract = async () => {
                await instance.methods.liquidate(
                    loanSlotIdx,
                    (sigResps) => findSig(sigResps, ownerPublicKey),
                    {
                        pubKeyOrAddrToSign: ownerPublicKey,
                        amount: 1500000,
                        changeAddress: await instance.signer.getDefaultAddress()
                    } as MethodCallOptions<LendingPool>
                )
            }
            await expect(callContract()).to.be.rejected
        })

        it('should reject liquidation of active loan before duration', async () => {
            // Set time to middle of loan duration
            let loanSlotIdx = 0n;
            const loan = instance.loans[Number(loanSlotIdx)]
            const midTime = Number(loan.startTime + (loan.duration / 2n))
            instance.ctx.locktime = BigInt(midTime)

            const callContract = async () => {
                await instance.methods.liquidate(
                    loanSlotIdx,
                    (sigResps) => findSig(sigResps, ownerPublicKey),
                    {
                        pubKeyOrAddrToSign: ownerPublicKey,
                        amount: 1500000,
                        changeAddress: await instance.signer.getDefaultAddress()
                    } as MethodCallOptions<LendingPool>
                )
            }
            await expect(callContract()).to.be.rejected
        })

        it('should allow liquidation of overdue unsecured loan', async () => {
            // Create an unsecured loan first
            const unsecuredLoanSlotIdx = 1n
            const loanAmount = 1000000n
            const duration = LendingPool.MIN_DURATION_WEEKS * LendingPool.DAYS_IN_WEEK * LendingPool.SECONDS_IN_DAY
            
            await instance.methods.borrow(
                unsecuredLoanSlotIdx,
                PubKey(toByteString(borrowerPublicKey.toString())),
                loanAmount,
                duration,
                false, // unsecured
                0n,    // no collateral
                (sigResps) => findSig(sigResps, borrowerPublicKey),
                {
                    pubKeyOrAddrToSign: borrowerPublicKey,
                    amount: 0, // No collateral needed
                    changeAddress: await instance.signer.getDefaultAddress()
                } as MethodCallOptions<LendingPool>
            )

            // Fast forward time past loan duration
            const loan = instance.loans[Number(unsecuredLoanSlotIdx)]
            const futureTime = Number(loan.startTime + loan.duration + 1n)
            instance.ctx.locktime = BigInt(futureTime)

            const callContract = async () => {
                await instance.methods.liquidate(
                    unsecuredLoanSlotIdx,
                    (sigResps) => findSig(sigResps, ownerPublicKey),
                    {
                        pubKeyOrAddrToSign: ownerPublicKey,
                        amount: 0, // No collateral to claim
                        changeAddress: await instance.signer.getDefaultAddress()
                    } as MethodCallOptions<LendingPool>
                )
            }

            await callContract()
            const updatedLoan = instance.loans[Number(unsecuredLoanSlotIdx)]
            expect(updatedLoan.amount).to.equal(0n)
        })

        it('should correctly handle liquidation with partial repayment', async () => {

            // Make a partial repayment first
            const partialRepayment = 500000n
            let loanSlotIdx = 0n;
            await instance.methods.repay(
                loanSlotIdx,
                PubKey(toByteString(borrowerPublicKey.toString())),
                partialRepayment,
                (sigResps) => findSig(sigResps, borrowerPublicKey),
                {
                    pubKeyOrAddrToSign: borrowerPublicKey,
                    amount: Number(partialRepayment),
                    changeAddress: await instance.signer.getDefaultAddress()
                } as MethodCallOptions<LendingPool>
            )

            // Fast forward time past loan duration
            
            const loan = instance.loans[Number(loanSlotIdx)]
            const futureTime = Number(loan.startTime + loan.duration + 1n)
            instance.ctx.locktime = BigInt(futureTime)

            const callContract = async () => {
                await instance.methods.liquidate(
                    loanSlotIdx,
                    (sigResps) => findSig(sigResps, ownerPublicKey),
                    {
                        pubKeyOrAddrToSign: ownerPublicKey,
                        amount: 1500000, // Full collateral amount
                        changeAddress: await instance.signer.getDefaultAddress()
                    } as MethodCallOptions<LendingPool>
                )
            }

            await callContract()
            const updatedLoan = instance.loans[Number(loanSlotIdx)]
            expect(updatedLoan.amount).to.equal(0n)
            expect(updatedLoan.repaidAmount).to.equal(partialRepayment)
        })
    })

})