import React from 'react';
import { LoanData } from '../services/LendingPoolService';

interface LoanListProps {
  loans: LoanData[];
  onRepay: (loanId: string) => void;
}

export const LoanList: React.FC<LoanListProps> = ({ loans, onRepay }) => {
  return (
    <div className="space-y-4">
      {loans.map((loan) => (
        <div key={loan.id} className="border p-4 rounded">
          <p>Amount: {loan.amount}</p>
          <p>Duration: {loan.duration} weeks</p>
          <button
            onClick={() => onRepay(loan.id)}
            className="bg-green-500 text-white px-4 py-2 rounded"
          >
            Repay Loan
          </button>
        </div>
      ))}
    </div>
  );
};