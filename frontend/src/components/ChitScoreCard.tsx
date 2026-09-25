"use client";

import { useMemo, useState } from "react";
import { buildChitScoreSvg, type ChitScoreInput } from "@/lib/chitscore";
import toast from "react-hot-toast";

// Rasterise a standalone SVG string to a PNG blob at 2× for crisp sharing.
async function svgToPng(svg: string, scale = 2): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("SVG render failed"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = 800 * scale;
    canvas.height = 420 * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG encode failed"))), "image/png"),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function ChitScoreCard({ input }: { input: ChitScoreInput }) {
  const svg = useMemo(() => buildChitScoreSvg(input), [input]);
  const dataUri = useMemo(
    () => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    [svg],
  );
  const [busy, setBusy] = useState(false);

  const download = async () => {
    setBusy(true);
    try {
      const blob = await svgToPng(svg);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `chitscore-${input.address.slice(0, 8)}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success("ChitScore card saved");
    } catch {
      toast.error("Could not export image");
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    setBusy(true);
    try {
      const blob = await svgToPng(svg);
      const file = new File([blob], "chitscore.png", { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.canShare?.({ files: [file] }) && nav.share) {
        await nav.share({ files: [file], title: "My ChainChit ChitScore", text: `ChitScore ${input.score}/1000` });
      } else {
        toast("Sharing images needs a mobile browser — downloading instead", { icon: "ℹ️" });
        await download();
      }
    } catch (e) {
      // Abort (user dismissed the sheet) is not an error worth surfacing.
      if ((e as Error)?.name !== "AbortError") toast.error("Share cancelled");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass-card p-6 space-y-4 border border-white/[0.04]">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-200 tracking-tight">Shareable ChitScore</h2>
        <span className="text-[11px] text-slate-500">Prove your on-chain trust</span>
      </div>

      {/* Inline card preview rendered as an <img> (no HTML injection) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={dataUri} alt="ChitScore card" className="w-full h-auto rounded-2xl" />

      <div className="flex gap-2">
        <button onClick={download} disabled={busy} className="btn-primary flex-1 text-sm py-2.5">
          {busy ? "Rendering…" : "Download PNG"}
        </button>
        <button onClick={share} disabled={busy} className="btn-secondary flex-1 text-sm py-2.5">
          Share card
        </button>
      </div>
    </div>
  );
}
