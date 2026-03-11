// components/SalesChart.tsx
import { ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';
import type { HistoricalSale, FestivalEntry } from '../types';
import { buildFestivalMap, TIER_COLORS, FestivalPill } from './FestivalBadge';

function Tip({ active, payload, label, festMap }: any) {
  if (!active || !payload?.length) return null;
  const fest = payload[0]?.payload?.date ? festMap[payload[0].payload.date] : null;
  return (
    <div className="px-3 py-2 rounded-lg bg-zinc-900/95 border border-zinc-700/60 shadow-xl text-xs">
      <p className="text-zinc-400 mb-1">{label}</p>
      <p className="font-mono font-bold text-sky-400">{payload[0]?.value} units</p>
      {fest && <FestivalPill festival={fest} />}
    </div>
  );
}

function FestivalDot(props: any) {
  const { cx, cy, payload, festMap } = props;
  const fest = festMap[payload?.date];
  if (!fest || !cx || !cy) return null;
  const c    = TIER_COLORS[fest.tier as 1 | 2 | 3];
  const size = fest.tier === 1 ? 8 : fest.tier === 2 ? 6 : 5;
  return (
    <g>
      <rect
        x={cx - size / 2} y={cy - size / 2}
        width={size} height={size}
        fill={c.dot} stroke="#18181b" strokeWidth={1}
        transform={`rotate(45 ${cx} ${cy})`}
        opacity={0.9}
      />
    </g>
  );
}

interface Props {
  data:      HistoricalSale[];
  baseline:  number;
  festivals: FestivalEntry[];
}

export default function SalesChart({ data, baseline, festivals }: Props) {
  if (!data.length) return <div className="flex items-center justify-center h-48 text-zinc-600 text-sm">No historical data</div>;
  const step = Math.max(1, Math.floor(data.length / 8));
  const cd = data.map((d, i) => ({
    ...d,
    label: i % step === 0 ? new Date(d.date).toLocaleDateString('en-GB', { day:'numeric', month:'short' }) : '',
  }));
  const festMap = buildFestivalMap(festivals);
  
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={cd} margin={{ top:10, right:20, left:-10, bottom:0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
        <XAxis dataKey="label" tick={{ fill:'#71717a', fontSize:10 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill:'#71717a', fontSize:10 }} axisLine={false} tickLine={false} />
        <Tooltip content={<Tip festMap={festMap} />} />
        {baseline > 0 && <ReferenceLine y={baseline} stroke="#f59e0b" strokeDasharray="4 3" strokeOpacity={0.5}
          label={{ value:`Base: ${baseline.toFixed(1)}`, fill:'#f59e0b', fontSize:9, position:'right' }} />}
        <Line type="monotone" dataKey="qty" stroke="#38bdf8" strokeWidth={2}
          dot={(p) => <FestivalDot {...p} festMap={festMap} />}
          activeDot={{ r:4, fill:'#38bdf8', strokeWidth:0 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
