"use client";

import { useWallet } from "@/hooks/useWallet";
import { shortenAddress } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/create-group", label: "Create Group" },
  { href: "/disputes", label: "Disputes" },
];

export function Navbar() {
  const { connected, address, disconnect } = useWallet();
  const pathname = usePathname();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-chit-bg/80 backdrop-blur-lg border-b border-chit-border">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-stellar-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">CC</span>
          </div>
          <span className="font-bold text-lg hidden sm:block">ChainChit</span>
        </Link>
        {connected && (
          <div className="flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  pathname === link.href
                    ? "bg-stellar-600/20 text-stellar-400"
                    : "text-chit-muted hover:text-chit-text"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        )}
        <div className="flex items-center gap-3">
          {connected ? (
            <div className="flex items-center gap-3">
              <Link
                href="/profile"
                className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-chit-card border border-chit-border hover:border-stellar-600/40 transition-colors"
              >
                <div className="w-2 h-2 rounded-full bg-chit-success" />
                <span className="font-mono text-sm">{shortenAddress(address || "")}</span>
              </Link>
              <button onClick={disconnect} className="text-chit-muted hover:text-chit-danger text-sm transition-colors">
                Disconnect
              </button>
            </div>
          ) : (
            <span className="text-chit-muted text-sm">Not connected</span>
          )}
        </div>
      </div>
    </nav>
  );
}
