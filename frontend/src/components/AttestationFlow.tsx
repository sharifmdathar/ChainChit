"use client";

import { useState, useCallback } from "react";
import { useWallet } from "@/hooks/useWallet";
import { vouchFor, getAttestationScore, isAttested, getVouchors, getAttestationCount } from "@/lib/contracts";
import { shortenAddress } from "@/lib/utils";
import toast from "react-hot-toast";

interface AttestationFlowProps {
  targetAddress: string;
  onAttested?: () => void;
}

export default function AttestationFlow({ targetAddress, onAttested }: AttestationFlowProps) {
  const { connected, address } = useWallet();
  const [vouchingFor, setVouchingFor] = useState("");
  const [loading, setLoading] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [attested, setAttested] = useState<boolean | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [vouchors, setVouchors] = useState<string[]>([]);
  const [fetching, setFetching] = useState(false);

  const fetchAttestationData = useCallback(async () => {
    if (!targetAddress) return;
    setFetching(true);
    try {
      const s = await getAttestationScore(targetAddress);
      setScore(s);
      const a = await isAttested(targetAddress);
      setAttested(a);
      const c = await getAttestationCount(targetAddress);
      setCount(c);
      const v = await getVouchors(targetAddress);
      setVouchors(v);
    } catch {
      // Score may be 0 for new accounts – that is expected.
      setScore(0);
      setAttested(false);
      setCount(0);
      setVouchors([]);
    } finally {
      setFetching(false);
    }
  }, [targetAddress]);

  const handleVouch = useCallback(async () => {
    if (!connected || !address) {
      toast.error("Connect wallet first");
      return;
    }

    const vouchee = vouchingFor.trim();
    if (!vouchee) {
      toast.error("Enter an address to vouch for");
      return;
    }

    if (vouchee === address) {
      toast.error("Cannot vouch for yourself");
      return;
    }

    setLoading(true);
    try {
      await vouchFor(address, vouchee);
      toast.success(`Vouched for ${shortenAddress(vouchee)}`);
      setVouchingFor("");
      onAttested?.();
      fetchAttestationData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Vouch failed");
    } finally {
      setLoading(false);
    }
  }, [connected, address, vouchingFor, onAttested, fetchAttestationData]);

  return (
    <div className="glass-card p-6 space-y-5 border border-white/[0.04] animate-fade-in-up">
      <div>
        <h3 className="text-xl font-bold text-slate-100 tracking-tight mb-1">Identity Attestation</h3>
        <p className="text-slate-400 text-sm leading-relaxed">
          Vouch for trusted community members. Your own reputation score directly weights the trust weight of your attestation vouches.
        </p>
      </div>

      {/* Current attestation status */}
      <div className="space-y-4">
        {fetching ? (
          <div className="shimmer-bg glass-card text-center py-6 text-xs text-slate-400">Loading attestation score records...</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-900/30 border border-white/[0.02] text-center">
                <p className="text-slate-500 font-bold uppercase tracking-wider text-[9px] mb-1">Score</p>
                <p className="text-xl font-black text-slate-200">{score ?? "—"}</p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-900/30 border border-white/[0.02] text-center">
                <p className="text-slate-500 font-bold uppercase tracking-wider text-[9px] mb-1">Vouches</p>
                <p className="text-xl font-black text-slate-200">{count ?? "—"}</p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-900/30 border border-white/[0.02] text-center">
                <p className="text-slate-500 font-bold uppercase tracking-wider text-[9px] mb-1">Status</p>
                <p className={`text-sm font-black uppercase tracking-wider mt-1 ${attested ? "text-emerald-400" : "text-rose-400"}`}>
                  {attested === null ? "—" : attested ? "Verified" : "Unverified"}
                </p>
              </div>
            </div>

            {vouchors.length > 0 && (
              <div className="p-4 rounded-xl bg-slate-900/20 border border-white/[0.02] space-y-2">
                <p className="text-slate-500 font-bold uppercase tracking-wider text-[9px]">Vouched By Community Members</p>
                <div className="flex flex-wrap gap-1.5">
                  {vouchors.map((v, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-0.5 text-[10px] font-mono rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 shadow-sm"
                    >
                      {shortenAddress(v)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <button
          onClick={fetchAttestationData}
          disabled={fetching || !targetAddress}
          className="btn-secondary text-xs py-2 px-4 flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89H18" />
          </svg>
          <span>Refresh Scores</span>
        </button>
      </div>

      {/* Vouch for someone */}
      <div className="border-t border-white/[0.05] pt-5">
        <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
          Vouch for community member
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={vouchingFor}
            onChange={(e) => setVouchingFor(e.target.value)}
            placeholder="Recipient account address (G...)"
            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-white/[0.08] text-slate-100 placeholder-slate-600 focus:border-indigo-500 outline-none text-sm font-mono transition-all"
          />
          <button
            onClick={handleVouch}
            disabled={loading || !connected}
            className="btn-primary whitespace-nowrap px-6"
          >
            {loading ? "..." : "Vouch"}
          </button>
        </div>
      </div>
    </div>
  );
}
