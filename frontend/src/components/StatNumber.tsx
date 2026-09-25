"use client";

// A large KPI number that shows a pulsing placeholder while its underlying
// data is still loading, so a mid-fetch value is never mistaken for a real
// count (e.g. "0 Active" before the on-chain groups have loaded).
export function StatNumber({
  loading,
  value,
  className = "text-slate-100",
}: {
  loading: boolean;
  value: number | string;
  className?: string;
}) {
  if (loading) {
    return <span className="text-3xl font-extrabold text-slate-600 animate-pulse">…</span>;
  }
  return <span className={`text-3xl font-extrabold ${className}`}>{value}</span>;
}
