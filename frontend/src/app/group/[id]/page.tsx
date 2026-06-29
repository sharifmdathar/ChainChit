"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useChitGroup } from "@/hooks/useChitGroup";
import { useWallet } from "@/hooks/useWallet";
import { ContributionFlow } from "@/components/ContributionFlow";
import { ReputationBadge } from "@/components/ReputationBadge";
import BiddingPanel from "@/components/BiddingPanel";
import { formatUsdc, getStateColor, shortenAddress } from "@/lib/utils";
import toast from "react-hot-toast";

export default function GroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { connected, address } = useWallet();
  const groupId = params.id as string;
  const {
    groupInfo, members, cycleState, loading,
    fetchGroupInfo, fetchMembers, fetchCycleState,
    join, start, advance, dispute,
  } = useChitGroup(groupId);

  useEffect(() => {
    if (connected && groupId) {
      fetchGroupInfo();
      fetchMembers();
    }
  }, [connected, groupId, fetchGroupInfo, fetchMembers]);

  useEffect(() => {
    if (groupInfo && groupInfo.current_cycle > 0) {
      fetchCycleState(groupInfo.current_cycle);
    }
  }, [groupInfo, fetchCycleState]);

  if (!connected) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className="text-chit-muted">Connect your wallet to view group details.</p>
      </div>
    );
  }

  if (loading && !groupInfo) {
    return <div className="max-w-4xl mx-auto px-4 py-16 text-center animate-pulse-glow text-chit-muted">Loading group...</div>;
  }

  if (!groupInfo) {
    return <div className="max-w-4xl mx-auto px-4 py-16 text-center text-chit-danger">Group not found.</div>;
  }

  const isAdmin = address === groupInfo.admin;
  const isMember = members.includes(address || "");

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="glass-card p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${getStateColor(groupInfo.state)}`}>
              {groupInfo.state}
            </span>
            <h1 className="text-2xl font-bold mt-2">Group {shortenAddress(groupId, 8)}</h1>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{formatUsdc(groupInfo.contribution_amount * groupInfo.num_members)}</p>
            <p className="text-chit-muted text-xs">Pool per cycle</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-chit-muted text-xs">Contribution</p>
            <p className="font-medium">{formatUsdc(groupInfo.contribution_amount)}</p>
          </div>
          <div>
            <p className="text-chit-muted text-xs">Members</p>
            <p className="font-medium">{members.length}/{groupInfo.num_members}</p>
          </div>
          <div>
            <p className="text-chit-muted text-xs">Cycle</p>
            <p className="font-medium">{groupInfo.current_cycle}/{groupInfo.total_cycles}</p>
          </div>
          <div>
            <p className="text-chit-muted text-xs">Min Attestation</p>
            <p className="font-medium">{groupInfo.min_attestation_score}</p>
          </div>
        </div>
      </div>

      {/* Actions based on state */}
      {groupInfo.state === "Forming" && !isMember && (
        <div className="glass-card p-6 mb-6">
          <button onClick={() => { 
            join()
              .then(() => { 
                toast.success("Joined!");
                fetchMembers();
                fetchGroupInfo();
              })
              .catch((e) => toast.error(e.message)); 
          }} className="btn-primary w-full">
            Join This Group
          </button>
        </div>
      )}

      {groupInfo.state === "Forming" && isAdmin && members.length >= groupInfo.num_members && (
        <div className="glass-card p-6 mb-6">
          <button onClick={() => { 
            start()
              .then(() => { 
                toast.success("Collection started!");
                fetchGroupInfo();
              })
              .catch((e) => toast.error(e.message)); 
          }} className="btn-primary w-full">
            Start Collection
          </button>
        </div>
      )}

      {groupInfo.state === "Collecting" && isMember && (
        <ContributionFlow
          groupId={params.id as string}
          contributionAmount={groupInfo.contribution_amount}
          cycle={groupInfo.current_cycle}
          onPaid={() => { fetchGroupInfo(); fetchCycleState(groupInfo.current_cycle); }}
        />
      )}

      {groupInfo.state === "Bidding" && isMember && (
        <BiddingPanel
          groupId={params.id as string}
          cycle={groupInfo.current_cycle}
          minReputation={groupInfo.min_reputation_for_bid}
          hasCommitment={cycleState && address ? !!cycleState.bids[address] : false}
          onBidCommitted={() => { fetchGroupInfo(); fetchCycleState(groupInfo.current_cycle); }}
          onBidRevealed={() => { fetchGroupInfo(); fetchCycleState(groupInfo.current_cycle); }}
        />
      )}

      {groupInfo.state === "Payout" && isAdmin && (
        <div className="glass-card p-6 mb-6">
          <button onClick={() => { 
            advance()
              .then(() => { 
                toast.success("Cycle advanced!");
                fetchGroupInfo();
                fetchCycleState(groupInfo.current_cycle);
              })
              .catch((e) => toast.error(e.message)); 
          }} className="btn-primary w-full">
            Advance to Next Cycle
          </button>
        </div>
      )}

      {/* Cycle state */}
      {cycleState && (
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold mb-4">Cycle {groupInfo.current_cycle} Details</h3>
          {cycleState.winner && (
            <div className="mb-4 p-3 rounded-lg bg-chit-success/10 border border-chit-success/20">
              <p className="text-chit-success text-sm font-medium">Winner: {shortenAddress(cycleState.winner)}</p>
              <p className="text-chit-muted text-xs">Winning bid: {formatUsdc(cycleState.winning_bid)}</p>
            </div>
          )}
          <div>
            <p className="text-chit-muted text-sm mb-2">Payment Status</p>
            <div className="space-y-1">
              {members.map((m) => (
                <div key={m} className="flex items-center justify-between text-sm">
                  <span className="font-mono">{shortenAddress(m)}</span>
                  <span className={
                    cycleState.payments[m] === "Paid" ? "text-chit-success" : "text-chit-warning"
                  }>
                    {cycleState.payments[m] || "Pending"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
