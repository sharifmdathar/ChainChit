"use client";

import { useState, useCallback } from "react";
import { useWallet } from "@/hooks/useWallet";
import { initiateSep24Deposit, initiateSep24Withdraw, getSep24Url } from "@/lib/stellar";
import toast from "react-hot-toast";

export default function Sep24Ramp() {
  const { connected, address } = useWallet();
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [depositing, setDepositing] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  const handleDeposit = useCallback(async () => {
    if (!address || !depositAmount) return;
    setDepositing(true);
    try {
      const url = await initiateSep24Deposit(address, depositAmount);
      window.open(url, "_blank", "width=600,height=800");
      toast.success("Deposit flow opened in new window");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Deposit failed");
    } finally {
      setDepositing(false);
    }
  }, [address, depositAmount]);

  const handleWithdraw = useCallback(async () => {
    if (!address || !withdrawAmount) return;
    setWithdrawing(true);
    try {
      const url = await initiateSep24Withdraw(address, withdrawAmount);
      window.open(url, "_blank", "width=600,height=800");
      toast.success("Withdrawal flow opened in new window");
    } catch (err: unknown) {
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
      <h2 className="text-lg font-semibold mb-4">INR On/Off Ramp</h2>
      <p className="text-chit-muted text-sm mb-4">
        Deposit INR via bank transfer to receive USDC on-chain, or withdraw USDC back to your bank account.
        Powered by SEP-24 anchor integration.
      </p>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Deposit */}
        <div className="p-4 rounded-lg bg-chit-bg border border-chit-border">
          <h3 className="text-sm font-medium text-chit-text mb-2">Deposit INR → USDC</h3>
          <div className="flex gap-2">
            <input
              type="number"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="Amount in INR"
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
          <h3 className="text-sm font-medium text-chit-text mb-2">Withdraw USDC → INR</h3>
          <div className="flex gap-2">
            <input
              type="number"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder="Amount in INR"
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
