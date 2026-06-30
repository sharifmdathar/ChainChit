"use client";

import { useEffect } from "react";
import { useWallet } from "@/hooks/useWallet";
import { useReputation } from "@/hooks/useReputation";
import { shortenAddress, getReputationColor, getReputationLabel, basisPointsToPercent } from "@/lib/utils";
import AttestationFlow from "@/components/AttestationFlow";
import { ReputationBadge } from "@/components/ReputationBadge";
import toast from "react-hot-toast";

export default function ProfilePage() {
  const { connected, address } = useWallet();
  const { reputation, compositeScore, loading, fetchReputation, fetchScore } = useReputation();

  useEffect(() => {
    if (address) {
      fetchReputation(address);
      fetchScore(address);
    }
  }, [address, fetchReputation, fetchScore]);

  if (!connected || !address) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-chit-muted">Connect your wallet to view your profile.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6 animate-fade-in-up">
      <div className="mb-2">
        <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight">Member Profile</h1>
        <p className="text-slate-400 text-sm mt-1">Audit on-chain savings history, vouches, and dispute resolutions.</p>
      </div>

      {/* Identity Card */}
      <div className="glass-card p-6 border border-white/[0.04]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white font-extrabold text-xl shadow-lg shadow-indigo-600/25">
              {address.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="font-mono text-slate-200 text-base font-semibold">{shortenAddress(address, 12)}</p>
              <p className="text-slate-500 text-xs font-mono mt-1 break-all select-all">{address}</p>
            </div>
          </div>
          <button 
            onClick={() => {
              navigator.clipboard.writeText(address);
              toast.success("Full address copied!");
            }}
            className="btn-secondary text-xs py-2 px-4 flex items-center gap-1.5 self-stretch sm:self-auto justify-center"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
            </svg>
            <span>Copy Address</span>
          </button>
        </div>
      </div>

      {/* Reputation Card */}
      <div className="glass-card p-6 space-y-4 border border-white/[0.04]">
        <h2 className="text-lg font-bold text-slate-200 tracking-tight">On-Chain Reputation Metrics</h2>
        {loading ? (
          <div className="shimmer-bg glass-card text-center py-8 text-xs text-slate-400">Loading profile trust metrics...</div>
        ) : (
          <>
            <div className="flex items-center gap-3 bg-slate-900/35 border border-white/[0.02] p-3 rounded-xl">
              <ReputationBadge score={compositeScore ?? 0} size="md" />
              <span className="text-slate-400 text-xs font-medium">
                Calculated dynamically via vouch weights, on-time ratio, and active cycles.
              </span>
            </div>

            {reputation && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-900/30 border border-white/[0.02]">
                  <p className="text-slate-500 font-bold uppercase tracking-wider text-[9px] mb-1">On-Time Ratio</p>
                  <p className="text-lg font-black text-slate-200">
                    {reputation.total_payments_due > 0
                      ? `${basisPointsToPercent(
                          Math.round(
                            (reputation.on_time_payments / reputation.total_payments_due) * 10000
                          )
                        ).toFixed(1)}%`
                      : "N/A"}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-900/30 border border-white/[0.02]">
                  <p className="text-slate-500 font-bold uppercase tracking-wider text-[9px] mb-1">Trust Score</p>
                  <p className="text-lg font-black text-slate-200">{compositeScore ?? 0}</p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-900/30 border border-white/[0.02]">
                  <p className="text-slate-500 font-bold uppercase tracking-wider text-[9px] mb-1">Payments Made</p>
                  <p className="text-lg font-black text-slate-200">{reputation.on_time_payments}</p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-900/30 border border-white/[0.02]">
                  <p className="text-slate-500 font-bold uppercase tracking-wider text-[9px] mb-1">Default Cycles</p>
                  <p className={`text-lg font-black ${reputation.cycles_defaulted > 0 ? "text-rose-400" : "text-slate-200"}`}>
                    {reputation.cycles_defaulted}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-900/30 border border-white/[0.02]">
                  <p className="text-slate-500 font-bold uppercase tracking-wider text-[9px] mb-1">Savings Won</p>
                  <p className="text-lg font-black text-slate-200">{reputation.bids_won}</p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-900/30 border border-white/[0.02]">
                  <p className="text-slate-500 font-bold uppercase tracking-wider text-[9px] mb-1">Disputes Lost</p>
                  <p className={`text-lg font-black ${reputation.disputes_lost > 0 ? "text-rose-400" : "text-slate-200"}`}>
                    {reputation.disputes_lost}
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Attestation Card */}
      <AttestationFlow targetAddress={address} />
    </div>
  );
}
