"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface OnboardingChecklistProps {
  connected: boolean;
  address?: string | null;
  /** True once the dashboard finished loading the user's groups. */
  groupsLoaded: boolean;
  /** Number of groups the wallet has joined. */
  joinedGroups: number;
  /** Groups that have progressed past Forming — implies contributions started. */
  activeGroups: number;
}

interface Step {
  key: string;
  title: string;
  detail: string;
  done: boolean;
  action?: { label: string; href?: string; onClick?: () => void };
}

const HORIZON_TESTNET = "https://horizon-testnet.stellar.org";
const DISMISS_KEY = "chit_onboarding_dismissed";

export function OnboardingChecklist({
  connected,
  address,
  groupsLoaded,
  joinedGroups,
  activeGroups,
}: OnboardingChecklistProps) {
  const [dismissed, setDismissed] = useState(true);
  const [walletFunded, setWalletFunded] = useState(false);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      /* storage unavailable — keep checklist visible */
    }
  }, []);

  // Detect funding state straight from Horizon (XLM balance + USDC trustline).
  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!address || !connected) {
        setWalletFunded(false);
        return;
      }
      try {
        const res = await fetch(`${HORIZON_TESTNET}/accounts/${address}`);
        if (!res.ok) return;
        const data = (await res.json()) as {
          balances?: { asset_type: string; asset_code?: string; balance?: string }[];
        };
        const xlm = data.balances?.find((b) => b.asset_type === "native");
        const usdc = data.balances?.find((b) => b.asset_code === "USDC");
        if (!cancelled) setWalletFunded(Number(xlm?.balance ?? 0) > 0 && !!usdc);
      } catch {
        /* network hiccup — leave as-is */
      }
    }
    void check();
    return () => {
      cancelled = true;
    };
  }, [address, connected]);

  if (!connected || dismissed) return null;

  const openFriendbot = () => {
    if (!address) return;
    window.open(`https://friendbot.stellar.org?addr=${encodeURIComponent(address)}`, "_blank");
  };

  const steps: Step[] = [
    {
      key: "connect",
      title: "Connect your wallet",
      detail: "Freighter, xBull or Lobstr — click Connect in the navbar.",
      done: true,
    },
    {
      key: "fund",
      title: "Fund your wallet",
      detail: "Claim testnet XLM from the faucet, then add USDC for contributions.",
      done: walletFunded,
      action: { label: "Claim testnet XLM", onClick: openFriendbot },
    },
    {
      key: "join",
      title: "Join or create a group",
      detail: "Browse open committees or start your own with custom contribution size.",
      done: joinedGroups > 0,
      action: { label: "Create a group", href: "/create-group" },
    },
    {
      key: "contribute",
      title: "Make your first contribution",
      detail: "Pay into an active cycle to unlock bidding and build on-chain reputation.",
      done: activeGroups > 0 && groupsLoaded,
    },
  ];

  const allDone = steps.every((s) => s.done);
  if (allDone) return null;

  const completedCount = steps.filter((s) => s.done).length;

  return (
    <div className="glass-card p-5 mb-8 border border-indigo-500/20">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-1">
            Getting Started
          </p>
          <h2 className="text-base font-bold text-slate-100">
            Set up ChainChit in 4 steps
            <span className="ml-2 text-xs font-medium text-slate-400">
              ({completedCount}/{steps.length} complete)
            </span>
          </h2>
        </div>
        <button
          onClick={() => {
            try {
              localStorage.setItem(DISMISS_KEY, "1");
            } catch {
              /* ignore */
            }
            setDismissed(true);
          }}
          className="text-slate-500 hover:text-slate-300 transition-colors p-1 text-sm"
          title="Dismiss checklist"
        >
          ✕
        </button>
      </div>

      <ol className="space-y-3">
        {steps.map((step, i) => (
          <li key={step.key} className="flex items-start gap-3">
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold border ${
                step.done
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  : "bg-slate-900 text-slate-500 border-white/[0.06]"
              }`}
            >
              {step.done ? "✓" : i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${step.done ? "text-slate-500 line-through" : "text-slate-200"}`}>
                {step.title}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">{step.detail}</p>
            </div>
            {!step.done && step.action && (
              step.action.href ? (
                <Link href={step.action.href} className="btn-primary !px-3 !py-1.5 !text-xs shrink-0">
                  {step.action.label}
                </Link>
              ) : (
                <button onClick={step.action.onClick} className="btn-primary !px-3 !py-1.5 !text-xs shrink-0">
                  {step.action.label}
                </button>
              )
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
