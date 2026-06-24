"use client";

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { connectWallet, disconnectWallet, getPublicKey, getNetwork } from "@/lib/stellar";
import { SUPPORTED_WALLETS } from "@/lib/stellar";
import type { WalletState } from "@/types";

interface WalletContextType extends WalletState {
  connect: (walletId?: string) => Promise<void>;
  disconnect: () => void;
  wallets: typeof SUPPORTED_WALLETS;
}

const WalletContext = createContext<WalletContextType>({
  address: null,
  connected: false,
  connecting: false,
  network: "PUBLIC",
  connect: async () => {},
  disconnect: () => {},
  wallets: SUPPORTED_WALLETS,
});

export function useWallet(): WalletContextType {
  return useContext(WalletContext);
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WalletState>({
    address: null,
    connected: false,
    connecting: false,
    network: getNetwork() as "PUBLIC" | "TESTNET" | "FUTURENET",
  });

  useEffect(() => {
    getPublicKey().then((addr) => {
      if (addr) {
        setState((prev) => ({ ...prev, address: addr, connected: true }));
      }
    });
  }, []);

  const connect = useCallback(async (walletId?: string) => {
    setState((prev) => ({ ...prev, connecting: true }));
    try {
      const address = await connectWallet(walletId);
      setState({ address, connected: true, connecting: false, network: getNetwork() as "PUBLIC" | "TESTNET" | "FUTURENET" });
    } catch (error) {
      setState((prev) => ({ ...prev, connecting: false }));
      throw error;
    }
  }, []);

  const disconnect = useCallback(() => {
    disconnectWallet();
    setState({ address: null, connected: false, connecting: false, network: getNetwork() as "PUBLIC" | "TESTNET" | "FUTURENET" });
  }, []);

  return (
    <WalletContext.Provider value={{ ...state, connect, disconnect, wallets: SUPPORTED_WALLETS }}>
      {children}
    </WalletContext.Provider>
  );
}
