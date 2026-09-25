// Pure, UI-free deadline helpers shared by the group page and tests.

// True once the on-chain collection deadline (Unix seconds) has passed.
// A null deadline means a legacy group whose wasm never armed one.
export function isDeadlineExpired(deadline: number | null, nowMs: number): boolean {
  if (deadline == null) return false;
  return deadline * 1000 <= nowMs;
}

// Human-readable remaining time for the collection-deadline countdown. Big
// windows show d/h; the final hour shows m/s so the last minute stays legible.
export function formatCollectionRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
