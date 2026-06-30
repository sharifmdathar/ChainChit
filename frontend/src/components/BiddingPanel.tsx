import { useState, useCallback, useEffect } from "react";
import { useWallet } from "@/hooks/useWallet";
import { commitBid, revealBid } from "@/lib/contracts";
import { computeCommitment } from "@/lib/utils";
import toast from "react-hot-toast";

interface BiddingPanelProps {
  groupId: string;
  cycle: number;
  minReputation: number;
  hasCommitment: boolean;
  isRevealed: boolean;
  onBidCommitted?: () => void;
  onBidRevealed?: () => void;
}

export default function BiddingPanel({
  groupId,
  cycle,
  minReputation,
  hasCommitment,
  isRevealed,
  onBidCommitted,
  onBidRevealed,
}: BiddingPanelProps) {
  const { connected, address } = useWallet();
  const [bidAmount, setBidAmount] = useState("");
  const [committing, setCommitting] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [phase, setPhase] = useState<"input" | "committed" | "revealed">(
    isRevealed ? "revealed" : (hasCommitment ? "committed" : "input")
  );
  const [savedNonce, setSavedNonce] = useState<number | null>(null);
  const [savedAmount, setSavedAmount] = useState<number | null>(null);

  // Synchronize phase with contract state props
  useEffect(() => {
    if (isRevealed) {
      setPhase("revealed");
    } else if (hasCommitment) {
      setPhase("committed");
    } else {
      setPhase("input");
    }
  }, [hasCommitment, isRevealed]);

  // Load saved bid from localStorage on mount or address/cycle change
  useEffect(() => {
    if (!address) return;
    const storageKey = `bid-${groupId}-${cycle}-${address}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSavedAmount(parsed.amount);
        setSavedNonce(parsed.nonce);
      } catch (e) {
        console.error("Failed to parse saved bid from localStorage", e);
      }
    }
  }, [groupId, cycle, address]);

  const handleCommit = useCallback(async () => {
    if (!connected || !address) {
      toast.error("Connect wallet first");
      return;
    }

    const amount = Math.round(Number(bidAmount) * 10_000_000);
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

      await commitBid(groupId, address, commitment);

      // Persist bid data in localStorage so it survives page reloads
      const storageKey = `bid-${groupId}-${cycle}-${address}`;
      localStorage.setItem(storageKey, JSON.stringify({ amount, nonce }));

      setPhase("committed");
      toast.success("Bid committed! Remember your bid amount — you must reveal it later.");
      onBidCommitted?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Commit failed");
    } finally {
      setCommitting(false);
    }
  }, [connected, address, bidAmount, onBidCommitted, groupId, cycle]);

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
      await revealBid(groupId, address, savedAmount, savedNonce);

      // Clean up localStorage on successful reveal
      const storageKey = `bid-${groupId}-${cycle}-${address}`;
      localStorage.removeItem(storageKey);

      setPhase("revealed");
      toast.success("Bid revealed! Waiting for payout execution.");
      onBidRevealed?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Error(Contract, #20)") || msg.includes("#20")) {
        toast.error("No bid commitment found for this account in this cycle. Please commit your bid first.");
      } else {
        toast.error(msg || "Reveal failed");
      }
    } finally {
      setRevealing(false);
    }
  }, [connected, address, savedAmount, savedNonce, onBidRevealed, groupId, cycle]);

  if (!connected) {
    return (
      <div className="glass-card p-6 text-center">
        <p className="text-chit-muted">Connect wallet to participate in bidding.</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-6 space-y-5 border border-white/[0.04] animate-fade-in-up">
      <div>
        <h3 className="text-xl font-bold text-slate-100 tracking-tight mb-1">Commit-Reveal Bidding</h3>
        <p className="text-slate-400 text-sm leading-relaxed">
          Cycle {cycle}: Bids are submitted cryptographically hidden. Once all members commit, bids are revealed. The lowest unique bid wins the cycle pool.
        </p>
      </div>

      {minReputation > 0 && (
        <div className="px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs font-semibold text-amber-400">
          ⚠️ Minimum reputation of {minReputation} bps is required to participate in this bid.
        </div>
      )}

      {/* Interactive visual steps indicator */}
      <div className="grid grid-cols-3 gap-3 border-t border-b border-white/[0.05] py-4 my-2">
        <div className="flex flex-col items-center gap-1.5 text-center">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] border ${
            phase === "input" ? "bg-indigo-600 border-indigo-500 text-white shadow-sm shadow-indigo-600/30" : "bg-emerald-500/15 border-emerald-500 text-emerald-400"
          }`}>
            {phase === "input" ? "1" : "✓"}
          </div>
          <span className={`text-[10px] font-bold uppercase tracking-wider ${phase === "input" ? "text-indigo-400" : "text-emerald-400"}`}>1. Commit</span>
        </div>
        
        <div className="flex flex-col items-center gap-1.5 text-center">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] border ${
            phase === "committed" 
              ? "bg-indigo-600 border-indigo-500 text-white shadow-sm shadow-indigo-600/30" 
              : phase === "revealed" 
                ? "bg-emerald-500/15 border-emerald-500 text-emerald-400"
                : "bg-slate-900 border-white/[0.05] text-slate-600"
          }`}>
            {phase === "revealed" ? "✓" : "2"}
          </div>
          <span className={`text-[10px] font-bold uppercase tracking-wider ${phase === "committed" ? "text-indigo-400" : phase === "revealed" ? "text-emerald-400" : "text-slate-500"}`}>2. Reveal</span>
        </div>

        <div className="flex flex-col items-center gap-1.5 text-center">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] border ${
            phase === "revealed" ? "bg-indigo-600 border-indigo-500 text-white shadow-sm shadow-indigo-600/30 animate-pulse" : "bg-slate-900 border-white/[0.05] text-slate-600"
          }`}>
            3
          </div>
          <span className={`text-[10px] font-bold uppercase tracking-wider ${phase === "revealed" ? "text-indigo-400 animate-pulse" : "text-slate-500"}`}>3. Payout</span>
        </div>
      </div>

      {/* Commit Phase */}
      {phase === "input" && (
        <div className="space-y-4">
          <div>
            <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              Your Secret Bid Amount (USDC)
            </label>
            <input
              type="number"
              value={bidAmount}
              onChange={(e) => setBidAmount(e.target.value)}
              placeholder="e.g. 0.50"
              step="any"
              min="0.000001"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-white/[0.08] text-slate-100 placeholder-slate-600 focus:border-indigo-500 outline-none text-sm transition-all"
            />
            {bidAmount && (
              <p className="text-emerald-400 text-xs font-semibold mt-1.5">
                Equivalent to {Math.round(Number(bidAmount) * 10_000_000).toLocaleString()} base units
              </p>
            )}
            <p className="text-slate-500 text-xs mt-2 leading-relaxed">
              * Note: The lower your bid, the more competitive it is to win the pool earlier, but you will pay this amount as a fee.
            </p>
          </div>
          <button
            onClick={handleCommit}
            disabled={committing}
            className="btn-primary w-full py-3"
          >
            {committing ? "Submitting Secret Commitment..." : "Submit Secret Bid"}
          </button>
        </div>
      )}

      {/* Committed: waiting to reveal */}
      {phase === "committed" && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/20 shadow-inner">
            <p className="text-indigo-400 text-sm font-bold flex items-center gap-1.5">
              <span>✓</span> Secret Bid Committed
            </p>
            {savedAmount !== null && (
              <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">
                Your local cached bid of <span className="text-slate-200 font-semibold">{(savedAmount / 10_000_000).toFixed(2)} USDC</span> is ready to be revealed. Please click the button below to submit the decryption nonce.
              </p>
            )}
          </div>
          <button
            onClick={handleReveal}
            disabled={revealing}
            className="btn-primary w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 border-none shadow-sm shadow-emerald-500/10"
          >
            {revealing ? "Submitting Reveal Key..." : "Reveal Secret Bid"}
          </button>
        </div>
      )}

      {/* Revealed */}
      {phase === "revealed" && (
        <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 shadow-inner">
          <p className="text-emerald-400 text-sm font-bold flex items-center gap-1.5">
            <span>✓</span> Bid Successfully Revealed
          </p>
          <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">
            Your bid has been decrypted and recorded on-chain. Waiting for other members to reveal before payout computation.
          </p>
        </div>
      )}
    </div>
  );
}
