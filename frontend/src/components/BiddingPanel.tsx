"use client";

import { useState, useCallback } from "react";
import { useWallet } from "@/hooks/useWallet";
import { commitBid, revealBid } from "@/lib/contracts";
import { computeCommitment } from "@/lib/utils";
import toast from "react-hot-toast";

interface BiddingPanelProps {
  groupId: string;
  cycle: number;
  minReputation: number;
  hasCommitment: boolean;
  onBidCommitted?: () => void;
  onBidRevealed?: () => void;
}

export default function BiddingPanel({
  groupId,
  cycle,
  minReputation,
  hasCommitment,
  onBidCommitted,
  onBidRevealed,
}: BiddingPanelProps) {
  const { connected, address } = useWallet();
  const [bidAmount, setBidAmount] = useState("");
  const [committing, setCommitting] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [phase, setPhase] = useState<"input" | "committed" | "revealed">(
    hasCommitment ? "committed" : "input"
  );
  const [savedNonce, setSavedNonce] = useState<number | null>(null);
  const [savedAmount, setSavedAmount] = useState<number | null>(null);

  const handleCommit = useCallback(async () => {
    if (!connected || !address) {
      toast.error("Connect wallet first");
      return;
    }

    const amount = Number(bidAmount);
    if (amount <= 0) {
      toast.error("Enter a valid bid amount");
      return;
    }

    // Generate a random nonce (0–2^53 safe integer range)
    const nonce = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
    setSavedNonce(nonce);
    setSavedAmount(amount);

    setCommitting(true);
    try {
      const commitment = await computeCommitment(amount, nonce);

      await commitBid(groupId, commitment);

      setPhase("committed");
      toast.success("Bid committed! Remember your bid amount — you must reveal it later.");
      onBidCommitted?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Commit failed");
    } finally {
      setCommitting(false);
    }
  }, [connected, address, bidAmount, onBidCommitted, groupId]);

  const handleReveal = useCallback(async () => {
    if (!connected || !address) {
      toast.error("Connect wallet first");
      return;
    }

    if (savedAmount === null || savedNonce === null) {
      toast.error("Bid data lost. You must re-commit or recall your bid amount and nonce.");
      return;
    }

    setRevealing(true);
    try {
      await revealBid(groupId, savedAmount, savedNonce);

      setPhase("revealed");
      toast.success("Bid revealed! Waiting for payout execution.");
      onBidRevealed?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Reveal failed");
    } finally {
      setRevealing(false);
    }
  }, [connected, address, savedAmount, savedNonce, onBidRevealed, groupId]);

  if (!connected) {
    return (
      <div className="glass-card p-6 text-center">
        <p className="text-chit-muted">Connect wallet to participate in bidding.</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-6 space-y-4">
      <h3 className="text-lg font-semibold">Commit-Reveal Bidding</h3>
      <p className="text-chit-muted text-sm">
        Cycle {cycle}: Place your bid using the commit-reveal scheme.
        Your bid is hidden until reveal phase — lowest unique bid wins the pool.
      </p>

      {minReputation > 0 && (
        <p className="text-xs text-chit-warning">
          Minimum reputation of {minReputation} bps required to bid.
        </p>
      )}

      {/* Commit Phase */}
      {phase === "input" && (
        <div className="space-y-3">
          <div>
            <label className="block text-chit-muted text-sm mb-1">Your Bid Amount (USDC units)</label>
            <input
              type="number"
              value={bidAmount}
              onChange={(e) => setBidAmount(e.target.value)}
              placeholder="e.g. 500000 (0.5 USDC)"
              min="1"
              className="w-full px-3 py-2 rounded-lg bg-chit-bg border border-chit-border text-chit-text focus:border-stellar-600 outline-none text-sm"
            />
            <p className="text-chit-muted text-xs mt-1">
              This is the fee you are willing to pay for early pool access. Lower = more competitive.
            </p>
          </div>
          <button
            onClick={handleCommit}
            disabled={committing}
            className="btn-primary w-full"
          >
            {committing ? "Committing..." : "Commit Bid"}
          </button>
        </div>
      )}

      {/* Committed: waiting to reveal */}
      {phase === "committed" && (
        <div className="space-y-3">
          <div className="p-3 rounded-lg bg-stellar-600/5 border border-stellar-600/20">
            <p className="text-chit-success text-sm font-medium">✓ Bid committed</p>
            {savedAmount !== null && (
              <p className="text-chit-muted text-xs mt-1">
                Your bid: {(savedAmount / 1_000_000).toFixed(2)} USDC — reveal when ready.
              </p>
            )}
          </div>
          <button
            onClick={handleReveal}
            disabled={revealing}
            className="btn-primary w-full"
          >
            {revealing ? "Revealing..." : "Reveal Bid"}
          </button>
        </div>
      )}

      {/* Revealed */}
      {phase === "revealed" && (
        <div className="p-3 rounded-lg bg-chit-success/5 border border-chit-success/20">
          <p className="text-chit-success text-sm font-medium">✓ Bid revealed</p>
          <p className="text-chit-muted text-xs mt-1">
            Waiting for all bids to be revealed and payout execution.
          </p>
        </div>
      )}
    </div>
  );
}
