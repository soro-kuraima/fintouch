// /services/LendingPoolService.ts

import { config } from "@/lib/config";
import { GetInscriptionsAPIResponse, Inscription } from "@/types/fractal";

type CollateralType = 'fractal' | 'ordinal' | 'rune';
type Network = 'fractal-testnet' | 'fractal-mainnet';

interface CreditScoreData {
    score: number;
    consecutiveOnTimePayments: number;
    totalLoans: number;
    defaultedLoans: number;
    lastUpdateTime: number;
    publicKey: string;
}

interface Deposit {
    id: string;
    amount: bigint;
    depositTime: number;
    lockInEndTime: number;
    expectedInterest: bigint;
    withdrawn: boolean;
}

interface Loan {
    id: string;
    borrower: string;
    amount: bigint;
    collateralAmount: bigint;
    interestRate: bigint;
    startTime: number;
    duration: number;
    isSecured: boolean;
    repaidAmount: bigint;
    lastPaymentTime: number;
    collateralType: CollateralType;
    status: 'active' | 'repaid' | 'defaulted';
}

interface InscriptionData {
    p: string;        // protocol
    op: string;       // operation type
    pk?: string;      // public key
    cs?: CreditScoreData;
    amt?: string;     // amount
    dur?: number;     // duration
    col?: string;     // collateral amount
    colType?: CollateralType;
    loan?: string;    // loan id for repayments
    ts: number;       // timestamp
}

export class LendingPoolService {

    // Constants
    private static readonly API_BASE_URL = 'https://open-api-fractal.unisat.io';

    private static readonly CONSTANTS = {
        // Protocol
        PROTOCOL_ID: 'ftp', // fintouch protocol
        NETWORK: 'fractal-testnet' as Network,

        // Time constants
        MIN_DURATION_WEEKS: 1,
        MAX_DURATION_WEEKS: 8,
        SECONDS_IN_DAY: 86400,
        WEEKS_IN_YEAR: 52,

        // Financial constants
        DAILY_PENALTY_BPS: 100, // 1%
        DEPOSIT_APY_BPS: 900,  // 9%
        BASE_INTEREST_RATE_SECURED: 1000, // 10%
        BASE_INTEREST_RATE_UNSECURED: 1500, // 15%
        COLLATERAL_RATIO: 150, // 150%

        // Credit score constants
        INITIAL_CREDIT_SCORE: 400,
        MIN_CREDIT_SCORE_FOR_UNSECURED: 550,
        EARLY_PAYMENT_MULTIPLIER: 130,
        LATE_PAYMENT_MULTIPLIER: 120,
        DEFAULT_MULTIPLIER: 130,
        CREDIT_SCORE_CHANGE_BASE: 10,
        MIN_PAYMENTS_HISTORY: 5,
        MIN_CLEAN_LOANS: 3,

        // Fractal testnet limits
        MIN_FRACTAL: 1000n, // 1k sats
        MAX_FRACTAL: 100000000n, // 1 tFB
    };

    // Network validation
    private static async validateNetwork(): Promise<void> {
        const network = await window.unisat.getNetwork();
        if (network !== this.CONSTANTS.NETWORK) {
            throw new Error(`Please switch to ${this.CONSTANTS.NETWORK}`);
        }
    }

    // Credit Score Management
    static async initializeCreditScore(publicKey: string): Promise<string> {
        await this.validateNetwork();

        const creditScoreData: CreditScoreData = {
            score: this.CONSTANTS.INITIAL_CREDIT_SCORE,
            consecutiveOnTimePayments: 0,
            totalLoans: 0,
            defaultedLoans: 0,
            lastUpdateTime: Date.now(),
            publicKey
        };

        const inscriptionData: InscriptionData = {
            p: this.CONSTANTS.PROTOCOL_ID,
            op: 'init_credit',
            pk: publicKey,
            cs: creditScoreData,
            ts: Date.now()
        };

        const inscriptionHex = Buffer.from(JSON.stringify(inscriptionData)).toString('hex');
        return await window.unisat.inscribe({
            content: inscriptionHex,
            contentType: 'text/plain',
        });
    }

