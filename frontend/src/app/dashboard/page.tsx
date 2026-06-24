"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { useReputation } from "@/hooks/useReputation";
import { ReputationBadge } from "@/components/ReputationBadge";
import { GroupCard } from "@/components/GroupCard";
import { formatInr, basisPointsToPercent } from "@/lib/utils";
import { initiateSep24Deposit, initiateSep24Withdraw, getSep24Url } from "@/lib/stellar";
import { getGroupInfo, getMembers } from "@/lib/contracts";
import type { GroupInfo } from "@/types";
import Link from "next/link";
import toast from "react-hot-toast";

interface GroupWithMembers {
  info: GroupInfo;
  memberCount: number;
  contractId: string;
}

export default function DashboardPage() {
  const { connected, address } = useWallet();
  const { compositeScore, onTimeRatio, established, fetchScore } = useReputation();
  const [groups, setGroups] = useState<GroupWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const sep24Available = !!getSep24Url();

  useEffect(() => {
    if (connected && address) {
      fetchScore(address);
    }
  }, [connected, address, fetchScore]);

  useEffect(() => {
    async function loadGroups() {
      setLoading(true);
      try {
        // In production, this would iterate over deployed group contracts
        // For now, show placeholder
        setGroups([]);
      } catch {
        toast.error("Failed to load groups");
      } finally {
        setLoading(false);
      }
    }
    if (connected) loadGroups();
  }, [connected]);

  const handleDeposit = async () => {
    if (!address || !depositAmount) return;
    try {
      const url = await initiateSep24Deposit(address, depositAmount);
      window.open(url, "_blank", "width=600,height=800");
      toast.success("Deposit flow opened");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Deposit failed");
    }
  };

  const handleWithdraw = async () => {
    if (!address || !withdrawAmount) return;
    try {
      const url = await initiateSep24Withdraw(address, withdrawAmount);
      window.open(url, "_blank", "width=600,height=800");
      toast.success("Withdrawal flow opened");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Withdrawal failed");
    }
  };

  if (!connected) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className="text-chit-muted">Connect your wallet to view your dashboard.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Profile summary */}
      <div className="glass-card p-6 mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold mb-2">Dashboard</h1>
            <p className="font-mono text-sm text-chit-muted mb-3">{address}</p>
            <div className="flex items-center gap-3">
              <ReputationBadge score={compositeScore} size="lg" />
              <span className="text-chit-muted text-sm">
                On-time: {basisPointsToPercent(onTimeRatio).toFixed(1)}%
              </span>
              {established && (
                <span className="px-2 py-0.5 rounded text-xs bg-chit-success/20 text-chit-success border border-chit-success/30">
                  Established
                </span>
              )}
            </div>
          </div>
          <Link href="/create-group" className="btn-primary">
            + Create Group
          </Link>
        </div>
      </div>

      {/* SEP-24 on/off ramp */}
      {sep24Available && (
        <div className="glass-card p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">INR On/Off Ramp</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-chit-muted text-sm mb-1">Deposit INR → USDC</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="Amount in INR"
                  className="flex-1 px-3 py-2 rounded-lg bg-chit-bg border border-chit-border text-chit-text focus:border-stellar-600 outline-none text-sm"
                />
                <button onClick={handleDeposit} disabled={!depositAmount} className="btn-primary">
                  Deposit
                </button>
              </div>
            </div>
            <div>
              <label className="block text-chit-muted text-sm mb-1">Withdraw USDC → INR</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="Amount in INR"
                  className="flex-1 px-3 py-2 rounded-lg bg-chit-bg border border-chit-border text-chit-text focus:border-stellar-600 outline-none text-sm"
                />
                <button onClick={handleWithdraw} disabled={!withdrawAmount} className="btn-secondary">
                  Withdraw
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Groups */}
      <h2 className="text-xl font-semibold mb-4">Your Groups</h2>
      {loading ? (
        <div className="animate-pulse-glow text-chit-muted text-center py-8">Loading groups...</div>
      ) : groups.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <p className="text-chit-muted mb-4">You haven't joined any groups yet.</p>
          <Link href="/create-group" className="btn-primary">
            Create Your First Group
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((g) => (
            <GroupCard
              key={g.contractId}
              group={g.info}
              memberCount={g.memberCount}
              onClick={() => {}}
            />
          ))}
        </div>
      )}
    </div>
  );
}
