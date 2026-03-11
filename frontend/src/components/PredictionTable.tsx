// components/PredictionTable.tsx
import type { PredictionTableRow } from '../types';

export default function PredictionTable({ rows }: { rows: PredictionTableRow[] }) {
  if (!rows.length) return <div className="flex items-center justify-center h-32 text-zinc-600 text-sm">No data</div>;
  const total = rows.reduce((s, r) => s + r.predicted_qty, 0);
  return (
    <div className="overflow-auto max-h-64 rounded-lg">
      <table className="w-full text-sm border-collapse">
        <thead className="sticky top-0 bg-zinc-900 z-10">
          <tr>
            {['Date','Weekday','DOW ×','Predicted Qty'].map(c => (
              <th key={c} className="px-4 py-2.5 text-left text-[10px] font-bold tracking-widest uppercase text-zinc-500 border-b border-zinc-800">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const d = new Date(row.date);
            const isWE = d.getDay()===0||d.getDay()===6;
            return (
              <tr key={row.date} className={`border-b border-zinc-800/50 hover:bg-zinc-800/40 transition-colors ${isWE?'bg-amber-500/5':i%2?'bg-zinc-800/20':''}`}>
                <td className="px-4 py-2 font-mono text-zinc-300 text-xs">{d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</td>
                <td className="px-4 py-2">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isWE?'bg-amber-500/15 text-amber-400':'bg-zinc-700/50 text-zinc-400'}`}>{row.weekday}</span>
                </td>
                <td className="px-4 py-2 font-mono text-zinc-400 text-xs">×{row.dow_multiplier.toFixed(2)}</td>
                <td className="px-4 py-2 font-mono font-bold text-emerald-400">{row.predicted_qty.toFixed(1)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="sticky bottom-0 bg-zinc-900 border-t border-zinc-700">
          <tr>
            <td colSpan={3} className="px-4 py-2.5 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Total Forecast</td>
            <td className="px-4 py-2.5 font-mono font-black text-amber-400 text-base">{total.toFixed(1)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
