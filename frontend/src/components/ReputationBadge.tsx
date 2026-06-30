import { getReputationColor, getReputationLabel } from "@/lib/utils";

interface ReputationBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "text-xs px-2 py-0.5",
  md: "text-sm px-3 py-1",
  lg: "text-base px-4 py-1.5",
};

export function ReputationBadge({ score, size = "md" }: ReputationBadgeProps) {
  const label = getReputationLabel(score);
  
  // Custom tier classes based on score
  let tierClasses = "";
  let dotColor = "";
  
  if (score >= 900) {
    // Gold Tier
    tierClasses = "bg-amber-500/10 border-amber-500/30 text-amber-300 shadow-sm shadow-amber-500/10";
    dotColor = "bg-amber-400 shadow-sm shadow-amber-400";
  } else if (score >= 700) {
    // Silver / Indigo Tier
    tierClasses = "bg-indigo-500/10 border-indigo-500/30 text-indigo-300 shadow-sm shadow-indigo-500/10";
    dotColor = "bg-indigo-400 shadow-sm shadow-indigo-400";
  } else if (score >= 500) {
    // Bronze Tier
    tierClasses = "bg-orange-500/10 border-orange-500/30 text-orange-300 shadow-sm shadow-orange-500/10";
    dotColor = "bg-orange-400 shadow-sm shadow-orange-400";
  } else {
    // Red/New Tier
    tierClasses = "bg-slate-900 border-white/[0.08] text-slate-400";
    dotColor = "bg-slate-500";
  }

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border font-semibold tracking-wide ${sizeClasses[size]} ${tierClasses}`}>
      <div className={`w-1.5 h-1.5 rounded-full ${dotColor} animate-pulse`} />
      <span className="font-mono">{score}</span>
      <span className="opacity-80 font-medium text-[10px] uppercase tracking-wider">{label}</span>
    </span>
  );
}
