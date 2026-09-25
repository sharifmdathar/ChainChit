"use client";

import { useState } from "react";
import { QrCode } from "@/components/QrCode";
import { shortenAddress } from "@/lib/utils";
import toast from "react-hot-toast";

interface InviteModalProps {
  groupId: string;
  onClose: () => void;
}

// Share sheet for a group: QR + link that deep-opens the group page with
// ?join=1, which auto-prompts Join once the wallet is connected.
export function InviteModal({ groupId, onClose }: InviteModalProps) {
  const [copied, setCopied] = useState(false);
  const url = `${typeof window !== "undefined" ? window.location.origin : ""}/group/${groupId}?join=1`;
  const waLink = `https://wa.me/?text=${encodeURIComponent(`Join my chit fund pool on ChainChit: ${url}`)}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Invite link copied!");
    } catch {
      toast.error("Copy failed — select the link manually");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4" onClick={onClose}>
      <div
        className="glass-card max-w-sm w-full p-6 space-y-4 shadow-xl border-chit-border/40 bg-chit-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-chit-text">Invite to Pool {shortenAddress(groupId, 5)}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl leading-none px-1" aria-label="Close">
            ×
          </button>
        </div>

        <div className="flex justify-center">
          <div className="bg-white p-3 rounded-xl">
            <QrCode value={url} size={180} />
          </div>
        </div>
        <p className="text-chit-muted text-[11px] text-center leading-relaxed">
          Scan or share the link — it opens the pool and pre-prompts <span className="text-slate-300 font-medium">Join</span> after wallet connect.
        </p>

        <div className="flex items-center gap-2">
          <input
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="flex-1 min-w-0 px-3 py-2 text-xs rounded-lg bg-chit-bg border border-chit-border text-slate-300 font-mono"
          />
          <button onClick={copy} className="btn-secondary text-xs whitespace-nowrap">
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>

        <div className="flex gap-2">
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary flex-1 text-center text-xs bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/50 text-emerald-400"
          >
            Share on WhatsApp
          </a>
          {typeof navigator !== "undefined" && "share" in navigator && (
            <button
              onClick={() => navigator.share({ title: "ChainChit pool invite", url }).catch(() => {})}
              className="btn-secondary flex-1 text-xs"
            >
              More options…
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
