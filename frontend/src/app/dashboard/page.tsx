"use client";

import { useEffect, useState, useCallback } from "react";
import { useWallet } from "@/hooks/useWallet";
import { useReputation } from "@/hooks/useReputation";
import { ReputationBadge } from "@/components/ReputationBadge";
import { GroupCard } from "@/components/GroupCard";
import Sep24Ramp from "@/components/Sep24Ramp";
import { basisPointsToPercent, shortenAddress } from "@/lib/utils";
import { getUserGroups, getGroupInfo, getMembers } from "@/lib/contracts";
import type { GroupInfo } from "@/types";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";

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

let activityCounter = 0;

export default function DashboardPage() {
  const router = useRouter();
  const { connected, address } = useWallet();
  const { compositeScore, onTimeRatio, established, fetchScore } = useReputation();
  const [groups, setGroups] = useState<GroupWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);

  const pushActivity = useCallback((type: ActivityEvent["type"], label: string, detail: string) => {
    activityCounter += 1;
    const event: ActivityEvent = {
      id: activityCounter,
      type,
      label,
      detail,
      timestamp: Date.now(),
    };
    setActivities((prev) => [event, ...prev].slice(0, 50));
    // Also store in localStorage for cross-page visibility
    try {
      const stored = JSON.parse(localStorage.getItem("chit_activity_log") || "[]");
      stored.unshift(event);
      if (stored.length > 100) stored.length = 100;
      localStorage.setItem("chit_activity_log", JSON.stringify(stored));
    } catch {}
  }, []);

  // Load saved activity log from localStorage on mount
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("chit_activity_log") || "[]");
      if (Array.isArray(stored) && stored.length > 0) {
        setActivities(stored.slice(0, 50));
        activityCounter = stored[0].id;
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (connected && address) {
      fetchScore(address);
      pushActivity("wallet", "Wallet Connected", shortenAddress(address));
    }
  }, [connected, address, fetchScore, pushActivity]);

  useEffect(() => {
    async function loadGroups() {
      setLoading(true);
      try {
        const groupIds = await getUserGroups(address!);
        const loadedGroups: GroupWithMembers[] = [];
        
        for (const contractId of groupIds) {
          try {
            const info = await getGroupInfo(contractId);
            const members = await getMembers(contractId);
            loadedGroups.push({
              info,
              memberCount: members.length,
              contractId
            });
          } catch (e) {
            console.error("Failed to load group", contractId, e);
          }
        }
        
        setGroups(loadedGroups);
        pushActivity("contract", "Groups Loaded", `${loadedGroups.length} groups found`);

        // Log each group's state
        for (const g of loadedGroups) {
          pushActivity("group", `Group: ${shortenAddress(g.contractId)}`, g.info.state);
        }
      } catch (e) {
        console.error(e);
        toast.error("Failed to load groups");
        pushActivity("contract", "Groups Load Error", "Failed to fetch groups");
      } finally {
        setLoading(false);
      }
    }
    if (connected && address) loadGroups();
  }, [connected, address, pushActivity]);

  if (!connected) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className="text-chit-muted">Connect your wallet to view your dashboard.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 animate-fade-in-up">
      {/* Dashboard Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">Manage your rotating savings pools and monitor on-chain trust scores.</p>
        </div>
        <Link href="/create-group" className="btn-primary flex items-center gap-2">
          <span>+ Create Group</span>
        </Link>
      </div>

      {/* Stats Summary Grid */}
      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        {/* Identity & Score */}
        <div className="glass-card p-5 flex flex-col justify-between">
          <div>
            <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-2">Member Profile</p>
            <div className="flex items-center gap-2 mb-3">
              <span className="font-mono text-xs text-slate-300 bg-slate-900 px-2 py-1 rounded border border-white/[0.03]">
                {shortenAddress(address || "")}
              </span>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(address || "");
                  toast.success("Address copied!");
                }}
                className="text-slate-500 hover:text-slate-300 transition-colors p-1"
                title="Copy Address"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <ReputationBadge score={compositeScore} size="sm" />
            {established && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Established
              </span>
            )}
          </div>
        </div>

        {/* Reputation Analytics */}
        <div className="glass-card p-5 flex flex-col justify-between">
          <div>
            <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-1">Reputation Score</p>
            <div className="flex items-baseline gap-1.5 my-2">
              <span className="text-3xl font-extrabold text-slate-100">{compositeScore}</span>
              <span className="text-xs text-slate-500">/ 1000 Max</span>
            </div>
          </div>
          <div>
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="text-slate-400">On-Time Payment Ratio</span>
              <span className="font-semibold text-emerald-400">{basisPointsToPercent(onTimeRatio).toFixed(1)}%</span>
            </div>
            <div className="w-full bg-slate-900 rounded-full h-1.5 border border-white/[0.03]">
              <div 
                className="bg-emerald-500 h-1.5 rounded-full transition-all duration-1000 shadow-sm shadow-emerald-500/50" 
                style={{ width: `${basisPointsToPercent(onTimeRatio)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Membership Summary */}
        <div className="glass-card p-5 flex flex-col justify-between">
          <div>
            <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-1">Active Chit Pools</p>
            <div className="flex items-baseline gap-1.5 my-2">
              <span className="text-3xl font-extrabold text-slate-100">{groups.length}</span>
              <span className="text-xs text-slate-500">Joined Pools</span>
            </div>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Ensure contributions are sent before the cycle deadlines to avoid negative score impacts.
          </p>
        </div>
      </div>

      {/* SEP-24 on/off ramp */}
      <div className="mb-8">
        <Sep24Ramp />
      </div>

      {/* Groups Section */}
      <div className="mb-12">
        <h2 className="text-xl font-bold text-slate-200 tracking-tight mb-4 flex items-center gap-2">
          <span>Your Saving Groups</span>
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-900 border border-white/[0.05] text-slate-400">
            {groups.length}
          </span>
        </h2>
        {loading ? (
          <div className="shimmer-bg glass-card text-slate-400 text-center py-12">
            <span className="animate-pulse flex items-center justify-center gap-2">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-indigo-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Loading your group details...
            </span>
          </div>
        ) : groups.length === 0 ? (
          <div className="glass-card p-10 text-center flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-slate-900 border border-white/[0.05] flex items-center justify-center text-slate-500">
              📁
            </div>
            <div>
              <p className="text-slate-300 font-bold text-base mb-1">{"You haven't joined any groups yet."}</p>
              <p className="text-slate-500 text-sm max-w-sm">Create a group parameters or vouch members to initiate rotation saving pools.</p>
            </div>
            <Link href="/create-group" className="btn-primary">
              Create Your First Group
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {groups.map((g) => (
              <GroupCard
                key={g.contractId}
                group={g.info}
                memberCount={g.memberCount}
                onClick={() => router.push(`/group/${g.contractId}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
