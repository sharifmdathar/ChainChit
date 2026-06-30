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
      className="glass-card p-5 w-full text-left transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] focus:outline-none flex flex-col justify-between h-[210px] group border border-white/[0.04]"
    >
      <div className="w-full">
        <div className="flex items-start justify-between mb-4">
          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${getStateColor(group.state)}`}>
            {group.state}
          </span>
          <span className="text-slate-400 text-xs font-semibold">
            Cycle {group.current_cycle}/{group.total_cycles}
          </span>
        </div>
        
        <div className="mb-4">
          <p className="text-2xl font-black text-slate-100 tracking-tight">
            {formatUsdc(group.contribution_amount * group.num_members)}
          </p>
          <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wider mt-0.5">Pool Per Cycle</p>
        </div>
      </div>

      <div className="w-full">
        <div className="grid grid-cols-2 gap-2 text-xs mb-4">
          <div>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Contribution</p>
            <p className="font-semibold text-slate-200">{formatUsdc(group.contribution_amount)}</p>
          </div>
          <div>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Members</p>
            <p className="font-semibold text-slate-200">{memberCount} / {group.num_members}</p>
          </div>
        </div>
        
        <div className="w-full bg-slate-900 rounded-full h-2 border border-white/[0.03] overflow-hidden">
          <div
            className="bg-gradient-to-r from-indigo-500 to-cyan-500 h-2 rounded-full transition-all duration-700 shadow-sm shadow-indigo-500/50"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </button>
  );
}
