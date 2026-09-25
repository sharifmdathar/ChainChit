"use client";

import { useEffect, useRef } from "react";
import toast from "react-hot-toast";
import type { CycleState, GroupInfo } from "@/types";
import { diffAlerts, type AlertSnapshot } from "@/lib/alerts";
import { pushNotification } from "@/lib/notify";

interface UseGroupAlertsArgs {
  groupInfo: GroupInfo | null;
  cycleState: CycleState | null;
  deadline: number | null;
  address: string | null;
  nowMs: number;
}

// Watches the group lifecycle and fires each distinct alert once: an in-app
// toast always, plus a system notification if the user granted permission.
// `prev` starts null so a freshly loaded, already-running group never spams.
export function useGroupAlerts({ groupInfo, cycleState, deadline, address, nowMs }: UseGroupAlertsArgs) {
  const prev = useRef<AlertSnapshot | null>(null);
  const fired = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!groupInfo) return;
    const curr: AlertSnapshot = {
      state: groupInfo.state,
      cycle: groupInfo.current_cycle,
      deadline,
      nowMs,
      address,
      winner: cycleState?.winner ?? null,
    };
    for (const alert of diffAlerts(prev.current, curr)) {
      if (fired.current.has(alert.id)) continue;
      fired.current.add(alert.id);
      toast(`${alert.title} · ${alert.body}`, { duration: 6000 });
      pushNotification(alert.title, alert.body);
    }
    prev.current = curr;
  }, [groupInfo, cycleState, deadline, address, nowMs]);
}
