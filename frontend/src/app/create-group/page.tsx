"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/hooks/useWallet";
import { createGroup } from "@/lib/contracts";
import toast from "react-hot-toast";

export default function CreateGroupPage() {
  const router = useRouter();
  const { connected, address } = useWallet();
  const [contribution, setContribution] = useState("");
  const [numMembers, setNumMembers] = useState("5");
  const [totalCycles, setTotalCycles] = useState("5");
  const [minAttestation, setMinAttestation] = useState("0");
  const [minReputation, setMinReputation] = useState("0");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connected || !address) {
      toast.error("Connect wallet first");
      return;
    }

    const contribAmount = Math.round(Number(contribution) * 1_000_000);
    const members = Number(numMembers);
    const cycles = Number(totalCycles);
    const minAtt = Number(minAttestation);
    const minRep = Number(minReputation);

    if (contribAmount <= 0 || members < 2 || cycles < 2) {
      toast.error("Invalid parameters. Min 2 members, 2 cycles, positive contribution.");
      return;
    }

    setLoading(true);
    try {
      const usdcContract = process.env.NEXT_PUBLIC_USDC_CONTRACT || "";
      if (!usdcContract) {
        toast.error("USDC contract not configured");
        return;
      }

      const salt = new Uint8Array(32);
      crypto.getRandomValues(salt);

      const groupId = await createGroup({
        caller: address,
        salt,
        token: usdcContract,
        contributionAmount: contribAmount,
        numMembers: members,
        totalCycles: cycles,
        minAttestationScore: minAtt,
        minReputationForBid: minRep,
      });

      toast.success(`Group created successfully! ID: ${groupId}`);
      router.push("/dashboard");
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg || "Failed to create group");
    } finally {
      setLoading(false);
    }
  };

  if (!connected) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-chit-muted">Connect your wallet to create a group.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Create a Chit Group</h1>
      <form onSubmit={handleSubmit} className="glass-card p-6 space-y-4">
        <div>
          <label className="block text-chit-muted text-sm mb-1">Contribution Amount (in USDC)</label>
          <input
            type="number"
            value={contribution}
            onChange={(e) => setContribution(e.target.value)}
            placeholder="e.g. 10"
            step="any"
            min="0.000001"
            required
            className="w-full px-3 py-2 rounded-lg bg-chit-bg border border-chit-border text-chit-text focus:border-stellar-600 outline-none text-sm"
          />
          {contribution && (
            <p className="text-emerald-400 text-xs mt-1">
              Equivalent to {Math.round(Number(contribution) * 1_000_000).toLocaleString()} base units
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-chit-muted text-sm mb-1">Number of Members</label>
            <input
              type="number"
              value={numMembers}
              onChange={(e) => setNumMembers(e.target.value)}
              min="2"
              required
              className="w-full px-3 py-2 rounded-lg bg-chit-bg border border-chit-border text-chit-text focus:border-stellar-600 outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-chit-muted text-sm mb-1">Total Cycles</label>
            <input
              type="number"
              value={totalCycles}
              onChange={(e) => setTotalCycles(e.target.value)}
              min="2"
              required
              className="w-full px-3 py-2 rounded-lg bg-chit-bg border border-chit-border text-chit-text focus:border-stellar-600 outline-none text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-chit-muted text-sm mb-1">Min Attestation Score</label>
            <input
              type="number"
              value={minAttestation}
              onChange={(e) => setMinAttestation(e.target.value)}
              min="0"
              className="w-full px-3 py-2 rounded-lg bg-chit-bg border border-chit-border text-chit-text focus:border-stellar-600 outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-chit-muted text-sm mb-1">Min Reputation for Bidding (bps)</label>
            <input
              type="number"
              value={minReputation}
              onChange={(e) => setMinReputation(e.target.value)}
              min="0"
              className="w-full px-3 py-2 rounded-lg bg-chit-bg border border-chit-border text-chit-text focus:border-stellar-600 outline-none text-sm"
            />
          </div>
        </div>

        <div className="pt-2">
          <div className="glass-card p-4 bg-stellar-600/5">
            <p className="text-chit-muted text-sm">
              Pool size per cycle: <span className="text-chit-text font-bold">
                {contribution && numMembers
                  ? `${(Number(contribution) * Number(numMembers) / 1_000_000).toFixed(2)} USDC`
                  : "—"}
              </span>
            </p>
            <p className="text-chit-muted text-xs mt-1">
              Each member contributes, and the lowest unique bidder wins the pool.
            </p>
          </div>
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Creating..." : "Create Group"}
        </button>
      </form>
    </div>
  );
}
