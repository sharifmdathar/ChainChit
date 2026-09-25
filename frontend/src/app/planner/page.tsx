"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  deriveMetrics,
  scenarioForWin,
  cumulativeCashflows,
  positionComparison,
  type ChitPlanInput,
} from "@/lib/planner";
import { useLanguage } from "@/hooks/useLanguage";

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(
    Number.isFinite(n) ? n : 0,
  );

function Field({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min?: number;
  max?: number;
  step?: number | string;
  suffix?: string;
}) {
  return (
    <div>
      <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">{label}</label>
      <div className="relative">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          min={min}
          max={max}
          step={step}
          className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-white/[0.08] text-slate-100 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-sm font-medium transition-all"
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-semibold">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
      <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">{label}</span>
      <span className={`font-mono text-sm font-semibold ${accent || "text-slate-100"}`}>{value}</span>
    </div>
  );
}

export default function PlannerPage() {
  const { t } = useLanguage();
  const [members, setMembers] = useState("5");
  const [contribution, setContribution] = useState("100");
  const [cycles, setCycles] = useState("5");
  const [discountPct, setDiscountPct] = useState("10");
  const [cycleMonths, setCycleMonths] = useState("1");
  const [winCycle, setWinCycle] = useState("1");

  const input: ChitPlanInput = useMemo(
    () => ({
      members: Number(members),
      contribution: Number(contribution),
      cycles: Number(cycles),
      discountPct: Number(discountPct),
      cycleMonths: Number(cycleMonths),
    }),
    [members, contribution, cycles, discountPct, cycleMonths],
  );

  const metrics = useMemo(() => deriveMetrics(input), [input]);
  const scenario = useMemo(() => scenarioForWin(input, Number(winCycle)), [input, winCycle]);
  const positions = useMemo(() => positionComparison(input), [input]);
  const timeline = useMemo(() => cumulativeCashflows(input, Number(winCycle)), [input, winCycle]);
  const maxAbs = Math.max(1e-9, ...timeline.map((c) => Math.abs(c)));
  const maxPeak = Math.max(1e-9, ...positions.map((p) => p.peakFunding));
  const effectiveWin = Math.min(Math.max(Number(winCycle) || 1, 1), positions.length);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 animate-fade-in-up">
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight">Chit What-if Planner</h1>
        <p className="text-slate-400 text-sm mt-1">
          Model a rotating savings pool before you deploy it — see the pool economics and how your
          win position changes when you get your hands on the cash.
        </p>
      </div>

      <div className="grid md:grid-cols-5 gap-8 items-start">
        {/* Inputs */}
        <div className="md:col-span-2 glass-card p-6 space-y-5 border border-white/[0.04]">
          <p className="text-slate-300 text-sm font-bold uppercase tracking-wider">Scenario</p>
          <Field label="Members" value={members} onChange={setMembers} min={2} />
          <Field label="Contribution / cycle" value={contribution} onChange={setContribution} min={0} step="any" suffix="USDC" />
          <Field label="Total cycles" value={cycles} onChange={setCycles} min={1} />
          <Field label="Typical auction discount" value={discountPct} onChange={setDiscountPct} min={0} max={99} suffix="%" />
          <Field label="Cycle length" value={cycleMonths} onChange={setCycleMonths} min={1} suffix="months" />

          <div>
            <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              You take the pot in cycle
            </label>
            <div className="flex flex-wrap gap-1.5">
              {positions.map((p, i) => (
                <button
                  key={i}
                  onClick={() => setWinCycle(String(i + 1))}
                  className={`w-9 h-9 rounded-lg text-xs font-bold transition-all ${
                    effectiveWin === i + 1
                      ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/30"
                      : "bg-slate-950 border border-white/[0.08] text-slate-400 hover:text-slate-100"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>

          <Link href="/create-group" className="btn-primary w-full py-3 inline-flex items-center justify-center">
            {t("nav.createGroup")} →
          </Link>
        </div>

        {/* Results */}
        <div className="md:col-span-3 space-y-4">
          <div className="glass-card p-6 border border-indigo-500/20">
            <div className="flex items-baseline justify-between mb-4">
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Pool per cycle</p>
              <span className="text-3xl font-black text-slate-100 tracking-tight">{money(metrics.pool)}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-8">
              <div>
                <Stat label="Winner payout" value={money(metrics.winnerPayout)} accent="text-cyan-300" />
                <Stat label="Discount / pot" value={money(metrics.discountAmount)} accent="text-amber-300" />
                <Stat label="Dividend / member" value={money(metrics.dividendPerMember)} accent="text-emerald-300" />
              </div>
              <div>
                <Stat label="Net cost / cycle" value={money(metrics.netContribution)} />
                <Stat label="You pay (total)" value={money(scenario.totalPaid)} />
                <Stat label="Run length" value={`${metrics.runMonths} mo`} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="glass-card p-5 border border-white/[0.04]">
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">Pot lands</p>
              <p className="text-2xl font-black text-slate-100">Mo {scenario.winMonth}</p>
              <p className="text-slate-500 text-[11px] mt-1">after you join</p>
            </div>
            <div className="glass-card p-5 border border-amber-500/20 bg-amber-500/[0.03]">
              <p className="text-amber-400 text-[10px] font-bold uppercase tracking-wider mb-1">Peak out-of-pocket</p>
              <p className="text-2xl font-black text-amber-300">{money(scenario.peakFunding)}</p>
              <p className="text-slate-500 text-[11px] mt-1">most you fund before cash back</p>
            </div>
            <div className="glass-card p-5 border border-emerald-500/20 bg-emerald-500/[0.03]">
              <p className="text-emerald-400 text-[10px] font-bold uppercase tracking-wider mb-1">Cash-positive</p>
              <p className="text-2xl font-black text-emerald-300">Cycle {scenario.breakevenCycle}</p>
              <p className="text-slate-500 text-[11px] mt-1">when you stop being net-negative</p>
            </div>
          </div>

          {/* Cashflow timeline for the chosen position */}
          <div className="glass-card p-6 border border-white/[0.04]">
            <p className="text-slate-300 text-sm font-bold uppercase tracking-wider mb-4">
              Your running cash position
            </p>
            <div className="flex items-end gap-2 h-28">
              {timeline.map((c, i) => {
                const h = Math.max(4, (Math.abs(c) / maxAbs) * 100);
                const neg = c < 0;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
                    <div
                      className={`w-full rounded-md transition-all duration-300 ${
                        neg ? "bg-gradient-to-t from-rose-600 to-rose-500" : "bg-gradient-to-t from-emerald-600 to-cyan-500"
                      }`}
                      style={{ height: `${h}%` }}
                      title={money(c)}
                    />
                    <span className="text-[9px] font-mono text-slate-500">{i + 1}</span>
                  </div>
                );
              })}
            </div>
            <p className="text-slate-500 text-[11px] mt-3">
              Bars below the line are money you have paid in but not yet received back. Winning earlier
              keeps you cash-positive; winning later means funding the pot first.
            </p>
          </div>

          {/* Position comparison */}
          <div className="glass-card p-6 border border-white/[0.04]">
            <p className="text-slate-300 text-sm font-bold uppercase tracking-wider mb-4">
              Peak out-of-pocket by win position
            </p>
            <div className="space-y-2.5">
              {positions.map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-16 text-xs font-mono text-slate-400 shrink-0">Cycle {p.winCycle}</span>
                  <div className="flex-1 h-3 rounded-full bg-slate-900 border border-white/[0.03] overflow-hidden">
                    <div
                      className="h-3 rounded-full bg-gradient-to-r from-indigo-500 to-amber-500 transition-all duration-300"
                      style={{ width: `${Math.max(2, (p.peakFunding / maxPeak) * 100)}%` }}
                    />
                  </div>
                  <span className="w-20 text-right text-xs font-mono text-slate-300 shrink-0">
                    {money(p.peakFunding)}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-slate-500 text-[11px] mt-4 leading-relaxed">
              Estimates only, derived from your assumed discount — not audited financial advice. The pool
              is nominally zero-sum; what changes with your win position is timing and how much you must
              fund up front.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
