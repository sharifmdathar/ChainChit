import type { CycleState, GroupState } from "@/types";
import { formatUsdc } from "@/lib/utils";

interface CycleProgressProps {
  totalCycles: number;
  currentCycle: number;
  groupState: GroupState;
  /** Winner lookup keyed by cycle number (from historical cycle fetches). */
  historyCycles: Record<number, CycleState>;
  /** Members who already paid in the active cycle. */
  paidCount: number;
  memberTotal: number;
}

/**
 * Per-cycle timeline strip + live contribution meter.
 * Shows where the committee stands at a glance: which cycles are done,
 * who won them, and how many contributions have landed in the open cycle.
 */
export function CycleProgress({
  totalCycles,
  currentCycle,
  groupState,
  historyCycles,
  paidCount,
  memberTotal,
}: CycleProgressProps) {
  const isDone = (c: number) => {
    const st = historyCycles[c];
    return !!st?.winner || (c < currentCycle && groupState !== "Forming");
  };
  const isActive = (c: number) =>
    groupState !== "Completed" && groupState !== "Paused" && c === currentCycle;

  const paidPercent = memberTotal > 0 ? Math.round((paidCount / memberTotal) * 100) : 0;
  const showMeter = groupState === "Collecting" || groupState === "Bidding";

  return (
    <div className="glass-card p-5 mb-6 border border-white/[0.04]">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Committee Timeline</p>
        <span className="text-xs text-slate-400 font-semibold">
          Cycle {currentCycle} of {totalCycles}
        </span>
      </div>

      {/* Cycle chips */}
      <div className="flex flex-wrap gap-2 mb-5">
        {Array.from({ length: totalCycles }, (_, i) => i + 1).map((c) => {
          const done = isDone(c);
          const active = isActive(c);
          const winner = historyCycles[c]?.winner;
          const winBid = historyCycles[c]?.winning_bid ?? 0;
          const tip = done
            ? winner
              ? `Winner ${winner.slice(0, 8)}… · bid ${formatUsdc(winBid)}`
              : "Cycle completed"
            : active
              ? "Currently running"
              : "Upcoming";
          return (
            <div
              key={c}
              title={tip}
              className={`px-3 py-2 rounded-lg border text-center min-w-[64px] transition-all duration-300 ${
                active
                  ? "bg-indigo-600/10 border-indigo-500/40 ring-1 ring-indigo-500/30"
                  : done
                    ? "bg-emerald-500/[0.06] border-emerald-500/25"
                    : "bg-slate-900/50 border-white/[0.05]"
              }`}
            >
              <p className={`text-sm font-bold leading-none ${
                active ? "text-indigo-300" : done ? "text-emerald-400" : "text-slate-500"
              }`}>
                {done && !active ? "✓ " : ""}C{c}
              </p>
              <p className="text-[9px] uppercase font-bold tracking-wider mt-1 text-slate-500">
                {active ? "Live" : done ? "Done" : "Queued"}
              </p>
            </div>
          );
        })}
      </div>

      {/* Contribution meter for the open cycle */}
      {showMeter && (
        <div>
          <div className="flex justify-between items-center text-xs mb-1.5">
            <span className="text-slate-400">Contributions received this cycle</span>
            <span className={`font-semibold ${paidCount >= memberTotal ? "text-emerald-400" : "text-indigo-300"}`}>
              {Math.min(paidCount, memberTotal)}/{memberTotal}
            </span>
          </div>
          <div className="w-full bg-slate-900 rounded-full h-2 border border-white/[0.03] overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all duration-700 ${
                paidCount >= memberTotal
                  ? "bg-emerald-500 shadow-sm shadow-emerald-500/50"
                  : "bg-gradient-to-r from-indigo-500 to-cyan-500 shadow-sm shadow-indigo-500/50"
              }`}
              style={{ width: `${paidPercent}%` }}
            />
          </div>
          {paidCount >= memberTotal && groupState === "Collecting" && (
            <p className="text-[11px] text-emerald-400 mt-2">
              All members paid — bidding opens automatically.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
