"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@/hooks/useWallet";
import { getDispute, getArbitrators, raiseDispute } from "@/lib/contracts";
import { shortenAddress } from "@/lib/utils";
import DisputeModal from "@/components/DisputeModal";
import type { DisputeRecord } from "@/types";
import toast from "react-hot-toast";

export default function DisputesPage() {
  const { connected, address } = useWallet();
  const [disputes, setDisputes] = useState<DisputeRecord[]>([]);
  const [selectedDispute, setSelectedDispute] = useState<DisputeRecord | null>(null);
  const [arbitrators, setArbitrators] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [disputeIdInput, setDisputeIdInput] = useState("");
  const [groupIdInput, setGroupIdInput] = useState("");
  const [raiseReason, setRaiseReason] = useState("");
  const [raising, setRaising] = useState(false);

  const isArbitrator = address ? arbitrators.includes(address) : false;

  const fetchDispute = useCallback(async (id: number): Promise<DisputeRecord | null> => {
    try {
      return await getDispute(id);
    } catch {
      return null;
    }
  }, []);

  const fetchAllDisputes = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch arbitrators list
      const arbs = await getArbitrators();
      setArbitrators(arbs);

      // Scan for disputes (try IDs 1..20; in production, use event indexing)
      const found: DisputeRecord[] = [];
      for (let i = 1; i <= 20; i++) {
        const d = await fetchDispute(i);
        if (d) found.push(d);
      }
      setDisputes(found);
    } catch {
      toast.error("Failed to load disputes");
    } finally {
      setLoading(false);
    }
  }, [fetchDispute]);

  useEffect(() => {
    if (connected) fetchAllDisputes();
  }, [connected, fetchAllDisputes]);

  const handleLookup = useCallback(async () => {
    const id = Number(disputeIdInput);
    if (!id || id <= 0) {
      toast.error("Enter a valid dispute ID");
      return;
    }

    const d = await fetchDispute(id);
    if (d) {
      setSelectedDispute(d);
    } else {
      toast.error("Dispute not found");
    }
  }, [disputeIdInput, fetchDispute]);

  if (!connected) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-chit-muted">Connect your wallet to view disputes.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight">Arbitration Center</h1>
          <p className="text-slate-400 text-sm mt-1">Review active disputes, lookup records, or file a smart contract complaint.</p>
        </div>
        {isArbitrator && (
          <span className="px-3 py-1 text-xs font-bold rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 shadow-sm animate-pulse">
            Vetted Arbitrator
          </span>
        )}
      </div>

      {/* Lookup & File Dispute side-by-side */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Lookup Card */}
        <div className="md:col-span-1 glass-card p-5 border border-white/[0.04] flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Dispute Lookup</h3>
            <p className="text-slate-500 text-xs mb-3">Retrieve details of specific disputes on-chain by their record index.</p>
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              value={disputeIdInput}
              onChange={(e) => setDisputeIdInput(e.target.value)}
              placeholder="Case ID"
              min="1"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/[0.08] text-slate-100 placeholder-slate-600 focus:border-indigo-500 outline-none text-xs transition-all"
            />
            <button onClick={handleLookup} className="btn-secondary text-xs px-4 py-2">
              Find
            </button>
          </div>
        </div>

        {/* Raise Dispute Form Card */}
        <div className="md:col-span-2 glass-card p-5 border border-white/[0.04] space-y-3">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">File Smart Dispute</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <input
              type="text"
              value={groupIdInput}
              onChange={(e) => setGroupIdInput(e.target.value)}
              placeholder="Contract address (G...)"
              className="px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/[0.08] text-slate-100 placeholder-slate-600 focus:border-indigo-500 outline-none text-xs font-mono transition-all"
            />
            <input
              type="text"
              value={raiseReason}
              onChange={(e) => setRaiseReason(e.target.value)}
              placeholder="Reason for dispute (default on cycle 2)"
              className="px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/[0.08] text-slate-100 placeholder-slate-600 focus:border-indigo-500 outline-none text-xs transition-all"
            />
          </div>
          <button
            onClick={async () => {
              if (!groupIdInput.trim()) { toast.error("Enter a group ID"); return; }
              if (!raiseReason.trim()) { toast.error("Enter a reason"); return; }
              setRaising(true);
              try {
                await raiseDispute(groupIdInput.trim(), address!, raiseReason.trim());
                toast.success("Dispute raised successfully!");
                setRaiseReason("");
                fetchAllDisputes();
              } catch (err: unknown) {
                toast.error(err instanceof Error ? err.message : "Failed to raise dispute");
              } finally {
                setRaising(false);
              }
            }}
            disabled={raising || !raiseReason.trim()}
            className="btn-primary w-full py-2.5 text-xs bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 border-none shadow-sm"
          >
            {raising ? "Submitting Dispute..." : "File Official Complaint"}
          </button>
        </div>
      </div>

      {/* Dispute Logs List */}
      <div>
        <h2 className="text-lg font-bold text-slate-200 tracking-tight mb-4 flex items-center gap-2">
          <span>Active Case Files</span>
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-900 border border-white/[0.05] text-slate-400">
            {disputes.length}
          </span>
        </h2>
        {loading ? (
          <div className="shimmer-bg glass-card text-center py-8 text-slate-400">
            <span className="animate-pulse">Loading arbitration case files...</span>
          </div>
        ) : disputes.length === 0 ? (
          <div className="glass-card p-8 text-center text-slate-400">
            No active disputes filed on this network.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {disputes.map((d) => (
              <button
                key={d.id}
                onClick={() => setSelectedDispute(d)}
                className="glass-card p-4 text-left transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] border border-white/[0.04] flex flex-col justify-between h-[110px]"
              >
                <div className="flex items-center justify-between w-full">
                  <div>
                    <p className="font-extrabold text-slate-200 text-sm">Dispute Case #{d.id}</p>
                    <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wider mt-0.5">
                      Cycle {d.cycle} · {shortenAddress(d.raiser, 5)}
                    </p>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider ${
                    d.status === "Open" ? "bg-amber-500/10 border-amber-500/30 text-amber-400" :
                    d.status === "Voting" ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400" :
                    d.status === "Resolved" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" :
                    "bg-slate-900 border-white/[0.08] text-slate-500"
                  }`}>
                    {d.status}
                  </span>
                </div>
                <p className="text-slate-400 text-xs truncate w-full mt-3 border-t border-white/[0.03] pt-2">
                  {d.reason}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Dispute Modal */}
      {selectedDispute && (
        <DisputeModal
          dispute={selectedDispute}
          onClose={() => setSelectedDispute(null)}
          isArbitrator={isArbitrator}
          onVoted={fetchAllDisputes}
        />
      )}
    </div>
  );
}
