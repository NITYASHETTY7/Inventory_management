// components/ModelComparisonChart.tsx
import { useState, useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import type { ModelPrediction } from '../types';

const PALETTE = ['#38bdf8','#34d399','#f59e0b','#a78bfa','#fb7185','#22d3ee',
                 '#fbbf24','#4ade80','#f472b6','#60a5fa','#e879f9','#94a3b8'];

function Tip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="px-3 py-2.5 rounded-lg bg-black/80 backdrop-blur-xl border border-white/10 shadow-glass text-xs max-w-xs">
      <p className="text-neutral-400 mb-2 font-mono">{label}</p>
      {[...payload].sort((a,b)=>b.value-a.value).map((p:any) => (
        <div key={p.dataKey} className="flex justify-between items-center gap-4">
          <span style={{color:p.color}} className="font-medium truncate max-w-[140px]">{p.name}</span>
          <span style={{color:p.color}} className="font-mono font-bold">{Number(p.value).toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
}

import type { HistoricalSale } from '../types';

export default function ModelComparisonChart({ models, futureDates, actualSales = [] }: { models: ModelPrediction[]; futureDates: string[], actualSales?: HistoricalSale[] }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const toggle = (n: string) => setHidden(p => { const s=new Set(p); s.has(n)?s.delete(n):s.add(n); return s; });
  const isolate = (n: string) => setHidden(new Set(models.filter(m=>m.name!==n).map(m=>m.name).concat('actual_sales')));

  const correctnessMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (!actualSales || actualSales.length === 0) return map;

    const actualMap: Record<string, number> = {};
    actualSales.forEach(s => actualMap[s.date] = s.qty);

    models.forEach(m => {
      let sumPctErr = 0;
      let count = 0;
      futureDates.forEach((d, i) => {
        const actual = actualMap[d];
        if (actual !== undefined && actual > 0) {
          const pred = m.daily_predictions[i] ?? 0;
          sumPctErr += Math.abs(pred - actual) / actual;
          count++;
        }
      });
      if (count > 0) {
        const mape = (sumPctErr / count) * 100;
        map[m.name] = (100 - mape).toFixed(1) + '%';
      }
    });
    return map;
  }, [models, futureDates, actualSales]);

  const chartData = useMemo(() => {
    const actualMap: Record<string, number> = {};
    actualSales.forEach(s => actualMap[s.date] = s.qty);
    
    return futureDates.map((d,i) => {
      const p: Record<string,string|number|null> = {
        label: new Date(d).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}),
        actual_sales: actualMap[d] ?? null,
      };
      models.forEach(m => { p[m.name]=m.daily_predictions[i]??0; });
      return p;
    });
  }, [models, futureDates, actualSales]);

  const actualTargetSum = useMemo(() => {
    return actualSales.filter(s => futureDates.includes(s.date)).reduce((a, b) => a + b.qty, 0);
  }, [actualSales, futureDates]);

  if (!models.length) return <div className="flex items-center justify-center h-48 text-neutral-500 text-sm">Run a comparison</div>;

  const actualHidden = hidden.has('actual_sales');

  return (
    <div className="flex flex-col gap-3 relative">
      {actualSales.length > 0 && (
        <div className="absolute top-1 right-3 z-10 flex flex-col gap-1 text-[10px] font-mono bg-[#0A0A0A]/60 px-3 py-2 rounded-lg border border-white/10 shadow-md backdrop-blur-sm pointer-events-none">
          <div className="text-neutral-400 font-bold border-b border-white/5 pb-1 mb-1 tracking-widest uppercase">Totals ({futureDates.length}d)</div>
          <div className="flex justify-between gap-4 text-sky-400">
            <span>Actual</span>
            <span className="font-bold text-sm">{actualTargetSum.toFixed(0)}</span>
          </div>
          {models.filter(m => !hidden.has(m.name)).map(m => (
            <div key={m.name} className="flex justify-between gap-4" style={{color: PALETTE[models.indexOf(m)%PALETTE.length]}}>
              <span className="truncate max-w-[100px]" title={m.label}>{m.label}</span>
              <span className="font-bold">{m.daily_predictions.reduce((a,b)=>a+b,0).toFixed(0)}</span>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5 items-center">
        <button onClick={()=>setHidden(new Set())} className="text-xs px-2 py-0.5 rounded bg-white/10 text-neutral-400 hover:bg-white/20">All</button>
        <button onClick={()=>setHidden(new Set(models.map(m=>m.name).concat('actual_sales')))} className="text-xs px-2 py-0.5 rounded bg-white/10 text-neutral-400 hover:bg-white/20">None</button>
        <div className="w-px h-4 bg-white/10 mx-1"/>
        
        {actualSales.length > 0 && (
          <button
            onClick={() => toggle('actual_sales')}
            className={`text-xs px-2.5 py-0.5 rounded-full border transition-all font-medium ${
              !actualHidden ? 'bg-sky-500/20 border-sky-500/40 text-sky-400' : 'bg-[#0A0A0A]/60 opacity-40 text-neutral-400 border-white/20'
            }`}
          >
            Actual Sales
          </button>
        )}
        
        {models.map((m,i) => {
          const vis = !hidden.has(m.name), c = PALETTE[i%PALETTE.length];
          const acc = correctnessMap[m.name];
          return (
            <button key={m.name} onClick={()=>toggle(m.name)} onDoubleClick={()=>isolate(m.name)}
              className={`text-xs px-2.5 py-0.5 rounded-full border transition-all font-medium flex items-center gap-1.5 ${vis?'bg-white/5':'bg-[#0A0A0A]/60 opacity-40'}`}
              style={{color:vis?c:'#71717a', borderColor:vis?c+'60':undefined}}>
              <span>{m.label}</span>
              {acc && <span className="opacity-70 text-[10px] bg-black/20 px-1 rounded">{acc}</span>}
            </button>
          );
        })}
        <span className="text-[10px] text-neutral-500 ml-1">dbl-click isolates</span>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{top:10,right:20,left:-10,bottom:0}}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          <XAxis dataKey="label" tick={{fill:'#71717a',fontSize:10}} axisLine={false} tickLine={false} interval={Math.max(0,Math.floor(futureDates.length/7)-1)} />
          <YAxis tick={{fill:'#71717a',fontSize:10}} axisLine={false} tickLine={false} />
          <Tooltip content={<Tip />} />
          {!actualHidden && actualSales.length > 0 && (
            <Line type="monotone" dataKey="actual_sales" name="Actual Sales" stroke="#f43f5e"
              strokeWidth={2.5} dot={false} activeDot={{r:4,strokeWidth:0}} connectNulls />
          )}
          {models.map((m,i) => !hidden.has(m.name) && (
            <Line key={m.name} type="monotone" dataKey={m.name} name={m.label}
              stroke={PALETTE[i%PALETTE.length]} strokeWidth={m.name==='ensemble'?2.5:1.5}
              strokeDasharray={m.name==='ensemble'?'6 3':undefined}
              dot={false} activeDot={{r:4,strokeWidth:0}} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
