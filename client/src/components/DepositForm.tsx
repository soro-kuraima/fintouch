import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { useState } from "react"

interface DepositFormProps {
  onDeposit: (amount: number) => void;
}

export function DepositForm({ onDeposit }: DepositFormProps) {
  const [amount, setAmount] = useState("");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Make a Deposit</CardTitle>
        <CardDescription>Earn 9% APY on your deposits</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <label>Amount (tFB)</label>
            <Input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <Alert>
            <AlertTitle>Estimated Returns</AlertTitle>
            <AlertDescription>
              {amount ? (
                `You will earn approximately ${(parseFloat(amount) * 0.09).toFixed(4)} tFB per year`
              ) : (
                'Enter an amount to see estimated returns'
              )}
            </AlertDescription>
          </Alert>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={() => onDeposit(parseFloat(amount))}>Deposit</Button>
      </CardFooter>
    </Card>
  )
}