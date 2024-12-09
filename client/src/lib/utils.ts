import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


export const formatBTC = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 8,
    maximumFractionDigits: 8
  }).format(amount);
};

export const calculateTotalRepayment = (
  amount: number,
  interest: number,
  fees: number
): number => {
  return amount + interest + fees;
};