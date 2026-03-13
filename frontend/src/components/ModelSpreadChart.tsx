// components/ModelSpreadChart.tsx
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ErrorBar } from 'recharts';
import type { ModelSummaryRow } from '../types';

const PAL: Record<string,string> = {
  median_dow:'#38bdf8',sma:'#34d399',wma:'#f59e0b',ets:'#a78bfa',
  holts:'#fb7185',holt_winters:'#22d3ee',trimmed_mean:'#fbbf24',
  iqr:'#4ade80',same_weekday:'#f472b6',seasonal_naive:'#60a5fa',
  stl:'#e879f9',ensemble:'#94a3b8',
};

function Tip({ active, payload }: any) {
  if (!active||!payload?.length) return null;
  const d = payload[0]?.payload as ModelSummaryRow;
  return (
    <div className="px-3 py-2 rounded-lg bg-black/80 backdrop-blur-xl border border-white/10 shadow-glass text-xs">
      <p className="font-semibold text-neutral-200 mb-1">{d.model}</p>
      <p className="text-neutral-400">Avg/day: <span className="text-zinc-900 font-mono">{d.avg_per_day.toFixed(2)}</span></p>
      <p className="text-neutral-400">Range: <span className="text-zinc-900 font-mono">{d.min_day.toFixed(1)}–{d.max_day.toFixed(1)}</span></p>
    </div>
  );
}

export default function ModelSpreadChart({ rows }: { rows: ModelSummaryRow[] }) {
  if (!rows.length) return null;
  const sorted = [...rows].sort((a,b)=>b.avg_per_day-a.avg_per_day);
  const cd = sorted.map(r=>({
    ...r,
    shortLabel: r.model.length>18?r.model.slice(0,16)+'…':r.model,
    errorVal: [r.avg_per_day-r.min_day, r.max_day-r.avg_per_day] as [number,number],
  }));
  return (
    <ResponsiveContainer width="100%" height={270}>
      <BarChart data={cd} layout="vertical" margin={{top:5,right:55,left:10,bottom:5}} barCategoryGap="30%">
        <XAxis type="number" tick={{fill:'#71717a',fontSize:10}} axisLine={false} tickLine={false}/>
        <YAxis type="category" dataKey="shortLabel" tick={{fill:'#a1a1aa',fontSize:11}} axisLine={false} tickLine={false} width={125}/>
        <Tooltip content={<Tip/>} cursor={{fill:'rgba(255,255,255,0.03)'}}/>
        <Bar dataKey="avg_per_day" radius={[0,4,4,0]} maxBarSize={14}>
          {cd.map(r=><Cell key={r.name} fill={PAL[r.name]??'#71717a'} fillOpacity={0.85}/>)}
          <ErrorBar dataKey="errorVal" width={4} strokeWidth={1.5} stroke="#ffffff" strokeOpacity={0.3} direction="x"/>
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
