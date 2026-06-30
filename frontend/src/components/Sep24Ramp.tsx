"use client";

import { useState, useCallback } from "react";
import { useWallet } from "@/hooks/useWallet";
import { initiateSep24Deposit, initiateSep24Withdraw, getSep24Url, addUsdcTrustline } from "@/lib/stellar";
import toast from "react-hot-toast";

export default function Sep24Ramp() {
  const { connected, address } = useWallet();
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [depositing, setDepositing] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [depositUrl, setDepositUrl] = useState<string | null>(null);
  const [withdrawUrl, setWithdrawUrl] = useState<string | null>(null);
  const [funding, setFunding] = useState(false);

  const handleFaucet = useCallback(async () => {
    if (!address) return;
    setFunding(true);
    try {
      const res = await fetch("/api/faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success("50 Test USDC transferred to your wallet successfully!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Faucet request failed");
    } finally {
      setFunding(false);
    }
  }, [address]);

  const handleDeposit = useCallback(async () => {
    if (!address || !depositAmount) return;
    setDepositing(true);
    setDepositUrl(null);

    // Open blank window synchronously to bypass popup blocker
    const win = window.open("about:blank", "_blank");

    try {
      const url = await initiateSep24Deposit(address, depositAmount);
      if (win) {
        win.location.href = url;
        toast.success("Deposit portal opened in a new tab!");
      } else {
        setDepositUrl(url);
        toast.error("Popup blocked! Please allow popups or use the button below.");
      }
    } catch (err: unknown) {
      if (win) win.close();
      toast.error(err instanceof Error ? err.message : "Deposit failed");
    } finally {
      setDepositing(false);
    }
  }, [address, depositAmount]);

  const handleWithdraw = useCallback(async () => {
    if (!address || !withdrawAmount) return;
    setWithdrawing(true);
    setWithdrawUrl(null);

    // Open blank window synchronously to bypass popup blocker
    const win = window.open("about:blank", "_blank");

    try {
      const url = await initiateSep24Withdraw(address, withdrawAmount);
      if (win) {
        win.location.href = url;
        toast.success("Withdrawal portal opened in a new tab!");
      } else {
        setWithdrawUrl(url);
        toast.error("Popup blocked! Please allow popups or use the button below.");
      }
    } catch (err: unknown) {
      if (win) win.close();
      toast.error(err instanceof Error ? err.message : "Withdrawal failed");
    } finally {
      setWithdrawing(false);
    }
  }, [address, withdrawAmount]);

  if (!getSep24Url()) {
    return (
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold mb-2">INR On/Off Ramp</h2>
        <p className="text-chit-muted text-sm">
          SEP-24 anchor not configured. Set NEXT_PUBLIC_ANCHOR_SEP24_URL to enable INR deposits and withdrawals.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card p-6 border border-white/[0.04]">
      <h2 className="text-xl font-bold text-slate-100 tracking-tight mb-2 flex items-center gap-2">
        <span>Stellar USDC Gateway</span>
      </h2>
      <p className="text-slate-400 text-sm mb-6 leading-relaxed">
        Securely deposit fiat to receive USDC on-chain, or withdraw USDC back to your bank account.
        Powered by standard SEP-24 Anchor integration.
      </p>

      {connected && (
        <div className="mb-6 flex flex-wrap gap-3">
          <button
            onClick={async () => {
              try {
                await addUsdcTrustline();
                toast.success("USDC Trustline established successfully!");
              } catch (err: unknown) {
                toast.error(err instanceof Error ? err.message : "Failed to establish trustline");
              }
            }}
            className="btn-secondary text-xs py-2 px-3.5 flex items-center gap-2"
          >
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>Add USDC Trustline</span>
          </button>

          <button
            onClick={handleFaucet}
            disabled={funding}
            className="btn-primary text-xs py-2 px-3.5 flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 border-none shadow-sm shadow-emerald-500/10"
          >
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
            </svg>
            <span>{funding ? "Funding Wallet..." : "Get 50 Test USDC (Faucet)"}</span>
          </button>
        </div>
      )}

      {depositUrl && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-center animate-fade-in">
          <h3 className="text-emerald-400 font-bold text-sm mb-1">Deposit Portal Ready</h3>
          <p className="text-slate-400 text-xs mb-4">
            Click the link to complete your mock deposit in a new browser tab.
          </p>
          <div className="flex justify-center gap-3">
            <a
              href={depositUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setDepositUrl(null)}
              className="btn-primary text-xs py-2 px-4 inline-flex items-center gap-1.5"
            >
              <span>🚀 Open Deposit Portal</span>
            </a>
            <button
              onClick={() => setDepositUrl(null)}
              className="btn-secondary text-xs py-2 px-3"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {withdrawUrl && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-center animate-fade-in">
          <h3 className="text-emerald-400 font-bold text-sm mb-1">Withdrawal Portal Ready</h3>
          <p className="text-slate-400 text-xs mb-4">
            Click the link to complete your mock withdrawal in a new browser tab.
          </p>
          <div className="flex justify-center gap-3">
            <a
              href={withdrawUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setWithdrawUrl(null)}
              className="btn-primary text-xs py-2 px-4 inline-flex items-center gap-1.5"
            >
              <span>🚀 Open Withdrawal Portal</span>
            </a>
            <button
              onClick={() => setWithdrawUrl(null)}
              className="btn-secondary text-xs py-2 px-3"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-5">
        {/* Deposit */}
        <div className="p-5 rounded-xl bg-slate-900/25 border border-white/[0.03]">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">Deposit FIAT → USDC</h3>
          <div className="flex gap-2">
            <input
              type="number"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="Amount in USDC"
              min="1"
              disabled={!connected}
              className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-white/[0.08] text-slate-100 placeholder-slate-600 focus:border-indigo-500 outline-none text-sm transition-all"
            />
            <button
              onClick={handleDeposit}
              disabled={!connected || !depositAmount || depositing}
              className="btn-primary whitespace-nowrap px-6"
            >
              {depositing ? "..." : "Deposit"}
            </button>
          </div>
        </div>

        {/* Withdraw */}
        <div className="p-5 rounded-xl bg-slate-900/25 border border-white/[0.03]">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">Withdraw USDC → FIAT</h3>
          <div className="flex gap-2">
            <input
              type="number"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder="Amount in USDC"
              min="1"
              disabled={!connected}
              className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-white/[0.08] text-slate-100 placeholder-slate-600 focus:border-indigo-500 outline-none text-sm transition-all"
            />
            <button
              onClick={handleWithdraw}
              disabled={!connected || !withdrawAmount || withdrawing}
              className="btn-secondary whitespace-nowrap px-6"
            >
              {withdrawing ? "..." : "Withdraw"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
