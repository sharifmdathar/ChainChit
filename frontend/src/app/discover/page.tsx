"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getGroupCount, getGroupsPaged, getGroupInfo, getMembers } from "@/lib/contracts";
import { filterDiscoverable, type DiscoverCandidate, type DiscoverFilter } from "@/lib/discover";
import { useWallet } from "@/hooks/useWallet";
import { useLanguage } from "@/hooks/useLanguage";
import { GroupCard } from "@/components/GroupCard";
import { friendlyError } from "@/lib/errors";
import toast from "react-hot-toast";

const PAGE = 24; // how many of the most-recent groups to inspect

const FILTERS: { code: DiscoverFilter; label: string }[] = [
  { code: "open", label: "Open to join" },
  { code: "forming", label: "Forming" },
  { code: "all", label: "All live" },
];

export default function DiscoverPage() {
  const router = useRouter();
  const { connected, address } = useWallet();
  const { t } = useLanguage();
  const [candidates, setCandidates] = useState<DiscoverCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<DiscoverFilter>("open");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const count = await getGroupCount();
      const start = Math.max(0, count - PAGE);
      const ids = (await getGroupsPaged(start, PAGE)).reverse(); // newest first
      const rows = await Promise.all(
        ids.map(async (id): Promise<DiscoverCandidate | null> => {
          try {
            const [info, members] = await Promise.all([getGroupInfo(id), getMembers(id)]);
            return {
              id,
              info,
              memberCount: members.length,
              isMember: !!address && members.includes(address),
            };
          } catch {
            return null; // skip unreadable/legacy groups
          }
        }),
      );
      setCandidates(rows.filter((r): r is DiscoverCandidate => r !== null));
    } catch (err) {
      toast.error(friendlyError(err));
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = filterDiscoverable(candidates, filter);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 animate-fade-in-up">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight">Discover Groups</h1>
          <p className="text-slate-400 text-sm mt-1">
            Public chit pools open to new members — join a rotating savings group beyond your circle.
          </p>
        </div>
        <button onClick={load} disabled={loading} className="btn-secondary text-xs px-4 py-2 self-start sm:self-auto">
          {loading ? "Scanning chain…" : "Refresh"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-6">
        {FILTERS.map((f) => (
          <button
            key={f.code}
            onClick={() => setFilter(f.code)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
              filter === f.code
                ? "bg-gradient-to-r from-indigo-600/20 to-violet-600/20 text-indigo-400 border-indigo-500/20"
                : "text-slate-400 border-white/[0.06] hover:text-slate-100"
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-slate-500 text-xs font-semibold">
          {visible.length} group{visible.length === 1 ? "" : "s"}
        </span>
      </div>

      {loading && candidates.length === 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass-card h-[210px] animate-pulse border border-white/[0.04]" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="glass-card p-12 text-center border border-white/[0.04]">
          <p className="text-slate-400 text-sm">No {filter === "all" ? "live " : ""}groups to show right now.</p>
          <p className="text-slate-500 text-xs mt-1">
            {connected ? "Be the first — deploy a group and it will appear here." : "Connect a wallet to join one."}{" "}
            <button onClick={() => router.push("/create-group")} className="text-indigo-400 hover:underline font-semibold">
              {t("nav.createGroup")}
            </button>
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((c) => (
            <GroupCard
              key={c.id}
              group={c.info}
              memberCount={c.memberCount}
              onClick={() => router.push(`/group/${c.id}?join=1`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
