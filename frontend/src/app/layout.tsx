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
      <body className="antialiased bg-[#030712] text-[#f9fafb] relative min-h-screen">
        {/* Glow ambient background effects */}
        <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none -z-10" />
        <div className="fixed top-[30%] -left-[100px] w-[600px] h-[600px] bg-violet-600/5 rounded-full blur-[150px] pointer-events-none -z-10" />
        <div className="fixed bottom-0 right-[-100px] w-[500px] h-[500px] bg-cyan-600/5 rounded-full blur-[120px] pointer-events-none -z-10" />
        
        {/* Subtle grid mesh */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(99,102,241,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(99,102,241,0.04)_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none -z-10" />

        <WalletProvider>
          <Navbar />
          <main className="min-h-screen pt-20 relative z-10">{children}</main>
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: "rgba(17, 24, 39, 0.8)",
                color: "#f9fafb",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                backdropFilter: "blur(12px)",
                borderRadius: "12px",
              },
              success: { iconTheme: { primary: "#10b981", secondary: "rgba(17, 24, 39, 0.8)" } },
              error: { iconTheme: { primary: "#ef4444", secondary: "rgba(17, 24, 39, 0.8)" } },
            }}
          />
        </WalletProvider>
      </body>
    </html>
  );
}
