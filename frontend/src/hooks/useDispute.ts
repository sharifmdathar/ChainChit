"use client";

import { useState, useCallback } from "react";
import { getDispute, getArbitrators, castVote } from "@/lib/contracts";
import type { DisputeRecord, DisputeDecision } from "@/types";

interface UseDisputeReturn {
  dispute: DisputeRecord | null;
  arbitrators: string[];
  loading: boolean;
  error: string | null;
  fetchDispute: (id: number) => Promise<void>;
  fetchArbitrators: () => Promise<void>;
  vote: (disputeId: number, inFavor: boolean, decision: DisputeDecision) => Promise<void>;
}

export function useDispute(): UseDisputeReturn {
  const [dispute, setDispute] = useState<DisputeRecord | null>(null);
  const [arbitrators, setArbitrators] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDispute = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const d = await getDispute(id);
      setDispute(d);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch dispute";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchArbitrators = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const arbs = await getArbitrators();
      setArbitrators(arbs);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch arbitrators";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const vote = useCallback(async (disputeId: number, inFavor: boolean, decision: DisputeDecision) => {
    setLoading(true);
    setError(null);
    try {
      await castVote(disputeId, inFavor, decision);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Vote failed";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { dispute, arbitrators, loading, error, fetchDispute, fetchArbitrators, vote };
}
