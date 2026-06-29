"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useChitGroup } from "@/hooks/useChitGroup";
import { useWallet } from "@/hooks/useWallet";
import { ContributionFlow } from "@/components/ContributionFlow";
import { ReputationBadge } from "@/components/ReputationBadge";
import BiddingPanel from "@/components/BiddingPanel";
import { formatUsdc, getStateColor, shortenAddress } from "@/lib/utils";
import { getCycleState } from "@/lib/contracts";
import type { CycleState } from "@/types";
import toast from "react-hot-toast";

export default function GroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { connected, address } = useWallet();
  const groupId = params.id as string;
  const {
    groupInfo, members, cycleState, loading,
    fetchGroupInfo, fetchMembers, fetchCycleState,
    join, start, payout, advance, dispute,
  } = useChitGroup(groupId);

  const [historyCycles, setHistoryCycles] = useState<Record<number, CycleState>>({});
  const [isDisputeModalOpen, setIsDisputeModalOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [submittingDispute, setSubmittingDispute] = useState(false);

  const fetchAllCycleStates = useCallback(async (currentCycle: number) => {
    const states: Record<number, CycleState> = {};
    for (let c = 1; c <= currentCycle; c++) {
      try {
        const state = await getCycleState(groupId, c);
        states[c] = state;
      } catch (err) {
        console.error(`Failed to fetch cycle state for cycle ${c}:`, err);
      }
    }
    setHistoryCycles(states);
  }, [groupId]);

  useEffect(() => {
    if (connected && groupId) {
      fetchGroupInfo().catch((err) => console.error("Error fetching group info:", err));
      fetchMembers().catch((err) => console.error("Error fetching members:", err));
    }
  }, [connected, groupId, fetchGroupInfo, fetchMembers]);

  useEffect(() => {
    if (groupInfo && groupInfo.current_cycle > 0) {
      fetchCycleState(groupInfo.current_cycle).catch((err) => console.error("Error fetching cycle state:", err));
      fetchAllCycleStates(groupInfo.current_cycle).catch((err) => console.error("Error fetching all cycle states:", err));
    }
  }, [groupInfo, fetchCycleState, fetchAllCycleStates]);

  const handleRaiseDispute = async () => {
    if (!disputeReason) {
      toast.error("Please enter a reason");
      return;
    }
    setSubmittingDispute(true);
    try {
      await dispute(disputeReason);
      toast.success("Dispute raised successfully! Redirecting to disputes page...");
      setIsDisputeModalOpen(false);
      router.push("/disputes");
    } catch (err: any) {
      toast.error(err.message || "Failed to raise dispute");
    } finally {
      setSubmittingDispute(false);
    }
  };

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
            <div className="flex items-center gap-2">
              <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${getStateColor(groupInfo.state)}`}>
                {groupInfo.state}
              </span>
              {isMember && groupInfo.state !== "Completed" && (
                <button
                  onClick={() => setIsDisputeModalOpen(true)}
                  className="btn-secondary text-xs px-2.5 py-0.5 flex items-center gap-1 border-chit-warning/30 hover:border-chit-warning/60 text-chit-warning bg-chit-warning/5"
                >
                  ⚠️ Raise Dispute
                </button>
              )}
            </div>
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
          isRevealed={cycleState && address ? !!cycleState.bids[address]?.revealed : false}
          onBidCommitted={() => { fetchGroupInfo(); fetchCycleState(groupInfo.current_cycle); }}
          onBidRevealed={() => { fetchGroupInfo(); fetchCycleState(groupInfo.current_cycle); }}
        />
      )}

      {groupInfo.state === "Bidding" && (
        <div className="glass-card p-6 mb-6">
          <h3 className="text-lg font-semibold mb-2">Execute Payout</h3>
          <p className="text-chit-muted text-sm mb-4">
            Once all members have committed and revealed their bids, click below to calculate the winner and transfer the pool.
          </p>
          <button
            onClick={() => {
              payout()
                .then(() => {
                  toast.success("Payout executed successfully!");
                  fetchGroupInfo();
                  fetchCycleState(groupInfo.current_cycle);
                })
                .catch((e) => toast.error(e.message));
            }}
            className="btn-primary w-full"
          >
            Execute Payout
          </button>
        </div>
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

      {/* Historical Cycles */}
      {Object.keys(historyCycles).length > 0 && (
        <div className="glass-card p-6 mt-6 space-y-4">
          <h3 className="text-lg font-semibold">Completed Cycle History</h3>
          <div className="space-y-3">
            {Object.entries(historyCycles)
              .map(([cycleNum, state]) => ({ num: Number(cycleNum), state }))
              .filter(({ num, state }) => num < groupInfo.current_cycle || state.winner)
              .map(({ num, state }) => (
                <div key={num} className="p-4 rounded-lg bg-chit-bg border border-chit-border/40 flex items-center justify-between text-sm">
                  <div>
                    <h4 className="font-semibold text-chit-text">Cycle {num}</h4>
                    <p className="text-chit-muted text-xs">
                      Winner: {state.winner ? shortenAddress(state.winner, 6) : "None"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-emerald-400">
                      {state.winning_bid > 0 ? formatUsdc(state.winning_bid) : "No bid (default)"}
                    </p>
                    <p className="text-chit-muted text-xs">Winning Bid</p>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Dispute Modal */}
      {isDisputeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card max-w-md w-full p-6 space-y-4 shadow-xl border-chit-border/40 bg-chit-card">
            <h3 className="text-lg font-semibold text-chit-warning flex items-center gap-2">
              ⚠️ Raise a Group Dispute
            </h3>
            <p className="text-chit-muted text-xs leading-relaxed">
              This will log an on-chain dispute against this group. 3-of-5 multi-sig arbitrators will review the case.
            </p>
            <div>
              <label className="block text-chit-muted text-xs mb-1">Reason for Dispute</label>
              <textarea
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                placeholder="e.g. Member failed to pay contribution on time"
                className="w-full h-24 px-3 py-2 text-sm rounded-lg bg-chit-bg border border-chit-border focus:border-stellar-600 outline-none resize-none text-chit-text"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setIsDisputeModalOpen(false)}
                className="btn-secondary w-full"
                disabled={submittingDispute}
              >
                Cancel
              </button>
              <button
                onClick={handleRaiseDispute}
                className="btn-primary w-full bg-gradient-to-r from-amber-600 to-red-600 hover:from-amber-500 hover:to-red-500 border-none"
                disabled={submittingDispute}
              >
                {submittingDispute ? "Submitting..." : "Submit Dispute"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
