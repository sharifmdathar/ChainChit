"use client";

import { useState, useCallback } from "react";
import {
  getReputation, getOnTimeRatio, getCompositeScore, isEstablished,
} from "@/lib/contracts";
import type { ReputationData } from "@/types";

interface UseReputationReturn {
  reputation: ReputationData | null;
  onTimeRatio: number;
  compositeScore: number;
  established: boolean;
  loading: boolean;
  error: string | null;
  fetchReputation: (address: string) => Promise<void>;
  fetchScore: (address: string) => Promise<void>;
}

export function useReputation(): UseReputationReturn {
  const [reputation, setReputation] = useState<ReputationData | null>(null);
  const [onTimeRatio, setOnTimeRatio] = useState<number>(0);
  const [compositeScore, setCompositeScore] = useState<number>(0);
  const [established, setEstablished] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReputation = useCallback(async (address: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getReputation(address);
      setReputation(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch reputation";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchScore = useCallback(async (address: string) => {
    setLoading(true);
    setError(null);
    try {
      const [ratio, score, est] = await Promise.all([
        getOnTimeRatio(address),
        getCompositeScore(address),
        isEstablished(address),
      ]);
      setOnTimeRatio(ratio);
      setCompositeScore(score);
      setEstablished(est);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch score";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    reputation, onTimeRatio, compositeScore, established, loading, error,
    fetchReputation, fetchScore,
  };
}
