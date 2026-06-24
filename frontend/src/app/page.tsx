"use client";

import { useWallet } from "@/hooks/useWallet";
import { SUPPORTED_WALLETS } from "@/lib/stellar";
import Link from "next/link";

export default function HomePage() {
  const { connected, address, connect, connecting, network } = useWallet();

  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      <div className="text-center mb-16">
        <div className="inline-block px-3 py-1 mb-6 rounded-full text-xs font-medium bg-stellar-600/20 text-stellar-400 border border-stellar-600/30">
          {network === "PUBLIC" ? "Mainnet" : "Testnet"} — Stellar Network
        </div>
        <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-stellar-400 to-stellar-200 bg-clip-text text-transparent">
          Chit Funds, Reinvented
        </h1>
        <p className="text-lg text-chit-muted max-w-2xl mx-auto mb-10">
          Smart contract custody eliminates fraud. On-chain reputation lets you
          evaluate strangers before pooling money. Join chit groups beyond your
          immediate circle — safely.
        </p>
        {!connected ? (
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {SUPPORTED_WALLETS.map((wallet) => (
              <button
                key={wallet.id}
                onClick={() => connect(wallet.id)}
                disabled={connecting}
                className="btn-primary flex items-center gap-2 justify-center min-w-[180px]"
              >
                <span className="text-lg">{wallet.icon}</span>
                {connecting ? "Connecting..." : `Connect ${wallet.name}`}
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-chit-card border border-chit-border">
              <div className="w-2 h-2 rounded-full bg-chit-success" />
              <span className="font-mono text-sm">{address}</span>
            </div>
            <div className="block">
              <Link href="/dashboard" className="btn-primary inline-block">
                Go to Dashboard →
              </Link>
            </div>
          </div>
        )}
      </div>
      <div className="grid md:grid-cols-3 gap-6">
        <FeatureCard title="Trustless Custody" description="Funds locked in Soroban smart contracts. No organizer can run away with the pool. Every USDC transfer is on-chain and verifiable." icon="🔒" />
        <FeatureCard title="Living Reputation" description="Not a one-time KYC stamp. Every payment, default, and dispute outcome updates a live on-chain score — visible before you join any group." icon="⭐" />
        <FeatureCard title="Dispute Resolution" description="3-of-5 multi-sig arbitration by vetted community members. Dispute outcomes feed back into reputation, creating accountability loops." icon="⚖️" />
      </div>
      <div className="mt-20">
        <h2 className="text-2xl font-bold text-center mb-10">How It Works</h2>
        <div className="grid md:grid-cols-4 gap-4">
          <StepCard number={1} title="Get Vouched" description="An existing member vouches for you, creating a reputation-weighted attestation." />
          <StepCard number={2} title="Join a Group" description="Browse groups, check member reputation scores, and join one that fits your risk level." />
          <StepCard number={3} title="Contribute & Bid" description="Pay your monthly contribution. Bid for the prize pool — lower bids win." />
          <StepCard number={4} title="Receive Payout" description="The lowest unique bidder receives the full pool. Everyone gets a turn over the cycle." />
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ title, description, icon }: { title: string; description: string; icon: string }) {
  return (
    <div className="glass-card p-6 hover:border-stellar-600/40 transition-colors">
      <div className="text-3xl mb-4">{icon}</div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-chit-muted text-sm leading-relaxed">{description}</p>
    </div>
  );
}

function StepCard({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div className="text-center">
      <div className="w-10 h-10 rounded-full bg-stellar-600/20 border border-stellar-600/30 flex items-center justify-center mx-auto mb-3">
        <span className="text-stellar-400 font-bold">{number}</span>
      </div>
      <h4 className="font-semibold mb-1">{title}</h4>
      <p className="text-chit-muted text-xs">{description}</p>
    </div>
  );
}
