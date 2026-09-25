// Pure, UI-free lifecycle→notification logic shared by the alerts hook and tests.
import type { GroupState } from "@/types";
import { formatCollectionRemaining } from "./deadline";

export interface Alert {
  id: string; // stable dedupe key so each alert fires at most once per session
  title: string;
  body: string;
}

export interface AlertSnapshot {
  state: GroupState;
  cycle: number;
  deadline: number | null;
  nowMs: number;
  address: string | null;
  winner: string | null;
}

// Diff two snapshots into human-facing alerts. A `null` prev means "first
// observation" — we never alert on a state we haven't actually transitioned
// out of, so loading an already-running group doesn't spam the user.
export function diffAlerts(prev: AlertSnapshot | null, curr: AlertSnapshot): Alert[] {
  const out: Alert[] = [];

  if (prev && prev.state !== curr.state) {
    if (curr.state === "Collecting") {
      out.push({
        id: `collect:${curr.cycle}`,
        title: "📥 Collection started",
        body: `Cycle ${curr.cycle}: send your contribution before the deadline.`,
      });
    } else if (curr.state === "Bidding") {
      out.push({
        id: `bid:${curr.cycle}`,
        title: "🔨 Bidding is open",
        body: `Cycle ${curr.cycle} — place your discount bid now.`,
      });
    } else if (curr.state === "Payout") {
      if (curr.address && curr.winner && curr.winner === curr.address) {
        out.push({
          id: `won:${curr.cycle}`,
          title: "🎉 You won the pot!",
          body: `Cycle ${curr.cycle} — claim your payout.`,
        });
      } else {
        out.push({
          id: `payout:${curr.cycle}`,
          title: "💸 Payout ready",
          body: `Cycle ${curr.cycle} pot is being distributed.`,
        });
      }
    } else if (curr.state === "Completed") {
      out.push({
        id: `done:${curr.cycle}`,
        title: "✅ Cycle completed",
        body: `Cycle ${curr.cycle} finished. Next cycle starts soon.`,
      });
    }
  }

  // Deadline proximity is independent of state transitions: warn once inside
  // the final hour, then announce the close once it passes — both keyed by
  // cycle so the hook dedupes them.
  if (curr.state === "Collecting" && curr.deadline != null) {
    const remaining = curr.deadline * 1000 - curr.nowMs;
    if (remaining > 0 && remaining <= 3_600_000) {
      out.push({
        id: `deadlineSoon:${curr.cycle}`,
        title: "⏰ Deadline approaching",
        body: `${formatCollectionRemaining(remaining)} left to pay your contribution.`,
      });
    } else if (remaining <= 0) {
      out.push({
        id: `deadlinePassed:${curr.cycle}`,
        title: "⌛ Collection closed",
        body: "Deadline passed — bidding can now begin.",
      });
    }
  }

  return out;
}
