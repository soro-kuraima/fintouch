import { useEffect } from "react";
import { useUnisat } from "@/hooks/useUnisat";
import { useLendingPool } from "@/hooks/useLendingPool";
import { CreditScore } from "@/components/CreditScore";
import { CreateLoan } from "@/components/CreateLoan";
import { ActiveLoans } from "@/components/ActiveLoans";
import { Button } from "@/components/ui/button";

export const LendingPoolPage: React.FC = () => {
  const { connected, address: publicKey, connect } = useUnisat();
  const {
    loans,
    creditScore,
    loading,
    error,
    createLoan,
    repayLoan,
    initializeCreditScore,
    checkUnsecuredLoanEligibility
  } = useLendingPool(publicKey);

  useEffect(() => {
    if (connected && publicKey && !creditScore) {
      initializeCreditScore();
    }
  }, [connected, publicKey, creditScore]);

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Button onClick={connect} size="lg">
          Connect Wallet
        </Button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-500">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <CreditScore creditScore={creditScore} loading={loading} />
        <CreateLoan
          onCreateLoan={createLoan}
          isEligibleForUnsecured={!!creditScore && creditScore.score >= 550}
          loading={loading}
        />
      </div>
      <ActiveLoans
        loans={loans}
        onRepay={repayLoan}
        loading={loading}
      />
    </div>
  );
};