"use client";

import { useState } from "react";
import { useChitGroup } from "@/hooks/useChitGroup";
import { useWallet } from "@/hooks/useWallet";
import { formatUsdc } from "@/lib/utils";
import toast from "react-hot-toast";

interface ContributionFlowProps {
  contributionAmount: number;
  cycle: number;
  onPaid?: () => void;
}

export function ContributionFlow({ contributionAmount, cycle, onPaid }: ContributionFlowProps) {
  const { connected, address } = useWallet();
  const { pay, loading } = useChitGroup();
  const [confirming, setConfirming] = useState(false);

  const handlePay = async () => {
    if (!connected) {
      toast.error("Connect wallet first");
      return;
    }
    setConfirming(true);
    try {
      await pay();
      toast.success(`Contribution of ${formatUsdc(contributionAmount)} paid for cycle ${cycle}`);
      onPaid?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="glass-card p-6">
      <h3 className="text-lg font-semibold mb-4">Pay Contribution — Cycle {cycle}</h3>
      <p className="text-chit-muted text-sm mb-4">
        Send your contribution of <span className="text-chit-text font-bold">{formatUsdc(contributionAmount)}</span> USDC to the group pool.
      </p>
      {confirming ? (
        <div className="flex items-center gap-3">
          <button
            onClick={handlePay}
            disabled={loading}
            className="btn-primary flex-1"
          >
            {loading ? "Confirming..." : "Confirm Payment"}
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="btn-secondary"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button onClick={() => setConfirming(true)} className="btn-primary w-full">
          Pay {formatUsdc(contributionAmount)}
        </button>
      )}
    </div>
  );
}
