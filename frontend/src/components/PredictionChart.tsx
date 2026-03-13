// components/PredictionChart.tsx
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import type { DayPrediction, HistoricalSale } from '../types';

function Tip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  // payload can contain predicted_qty (Area) and/or actual_qty (Line)
  const d = payload[0]?.payload;
  return (
    <div className="px-3 py-2 rounded-lg bg-black/80 backdrop-blur-xl border border-white/10 shadow-glass text-xs">
      <p className="text-neutral-400 mb-1">{d?.weekday_name}, {label}</p>
      {d?.predicted_qty != null && (
        <p className="font-mono font-bold text-emerald-400">Predicted: {d.predicted_qty}</p>
      )}
      {d?.actual_qty != null && (
        <p className="font-mono font-bold text-sky-400">Actual: {d.actual_qty}</p>
      )}
      {d?.dow_multiplier && (
        <p className="text-neutral-400 mt-0.5">DOW ×{d?.dow_multiplier} · Fest ×{d?.festival_multiplier}</p>
      )}
    </div>
  );
}

export default function PredictionChart({ data, actualSales = [] }: { data: DayPrediction[]; actualSales?: HistoricalSale[] }) {
  if (!data.length) return <div className="flex items-center justify-center h-48 text-neutral-500 text-sm">No predictions yet</div>;

  const actualMap: Record<string, number> = {};
  actualSales.forEach(s => actualMap[s.date] = s.qty);

  const cd = data.map(d => ({
    ...d,
    label: new Date(d.date).toLocaleDateString('en-GB', { day:'numeric', month:'short' }),
    actual_qty: actualMap[d.date] ?? null,
  }));

  const predSum = data.reduce((s, d) => s + d.predicted_qty, 0);
  // Only sum actual sales for the dates that we are predicting
  const targetDates = new Set(data.map(d => d.date));
  const actualSum = actualSales.filter(s => targetDates.has(s.date)).reduce((s, d) => s + d.qty, 0);

  return (
    <div className="flex flex-col h-full relative">
      {actualSales.length > 0 && (
        <div className="absolute top-0 right-2 flex gap-4 text-[10px] font-mono z-10 bg-[#0A0A0A]/60 px-3 py-1.5 rounded-lg border border-white/10 shadow-md">
          <div className="text-emerald-400 flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-400" />Pred: <span className="font-bold text-sm">{predSum.toFixed(0)}</span></div>
          <div className="text-sky-400 flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-sky-400" />Actual: <span className="font-bold text-sm">{actualSum.toFixed(0)}</span></div>
        </div>
      )}
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={cd} margin={{ top:10, right:20, left:-10, bottom:0 }}>
        <defs>
          <linearGradient id="egrGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34d399" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#34d399" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
        <XAxis dataKey="label" tick={{ fill:'#71717a', fontSize:10 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill:'#71717a', fontSize:10 }} axisLine={false} tickLine={false} />
        <Tooltip content={<Tip />} />
        <Area type="monotone" dataKey="predicted_qty" stroke="#34d399" strokeWidth={2.5}
          fill="url(#egrGrad)" dot={{ r:3, fill:'#34d399', strokeWidth:0 }} activeDot={{ r:5, fill:'#34d399', strokeWidth:0 }} />
        {actualSales.length > 0 && (
          <Line type="monotone" dataKey="actual_qty" stroke="#38bdf8" strokeWidth={2}
            dot={{ r:3, fill:'#38bdf8', strokeWidth:0 }} activeDot={{ r:5, fill:'#38bdf8', strokeWidth:0 }} connectNulls />
        )}
      </ComposedChart>
    </ResponsiveContainer>
    </div>
  );
}
