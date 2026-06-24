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
      await castVote(dispute.id, support, support ? selectedDecision : "Dismiss");
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass-card p-6 max-w-lg w-full space-y-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Dispute #{dispute.id}</h2>
          <button onClick={onClose} className="text-chit-muted hover:text-chit-text">✕</button>
        </div>

        <div className={`inline-block px-2 py-1 text-xs rounded-full border ${statusColor}`}>
          {dispute.status}
        </div>

        <div className="space-y-2">
          <div>
            <p className="text-chit-muted text-xs">Raiser</p>
            <p className="font-mono text-sm text-chit-text">{shortenAddress(dispute.raiser)}</p>
          </div>
          <div>
            <p className="text-chit-muted text-xs">Cycle</p>
            <p className="text-sm text-chit-text">{dispute.cycle}</p>
          </div>
          <div>
            <p className="text-chit-muted text-xs">Reason</p>
            <p className="text-sm text-chit-text">{dispute.reason}</p>
          </div>
        </div>

        {/* Vote tallies */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-chit-success/5 border border-chit-success/20 text-center">
            <p className="text-chit-muted text-xs">In Favor</p>
            <p className="text-xl font-bold text-chit-success">{dispute.votes_for.length}</p>
            {dispute.votes_for.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {dispute.votes_for.map((v, i) => (
                  <span key={i} className="text-xs text-chit-muted font-mono">{shortenAddress(v, 4)}</span>
                ))}
              </div>
            )}
          </div>
          <div className="p-3 rounded-lg bg-chit-danger/5 border border-chit-danger/20 text-center">
            <p className="text-chit-muted text-xs">Against</p>
            <p className="text-xl font-bold text-chit-danger">{dispute.votes_against.length}</p>
            {dispute.votes_against.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {dispute.votes_against.map((v, i) => (
                  <span key={i} className="text-xs text-chit-muted font-mono">{shortenAddress(v, 4)}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Decision */}
        {dispute.decision && (
          <div className="p-3 rounded-lg bg-chit-bg border border-chit-border">
            <p className="text-chit-muted text-xs">Decision</p>
            <p className="text-chit-text font-medium">{dispute.decision}</p>
          </div>
        )}

        {/* Voting buttons – only for arbitrators on open disputes */}
        {dispute.status === "Voting" && isArbitrator && !hasVoted && (
          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <label className="text-xs text-chit-muted">Decision Action (if voting to resolve)</label>
              <select
                value={selectedDecision}
                onChange={(e) => setSelectedDecision(e.target.value as DisputeDecision)}
                className="w-full bg-chit-bg border border-chit-border rounded-lg p-2 text-sm text-chit-text focus:outline-none focus:border-stellar-500"
              >
                <option value="ForceDefault">Force Default</option>
                <option value="ReversePayout">Reverse Payout</option>
                <option value="PartialRefund">Partial Refund</option>
                <option value="Dismiss">Dismiss</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleVote(true)}
                disabled={loading}
                className="btn-primary bg-chit-success hover:bg-chit-success/80"
              >
                {loading ? "..." : "Vote For"}
              </button>
              <button
                onClick={() => handleVote(false)}
                disabled={loading}
                className="btn-danger"
              >
                {loading ? "..." : "Vote Against"}
              </button>
            </div>
          </div>
        )}

        {hasVoted && dispute.status === "Voting" && (
          <p className="text-chit-muted text-sm text-center">You have already voted on this dispute.</p>
        )}

        {!isArbitrator && dispute.status === "Voting" && (
          <p className="text-chit-muted text-sm text-center">Only arbitrators can vote.</p>
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
