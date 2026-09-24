"use client";

import { useState, useCallback } from "react";
import { useWallet } from "@/hooks/useWallet";
import {
  getGroupInfo,
  getMembers,
  getCycleState,
  joinGroup,
  startCollection,
  payContribution,
  commitBid,
  revealBid,
  executePayout,
  advanceCycle,
  raiseDispute,
  getCollectionDeadline,
  beginBiddingAfterDeadline,
} from "@/lib/contracts";
import type { GroupInfo, CycleState } from "@/types";

interface UseChitGroupReturn {
  groupInfo: GroupInfo | null;
  members: string[];
  cycleState: CycleState | null;
  deadline: number | null;
  loading: boolean;
  error: string | null;
  fetchGroupInfo: () => Promise<void>;
  fetchMembers: () => Promise<void>;
  fetchCycleState: (cycle: number) => Promise<void>;
  fetchDeadline: () => Promise<void>;
  join: () => Promise<void>;
  start: () => Promise<void>;
  pay: () => Promise<void>;
  commit: (commitment: number[]) => Promise<void>;
  reveal: (amount: number, nonce: number) => Promise<void>;
  payout: () => Promise<void>;
  advance: () => Promise<void>;
  dispute: (reason: string) => Promise<void>;
  beginBidding: () => Promise<void>;
}

export function useChitGroup(contractId: string): UseChitGroupReturn {
  const { address } = useWallet();
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [members, setMembers] = useState<string[]>([]);
  const [cycleState, setCycleState] = useState<CycleState | null>(null);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const withLoading = useCallback(async (fn: () => Promise<void>) => {
    setLoading(true);
    setError(null);
    try {
      await fn();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchGroupInfo = useCallback(async () => {
    if (!contractId) return;
    await withLoading(async () => {
      const info = await getGroupInfo(contractId);
      setGroupInfo(info);
    });
  }, [withLoading, contractId]);

  const fetchMembers = useCallback(async () => {
    if (!contractId) return;
    await withLoading(async () => {
      const m = await getMembers(contractId);
      setMembers(m);
    });
  }, [withLoading, contractId]);

  const fetchCycleState = useCallback(async (cycle: number) => {
    if (!contractId) return;
    await withLoading(async () => {
      const cs = await getCycleState(contractId, cycle);
      setCycleState(cs);
    });
  }, [withLoading, contractId]);

  // Silent read — does not toggle `loading` so the countdown effect stays smooth.
  const fetchDeadline = useCallback(async () => {
    if (!contractId) return;
    try {
      const d = await getCollectionDeadline(contractId);
      setDeadline(d);
    } catch {
      // Legacy groups on pre-upgrade wasm have no such function; treat as null.
      setDeadline(null);
    }
  }, [contractId]);

  const join = useCallback(async () => {
    if (!contractId || !address) return;
    await withLoading(async () => { await joinGroup(contractId, address); });
  }, [withLoading, contractId, address]);

  const start = useCallback(async () => {
    if (!contractId || !address) return;
    await withLoading(async () => { await startCollection(contractId, address); });
  }, [withLoading, contractId, address]);

  const pay = useCallback(async () => {
    if (!contractId || !address) return;
    await withLoading(async () => { await payContribution(contractId, address); });
  }, [withLoading, contractId, address]);

  const commit = useCallback(async (commitment: number[]) => {
    if (!contractId || !address) return;
    await withLoading(async () => { await commitBid(contractId, address, commitment); });
  }, [withLoading, contractId, address]);

  const reveal = useCallback(async (amount: number, nonce: number) => {
    if (!contractId || !address) return;
    await withLoading(async () => { await revealBid(contractId, address, amount, nonce); });
  }, [withLoading, contractId, address]);

  const payout = useCallback(async () => {
    if (!contractId) return;
    await withLoading(async () => { await executePayout(contractId); });
  }, [withLoading, contractId]);

  const advance = useCallback(async () => {
    if (!contractId || !address) return;
    await withLoading(async () => { await advanceCycle(contractId, address); });
  }, [withLoading, contractId, address]);

  const dispute = useCallback(async (reason: string) => {
    if (!contractId || !address) return;
    await withLoading(async () => { await raiseDispute(contractId, address, reason); });
  }, [withLoading, contractId, address]);

  const beginBidding = useCallback(async () => {
    if (!contractId) return;
    await withLoading(async () => { await beginBiddingAfterDeadline(contractId); });
  }, [withLoading, contractId]);

  return {
    groupInfo, members, cycleState, deadline, loading, error,
    fetchGroupInfo, fetchMembers, fetchCycleState, fetchDeadline,
    join, start, pay, commit, reveal, payout, advance, dispute, beginBidding,
  };
}