    static async deposit(publicKey: string, amount: bigint): Promise<string> {
        await this.validateNetwork();

        if (amount < this.CONSTANTS.MIN_FRACTAL || amount > this.CONSTANTS.MAX_FRACTAL) {
            throw new Error('Invalid deposit amount for Fractal testnet');
        }

        const inscriptionData: InscriptionData = {
            p: this.CONSTANTS.PROTOCOL_ID,
            op: 'deposit',
            pk: publicKey,
            amt: amount.toString(),
            ts: Date.now()
        };

        const inscriptionHex = Buffer.from(JSON.stringify(inscriptionData)).toString('hex');
        return await window.unisat.inscribe({
            content: inscriptionHex,
            contentType: 'text/plain',
        });
    }

    static async createLoan(
        borrower: string,
        amount: bigint,
        duration: number,
        collateralAmount: bigint
    ): Promise<string> {
        await this.validateNetwork();

        // Validate loan parameters for Fractal testnet
        if (amount < this.CONSTANTS.MIN_FRACTAL || amount > this.CONSTANTS.MAX_FRACTAL) {
            throw new Error('Invalid loan amount for Fractal testnet');
        }

        const isSecured = collateralAmount > 0n;
        
        if (isSecured) {
            // Check if collateral meets requirements
            if (collateralAmount < (amount * BigInt(this.CONSTANTS.COLLATERAL_RATIO)) / 100n) {
                throw new Error('Insufficient collateral');
            }
        } else {
            // Check credit score for unsecured loan
            const creditScore = await this.fetchCreditScore(borrower);
            if (!creditScore || !this.isEligibleForUnsecured(creditScore)) {
                throw new Error('Not eligible for unsecured loan');
            }
        }

        const inscriptionData: InscriptionData = {
            p: this.CONSTANTS.PROTOCOL_ID,
            op: 'loan',
            pk: borrower,
            amt: amount.toString(),
            dur: duration,
            col: collateralAmount.toString(),
            colType: 'fractal',
            ts: Date.now()
        };

        const inscriptionHex = Buffer.from(JSON.stringify(inscriptionData)).toString('hex');
        return await window.unisat.inscribe({
            content: inscriptionHex,
            contentType: 'text/plain',
        });
    }

    static async repayLoan(
        loanId: string,
        borrower: string,
        amount: bigint
    ): Promise<string> {
        await this.validateNetwork();

        const inscriptionData: InscriptionData = {
            p: this.CONSTANTS.PROTOCOL_ID,
            op: 'repay',
            pk: borrower,
            loan: loanId,
            amt: amount.toString(),
            ts: Date.now()
        };

        const inscriptionHex = Buffer.from(JSON.stringify(inscriptionData)).toString('hex');
        return await window.unisat.inscribe({
            content: inscriptionHex,
            contentType: 'text/plain',
        });
    }

    // Credit Score Calculations
    static async updateCreditScore(
        publicKey: string,
        paymentTime: number,
        dueTime: number,
        isDefault: boolean
    ): Promise<string> {
        const currentScore = await this.fetchCreditScore(publicKey);
        if (!currentScore) throw new Error('Credit score not found');

        const newScore = this.calculateNewScore(currentScore, paymentTime, dueTime, isDefault);

        const inscriptionData: InscriptionData = {
            p: this.CONSTANTS.PROTOCOL_ID,
            op: 'update_credit',
            pk: publicKey,
            cs: newScore,
            ts: Date.now()
        };

        const inscriptionHex = Buffer.from(JSON.stringify(inscriptionData)).toString('hex');
        return await window.unisat.inscribe({
            content: inscriptionHex,
            contentType: 'text/plain',
        });
    }

