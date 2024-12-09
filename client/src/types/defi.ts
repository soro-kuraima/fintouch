// src/types/defi.ts
export interface Loan {
    id: number;
    amount: number;
    collateral: number;
    duration: number;
    startDate: Date;
    dueDate: Date;
    interestRate: number;
    repaidAmount: number;
    status: 'active' | 'repaid' | 'defaulted';
  }
  
  export interface Deposit {
    id: number;
    amount: number;
    date: Date;
    earnedInterest: number;
  }
  
  export interface CreditScore {
    score: number;
    history: Array<{
      date: string;
      score: number;
    }>;
  }