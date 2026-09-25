"use client";

import { useMemo } from "react";
import { generateQr } from "@/lib/qr";

// Dependency-free SVG QR renderer. Quiet zone of 4 modules per spec.
export function QrCode({ value, size = 200, className }: { value: string; size?: number; className?: string }) {
  const modules = useMemo(() => {
    try {
      return generateQr(value);
    } catch {
      return null;
    }
  }, [value]);

  if (!modules) return null;

  const dim = modules.length;
  const quiet = 4;
  const total = dim + quiet * 2;
  const path: string[] = [];
  for (let r = 0; r < dim; r++) {
    for (let c = 0; c < dim; c++) {
      if (modules[r][c]) {
        path.push(`M${c + quiet} ${r + quiet}h1v1h-1z`);
      }
    }
  }

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox={`0 0 ${total} ${total}`}
      shapeRendering="crispEdges"
      aria-label="QR code"
    >
      <rect width={total} height={total} fill="#fff" />
      <path d={path.join("")} fill="#0f172a" />
    </svg>
  );
}
