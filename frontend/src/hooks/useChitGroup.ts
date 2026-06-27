"use client";

import { useState, useCallback } from "react";
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
} from "@/lib/contracts";
import type { GroupInfo, CycleState } from "@/types";

interface UseChitGroupReturn {
  groupInfo: GroupInfo | null;
  members: string[];
  cycleState: CycleState | null;
  loading: boolean;
  error: string | null;
  fetchGroupInfo: () => Promise<void>;
  fetchMembers: () => Promise<void>;
  fetchCycleState: (cycle: number) => Promise<void>;
  join: () => Promise<void>;
  start: () => Promise<void>;
  pay: () => Promise<void>;
  commit: (commitment: number[]) => Promise<void>;
  reveal: (amount: number, nonce: number) => Promise<void>;
  payout: () => Promise<void>;
  advance: () => Promise<void>;
  dispute: (reason: string) => Promise<void>;
}

export function useChitGroup(contractId: string): UseChitGroupReturn {
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [members, setMembers] = useState<string[]>([]);
  const [cycleState, setCycleState] = useState<CycleState | null>(null);
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

  const join = useCallback(async () => {
    if (!contractId) return;
    await withLoading(async () => { await joinGroup(contractId); });
  }, [withLoading, contractId]);

  const start = useCallback(async () => {
    if (!contractId) return;
    await withLoading(async () => { await startCollection(contractId); });
  }, [withLoading, contractId]);

  const pay = useCallback(async () => {
    if (!contractId) return;
    await withLoading(async () => { await payContribution(contractId); });
  }, [withLoading, contractId]);

  const commit = useCallback(async (commitment: number[]) => {
    if (!contractId) return;
    await withLoading(async () => { await commitBid(contractId, commitment); });
  }, [withLoading, contractId]);

  const reveal = useCallback(async (amount: number, nonce: number) => {
    if (!contractId) return;
    await withLoading(async () => { await revealBid(contractId, amount, nonce); });
  }, [withLoading, contractId]);

  const payout = useCallback(async () => {
    if (!contractId) return;
    await withLoading(async () => { await executePayout(contractId); });
  }, [withLoading, contractId]);

  const advance = useCallback(async () => {
    if (!contractId) return;
    await withLoading(async () => { await advanceCycle(contractId); });
  }, [withLoading, contractId]);

  const dispute = useCallback(async (reason: string) => {
    if (!contractId) return;
    await withLoading(async () => { await raiseDispute(contractId, reason); });
  }, [withLoading, contractId]);

  return {
    groupInfo, members, cycleState, loading, error,
    fetchGroupInfo, fetchMembers, fetchCycleState,
    join, start, pay, commit, reveal, payout, advance, dispute,
  };
}
