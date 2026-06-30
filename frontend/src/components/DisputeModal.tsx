"use client";

import { useState, useCallback } from "react";
import { useWallet } from "@/hooks/useWallet";
import { castVote } from "@/lib/contracts";
import { shortenAddress } from "@/lib/utils";
import type { DisputeRecord, DisputeStatus, DisputeDecision } from "@/types";
import toast from "react-hot-toast";

interface DisputeModalProps {
  dispute: DisputeRecord;
  onClose: () => void;
  isArbitrator: boolean;
  onVoted?: () => void;
}

export default function DisputeModal({ dispute, onClose, isArbitrator, onVoted }: DisputeModalProps) {
  const { connected, address } = useWallet();
  const [loading, setLoading] = useState(false);
  const [selectedDecision, setSelectedDecision] = useState<DisputeDecision>("ForceDefault");

  const hasVoted = address ? dispute.votes_against.includes(address) || dispute.votes_for.includes(address) : false;
  const statusColor = getStatusColor(dispute.status);

  const handleVote = useCallback(async (support: boolean) => {
    if (!connected || !address) {
      toast.error("Connect wallet first");
      return;
    }

    setLoading(true);
    try {
      await castVote(address, dispute.id, support, support ? selectedDecision : "Dismiss");
      toast.success(support ? "Voted in favor" : "Voted against");
      onVoted?.();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Vote failed");
    } finally {
      setLoading(false);
    }
  }, [connected, address, dispute.id, selectedDecision, onVoted, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
      <div className="glass-card p-6 max-w-lg w-full space-y-5 max-h-[85vh] overflow-y-auto border border-white/[0.08] shadow-2xl shadow-black/80 animate-fade-in-up">
        <div className="flex items-center justify-between border-b border-white/[0.05] pb-3">
          <h2 className="text-xl font-extrabold text-slate-100 tracking-tight">Dispute Case #{dispute.id}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 transition-colors p-1.5 rounded-lg hover:bg-slate-900">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div>
          <span className={`inline-block px-3 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider ${statusColor}`}>
            {dispute.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 text-xs">
          <div className="col-span-2 p-3.5 rounded-xl bg-slate-900/30 border border-white/[0.02]">
            <p className="text-slate-500 font-bold uppercase tracking-wider text-[9px] mb-1.5">Raiser Address</p>
            <p className="font-mono text-slate-300 text-sm">{dispute.raiser}</p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-900/30 border border-white/[0.02]">
            <p className="text-slate-500 font-bold uppercase tracking-wider text-[9px] mb-1">Cycle Number</p>
            <p className="text-slate-200 text-sm font-semibold">Cycle {dispute.cycle}</p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-900/30 border border-white/[0.02]">
            <p className="text-slate-500 font-bold uppercase tracking-wider text-[9px] mb-1">Dispute Status</p>
            <p className="text-slate-200 text-sm font-semibold">{dispute.status}</p>
          </div>
          <div className="col-span-2 p-3.5 rounded-xl bg-slate-900/30 border border-white/[0.02]">
            <p className="text-slate-500 font-bold uppercase tracking-wider text-[9px] mb-1.5">Reason Submitted</p>
            <p className="text-slate-300 text-sm leading-relaxed">{dispute.reason}</p>
          </div>
        </div>

        {/* Vote tallies */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-center">
            <p className="text-slate-500 font-bold uppercase tracking-wider text-[9px] mb-1">Arbitration Votes For</p>
            <p className="text-2xl font-black text-emerald-400">{dispute.votes_for.length}</p>
            {dispute.votes_for.length > 0 && (
              <div className="mt-2.5 flex flex-col gap-1 items-center border-t border-emerald-500/10 pt-2">
                {dispute.votes_for.map((v, i) => (
                  <span key={i} className="text-[10px] text-slate-400 font-mono bg-emerald-950/20 px-2 py-0.5 rounded border border-emerald-500/10">{shortenAddress(v, 4)}</span>
                ))}
              </div>
            )}
          </div>
          <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20 text-center">
            <p className="text-slate-500 font-bold uppercase tracking-wider text-[9px] mb-1">Arbitration Votes Against</p>
            <p className="text-2xl font-black text-rose-400">{dispute.votes_against.length}</p>
            {dispute.votes_against.length > 0 && (
              <div className="mt-2.5 flex flex-col gap-1 items-center border-t border-rose-500/10 pt-2">
                {dispute.votes_against.map((v, i) => (
                  <span key={i} className="text-[10px] text-slate-400 font-mono bg-rose-950/20 px-2 py-0.5 rounded border border-rose-500/10">{shortenAddress(v, 4)}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Decision */}
        {dispute.decision && (
          <div className="p-3.5 rounded-xl bg-slate-900/40 border border-white/[0.04] text-xs">
            <p className="text-slate-500 font-bold uppercase tracking-wider text-[9px] mb-1.5">Arbitration Resolution</p>
            <p className="text-slate-200 font-semibold text-sm">{dispute.decision}</p>
          </div>
        )}

        {/* Voting buttons – only for arbitrators on open disputes */}
        {dispute.status === "Voting" && isArbitrator && !hasVoted && (
          <div className="space-y-4 pt-3 border-t border-white/[0.05]">
            <div className="space-y-2">
              <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider">
                Select Resolution Action
              </label>
              <select
                value={selectedDecision}
                onChange={(e) => setSelectedDecision(e.target.value as DisputeDecision)}
                className="w-full bg-slate-950 border border-white/[0.08] rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="ForceDefault">Force Default (Penalize Defaulting Member)</option>
                <option value="ReversePayout">Reverse Payout (Revert Payout State)</option>
                <option value="PartialRefund">Partial Refund (Return Pool Split)</option>
                <option value="Dismiss">Dismiss Case (Mark Inactive)</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleVote(true)}
                disabled={loading}
                className="btn bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-500/15"
              >
                {loading ? "Voting..." : "Vote in Favor"}
              </button>
              <button
                onClick={() => handleVote(false)}
                disabled={loading}
                className="btn bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-rose-500/15"
              >
                {loading ? "Voting..." : "Vote to Dismiss"}
              </button>
            </div>
          </div>
        )}

        {hasVoted && dispute.status === "Voting" && (
          <p className="text-slate-400 text-xs text-center font-medium bg-slate-900/30 p-3 rounded-xl border border-white/[0.02]">
            🔒 You have already cast your vote on this dispute file.
          </p>
        )}

        {!isArbitrator && dispute.status === "Voting" && (
          <p className="text-slate-500 text-xs text-center font-medium">
            ℹ️ Only authorized mult-sig arbitrators can submit votes.
          </p>
        )}
      </div>
    </div>
  );
}

function getStatusColor(status: DisputeStatus): string {
  switch (status) {
    case "Open": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    case "Voting": return "bg-purple-500/20 text-purple-400 border-purple-500/30";
    case "Resolved": return "bg-green-500/20 text-green-400 border-green-500/30";
    case "Dismissed": return "bg-gray-500/20 text-gray-400 border-gray-500/30";
  }
}
