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
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Disputes</h1>
        {isArbitrator && (
          <span className="px-2 py-1 text-xs rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
            Arbitrator
          </span>
        )}
      </div>

      {/* Lookup by ID */}
      <div className="glass-card p-4">
        <div className="flex gap-2">
          <input
            type="number"
            value={disputeIdInput}
            onChange={(e) => setDisputeIdInput(e.target.value)}
            placeholder="Dispute ID"
            min="1"
            className="flex-1 px-3 py-2 rounded-lg bg-chit-bg border border-chit-border text-chit-text focus:border-stellar-600 outline-none text-sm"
          />
          <button onClick={handleLookup} className="btn-secondary">
            Lookup
          </button>
        </div>
      </div>

      {/* Raise Dispute */}
      <div className="glass-card p-4 space-y-3">
        <h2 className="text-sm font-semibold text-chit-text">Raise Dispute</h2>
        <div className="flex flex-col md:flex-row gap-2">
          <input
            type="text"
            value={groupIdInput}
            onChange={(e) => setGroupIdInput(e.target.value)}
            placeholder="Group ID (contract address)"
            className="flex-1 md:w-1/3 px-3 py-2 rounded-lg bg-chit-bg border border-chit-border text-chit-text focus:border-stellar-600 outline-none text-sm"
          />
          <input
            type="text"
            value={raiseReason}
            onChange={(e) => setRaiseReason(e.target.value)}
            placeholder="Reason for dispute (e.g. member defaulted on cycle 1)"
            className="flex-1 md:w-2/3 px-3 py-2 rounded-lg bg-chit-bg border border-chit-border text-chit-text focus:border-stellar-600 outline-none text-sm"
          />
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
            className="btn-primary whitespace-nowrap"
          >
            {raising ? "Raising..." : "Raise Dispute"}
          </button>
        </div>
      </div>

      {/* Dispute List */}
      {loading ? (
        <p className="text-chit-muted text-sm">Loading disputes...</p>
      ) : disputes.length === 0 ? (
        <div className="glass-card p-6 text-center">
          <p className="text-chit-muted">No active disputes found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {disputes.map((d) => (
            <button
              key={d.id}
              onClick={() => setSelectedDispute(d)}
              className="w-full glass-card p-4 text-left hover:border-stellar-600/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-chit-text">Dispute #{d.id}</p>
                  <p className="text-chit-muted text-sm">
                    Cycle {d.cycle} · {shortenAddress(d.raiser)}
                  </p>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full border ${
                  d.status === "Open" ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" :
                  d.status === "Voting" ? "bg-purple-500/20 text-purple-400 border-purple-500/30" :
                  d.status === "Resolved" ? "bg-green-500/20 text-green-400 border-green-500/30" :
                  "bg-gray-500/20 text-gray-400 border-gray-500/30"
                }`}>
                  {d.status}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

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
