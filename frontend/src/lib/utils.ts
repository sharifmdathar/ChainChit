import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

export function shortenAddress(address: string, chars: number = 6): string {
  if (!address) return "";
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function formatUsdc(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount / 10_000_000);
}

export function formatInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount / 10_000_000);
}

export function basisPointsToPercent(bp: number): number {
  return Math.round((bp / 100) * 100) / 100;
}

export function getReputationColor(score: number): string {
  if (score >= 800) return "text-chit-success";
  if (score >= 500) return "text-chit-warning";
  return "text-chit-danger";
}

export function getReputationLabel(score: number): string {
  if (score >= 900) return "Excellent";
  if (score >= 700) return "Good";
  if (score >= 500) return "Fair";
  if (score >= 300) return "Poor";
  return "New";
}

export function getStateColor(state: string): string {
  switch (state) {
    case "Forming":
      return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    case "Collecting":
      return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    case "Bidding":
      return "bg-purple-500/20 text-purple-400 border-purple-500/30";
    case "Payout":
      return "bg-green-500/20 text-green-400 border-green-500/30";
    case "Completed":
      return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    case "Paused":
      return "bg-red-500/20 text-red-400 border-red-500/30";
    default:
      return "bg-gray-500/20 text-gray-400 border-gray-500/30";
  }
}

export async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", data as any);
  return new Uint8Array(hashBuffer);
}

export function u64ToLeBytes(value: number): Uint8Array {
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setBigUint64(0, BigInt(value), true);
  return new Uint8Array(buf);
}

export async function computeCommitment(
  amount: number,
  nonce: number
): Promise<number[]> {
  const amountBytes = u64ToLeBytes(amount);
  const nonceBytes = u64ToLeBytes(nonce);
  const combined = new Uint8Array(amountBytes.length + nonceBytes.length);
  combined.set(amountBytes, 0);
  combined.set(nonceBytes, amountBytes.length);
  const hash = await sha256(combined);
  return Array.from(hash);
}
