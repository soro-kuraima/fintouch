import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Loan } from "@/types/defi"

interface LoanCardProps {
  loan: Loan;
  onRepay?: (amount: number) => void;
}

export function LoanCard({ loan, onRepay }: LoanCardProps) {
  return (
    <div className="mb-4 p-4 border rounded">
      <div className="flex justify-between mb-2">
        <span>Amount: {loan.amount} tFB</span>
        <span>Interest: {(loan.interestRate * 100).toFixed(1)}%</span>
      </div>
      <Progress value={(loan.repaidAmount / loan.amount) * 100} className="mb-2" />
      <div className="text-sm text-muted-foreground">
        Due: {loan.dueDate.toLocaleDateString()}
      </div>
    </div>
  )
}