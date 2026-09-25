"use client";

import { useEffect, useState } from "react";
import { getCycleState } from "@/lib/contracts";
import { formatUsdc, shortenAddress } from "@/lib/utils";
import type { CycleState } from "@/types";

interface AuctionLivestreamProps {
  groupId: string;
  cycle: number;
  pot: number; // contribution_amount * num_members (base units)
}

interface Row {
  address: string;
  revealed: boolean;
  amount: number;
}

// A spectate-friendly "auction broadcast" of the commit-reveal bid: a pulsing
// LIVE header, a heartbeat poll indicator, and a leaderboard that flips sealed
// commitments into revealed amounts as they land on-chain.
export default function AuctionLivestream({ groupId, cycle, pot }: AuctionLivestreamProps) {
  const [data, setData] = useState<CycleState | null>(null);
  const [beat, setBeat] = useState(0); // increments each poll → drives the pulse

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const st = await getCycleState(groupId, cycle);
        if (cancelled) return;
        setData(st);
        setBeat((b) => b + 1);
      } catch {
        /* keep last snapshot; non-fatal */
      }
    }
    poll();
    const t = setInterval(poll, 5_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [groupId, cycle]);

  const rows: Row[] = Object.entries(data?.bids ?? {}).map(([address, b]) => ({
    address,
    revealed: b.revealed,
    amount: b.amount,
  }));
  const revealedSorted = rows.filter((r) => r.revealed && r.amount > 0).sort((a, b) => a.amount - b.amount);
  const sealed = rows.filter((r) => !r.revealed);

  // Tentative leader: lowest *unique* revealed amount (a tie is not a winner).
  let leaderAmount: number | null = null;
  if (revealedSorted.length) {
    const lowest = revealedSorted[0].amount;
    const count = revealedSorted.filter((r) => r.amount === lowest).length;
    if (count === 1) leaderAmount = lowest;
  }

  return (
    <div className="glass-card p-6 mb-6 overflow-hidden relative border border-white/[0.05]">
      {/* Broadcast header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/15 border border-rose-500/30">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
            </span>
            <span className="text-[10px] font-black uppercase tracking-widest text-rose-300">Live</span>
          </span>
          <div>
            <h3 className="text-lg font-bold text-slate-100 tracking-tight leading-none">Auction Floor</h3>
            <p className="text-[11px] text-slate-500">Cycle {cycle} · pot {formatUsdc(pot)}</p>
          </div>
        </div>
        {/* Heartbeat equalizer — bars jump on every fresh poll */}
        <div key={beat} className="flex items-end gap-1 h-6" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="w-1 rounded-full bg-gradient-to-t from-indigo-600 to-emerald-400 animate-pulse"
              style={{ height: `${6 + ((beat + i * 3) % 5) * 3}px`, animationDelay: `${i * 90}ms` }}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5 text-center">
        <div className="rounded-xl bg-slate-900/40 border border-white/[0.05] py-2.5">
          <p className="text-xl font-black text-slate-100">{rows.length}</p>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Committed</p>
        </div>
        <div className="rounded-xl bg-slate-900/40 border border-white/[0.05] py-2.5">
          <p className="text-xl font-black text-emerald-400">{revealedSorted.length}</p>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Revealed</p>
        </div>
        <div className="rounded-xl bg-slate-900/40 border border-white/[0.05] py-2.5">
          <p className="text-xl font-black text-indigo-300">{sealed.length}</p>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Sealed</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-6 animate-pulse-glow">
          🎙️ The floor is open — no bids committed yet. First secret bids will appear here live.
        </p>
      ) : (
        <div className="space-y-2">
          {revealedSorted.map((r, i) => {
            const isLeader = leaderAmount !== null && r.amount === leaderAmount;
            return (
              <div
                key={r.address}
                className={`animate-fade-in-up flex items-center justify-between px-4 py-2.5 rounded-xl border text-sm transition-all ${
                  isLeader
                    ? "bg-emerald-500/10 border-emerald-500/40 shadow-[0_0_20px_-4px_rgba(16,185,129,0.5)]"
                    : "bg-slate-900/40 border-white/[0.05]"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-5 text-center text-xs font-mono text-slate-500">{i + 1}</span>
                  <span className="font-mono text-slate-300 text-xs">{shortenAddress(r.address, 4)}</span>
                  {isLeader && <span title="Lowest unique bid — tentative winner">👑</span>}
                </div>
                <span className={`font-bold font-mono ${isLeader ? "text-emerald-300" : "text-slate-200"}`}>
                  {formatUsdc(r.amount)}
                </span>
              </div>
            );
          })}

          {/* Sealed commitments as face-down cards */}
          {sealed.map((r) => (
            <div
              key={r.address}
              className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-dashed border-indigo-500/20 bg-indigo-500/[0.03] text-sm"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-5 text-center text-xs">🔒</span>
                <span className="font-mono text-slate-500 text-xs">{shortenAddress(r.address, 4)}</span>
              </div>
              <span className="font-mono text-indigo-300/70 tracking-widest animate-pulse">• • • • •</span>
            </div>
          ))}
        </div>
      )}

      {leaderAmount !== null && sealed.length > 0 && (
        <p className="text-[11px] text-slate-500 mt-3 text-center">
          Leader is provisional — {sealed.length} sealed bid{sealed.length > 1 ? "s" : ""} could still take the pot.
        </p>
      )}
    </div>
  );
}
