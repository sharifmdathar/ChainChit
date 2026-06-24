import type { GroupInfo } from "@/types";
import { getStateColor, formatUsdc } from "@/lib/utils";

interface GroupCardProps {
  group: GroupInfo;
  memberCount: number;
  onClick: () => void;
}

export function GroupCard({ group, memberCount, onClick }: GroupCardProps) {
  const progress = group.total_cycles > 0
    ? Math.round((group.current_cycle / group.total_cycles) * 100)
    : 0;

  return (
    <button
      onClick={onClick}
      className="glass-card p-5 w-full text-left hover:border-stellar-600/40 transition-all duration-200 group"
    >
      <div className="flex items-start justify-between mb-3">
        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${getStateColor(group.state)}`}>
          {group.state}
        </span>
        <span className="text-chit-muted text-xs">
          Cycle {group.current_cycle}/{group.total_cycles}
        </span>
      </div>
      <div className="mb-3">
        <p className="text-2xl font-bold text-chit-text">{formatUsdc(group.contribution_amount * group.num_members)}</p>
        <p className="text-chit-muted text-xs">Pool per cycle</p>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
        <div>
          <p className="text-chit-muted text-xs">Contribution</p>
          <p className="font-medium">{formatUsdc(group.contribution_amount)}</p>
        </div>
        <div>
          <p className="text-chit-muted text-xs">Members</p>
          <p className="font-medium">{memberCount}/{group.num_members}</p>
        </div>
      </div>
      <div className="w-full bg-chit-border rounded-full h-1.5">
        <div
          className="bg-stellar-600 h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </button>
  );
}
