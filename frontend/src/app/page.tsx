"use client";

import { useWallet } from "@/hooks/useWallet";
import { SUPPORTED_WALLETS } from "@/lib/stellar";
import Link from "next/link";

export default function HomePage() {
  const { connected, address, connect, connecting, network } = useWallet();

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 md:py-20 animate-fade-in-up">
      {/* Hero Section */}
      <div className="text-center mb-20 relative">
        <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-sm">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
          {network === "PUBLIC" ? "Stellar Mainnet" : "Stellar Testnet"}
        </div>
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 bg-gradient-to-r from-slate-100 via-indigo-200 to-indigo-400 bg-clip-text text-transparent leading-none">
          Chit Funds, <br className="hidden sm:inline" />Reinvented
        </h1>
        <p className="text-base md:text-lg text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Smart contract custody eliminates fraud. On-chain reputation lets you
          evaluate strangers before pooling money. Join rotating savings groups beyond your
          immediate circle — safely.
        </p>

        {!connected ? (
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center max-w-md mx-auto">
            {SUPPORTED_WALLETS.map((wallet) => (
              <button
                key={wallet.id}
                onClick={() => connect(wallet.id)}
                disabled={connecting}
                className="btn-primary w-full sm:w-auto flex items-center gap-2.5 justify-center min-w-[200px]"
              >
                <span className="text-lg opacity-90">{wallet.icon}</span>
                <span>{connecting ? "Connecting..." : `Connect ${wallet.name}`}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-xl bg-slate-900/60 border border-white/[0.05] shadow-inner">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-sm shadow-emerald-500/50" />
              <span className="font-mono text-xs text-slate-300 md:text-sm">{address}</span>
            </div>
            <div className="block">
              <Link href="/dashboard" className="btn-primary inline-flex items-center gap-2">
                <span>Go to Dashboard</span>
                <svg className="w-4 h-4 transition-transform hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Feature Section */}
      <div className="grid md:grid-cols-3 gap-6 mb-24">
        <FeatureCard 
          title="Trustless Custody" 
          description="Funds locked in Soroban smart contracts. No organizer can run away with the pool. Every USDC transfer is on-chain and verifiable." 
          icon={
            <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          } 
        />
        <FeatureCard 
          title="Living Reputation" 
          description="Not a one-time KYC stamp. Every payment, default, and dispute outcome updates a live on-chain score — visible before you join any group." 
          icon={
            <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          } 
        />
        <FeatureCard 
          title="Dispute Resolution" 
          description="3-of-5 multi-sig arbitration by vetted community members. Dispute outcomes feed back into reputation, creating accountability loops." 
          icon={
            <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7h12m0 0l-3-1m3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9h-6l-2-2H5a3 3 0 00-3 3v12a3 3 0 003 3h14a3 3 0 003-3V7a3 3 0 00-3-3z" />
            </svg>
          } 
        />
      </div>

      {/* How it Works Section */}
      <div className="border-t border-white/[0.05] pt-20">
        <h2 className="text-3xl font-bold text-center mb-4 tracking-tight">How It Works</h2>
        <p className="text-slate-400 text-center max-w-lg mx-auto mb-16 text-sm">
          Rotating savings are simplified on-chain with minimal friction and maximum security rules.
        </p>
        <div className="relative">
          {/* Timeline connecting line for desktop */}
          <div className="hidden md:block absolute top-6 left-[12%] right-[12%] h-[2px] bg-gradient-to-r from-indigo-500/10 via-indigo-500/30 to-indigo-500/10 z-0" />
          
          <div className="grid md:grid-cols-4 gap-8 relative z-10">
            <StepCard number={1} title="Get Vouched" description="An existing member vouches for you, creating a reputation attestation." />
            <StepCard number={2} title="Join a Group" description="Browse groups, check member reputation scores, and join that fits your risk level." />
            <StepCard number={3} title="Contribute & Bid" description="Pay your monthly contribution. Bid for the prize pool — lower bids win." />
            <StepCard number={4} title="Receive Payout" description="The lowest unique bidder receives the full pool. Everyone gets a turn." />
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ title, description, icon }: { title: string; description: string; icon: React.ReactNode }) {
  return (
    <div className="glass-card p-6 flex flex-col items-start gap-4">
      <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 shadow-inner">
        {icon}
      </div>
      <div>
        <h3 className="text-lg font-bold text-slate-100 mb-2">{title}</h3>
        <p className="text-slate-400 text-sm leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function StepCard({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div className="text-center group flex flex-col items-center">
      <div className="w-12 h-12 rounded-xl bg-slate-900 border border-white/[0.05] flex items-center justify-center mb-4 transition-all duration-300 group-hover:border-indigo-500/40 group-hover:shadow-lg group-hover:shadow-indigo-600/15 group-hover:-translate-y-1">
        <span className="text-indigo-400 font-extrabold text-sm">{number}</span>
      </div>
      <h4 className="font-bold text-slate-200 mb-2 text-sm md:text-base">{title}</h4>
      <p className="text-slate-400 text-xs max-w-[200px] leading-relaxed">{description}</p>
    </div>
  );
}
