"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { useReputation } from "@/hooks/useReputation";
import { shortenAddress, basisPointsToPercent } from "@/lib/utils";
import { getUserGroups, getGroupInfo, getMembers } from "@/lib/contracts";
import type { GroupInfo } from "@/types";

const RPC_URL = process.env.NEXT_PUBLIC_STELLAR_RPC_URL || "https://soroban-testnet.stellar.org";
const NETWORK = process.env.NEXT_PUBLIC_NETWORK || "TESTNET";

interface GroupWithMembers {
  info: GroupInfo;
  memberCount: number;
  contractId: string;
}

interface ActivityEvent {
  id: number;
  type: "group" | "transaction" | "wallet" | "contract";
  label: string;
  detail: string;
  timestamp: number;
}

const STATE_COLORS: Record<string, string> = {
  Forming: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  Collecting: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  Bidding: "text-violet-400 bg-violet-500/10 border-violet-500/20",
  Payout: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  Completed: "text-slate-500 bg-slate-500/10 border-slate-500/20",
  Paused: "text-rose-400 bg-rose-500/10 border-rose-500/20",
};

const ACTIVITY_ICONS: Record<string, string> = {
  wallet: "🔌",
  contract: "📜",
  group: "📦",
  transaction: "↻",
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 1_000) return "now";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}

