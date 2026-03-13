import { useState } from 'react';
import type { ModelSummaryRow } from '../types';
import { ChevronDown, ChevronUp, Play } from 'lucide-react';

const PAL: Record<string,string> = {
  median_dow:'#38bdf8',sma:'#34d399',wma:'#f59e0b',ets:'#a78bfa',
  holts:'#fb7185',holt_winters:'#22d3ee',trimmed_mean:'#fbbf24',
  iqr:'#4ade80',same_weekday:'#f472b6',seasonal_naive:'#60a5fa',
  stl:'#e879f9',ensemble:'#94a3b8',
};

type K = keyof ModelSummaryRow;

export default function ModelSummaryTable({ rows, onSelectModel, selectedModel }: {
  rows: ModelSummaryRow[]; onSelectModel?: (n:string)=>void; selectedModel?: string;
}) {
  const [sk, setSk] = useState<K>('total');
  const [dir, setDir] = useState<'asc'|'desc'>('desc');

  if (!rows.length) return <div className="flex items-center justify-center h-32 text-neutral-500 text-sm font-medium">No models generated</div>;

  const sort = (k:K) => { if(k===sk) setDir(d=>d==='asc'?'desc':'asc'); else{setSk(k);setDir('desc');} };
  const sorted = [...rows].sort((a,b)=>{
    const av=a[sk],bv=b[sk];
    return typeof av==='number'&&typeof bv==='number' ? (dir==='asc'?av-bv:bv-av) : (dir==='asc'?String(av).localeCompare(String(bv)):String(bv).localeCompare(String(av)));
  });
  const maxT = Math.max(...rows.map(r=>r.total));

  const Th = ({label,k}:{label:string;k:K}) => (
    <th onClick={()=>sort(k)} className="px-4 py-3 text-left text-xs font-semibold tracking-wider uppercase text-neutral-400 cursor-pointer hover:text-white transition-colors whitespace-nowrap group select-none">
      <div className="flex items-center gap-1.5">
        {label}
        <span className={`transition-opacity ${sk === k ? 'opacity-100 text-amber-400' : 'opacity-0 group-hover:opacity-50 text-neutral-500'}`}>
          {sk === k ? (dir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : <ChevronDown size={14} />}
        </span>
      </div>
    </th>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto rounded-xl border border-white/5 bg-black/20 custom-scrollbar">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-[#0A0A0A]/95 backdrop-blur-md z-10 border-b border-white/10 shadow-sm">
            <tr>
              <th className="px-4 py-3 border-b border-white/5 text-xs text-neutral-500 font-medium">#</th>
              <Th label="Model" k="model" />
              <Th label="Baseline" k="baseline" />
              <Th label="Variance" k="diff" />
              <Th label="Total Forecast" k="total" />
              <Th label="Avg/Day" k="avg_per_day" />
              <Th label="Spread" k="spread" />
              <th className="px-4 py-3 border-b border-white/5"/>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {sorted.map((row,idx)=>{
              const c = PAL[row.name]??'#a1a1aa';
              const bw = maxT>0?(row.total/maxT)*100:0;
              const sel = selectedModel===row.name;
              return (
                <tr key={row.name} onClick={()=>onSelectModel?.(row.name)}
                  className={`cursor-pointer transition-all duration-200 group
                    ${sel ? 'bg-white/[0.06] border-l-2 border-l-amber-400' : 'hover:bg-white/[0.03] border-l-2 border-l-transparent'} 
                    ${row.name==='ensemble' && !sel ? 'bg-blue-500/[0.02]' : ''}`}>
                  <td className="px-4 py-3 text-xs text-neutral-500 font-mono">{idx+1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style={{background:c, boxShadow: `0 0 8px ${c}40`}}/>
                      <span className={`text-sm font-medium ${sel ? 'text-white' : 'text-neutral-300 group-hover:text-white transition-colors'}`}>{row.model}</span>
                      {row.name==='ensemble' && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium uppercase tracking-wider">consensus</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-neutral-400">{row.baseline.toFixed(2)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-neutral-400">{row.diff !== undefined ? (
                    <span className={row.diff > 0 ? 'text-emerald-400' : row.diff < 0 ? 'text-red-400' : 'text-neutral-400'}>
                      {row.diff > 0 ? '+' : ''}{row.diff.toFixed(2)}
                    </span>
                  ) : '-'}</td>
                  <td className="px-4 py-3 min-w-[140px]">
                    <div className="flex flex-col gap-1.5">
                      <span className="font-mono font-bold text-sm tracking-tight" style={{color:c}}>{row.total.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1})}</span>
                      <div className="h-1 w-24 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{width:`${bw}%`,background:c, boxShadow: `0 0 8px ${c}80`}}/>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-neutral-400">{row.avg_per_day.toFixed(2)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-neutral-500">{row.spread.toFixed(1)}</td>
                  <td className="px-4 py-3 text-right">
                    {sel ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                        </span>
                        Active
                      </span>
                    ) : (
                      <button className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-xs text-neutral-400 hover:text-white bg-white/5 hover:bg-white/10 px-2 py-1 rounded-lg border border-white/10">
                        <Play size={10} className="fill-current" />
                        Apply
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-between px-2">
        <p className="text-[11px] text-neutral-500 font-medium">Click any row to apply its algorithm globally across all projections.</p>
        <p className="text-[11px] text-neutral-500">Sorted by: <span className="text-white font-medium">{String(sk)}</span> ({dir})</p>
      </div>
    </div>
  );
}
