"use client";

import { useState, useCallback } from "react";
import { useWallet } from "@/hooks/useWallet";
import {
  getAttestationScore, isAttested, getVouchors, getAttestationCount, vouchFor,
} from "@/lib/contracts";

interface UseIdentityReturn {
  attestationScore: number;
  attested: boolean;
  vouchors: string[];
  attestationCount: number;
  loading: boolean;
  error: string | null;
  fetchAttestation: (address: string) => Promise<void>;
  vouch: (vouchee: string) => Promise<void>;
}

export function useIdentity(): UseIdentityReturn {
  const { address } = useWallet();
  const [attestationScore, setAttestationScore] = useState<number>(0);
  const [attested, setAttested] = useState<boolean>(false);
  const [vouchors, setVouchors] = useState<string[]>([]);
  const [attestationCount, setAttestationCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAttestation = useCallback(async (address: string) => {
    setLoading(true);
    setError(null);
    try {
      const [score, isAtt, vouchList, count] = await Promise.all([
        getAttestationScore(address),
        isAttested(address),
        getVouchors(address),
        getAttestationCount(address),
      ]);
      setAttestationScore(score);
      setAttested(isAtt);
      setVouchors(vouchList);
      setAttestationCount(count);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch attestation";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const vouch = useCallback(async (vouchee: string) => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      await vouchFor(address, vouchee);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Vouch failed";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [address]);

  return { attestationScore, attested, vouchors, attestationCount, loading, error, fetchAttestation, vouch };
}