export default function AnalyticsPage() {
  const { connected, address, network } = useWallet();
  const { compositeScore, onTimeRatio, established, fetchScore } = useReputation();
  const [groups, setGroups] = useState<GroupWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("chit_activity_log") || "[]");
      if (Array.isArray(stored) && stored.length > 0) {
        setActivities(stored.slice(0, 50));
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (connected && address) fetchScore(address);
  }, [connected, address, fetchScore]);

  useEffect(() => {
    if (!connected || !address) return;
    const walletAddr: string = address;
    async function load() {
      setLoading(true);
      try {
        const groupIds = await getUserGroups(walletAddr);
        const loaded: GroupWithMembers[] = [];
        for (const contractId of groupIds) {
          try {
            const info = await getGroupInfo(contractId);
            const members = await getMembers(contractId);
            loaded.push({ info, memberCount: members.length, contractId });
          } catch {
            // skip failed groups
          }
        }
        setGroups(loaded);
      } catch {
        // groups fetch failed — silently
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [connected, address]);

  const activeGroups = groups.filter((g) => g.info.state !== "Completed");
  const completedGroups = groups.filter((g) => g.info.state === "Completed");

  const totalPooled = groups.reduce((sum, g) => {
    const activeMembers = Math.min(g.memberCount, g.info.num_members);
    return sum + g.info.contribution_amount * activeMembers;
  }, 0);

  if (!connected) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 text-center">
        <p className="text-slate-400">Connect your wallet to view analytics.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight">Analytics & Monitoring</h1>
          <p className="text-slate-400 text-sm mt-1">
            On-chain insights, network status, and session activity for your Stellar chit fund activity.
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Total Pooled Value */}
        <div className="glass-card p-5 flex flex-col gap-1.5">
          <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Total Pooled Value</p>
          <p className="text-3xl font-extrabold text-slate-100">
            {totalPooled === 0 ? "—" : `${(totalPooled / 10_000_000).toLocaleString()} USDC`}
          </p>
          <p className="text-xs text-slate-500">Across {groups.length} group{groups.length !== 1 ? "s" : ""}</p>
        </div>

        {/* Group States */}
        <div className="glass-card p-5 flex flex-col gap-1.5">
          <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Group States</p>
          <div className="flex items-baseline gap-5">
            <div>
              <span className="text-3xl font-extrabold text-emerald-400">{activeGroups.length}</span>
              <span className="text-xs text-slate-500 ml-1.5">Active</span>
            </div>
            <div>
              <span className="text-3xl font-extrabold text-slate-500">{completedGroups.length}</span>
              <span className="text-xs text-slate-500 ml-1.5">Completed</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {(["Forming", "Collecting", "Bidding", "Payout", "Paused"] as const).map((s) => {
              const count = groups.filter((g) => g.info.state === s).length;
              if (count === 0) return null;
              return (
                <span
                  key={s}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${STATE_COLORS[s] || "text-slate-400 bg-slate-900 border-white/[0.05]"}`}
                >
                  {s}: {count}
                </span>
              );
            })}
          </div>
        </div>

        {/* Network Status */}
        <div className="glass-card p-5 flex flex-col gap-1.5">
          <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Network</p>
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow shadow-emerald-500/50" />
            <span className="text-base font-bold text-slate-200">
              {NETWORK === "TESTNET" ? "Stellar Testnet" : "Stellar Mainnet"}
            </span>
          </div>
          <div className="mt-2 space-y-1">
            <p className="text-xs text-slate-500 truncate" title={RPC_URL}>
              <span className="text-slate-600">RPC:</span> {RPC_URL.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </p>
            <p className="text-xs text-slate-500">
              <span className="text-slate-600">Wallet:</span> {network === "TESTNET" ? "Testnet" : network}
            </p>
            <p className="text-xs text-slate-500">
              <span className="text-slate-600">Passphrase:</span>{" "}
              {NETWORK === "TESTNET" ? "Test SDF Network ; September 2015" : "Public Global Stellar Network ; September 2015"}
            </p>
          </div>
        </div>

        {/* Reputation Overview */}
        <div className="glass-card p-5 flex flex-col gap-1.5">
          <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Reputation</p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold text-slate-100">{compositeScore}</span>
            <span className="text-xs text-slate-500">/ 1000</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className={`font-semibold ${onTimeRatio >= 8000 ? "text-emerald-400" : "text-amber-400"}`}>
              {basisPointsToPercent(onTimeRatio).toFixed(0)}% on-time
            </span>
            {established && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Established
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Wallet: {shortenAddress(address || "")}
          </p>
        </div>
      </div>

      {/* Activity Log */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-200 tracking-tight">Activity Log</h2>
          {activities.length > 0 && (
            <button
              onClick={() => {
                setActivities([]);
                try { localStorage.removeItem("chit_activity_log"); } catch {}
              }}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors px-2.5 py-1 rounded-lg border border-white/[0.05] hover:border-white/[0.1]"
            >
              Clear log
            </button>
          )}
        </div>

        {activities.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <p className="text-slate-500 text-sm">No activity recorded yet.</p>
            <p className="text-slate-600 text-xs mt-1">Actions you perform across the app will appear here.</p>
          </div>
        ) : (
          <div className="glass-card divide-y divide-white/[0.04] max-h-[480px] overflow-y-auto">
            {activities.map((a) => (
              <div key={a.id} className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors">
                <div className="w-7 h-7 rounded-full bg-slate-900 flex items-center justify-center text-xs shrink-0 border border-white/[0.05]">
                  {ACTIVITY_ICONS[a.type] || "○"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline gap-2">
                    <p className="text-sm font-medium text-slate-200 truncate">{a.label}</p>
                    <span className="text-[10px] text-slate-600 shrink-0">{timeAgo(a.timestamp)}</span>
                  </div>
                  <p className="text-xs text-slate-500 truncate mt-0.5">{a.detail}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Connected Groups Summary */}
      {!loading && groups.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-slate-200 tracking-tight mb-4">Group Breakdown</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.05] text-left text-xs text-slate-500 uppercase tracking-wider">
                  <th className="pb-2 pr-4 font-semibold">Contract</th>
                  <th className="pb-2 pr-4 font-semibold">State</th>
                  <th className="pb-2 pr-4 font-semibold">Members</th>
                  <th className="pb-2 pr-4 font-semibold">Cycle</th>
                  <th className="pb-2 pr-4 font-semibold">Contribution</th>
                  <th className="pb-2 font-semibold">Pool Size</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {groups.map((g) => (
                  <tr key={g.contractId} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-2.5 pr-4 font-mono text-xs text-slate-300">{shortenAddress(g.contractId)}</td>
                    <td className="py-2.5 pr-4">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${STATE_COLORS[g.info.state] || ""}`}>
                        {g.info.state}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-slate-400">{g.memberCount}/{g.info.num_members}</td>
                    <td className="py-2.5 pr-4 text-slate-400">{g.info.current_cycle}/{g.info.total_cycles}</td>
                    <td className="py-2.5 pr-4 text-slate-400">{(g.info.contribution_amount / 10_000_000).toLocaleString()} USDC</td>
                    <td className="py-2.5 text-slate-400">
                      {((g.info.contribution_amount * g.memberCount) / 10_000_000).toLocaleString()} USDC
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
