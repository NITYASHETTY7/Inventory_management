// components/PredictionControls.tsx
import type { Filters, ModelStats } from '../types';

interface Props {
  filters: Filters; onChange: (u: Partial<Filters>) => void; modelStats: ModelStats | null;
}

const DOW_NAMES = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

export default function PredictionControls({ filters, onChange, modelStats }: Props) {
  const pct = ((filters.festivalMultiplier - 1.0) / 1.0) * 100;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="w-1 h-5 rounded-full bg-emerald-400" />
        <span className="text-[10px] font-bold tracking-widest uppercase text-zinc-400">Demand Controls</span>
      </div>

      <div className="p-4 rounded-xl bg-amber-500/8 border border-amber-500/20">
        <div className="flex justify-between items-center mb-3">
          <span className="text-xs font-semibold text-zinc-300">Festival Multiplier</span>
          <span className="text-xl font-mono font-black text-amber-400">×{filters.festivalMultiplier.toFixed(1)}</span>
        </div>
        <input type="range" min={1.0} max={2.0} step={0.1} value={filters.festivalMultiplier}
          onChange={e => onChange({ festivalMultiplier: parseFloat(e.target.value) })}
          className="w-full accent-amber-400 cursor-pointer" />
        <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
          <span>Normal (1×)</span><span>Peak (2×)</span>
        </div>
        <div className="mt-3 h-1.5 rounded-full bg-zinc-700 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400 transition-all duration-200"
            style={{ width: `${pct}%` }} />
        </div>
        <p className="text-[10px] text-zinc-500 mt-1">Demand boost: +{pct.toFixed(0)}%</p>
      </div>

      {modelStats && Object.keys(modelStats.dow_multipliers).length > 0 && (
        <div className="p-3 rounded-lg bg-zinc-800/40 border border-zinc-700/30">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold mb-3">DOW Multipliers</p>
          <div className="flex items-end gap-1 h-10">
            {DOW_NAMES.map((name, i) => {
              const m = modelStats.dow_multipliers[String(i)] ?? 1;
              const max = Math.max(...Object.values(modelStats.dow_multipliers));
              const h = max > 0 ? (m / max) * 100 : 50;
              return (
                <div key={name} className="flex flex-col items-center gap-1 flex-1">
                  <div className={`w-full rounded-sm ${i>=5?'bg-amber-500/70':'bg-zinc-600/80'}`}
                    style={{ height: `${h}%` }} title={`${name}: ×${m.toFixed(2)}`} />
                  <span className="text-[8px] text-zinc-600">{name}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
