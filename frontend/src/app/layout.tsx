import type { Metadata } from "next";
import "./globals.css";
import { WalletProvider } from "@/hooks/useWallet";
import { Navbar } from "@/components/Navbar";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "ChainChit — Transparent On-Chain Chit Funds",
  description:
    "Trustless rotating savings on Stellar. Smart contract custody, on-chain reputation, dispute resolution.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <WalletProvider>
          <Navbar />
          <main className="min-h-screen pt-16">{children}</main>
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: "#111827",
                color: "#f9fafb",
                border: "1px solid #1f2937",
              },
              success: { iconTheme: { primary: "#40c057", secondary: "#111827" } },
              error: { iconTheme: { primary: "#fa5252", secondary: "#111827" } },
            }}
          />
        </WalletProvider>
      </body>
    </html>
  );
}
