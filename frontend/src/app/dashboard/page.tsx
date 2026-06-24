"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { useReputation } from "@/hooks/useReputation";
import { ReputationBadge } from "@/components/ReputationBadge";
import { GroupCard } from "@/components/GroupCard";
import Sep24Ramp from "@/components/Sep24Ramp";
import { basisPointsToPercent } from "@/lib/utils";
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
      <div className="mb-8">
        <Sep24Ramp />
      </div>

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