    private static calculateNewScore(
        currentScore: CreditScoreData,
        paymentTime: number,
        dueTime: number,
        isDefault: boolean
    ): CreditScoreData {
        const halfDuration = (dueTime - currentScore.lastUpdateTime) / 2;
        let scoreChange = this.CONSTANTS.CREDIT_SCORE_CHANGE_BASE;
        
        const newScore = { ...currentScore };

        if (isDefault) {
            scoreChange = -scoreChange * this.CONSTANTS.DEFAULT_MULTIPLIER / 100;
            newScore.defaultedLoans++;
            newScore.consecutiveOnTimePayments = 0;
        } else if (paymentTime > dueTime) {
            scoreChange = -scoreChange * this.CONSTANTS.LATE_PAYMENT_MULTIPLIER / 100;
            newScore.consecutiveOnTimePayments = 0;
        } else if (paymentTime <= currentScore.lastUpdateTime + halfDuration) {
            scoreChange = scoreChange * this.CONSTANTS.EARLY_PAYMENT_MULTIPLIER / 100;
            newScore.consecutiveOnTimePayments++;
        } else {
            newScore.consecutiveOnTimePayments++;
        }

        newScore.score = Math.max(0, Math.min(1000, currentScore.score + scoreChange));
        newScore.totalLoans++;
        newScore.lastUpdateTime = Date.now();

        return newScore;
    }

   
    private static async fetchInscriptions(address: string): Promise<Inscription[]> {
      try {
          const response = await fetch(
              `${this.API_BASE_URL}/v1/indexer/address/${address}/inscription-data?cursor=0&size=100`,
              {
                  method: 'GET',
                  headers: {
                      'Accept': 'application/json',
                      'Authorization': `Bearer 49fb7c7047322a546ebc6c11aa9e6456a9752c2d492cf4f61f7f0c524316230a`,
                  }
              }
          );
  
          if (!response.ok) {
              console.log(response);
              throw new Error(`API Error: ${response.statusText}`);
          }
  
          const data: GetInscriptionsAPIResponse = await response.json();
          return data.data.inscription;
      } catch (error) {
          console.error('Error fetching inscriptions:', error);
          throw error;
      }
  }
  // Parse inscription content
  private static async fetchInscriptionContent(inscriptionId: string): Promise<any> {
      try {
          const response = await fetch(
              `${this.API_BASE_URL}/indexer/inscription/${inscriptionId}/content`,
              {
                  method: 'GET',
                  headers: {
                      'Accept': 'application/json',
                  },
              }
          );

          if (!response.ok) {
              throw new Error(`API Error: ${response.statusText}`);
          }

          const content = await response.text();
          return JSON.parse(content);
      } catch (error) {
          console.error('Error fetching inscription content:', error);
          throw error;
      }
  }

  // Updated credit score fetching
  static async fetchCreditScore(publicKey: string): Promise<CreditScoreData | null> {
      await this.validateNetwork();
      
      try {
          const inscriptions = await this.fetchInscriptions(publicKey);
          
          // Filter for credit score inscriptions
          const creditScoreInscriptions = inscriptions.filter(inscription => 
              inscription.contentType === 'text/plain'
          );

          // Fetch and parse content for each inscription
          const creditScores = await Promise.all(
              creditScoreInscriptions.map(async inscription => {
                  try {
                      const content = await this.fetchInscriptionContent(inscription.inscriptionId);
                      if (
                          content.p === this.CONSTANTS.PROTOCOL_ID && 
                          content.pk === publicKey &&
                          (content.op === 'init_credit' || content.op === 'update_credit')
                      ) {
                          return {
                              content: content.cs,
                              timestamp: inscription.timestamp
                          };
                      }
                      return null;
                  } catch {
                      return null;
                  }
              })
          );

          // Get the latest valid credit score
          const validScores = creditScores.filter(score => score !== null);
          if (validScores.length === 0) return null;

          validScores.sort((a, b) => b!.timestamp - a!.timestamp);
          return validScores[0]!.content;
      } catch (error) {
          console.error('Error fetching credit score:', error);
          throw error;
      }
  }

  // Fetch loan data
  static async fetchLoan(loanId: string): Promise<Loan | null> {
      try {
          const content = await this.fetchInscriptionContent(loanId);
          if (content.p === this.CONSTANTS.PROTOCOL_ID && content.op === 'loan') {
              return {
                  id: loanId,
                  borrower: content.pk,
                  amount: BigInt(content.amt),
                  collateralAmount: BigInt(content.col || '0'),
                  interestRate: BigInt(content.rate || '0'),
                  startTime: content.ts,
                  duration: content.dur,
                  isSecured: BigInt(content.col || '0') > 0n,
                  repaidAmount: 0n,
                  lastPaymentTime: content.ts,
                  collateralType: 'fractal',
                  status: 'active'
              };
          }
          return null;
      } catch (error) {
          console.error('Error fetching loan:', error);
          throw error;
      }
  }

