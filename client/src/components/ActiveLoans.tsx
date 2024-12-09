import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from "@/components/ui/table";
  import { Button } from "@/components/ui/button";
  import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
  } from "@/components/ui/card";
  import { Input } from "@/components/ui/input";
  import { useState } from "react";
  import type { Loan } from "@/services/LendingPoolService";
  
  interface ActiveLoansProps {
    loans: Loan[];
    onRepay: (loanId: string, amount: bigint) => Promise<string>;
    loading: boolean;
  }
  
  export const ActiveLoans: React.FC<ActiveLoansProps> = ({ loans, onRepay, loading }) => {
    const [repayAmounts, setRepayAmounts] = useState<Record<string, string>>({});
  
    const handleRepay = async (loanId: string) => {
      const amount = repayAmounts[loanId];
      if (!amount) return;
  
      try {
        await onRepay(loanId, BigInt(Math.floor(Number(amount) * 100000000)));
        setRepayAmounts(prev => ({
          ...prev,
          [loanId]: ""
        }));
      } catch (error) {
        console.error('Repayment failed:', error);
      }
    };
  
    return (
      <Card>
        <CardHeader>
          <CardTitle>Active Loans</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Amount</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Repaid</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loans.map((loan) => (
                <TableRow key={loan.id}>
                  <TableCell>
                            {(Number(BigInt(loan.amount)) / 100000000).toFixed(8)} tFB
                        </TableCell>
                        
                  <TableCell>{loan.duration} weeks</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      loan.status === 'active' ? 'bg-green-100 text-green-800' :
                      loan.status === 'repaid' ? 'bg-blue-100 text-blue-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {loan.status}
                    </span>
                  </TableCell>
                  <TableCell>
                            {(Number(BigInt(loan.repaidAmount)) / 100000000).toFixed(8)} tFB
                        </TableCell>
                  <TableCell>
                    {loan.status === 'active' && (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          step="0.00000001"
                          value={repayAmounts[loan.id] || ""}
                          onChange={(e) => setRepayAmounts(prev => ({
                            ...prev,
                            [loan.id]: e.target.value
                          }))}
                          placeholder="Amount"
                          className="w-32"
                        />
                        <Button
                          size="sm"
                          onClick={() => handleRepay(loan.id)}
                          disabled={loading || !repayAmounts[loan.id]}
                        >
                          Repay
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  };