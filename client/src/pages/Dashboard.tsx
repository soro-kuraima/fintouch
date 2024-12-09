import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Wallet, CircleDollarSign, Activity } from "lucide-react"
import { StatsCard } from "@/components/StatsCard"
import { CreditScoreChart } from "@/components/CreditScoreChart"
import { LoanCard } from "@/components/LoanCard"
import { DepositCard } from "@/components/DepositCard"
import { DepositForm } from "@/components/DepositForm"
import { LoanForm } from "@/components/LoanForm"
import type { Loan, Deposit } from "@/types/defi"

export function Dashboard() {

    const { connected, address, connect, loading } = useUnisat();
  // State management
  const [balance, setBalance] = useState(10);
  const [creditScore, setCreditScore] = useState(400);
  const [activeLoans, setActiveLoans] = useState<Loan[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [selectedTab, setSelectedTab] = useState('overview');

  const creditScoreHistory = [
    { date: '1 Week Ago', score: 380 },
    { date: '6 Days Ago', score: 400 },
    { date: '5 Days Ago', score: 420 },
    { date: '4 Days Ago', score: 450 },
    { date: '3 Days Ago', score: 470 },
    { date: '2 Days Ago', score: 490 },
    { date: 'Today', score: creditScore }
  ];

  // Handler functions
  const handleDeposit = (amount: number) => {
    const newDeposit = {
      id: deposits.length + 1,
      amount,
      date: new Date(),
      earnedInterest: 0
    };
    setDeposits([...deposits, newDeposit]);
    setBalance(prev => prev + amount);
  };

  const handleBorrow = (amount: number, duration: number) => {
    const newLoan = {
      id: activeLoans.length + 1,
      amount,
      collateral: amount * 1.5,
      duration,
      startDate: new Date(),
      dueDate: new Date(Date.now() + duration * 7 * 24 * 60 * 60 * 1000),
      interestRate: creditScore > 550 ? 0.10 : 0.15,
      repaidAmount: 0,
      status: 'active' as const
    };
    setActiveLoans([...activeLoans, newLoan]);
    setBalance(prev => prev + amount);
  };

  if (!connected) {
    return (
      <div className="p-4">
        <button
          onClick={connect}
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          {loading ? 'Connecting...' : 'Connect UniSat Wallet'}
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-4">
      <div className="grid grid-cols-3 gap-4 mb-4">
        <StatsCard
          title="Balance"
          value={`${balance.toFixed(4)} tFB`}
          icon={Wallet}
        />
        <StatsCard
          title="Credit Score"
          value={creditScore}
          icon={Activity}
        />
        <StatsCard
          title="Total Deposits"
          value={`${deposits.reduce((acc, dep) => acc + dep.amount, 0).toFixed(4)} tFB`}
          icon={CircleDollarSign}
        />
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid grid-cols-4 gap-4 mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="deposit">Deposit</TabsTrigger>
          <TabsTrigger value="borrow">Borrow</TabsTrigger>
          <TabsTrigger value="repay">Repay</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="space-y-4">
            <CreditScoreChart data={creditScoreHistory} />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="mb-4">Active Loans</h3>
                {activeLoans.map(loan => (
                  <LoanCard key={loan.id} loan={loan} />
                ))}
              </div>
              <div>
                <h3 className="mb-4">Recent Deposits</h3>
                {deposits.map(deposit => (
                  <DepositCard key={deposit.id} deposit={deposit} />
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="deposit">
          <DepositForm onDeposit={handleDeposit} />
        </TabsContent>

        <TabsContent value="borrow">
          <LoanForm creditScore={creditScore} onBorrow={handleBorrow} />
        </TabsContent>

        <TabsContent value="repay">
          <div>
            {activeLoans.map(loan => (
              <LoanCard key={loan.id} loan={loan} onRepay={() => {}} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}