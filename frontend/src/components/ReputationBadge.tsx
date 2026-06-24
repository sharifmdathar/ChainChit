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
  const color = getReputationColor(score);

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full bg-chit-card border border-chit-border ${sizeClasses[size]}`}>
      <div className={`w-2 h-2 rounded-full ${
        score >= 800 ? "bg-chit-success" : score >= 500 ? "bg-chit-warning" : "bg-chit-danger"
      }`} />
      <span className={`font-medium ${color}`}>{score}</span>
      <span className="text-chit-muted">{label}</span>
    </span>
  );
}
