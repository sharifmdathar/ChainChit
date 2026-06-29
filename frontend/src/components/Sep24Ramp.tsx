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
    <div className="glass-card p-6">
      <h2 className="text-lg font-semibold mb-4">USDC On/Off Ramp</h2>
      <p className="text-chit-muted text-sm mb-4">
        Deposit fiat to receive USDC on-chain, or withdraw USDC back to your bank account.
        Powered by SEP-24 anchor integration.
      </p>

      {connected && (
        <div className="mb-4">
          <button
            onClick={async () => {
              try {
                await addUsdcTrustline();
                toast.success("USDC Trustline established successfully!");
              } catch (err: unknown) {
                toast.error(err instanceof Error ? err.message : "Failed to establish trustline");
              }
            }}
            className="btn-secondary text-xs py-1.5 px-3"
          >
            ⚙️ Add USDC Trustline (Freighter)
          </button>
        </div>
      )}

      {depositUrl && (
        <div className="mb-6 p-4 rounded-lg bg-emerald-950/20 border border-emerald-500/30 text-center animate-fade-in">
          <h3 className="text-emerald-400 font-semibold text-sm mb-1">Deposit Portal Ready</h3>
          <p className="text-chit-muted text-xs mb-3">
            Click the button below to complete your mock deposit in a new browser tab.
          </p>
          <div className="flex justify-center gap-2">
            <a
              href={depositUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setDepositUrl(null)}
              className="btn-primary text-xs py-2 px-4 inline-flex items-center gap-1.5"
            >
              🚀 Open Deposit Portal
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
        <div className="mb-6 p-4 rounded-lg bg-emerald-950/20 border border-emerald-500/30 text-center animate-fade-in">
          <h3 className="text-emerald-400 font-semibold text-sm mb-1">Withdrawal Portal Ready</h3>
          <p className="text-chit-muted text-xs mb-3">
            Click the button below to complete your mock withdrawal in a new browser tab.
          </p>
          <div className="flex justify-center gap-2">
            <a
              href={withdrawUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setWithdrawUrl(null)}
              className="btn-primary text-xs py-2 px-4 inline-flex items-center gap-1.5"
            >
              🚀 Open Withdrawal Portal
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

      <div className="grid md:grid-cols-2 gap-4">
        {/* Deposit */}
        <div className="p-4 rounded-lg bg-chit-bg border border-chit-border">
          <h3 className="text-sm font-medium text-chit-text mb-2">Deposit → USDC</h3>
          <div className="flex gap-2">
            <input
              type="number"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="Amount in USDC"
              min="1"
              disabled={!connected}
              className="flex-1 px-3 py-2 rounded-lg bg-chit-card border border-chit-border text-chit-text focus:border-stellar-600 outline-none text-sm"
            />
            <button
              onClick={handleDeposit}
              disabled={!connected || !depositAmount || depositing}
              className="btn-primary whitespace-nowrap"
            >
              {depositing ? "..." : "Deposit"}
            </button>
          </div>
        </div>

        {/* Withdraw */}
        <div className="p-4 rounded-lg bg-chit-bg border border-chit-border">
          <h3 className="text-sm font-medium text-chit-text mb-2">Withdraw USDC →</h3>
          <div className="flex gap-2">
            <input
              type="number"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder="Amount in USDC"
              min="1"
              disabled={!connected}
              className="flex-1 px-3 py-2 rounded-lg bg-chit-card border border-chit-border text-chit-text focus:border-stellar-600 outline-none text-sm"
            />
            <button
              onClick={handleWithdraw}
              disabled={!connected || !withdrawAmount || withdrawing}
              className="btn-secondary whitespace-nowrap"
            >
              {withdrawing ? "..." : "Withdraw"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