  // Fetch user's loans
  static async fetchUserLoans(publicKey: string): Promise<Loan[]> {
      try {
          const inscriptions = await this.fetchInscriptions(publicKey);
          const loans: Loan[] = [];

          for (const inscription of inscriptions) {
              if (inscription.contentType === 'text/plain') {
                  try {
                      const content = await this.fetchInscriptionContent(inscription.inscriptionId);
                      if (content.p === this.CONSTANTS.PROTOCOL_ID && content.op === 'loan' && content.pk === publicKey) {
                          loans.push({
                              id: inscription.inscriptionId,
                              borrower: publicKey,
                              amount: BigInt(content.amt),
                              collateralAmount: BigInt(content.col || '0'),
                              interestRate: BigInt(content.rate || '0'),
                              startTime: content.ts,
                              duration: content.dur,
                              isSecured: BigInt(content.col || '0') > 0n,
                              repaidAmount: 0n,
                              lastPaymentTime: content.ts,
                              collateralType: 'fractal',
                              status: 'active'
                          });
                      }
                  } catch {
                      continue;
                  }
              }
          }

          // Also fetch repayments to update loan status
          const repayments = await this.fetchRepayments(publicKey);
          return this.updateLoansWithRepayments(loans, repayments);
      } catch (error) {
          console.error('Error fetching user loans:', error);
          throw error;
      }
  }

  // Fetch repayments
  private static async fetchRepayments(publicKey: string): Promise<any[]> {
      const inscriptions = await this.fetchInscriptions(publicKey);
      const repayments: any[] = [];

      for (const inscription of inscriptions) {
          if (inscription.contentType === 'text/plain') {
              try {
                  const content = await this.fetchInscriptionContent(inscription.inscriptionId);
                  if (content.p === this.CONSTANTS.PROTOCOL_ID && content.op === 'repay') {
                      repayments.push({
                          loanId: content.loan,
                          amount: BigInt(content.amt),
                          timestamp: content.ts
                      });
                  }
              } catch {
                  continue;
              }
          }
      }

      return repayments;
  }

  // Update loans with repayment information
  private static updateLoansWithRepayments(loans: Loan[], repayments: any[]): Loan[] {
      return loans.map(loan => {
          const loanRepayments = repayments.filter(r => r.loanId === loan.id);
          const totalRepaid = loanRepayments.reduce((sum, r) => sum + r.amount, 0n);
          const lastPayment = loanRepayments.sort((a, b) => b.timestamp - a.timestamp)[0];

          return {
              ...loan,
              repaidAmount: totalRepaid,
              lastPaymentTime: lastPayment ? lastPayment.timestamp : loan.lastPaymentTime,
              status: this.calculateLoanStatus(loan, totalRepaid)
          };
      });
  }

  private static calculateLoanStatus(loan: Loan, totalRepaid: bigint): 'active' | 'repaid' | 'defaulted' {
      const totalDue = this.calculateTotalDue(loan);
      if (totalRepaid >= totalDue) return 'repaid';
      if (Date.now() > loan.startTime + (loan.duration * 7 * 24 * 60 * 60 * 1000)) return 'defaulted';
      return 'active';
  }

  // Add this method to your LendingPoolService class

private static calculateTotalDue(loan: Loan): bigint {
  const currentTime = Date.now();
  const duration = (currentTime - loan.startTime) / 1000; // Convert to seconds
  
  // Calculate base interest
  const interest = (loan.amount * loan.interestRate * BigInt(duration)) / 
                  (365n * BigInt(this.CONSTANTS.SECONDS_IN_DAY) * 10000n);
  
  let penalty = 0n;
  const dueTime = loan.startTime + (loan.duration * 7 * this.CONSTANTS.SECONDS_IN_DAY * 1000);
  
  // Calculate penalty if payment is late
  if (currentTime > dueTime) {
      const daysLate = Math.min(
          7, 
          Math.floor((currentTime - dueTime) / (this.CONSTANTS.SECONDS_IN_DAY * 1000))
      );
      penalty = (loan.amount * BigInt(this.CONSTANTS.DAILY_PENALTY_BPS) * BigInt(daysLate)) / 10000n;
  }
  
  return loan.amount + interest + penalty;
}

// Helper method to calculate APR interest
private static calculateInterest(
  principal: bigint,
  rateInBps: bigint,
  timeInSeconds: bigint
): bigint {
  return (principal * rateInBps * timeInSeconds) / 
         (365n * BigInt(this.CONSTANTS.SECONDS_IN_DAY) * 10000n);
}

    private static isEligibleForUnsecured(creditScore: CreditScoreData): boolean {
        return (
            creditScore.score >= this.CONSTANTS.MIN_CREDIT_SCORE_FOR_UNSECURED &&
            creditScore.consecutiveOnTimePayments >= this.CONSTANTS.MIN_PAYMENTS_HISTORY &&
            creditScore.totalLoans >= this.CONSTANTS.MIN_CLEAN_LOANS &&
            creditScore.defaultedLoans === 0
        );
    }
}

export type { Loan, CreditScoreData, Deposit, InscriptionData };