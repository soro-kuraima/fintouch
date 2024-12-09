import { Card, CardContent } from "@/components/ui/card"
import { Deposit } from "@/types/defi"

interface DepositCardProps {
  deposit: Deposit;
}

export function DepositCard({ deposit }: DepositCardProps) {
  return (
    <div className="mb-4 p-4 border rounded">
      <div className="flex justify-between mb-2">
        <span>Amount: {deposit.amount} tFB</span>
        <span>APY: 9%</span>
      </div>
      <div className="text-sm text-muted-foreground">
        Date: {deposit.date.toLocaleDateString()}
      </div>
    </div>
  )
}