"use client";

import { useWallet } from "@/hooks/useWallet";
import { shortenAddress } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/profile", label: "Profile" },
  { href: "/create-group", label: "Create Group" },
  { href: "/disputes", label: "Disputes" },
];

export function Navbar() {
  const { connected, address, disconnect } = useWallet();
  const pathname = usePathname();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-950/45 backdrop-blur-md border-b border-white/[0.05] shadow-lg shadow-black/10">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 transition-transform hover:scale-[1.02] active:scale-[0.98]">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
            <span className="text-white font-extrabold text-sm tracking-tight">CC</span>
          </div>
          <span className="font-bold text-lg hidden sm:block tracking-tight bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent">
            ChainChit
          </span>
        </Link>
        
        {connected && (
          <div className="flex items-center gap-1 bg-white/[0.02] border border-white/[0.05] rounded-xl p-1">
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 ${
                    isActive
                      ? "bg-gradient-to-r from-indigo-600/20 to-violet-600/20 text-indigo-400 border border-indigo-500/20 shadow-sm"
                      : "text-slate-400 hover:text-slate-100 border border-transparent"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        )}
        
        <div className="flex items-center gap-3">
          {connected ? (
            <div className="flex items-center gap-3">
              <Link
                href="/profile"
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900/50 border border-white/[0.05] hover:border-indigo-500/30 transition-all duration-300 hover:bg-slate-900/80"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-sm shadow-emerald-500/50" />
                <span className="font-mono text-xs font-medium text-slate-300">{shortenAddress(address || "")}</span>
              </Link>
              <button 
                onClick={disconnect} 
                className="px-3 py-1.5 text-xs rounded-xl border border-rose-500/20 hover:border-rose-500/50 hover:bg-rose-950/25 text-rose-400 bg-transparent transition-all duration-300 active:scale-[0.97]"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-500 text-xs">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
              <span>Not connected</span>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
