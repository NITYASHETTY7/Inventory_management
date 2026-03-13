import type { Filters, ModelStats } from '../types';
import { Settings2, TrendingUp, Zap } from 'lucide-react';

interface Props {
  filters: Filters; onChange: (u: Partial<Filters>) => void; modelStats: ModelStats | null;
}

const DOW_NAMES = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

export default function PredictionControls({ filters, onChange, modelStats }: Props) {
  const pct = ((filters.festivalMultiplier - 1.0) / 1.0) * 100;
  
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2 pb-2 border-b border-white/5">
        <Settings2 size={16} className="text-white" />
        <span className="text-sm font-semibold text-white">Demand Controls</span>
      </div>

      <div className="glass-panel p-4 bg-amber-500/5 border-amber-500/20 group hover:border-amber-500/30 transition-colors">
        <div className="flex justify-between items-center mb-4">
          <span className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
            <Zap size={14} className="text-amber-400" />
            Festival Multiplier
          </span>
          <span className="text-lg font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20 shadow-inner">
            ×{filters.festivalMultiplier.toFixed(1)}
          </span>
        </div>
        
        <div className="px-1 relative">
          <input type="range" min={1.0} max={2.0} step={0.1} value={filters.festivalMultiplier}
            onChange={e => onChange({ festivalMultiplier: parseFloat(e.target.value) })}
            className="w-full relative z-10 cursor-pointer opacity-0" />
          
          {/* Custom Slider Track Overlay */}
          <div className="absolute top-1/2 -translate-y-1/2 left-1 right-1 h-1.5 rounded-full bg-white/10 overflow-hidden pointer-events-none">
            <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400 transition-all duration-200"
              style={{ width: `${pct}%` }} />
          </div>
          {/* Custom Thumb */}
          <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-amber-400 border-2 border-[#1a1a1a] shadow-md pointer-events-none transition-all duration-200"
               style={{ left: `calc(${pct}% - 8px)` }}></div>
        </div>

        <div className="flex justify-between text-[10px] text-neutral-500 mt-2 font-medium">
          <span>Baseline (1×)</span>
          <span>Peak Demand (2×)</span>
        </div>
        
        {pct > 0 && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-amber-400/80 bg-amber-500/10 p-2 rounded-lg border border-amber-500/10 animate-in fade-in slide-in-from-top-2">
            <TrendingUp size={14} />
            <span>Demand artificially boosted by +{pct.toFixed(0)}%</span>
          </div>
        )}
      </div>

      {modelStats && Object.keys(modelStats.dow_multipliers).length > 0 && (
        <div className="glass-panel p-4 bg-white/5">
          <p className="text-xs font-semibold text-neutral-300 mb-4 flex items-center gap-1.5">
            <TrendingUp size={14} className="text-blue-400" />
            Day-of-Week Multipliers
          </p>
          <div className="flex items-end gap-1.5 h-16 pt-2">
            {DOW_NAMES.map((name, i) => {
              const m = modelStats.dow_multipliers[String(i)] ?? 1;
              const max = Math.max(...Object.values(modelStats.dow_multipliers));
              const h = max > 0 ? (m / max) * 100 : 50;
              const isWeekend = i >= 5;
              
              return (
                <div key={name} className="flex flex-col items-center gap-2 flex-1 group">
                  <div className="relative w-full h-full flex items-end justify-center rounded overflow-hidden">
                     {/* Background track */}
                    <div className="absolute inset-0 bg-white/5 rounded-t-sm" />
                    {/* Active bar */}
                    <div className={`w-full rounded-t-sm transition-all duration-500 ${isWeekend ? 'bg-amber-400/80 group-hover:bg-amber-400' : 'bg-blue-400/60 group-hover:bg-blue-400'}`}
                      style={{ height: `${h}%` }} />
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 transition-opacity bg-[#111] border border-white/10 text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap shadow-lg z-10 pointer-events-none">
                      ×{m.toFixed(2)}
                    </div>
                  </div>
                  <span className={`text-[9px] font-medium ${isWeekend ? 'text-amber-400/80' : 'text-neutral-500'}`}>{name}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
