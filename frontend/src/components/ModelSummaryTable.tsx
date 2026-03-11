// components/ModelSummaryTable.tsx
import { useState } from 'react';
import type { ModelSummaryRow } from '../types';

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

  if (!rows.length) return <div className="flex items-center justify-center h-32 text-zinc-600 text-sm">No data</div>;

  const sort = (k:K) => { if(k===sk) setDir(d=>d==='asc'?'desc':'asc'); else{setSk(k);setDir('desc');} };
  const sorted = [...rows].sort((a,b)=>{
    const av=a[sk],bv=b[sk];
    return typeof av==='number'&&typeof bv==='number' ? (dir==='asc'?av-bv:bv-av) : (dir==='asc'?String(av).localeCompare(String(bv)):String(bv).localeCompare(String(av)));
  });
  const maxT = Math.max(...rows.map(r=>r.total));

  const Th = ({label,k}:{label:string;k:K}) => (
    <th onClick={()=>sort(k)} className="px-3 py-2.5 text-left text-[10px] font-bold tracking-widest uppercase text-zinc-500 border-b border-zinc-800 cursor-pointer hover:text-zinc-300 whitespace-nowrap">
      {label}{sk===k&&<span className="ml-1 text-amber-400">{dir==='asc'?'↑':'↓'}</span>}
    </th>
  );

  return (
    <div className="overflow-auto rounded-lg">
      <table className="w-full text-sm border-collapse">
        <thead className="sticky top-0 bg-zinc-900 z-10">
          <tr>
            <th className="px-3 py-2.5 border-b border-zinc-800 text-[10px] text-zinc-600">#</th>
            <Th label="Model" k="model" />
            <Th label="Baseline" k="baseline" />
            <Th label="Diff" k="diff" />
            <Th label="Total" k="total" />
            <Th label="Avg/Day" k="avg_per_day" />
            <Th label="Spread" k="spread" />
            <th className="px-3 py-2.5 border-b border-zinc-800"/>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row,idx)=>{
            const c = PAL[row.name]??'#71717a';
            const bw = maxT>0?(row.total/maxT)*100:0;
            const sel = selectedModel===row.name;
            return (
              <tr key={row.name} onClick={()=>onSelectModel?.(row.name)}
                className={`border-b border-zinc-800/50 cursor-pointer transition-colors ${sel?'bg-zinc-700/40':'hover:bg-zinc-800/30'} ${row.name==='ensemble'?'bg-zinc-800/20':''}`}>
                <td className="px-3 py-2 text-[10px] text-zinc-600 font-mono">{idx+1}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{background:c}}/>
                    <span className="text-xs font-semibold text-zinc-200">{row.model}</span>
                    {row.name==='ensemble'&&<span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-700/60 text-zinc-400">combined</span>}
                  </div>
                </td>
                <td className="px-3 py-2 font-mono text-xs text-zinc-400">{row.baseline.toFixed(2)}</td>
                <td className="px-3 py-2 font-mono text-xs text-zinc-400">{row.diff !== undefined ? row.diff.toFixed(2) : '-'}</td>
                <td className="px-3 py-2">
                  <span className="font-mono font-bold text-sm" style={{color:c}}>{row.total.toFixed(1)}</span>
                  <div className="mt-1 h-0.5 w-20 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{width:`${bw}%`,background:c}}/>
                  </div>
                </td>
                <td className="px-3 py-2 font-mono text-xs text-zinc-400">{row.avg_per_day.toFixed(2)}</td>
                <td className="px-3 py-2 font-mono text-xs text-zinc-500">{row.spread.toFixed(1)}</td>
                <td className="px-3 py-2 text-xs">{sel?<span className="text-amber-400 font-bold">● active</span>:<span className="text-zinc-700">use →</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-[10px] text-zinc-600 px-4 py-2">Click row to use model in Prediction tab. Click header to sort.</p>
    </div>
  );
}
