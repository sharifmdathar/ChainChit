"use client";

import { useState, useCallback } from "react";
import { useWallet } from "@/hooks/useWallet";
import { vouchFor, getAttestationScore, isAttested, getVouchors, getAttestationCount } from "@/lib/contracts";
import { shortenAddress } from "@/lib/utils";
import toast from "react-hot-toast";

interface AttestationFlowProps {
  targetAddress: string;
  onAttested?: () => void;
}

export default function AttestationFlow({ targetAddress, onAttested }: AttestationFlowProps) {
  const { connected, address } = useWallet();
  const [vouchingFor, setVouchingFor] = useState("");
  const [loading, setLoading] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [attested, setAttested] = useState<boolean | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [vouchors, setVouchors] = useState<string[]>([]);
  const [fetching, setFetching] = useState(false);

  const fetchAttestationData = useCallback(async () => {
    if (!targetAddress) return;
    setFetching(true);
    try {
      const s = await getAttestationScore(targetAddress);
      setScore(s);
      const a = await isAttested(targetAddress);
      setAttested(a);
      const c = await getAttestationCount(targetAddress);
      setCount(c);
      const v = await getVouchors(targetAddress);
      setVouchors(v);
    } catch {
      // Score may be 0 for new accounts – that is expected.
      setScore(0);
      setAttested(false);
      setCount(0);
      setVouchors([]);
    } finally {
      setFetching(false);
    }
  }, [targetAddress]);

  const handleVouch = useCallback(async () => {
    if (!connected || !address) {
      toast.error("Connect wallet first");
      return;
    }

    const vouchee = vouchingFor.trim();
    if (!vouchee) {
      toast.error("Enter an address to vouch for");
      return;
    }

    if (vouchee === address) {
      toast.error("Cannot vouch for yourself");
      return;
    }

    setLoading(true);
    try {
      await vouchFor(address, vouchee);
      toast.success(`Vouched for ${shortenAddress(vouchee)}`);
      setVouchingFor("");
      onAttested?.();
      fetchAttestationData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Vouch failed");
    } finally {
      setLoading(false);
    }
  }, [connected, address, vouchingFor, onAttested, fetchAttestationData]);

  return (
    <div className="glass-card p-6 space-y-4">
      <h3 className="text-lg font-semibold">Identity Attestation</h3>
      <p className="text-chit-muted text-sm">
        Vouch for trusted community members. Your reputation score determines your vouch weight.
      </p>

      {/* Current attestation status */}
      <div className="space-y-2">
        {fetching ? (
          <p className="text-chit-muted text-sm">Loading attestation data...</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-chit-bg text-center">
                <p className="text-chit-muted text-xs">Score</p>
                <p className="text-lg font-bold text-chit-text">{score ?? "—"}</p>
              </div>
              <div className="p-3 rounded-lg bg-chit-bg text-center">
                <p className="text-chit-muted text-xs">Vouches</p>
                <p className="text-lg font-bold text-chit-text">{count ?? "—"}</p>
              </div>
              <div className="p-3 rounded-lg bg-chit-bg text-center">
                <p className="text-chit-muted text-xs">Status</p>
                <p className={`text-lg font-bold ${attested ? "text-chit-success" : "text-chit-danger"}`}>
                  {attested === null ? "—" : attested ? "Verified" : "Unverified"}
                </p>
              </div>
            </div>

            {vouchors.length > 0 && (
              <div>
                <p className="text-chit-muted text-xs mb-1">Vouched by:</p>
                <div className="flex flex-wrap gap-1">
                  {vouchors.map((v, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 text-xs rounded-full bg-stellar-600/10 text-stellar-600"
                    >
                      {shortenAddress(v)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <button
          onClick={fetchAttestationData}
          disabled={fetching || !targetAddress}
          className="btn-secondary text-sm"
        >
          Refresh
        </button>
      </div>

      {/* Vouch for someone */}
      <div className="border-t border-chit-border pt-4">
        <label className="block text-chit-muted text-sm mb-1">Vouch for address</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={vouchingFor}
            onChange={(e) => setVouchingFor(e.target.value)}
            placeholder="G..."
            className="flex-1 px-3 py-2 rounded-lg bg-chit-bg border border-chit-border text-chit-text focus:border-stellar-600 outline-none text-sm font-mono"
          />
          <button
            onClick={handleVouch}
            disabled={loading || !connected}
            className="btn-primary whitespace-nowrap"
          >
            {loading ? "Vouching..." : "Vouch"}
          </button>
        </div>
      </div>
    </div>
  );
}
