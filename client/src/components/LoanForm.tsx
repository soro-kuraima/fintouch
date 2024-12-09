import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { useState } from "react"

interface LoanFormProps {
  creditScore: number;
  onBorrow: (amount: number, duration: number) => void;
}

export function LoanForm({ creditScore, onBorrow }: LoanFormProps) {
  const [amount, setAmount] = useState("");
  const [duration, setDuration] = useState("1");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Get a Loan</CardTitle>
        <CardDescription>
          {creditScore > 550 ? 'You are eligible for uncollateralized loans!' : 'Collateral required'}
        </CardDescription>
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
          <div className="space-y-2">
            <label>Duration (weeks)</label>
            <Input
              type="number"
              min="1"
              max="8"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </div>
          <Alert>
            <AlertTitle>Loan Terms</AlertTitle>
            <AlertDescription>
              {amount ? (
                <div className="space-y-2">
                  <p>Interest Rate: {creditScore > 550 ? '10%' : '15%'} APR</p>
                  <p>Required Collateral: {(parseFloat(amount) * 1.5).toFixed(4)} tFB</p>
                  <p>Weekly Payment: {(parseFloat(amount) / parseInt(duration)).toFixed(4)} tFB</p>
                </div>
              ) : (
                'Enter loan details to see terms'
              )}
            </AlertDescription>
          </Alert>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={() => onBorrow(parseFloat(amount), parseInt(duration))}>
          Borrow
        </Button>
      </CardFooter>
    </Card>
  )
}