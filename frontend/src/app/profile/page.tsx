"use client";

import { useEffect } from "react";
import { useWallet } from "@/hooks/useWallet";
import { useReputation } from "@/hooks/useReputation";
import { shortenAddress, getReputationColor, getReputationLabel, basisPointsToPercent } from "@/lib/utils";
import AttestationFlow from "@/components/AttestationFlow";
import { ReputationBadge } from "@/components/ReputationBadge";

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
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold">Profile</h1>

      {/* Identity Card */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-stellar-600/20 flex items-center justify-center text-stellar-400 font-bold text-lg">
            {address.slice(0, 1)}
          </div>
          <div>
            <p className="font-mono text-chit-text">{shortenAddress(address, 10)}</p>
            <p className="text-chit-muted text-sm">Full: {address}</p>
          </div>
        </div>
      </div>

      {/* Reputation Card */}
      <div className="glass-card p-6 space-y-3">
        <h2 className="text-lg font-semibold">Reputation</h2>
        {loading ? (
          <p className="text-chit-muted text-sm">Loading reputation...</p>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <ReputationBadge score={compositeScore ?? 0} />
              <span className={`text-sm ${getReputationColor(compositeScore ?? 0)}`}>
                {getReputationLabel(compositeScore ?? 0)}
              </span>
            </div>

            {reputation && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="p-3 rounded-lg bg-chit-bg">
                  <p className="text-chit-muted text-xs">On-Time Ratio</p>
                  <p className="text-chit-text font-bold">
                    {reputation.total_payments_due > 0
                      ? `${basisPointsToPercent(
                          Math.round(
                            (reputation.on_time_payments / reputation.total_payments_due) * 10000
                          )
                        )}%`
                      : "N/A"}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-chit-bg">
                  <p className="text-chit-muted text-xs">Composite Score</p>
                  <p className="text-chit-text font-bold">{compositeScore ?? 0}</p>
                </div>
                <div className="p-3 rounded-lg bg-chit-bg">
                  <p className="text-chit-muted text-xs">Payments Made</p>
                  <p className="text-chit-text font-bold">{reputation.on_time_payments}</p>
                </div>
                <div className="p-3 rounded-lg bg-chit-bg">
                  <p className="text-chit-muted text-xs">Defaults</p>
                  <p className="text-chit-text font-bold">{reputation.cycles_defaulted}</p>
                </div>
                <div className="p-3 rounded-lg bg-chit-bg">
                  <p className="text-chit-muted text-xs">Bids Won</p>
                  <p className="text-chit-text font-bold">{reputation.bids_won}</p>
                </div>
                <div className="p-3 rounded-lg bg-chit-bg">
                  <p className="text-chit-muted text-xs">Disputes Lost</p>
                  <p className="text-chit-text font-bold">{reputation.disputes_lost}</p>
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
