"use client";

import { useState } from "react";
import { useChitGroup } from "@/hooks/useChitGroup";
import { useWallet } from "@/hooks/useWallet";
import { formatUsdc } from "@/lib/utils";
import toast from "react-hot-toast";

interface ContributionFlowProps {
  groupId: string;
  contributionAmount: number;
  cycle: number;
  onPaid?: () => void;
}

export function ContributionFlow({ groupId, contributionAmount, cycle, onPaid }: ContributionFlowProps) {
  const { connected, address } = useWallet();
  const { pay, loading } = useChitGroup(groupId);
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
    <div className="glass-card p-6 border border-white/[0.04] animate-fade-in-up">
      <h3 className="text-xl font-bold text-slate-100 tracking-tight mb-2">Pay Cycle Contribution</h3>
      <p className="text-slate-400 text-sm mb-5 leading-relaxed">
        Submit your token contribution to the smart contract escrow for the current rotation savings cycle.
      </p>
      
      {/* Receipt Preview */}
      <div className="p-4 rounded-xl bg-slate-900/30 border border-white/[0.02] text-xs space-y-2 mb-6">
        <div className="flex justify-between text-slate-500 uppercase font-bold tracking-wider text-[10px]">
          <span>Transaction Details</span>
          <span>Escrow Target</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Contribution Amount:</span>
          <span className="font-semibold text-slate-200">{formatUsdc(contributionAmount)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Current Cycle:</span>
          <span className="font-semibold text-slate-200">Cycle {cycle}</span>
        </div>
      </div>

      {confirming ? (
        <div className="flex items-center gap-3">
          <button
            onClick={handlePay}
            disabled={loading}
            className="btn-primary flex-1 py-3"
          >
            {loading ? "Approving Smart Contract..." : "Confirm Payment"}
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="btn-secondary py-3 px-6"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button 
          onClick={() => setConfirming(true)} 
          className="btn-primary w-full py-3"
        >
          Authorize Payment of {formatUsdc(contributionAmount)}
        </button>
      )}
    </div>
  );
}
