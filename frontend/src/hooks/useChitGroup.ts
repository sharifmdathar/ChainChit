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

export function useChitGroup(): UseChitGroupReturn {
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
    await withLoading(async () => {
      const info = await getGroupInfo();
      setGroupInfo(info);
    });
  }, [withLoading]);

  const fetchMembers = useCallback(async () => {
    await withLoading(async () => {
      const m = await getMembers();
      setMembers(m);
    });
  }, [withLoading]);

  const fetchCycleState = useCallback(async (cycle: number) => {
    await withLoading(async () => {
      const cs = await getCycleState(cycle);
      setCycleState(cs);
    });
  }, [withLoading]);

  const join = useCallback(async () => {
    await withLoading(async () => { await joinGroup(); });
  }, [withLoading]);

  const start = useCallback(async () => {
    await withLoading(async () => { await startCollection(); });
  }, [withLoading]);

  const pay = useCallback(async () => {
    await withLoading(async () => { await payContribution(); });
  }, [withLoading]);

  const commit = useCallback(async (commitment: number[]) => {
    await withLoading(async () => { await commitBid(commitment); });
  }, [withLoading]);

  const reveal = useCallback(async (amount: number, nonce: number) => {
    await withLoading(async () => { await revealBid(amount, nonce); });
  }, [withLoading]);

  const payout = useCallback(async () => {
    await withLoading(async () => { await executePayout(); });
  }, [withLoading]);

  const advance = useCallback(async () => {
    await withLoading(async () => { await advanceCycle(); });
  }, [withLoading]);

  const dispute = useCallback(async (reason: string) => {
    await withLoading(async () => { await raiseDispute(reason); });
  }, [withLoading]);

  return {
    groupInfo, members, cycleState, loading, error,
    fetchGroupInfo, fetchMembers, fetchCycleState,
    join, start, pay, commit, reveal, payout, advance, dispute,
  };
}
