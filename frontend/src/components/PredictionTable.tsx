import type { PredictionTableRow } from '../types';

export default function PredictionTable({ rows }: { rows: PredictionTableRow[] }) {
  if (!rows.length) return <div className="flex items-center justify-center h-32 text-neutral-500 text-sm font-medium">No projection data available</div>;
  const total = rows.reduce((s, r) => s + r.predicted_qty, 0);
  
  return (
    <div className="overflow-auto max-h-[300px] rounded-xl border border-white/5 bg-black/20 custom-scrollbar">
      <table className="w-full text-sm border-collapse">
        <thead className="sticky top-0 bg-[#0A0A0A]/90 backdrop-blur-md z-10 border-b border-white/10">
          <tr>
            {['Date', 'Day', 'Multiplier', 'Forecast Qty'].map(c => (
              <th key={c} className="px-5 py-3 text-left text-xs font-semibold tracking-wider uppercase text-neutral-400 whitespace-nowrap">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {rows.map((row) => {
            const d = new Date(row.date);
            const isWE = d.getDay() === 0 || d.getDay() === 6;
            return (
              <tr key={row.date} className={`hover:bg-white/[0.03] transition-colors ${isWE ? 'bg-amber-500/[0.02]' : ''}`}>
                <td className="px-5 py-3 font-mono text-neutral-300 text-xs whitespace-nowrap">
                  {d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}
                </td>
                <td className="px-5 py-3 whitespace-nowrap">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${isWE ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-white/5 text-neutral-400 border-white/10'}`}>
                    {row.weekday}
                  </span>
                </td>
                <td className="px-5 py-3 font-mono text-neutral-400 text-xs whitespace-nowrap">
                  <span className="flex items-center gap-1">
                    <span className="text-neutral-600">×</span>
                    {row.dow_multiplier.toFixed(2)}
                  </span>
                </td>
                <td className="px-5 py-3 font-mono font-bold text-emerald-400 whitespace-nowrap">
                  {row.predicted_qty.toFixed(1)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="sticky bottom-0 bg-[#0A0A0A]/95 backdrop-blur-md border-t border-white/10">
          <tr>
            <td colSpan={3} className="px-5 py-3.5 text-xs font-semibold text-neutral-300 uppercase tracking-wider">Aggregate Forecast</td>
            <td className="px-5 py-3.5 font-mono font-black text-amber-400 text-lg">{total.toFixed(1)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
