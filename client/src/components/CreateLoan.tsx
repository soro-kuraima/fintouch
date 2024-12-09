import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface CreateLoanProps {
  onCreateLoan: (params: { amount: bigint; duration: number; collateralAmount: bigint }) => Promise<string>;
  isEligibleForUnsecured: boolean;
  loading: boolean;
}

export const CreateLoan: React.FC<CreateLoanProps> = ({ onCreateLoan, isEligibleForUnsecured, loading }) => {
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [duration, setDuration] = useState("4");
  const [collateralAmount, setCollateralAmount] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
        const txId = await onCreateLoan({
            amount: BigInt(Math.floor(Number(amount) * 100000000)),
            duration: Number(duration),
            collateralAmount: BigInt(Math.floor(Number(collateralAmount) * 100000000))
        });
      toast({
        title: "Loan Created",
        description: `Transaction ID: ${txId}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create New Loan</CardTitle>
        <CardDescription>
          {isEligibleForUnsecured 
            ? "You're eligible for unsecured loans!"
            : "Collateral required for loans"}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Loan Amount (tFB)</Label>
            <Input
              id="amount"
              type="number"
              step="0.00000001"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00000000"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="duration">Duration (weeks)</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger>
                <SelectValue placeholder="Select duration" />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((week) => (
                  <SelectItem key={week} value={week.toString()}>
                    {week} week{week > 1 ? 's' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!isEligibleForUnsecured && (
            <div className="space-y-2">
              <Label htmlFor="collateral">Collateral Amount (tFB)</Label>
              <Input
                id="collateral"
                type="number"
                step="0.00000001"
                value={collateralAmount}
                onChange={(e) => setCollateralAmount(e.target.value)}
                placeholder="0.00000000"
              />
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={loading}>
            {loading ? "Creating Loan..." : "Create Loan"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};