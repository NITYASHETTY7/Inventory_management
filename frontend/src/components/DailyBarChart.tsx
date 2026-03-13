// components/DailyBarChart.tsx
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import type { DayPrediction } from '../types';

function Tip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as DayPrediction;
  return (
    <div className="px-3 py-2 rounded-lg bg-black/80 backdrop-blur-xl border border-white/10 shadow-glass text-xs">
      <p className="text-neutral-400 mb-1">{d?.weekday_name}</p>
      <p className={`font-mono font-bold ${d?.dow>=5?'text-amber-400':'text-indigo-400'}`}>{d?.predicted_qty} units</p>
      <p className="text-neutral-400">{new Date(d.date).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</p>
    </div>
  );
}

export default function DailyBarChart({ data }: { data: DayPrediction[] }) {
  if (!data.length) return <div className="flex items-center justify-center h-48 text-neutral-500 text-sm">No data</div>;
  const cd = data.map(d => ({ ...d, label: new Date(d.date).toLocaleDateString('en-GB',{weekday:'short',day:'numeric'}) }));
  return (
    <>
      <ResponsiveContainer width="100%" height={210}>
        <BarChart data={cd} margin={{top:10,right:20,left:-10,bottom:0}} barCategoryGap="30%">
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          <XAxis dataKey="label" tick={{fill:'#71717a',fontSize:10}} axisLine={false} tickLine={false} interval={data.length>14?1:0} />
          <YAxis tick={{fill:'#71717a',fontSize:10}} axisLine={false} tickLine={false} />
          <Tooltip content={<Tip />} cursor={{fill:'rgba(255,255,255,0.04)'}} />
          <Bar dataKey="predicted_qty" radius={[3,3,0,0]}>
            {cd.map((e,i)=><Cell key={i} fill={e.dow>=5?'#f59e0b':'#6366f1'} fillOpacity={0.85} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex gap-4 justify-end mt-1 pr-2">
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-sm bg-indigo-500/80"/><span className="text-[10px] text-neutral-400">Weekday</span></div>
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-sm bg-amber-500/80"/><span className="text-[10px] text-neutral-400">Weekend</span></div>
      </div>
    </>
  );
}
