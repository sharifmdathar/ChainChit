import type { GroupInfo } from "@/types";

// Pure helpers behind the Discover page, kept SDK- and React-free so the
// joinability rules and ordering can be unit-tested without a network.

export interface DiscoverCandidate {
  id: string;
  info: GroupInfo;
  memberCount: number;
  isMember: boolean;
}

export type DiscoverFilter = "open" | "forming" | "collecting" | "all";

export function poolOf(info: GroupInfo): number {
  return info.contribution_amount * info.num_members;
}

export function spotsLeft(c: DiscoverCandidate): number {
  return Math.max(0, c.info.num_members - c.memberCount);
}

// Joinable = you're not already in, seats remain, and the group is still in a
// pre-bidding lifecycle (Forming or Collecting) and not paused/completed.
export function isJoinable(c: DiscoverCandidate): boolean {
  if (c.isMember) return false;
  if (c.info.state === "Completed" || c.info.state === "Paused") return false;
  if (c.info.state !== "Forming" && c.info.state !== "Collecting") return false;
  return spotsLeft(c) > 0;
}

// Largest pool first, then most seats free, then a stable id tiebreak.
export function sortCandidates(cands: DiscoverCandidate[]): DiscoverCandidate[] {
  return [...cands].sort((a, b) => {
    const byPool = poolOf(b.info) - poolOf(a.info);
    if (byPool !== 0) return byPool;
    const bySpots = spotsLeft(b) - spotsLeft(a);
    if (bySpots !== 0) return bySpots;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

export function filterDiscoverable(
  cands: DiscoverCandidate[],
  filter: DiscoverFilter,
): DiscoverCandidate[] {
  const rows =
    filter === "forming"
      ? cands.filter((c) => c.info.state === "Forming")
      : filter === "collecting"
        ? cands.filter((c) => c.info.state === "Collecting")
        : filter === "open"
          ? cands.filter(isJoinable)
          : cands;
  return sortCandidates(rows);
}
