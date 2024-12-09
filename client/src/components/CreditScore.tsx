import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { CreditScoreData } from "@/services/LendingPoolService";

interface CreditScoreProps {
  creditScore: CreditScoreData | null;
  loading: boolean;
}

export const CreditScore: React.FC<CreditScoreProps> = ({ creditScore, loading }) => {
  if (loading) return <div>Loading credit score...</div>;
  if (!creditScore) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Credit Score</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">Score: {creditScore.score}</span>
              <span className="text-sm text-muted-foreground">1000</span>
            </div>
            <Progress value={(creditScore.score / 1000) * 100} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium">Consecutive Payments</p>
              <p className="text-2xl font-bold">{creditScore.consecutiveOnTimePayments}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Total Loans</p>
              <p className="text-2xl font-bold">{creditScore.totalLoans}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};