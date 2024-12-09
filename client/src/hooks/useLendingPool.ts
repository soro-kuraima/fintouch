// /hooks/useLendingPool.ts
import { useState, useEffect } from 'react';
import { MockLendingService, CreditScore, Loan, Deposit } from '../services/MockLendingService';

interface UseLendingPoolState {
    creditScore: CreditScore | null;
    loans: Loan[];
    deposits: Deposit[];
    loading: boolean;
    error: string | null;
}

export const useLendingPool = (address: string | undefined) => {
    const [state, setState] = useState<UseLendingPoolState>({
        creditScore: null,
        loans: [],
        deposits: [],
        loading: false,
        error: null
    });


    const initializeCreditScore = async () => {
        if (!address) throw new Error('Address not provided');

        setState(prev => ({ ...prev, loading: true, error: null }));
        try {
            await MockLendingService.initializeCreditScore(address);
            await fetchData();
        } catch (err) {
            setState(prev => ({
                ...prev,
                loading: false,
                error: err instanceof Error ? err.message : 'Unknown error occurred'
            }));
            throw err;
        }
    };

    const checkUnsecuredLoanEligibility = async (): Promise<boolean> => {
        if (!address) return false;
        try {
            return await MockLendingService.checkUnsecuredLoanEligibility(address);
        } catch (err) {
            console.error('Error checking loan eligibility:', err);
            return false;
        }
    };


    const fetchData = async () => {
        if (!address) return;

        setState(prev => ({ ...prev, loading: true, error: null }));
        try {
            const [creditScore, loans, deposits] = await Promise.all([
                MockLendingService.fetchCreditScore(address),
                MockLendingService.getLoans(address),
                MockLendingService.getDeposits(address)
            ]);

            setState(prev => ({
                ...prev,
                creditScore,
                loans,
                deposits,
                loading: false
            }));
        } catch (err) {
            setState(prev => ({
                ...prev,
                loading: false,
                error: err instanceof Error ? err.message : 'Unknown error occurred'
            }));
        }
    };

    useEffect(() => {
        fetchData();
    }, [address]);

    const createLoan = async (
        amount: bigint,
        duration: number,
        collateralAmount: bigint = 0n
    ) => {
        if (!address) throw new Error('Address not provided');

        setState(prev => ({ ...prev, loading: true, error: null }));
        try {
            await MockLendingService.createLoan({
                address,
                amount,
                duration,
                collateralAmount
            });
            await fetchData();
        } catch (err) {
            setState(prev => ({
                ...prev,
                loading: false,
                error: err instanceof Error ? err.message : 'Unknown error occurred'
            }));
            throw err;
        }
    };

    const repayLoan = async (loanId: string, amount: bigint) => {
        if (!address) throw new Error('Address not provided');

        setState(prev => ({ ...prev, loading: true, error: null }));
        try {
            await MockLendingService.repayLoan({
                address,
                loanId,
                amount
            });
            await fetchData();
        } catch (err) {
            setState(prev => ({
                ...prev,
                loading: false,
                error: err instanceof Error ? err.message : 'Unknown error occurred'
            }));
            throw err;
        }
    };

    const createDeposit = async (amount: bigint) => {
        if (!address) throw new Error('Address not provided');

        setState(prev => ({ ...prev, loading: true, error: null }));
        try {
            await MockLendingService.createDeposit({
                address,
                amount
            });
            await fetchData();
        } catch (err) {
            setState(prev => ({
                ...prev,
                loading: false,
                error: err instanceof Error ? err.message : 'Unknown error occurred'
            }));
            throw err;
        }
    };

    // For testing purposes
    const resetAllData = () => {
        if (!address) return;
        MockLendingService.clearAllData(address);
        fetchData();
    };

    return {
        ...state,
        createLoan,
        repayLoan,
        createDeposit,
        initializeCreditScore,
        checkUnsecuredLoanEligibility,
        resetAllData,
        refresh: fetchData
    };
};