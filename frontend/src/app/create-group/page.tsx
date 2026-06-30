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

    const contribAmount = Math.round(Number(contribution) * 10_000_000);
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

  const previewContribution = Number(contribution) || 0;
  const previewMembers = Number(numMembers) || 0;
  const previewCycles = Number(totalCycles) || 0;
  const previewPool = previewContribution * previewMembers;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 animate-fade-in-up">
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight">Create a Chit Group</h1>
        <p className="text-slate-400 text-sm mt-1">Deploy a customized, secure rotating savings pool on Soroban smart contracts.</p>
      </div>

      <div className="grid md:grid-cols-5 gap-8 items-start">
        {/* Creation Form */}
        <form onSubmit={handleSubmit} className="md:col-span-3 glass-card p-6 space-y-5 border border-white/[0.04]">
          <div>
            <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              Contribution Amount (USDC)
            </label>
            <input
              type="number"
              value={contribution}
              onChange={(e) => setContribution(e.target.value)}
              placeholder="e.g. 10"
              step="any"
              min="0.000001"
              required
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-white/[0.08] text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-sm font-medium transition-all"
            />
            {contribution && (
              <p className="text-emerald-400 text-xs font-semibold mt-1">
                Equivalent to {Math.round(Number(contribution) * 10_000_000).toLocaleString()} base units
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                Number of Members
              </label>
              <input
                type="number"
                value={numMembers}
                onChange={(e) => setNumMembers(e.target.value)}
                min="2"
                required
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-white/[0.08] text-slate-100 focus:border-indigo-500 outline-none text-sm font-medium transition-all"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                Total Cycles
              </label>
              <input
                type="number"
                value={totalCycles}
                onChange={(e) => setTotalCycles(e.target.value)}
                min="2"
                required
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-white/[0.08] text-slate-100 focus:border-indigo-500 outline-none text-sm font-medium transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                Min Attestation Score
              </label>
              <input
                type="number"
                value={minAttestation}
                onChange={(e) => setMinAttestation(e.target.value)}
                min="0"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-white/[0.08] text-slate-100 focus:border-indigo-500 outline-none text-sm font-medium transition-all"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                Min Reputation (bps)
              </label>
              <input
                type="number"
                value={minReputation}
                onChange={(e) => setMinReputation(e.target.value)}
                min="0"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-white/[0.08] text-slate-100 focus:border-indigo-500 outline-none text-sm font-medium transition-all"
              />
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-4">
            {loading ? "Deploying Smart Contract..." : "Deploy Group Contract"}
          </button>
        </form>

        {/* Live Preview Card */}
        <div className="md:col-span-2 space-y-4">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider px-1">Live Preview</p>
          
          <div className="glass-card p-6 border border-indigo-500/20 relative overflow-hidden flex flex-col justify-between min-h-[220px]">
            {/* Ambient indicator */}
            <div className="absolute top-0 right-0 px-3 py-1 rounded-bl-xl text-[9px] font-bold bg-indigo-600/10 text-indigo-400 border-l border-b border-indigo-500/20 uppercase tracking-widest">
              Preview Mode
            </div>

            <div className="w-full">
              <div className="flex items-start justify-between mb-4 mt-2">
                <span className="inline-block px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 uppercase tracking-wider">
                  Forming
                </span>
                <span className="text-slate-400 text-xs font-semibold">
                  Cycle 0 / {previewCycles}
                </span>
              </div>
              
              <div className="mb-4">
                <p className="text-3xl font-black text-slate-100 tracking-tight">
                  {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(previewPool)}
                </p>
                <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wider mt-0.5">Estimated Pool Per Cycle</p>
              </div>
            </div>

            <div className="w-full">
              <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                <div>
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Contribution</p>
                  <p className="font-semibold text-slate-200">
                    {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(previewContribution)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Members Required</p>
                  <p className="font-semibold text-slate-200">0 / {previewMembers}</p>
                </div>
              </div>

              {/* Progress visual */}
              <div className="w-full bg-slate-900 rounded-full h-2 border border-white/[0.03] overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-500 to-cyan-500 h-2 rounded-full w-[10%] transition-all duration-300 shadow-sm shadow-indigo-500/50" />
              </div>
            </div>
          </div>

          {/* Details summary */}
          <div className="glass-card p-4 space-y-3 bg-slate-900/30 text-xs border border-white/[0.03]">
            <h4 className="font-bold text-slate-300 uppercase tracking-wider text-[10px]">Contract Settings</h4>
            <div className="space-y-1.5 text-slate-400">
              <div className="flex justify-between">
                <span>Minimum Attestation Score:</span>
                <span className="font-mono text-slate-200">{minAttestation || "0"}</span>
              </div>
              <div className="flex justify-between">
                <span>Minimum Bidding Reputation:</span>
                <span className="font-mono text-slate-200">{minReputation || "0"} bps</span>
              </div>
              <div className="flex justify-between">
                <span>Total Pool Cycles:</span>
                <span className="font-mono text-slate-200">{previewCycles} months</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
