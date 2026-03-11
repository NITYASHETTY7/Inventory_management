// pages/MspAccuracy.tsx
// MSP Accuracy tab — three model cards, overlay chart, accuracy table, cross-check panel

import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  ResponsiveContainer, ComposedChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ReferenceLine,
} from 'recharts';
import { api } from '../services/api';
import type { Filters, MspAccuracyResponse, MspModelResult, CrossCheckEntry, FestivalEntry } from '../types';
import FiltersPanel from '../components/FiltersPanel';
import { buildFestivalMap, TIER_COLORS, FestivalPill, FestivalCalendarPanel } from '../components/FestivalBadge';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const MODEL_COLORS: Record<string, string> = {
  median_dow: '#a78bfa',   // violet
  wma:        '#f59e0b',   // amber
  sma:        '#34d399',   // emerald
};

function mapeColor(mape: number) {
  if (mape < 15) return 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30';
  if (mape < 30) return 'text-amber-400 bg-amber-500/15 border-amber-500/30';
  return 'text-red-400 bg-red-500/15 border-red-500/30';
}

function errColor(pct: number) {
  if (pct < 15) return 'text-emerald-400';
  if (pct < 30) return 'text-amber-400';
  return 'text-red-400';
}

function accuracyRating(mape: number) {
  if (mape < 10) return { label: 'Excellent', cls: 'text-emerald-400' };
  if (mape < 20) return { label: 'Good',      cls: 'text-sky-400'     };
  if (mape < 35) return { label: 'Fair',       cls: 'text-amber-400'   };
  return              { label: 'Poor',         cls: 'text-red-400'     };
}



// ─────────────────────────────────────────────────────────────────────────────
// Loading skeleton
// ─────────────────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="animate-pulse flex flex-col gap-3">
      <div className="h-4 bg-zinc-800 rounded w-1/3"/>
      <div className="h-48 bg-zinc-800/60 rounded-xl"/>
      <div className="h-4 bg-zinc-800 rounded w-1/2"/>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Formula info box
// ─────────────────────────────────────────────────────────────────────────────

function FormulaBox({ text, visible }: { text: string; visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="mt-3 border-l-2 border-amber-400 bg-zinc-800/80 rounded-r-lg p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400 mb-2">Formula</p>
      <pre className="text-[11px] font-mono text-zinc-300 whitespace-pre-wrap leading-relaxed">{text}</pre>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Error metrics badges
// ─────────────────────────────────────────────────────────────────────────────

function ErrorBadges({ metrics }: { metrics: MspModelResult['error_metrics'] }) {
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      <span className="text-[10px] px-2.5 py-1 rounded-full bg-zinc-700/50 border border-zinc-600/40 text-zinc-300 font-mono">
        MAE <span className="font-bold text-zinc-900 ml-1">{metrics.mae.toFixed(2)}</span>
      </span>
      <span className={`text-[10px] px-2.5 py-1 rounded-full border font-mono ${mapeColor(metrics.mape)}`}>
        MAPE <span className="font-bold ml-1">{metrics.mape.toFixed(1)}%</span>
      </span>
      <span className="text-[10px] px-2.5 py-1 rounded-full bg-zinc-700/50 border border-zinc-600/40 text-zinc-300 font-mono">
        RMSE <span className="font-bold text-zinc-900 ml-1">{metrics.rmse.toFixed(2)}</span>
      </span>
      <span className="text-[10px] px-2.5 py-1 rounded-full bg-zinc-800/60 border border-zinc-700/30 text-zinc-500 font-mono">
        n = {metrics.n_days} days
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Individual model chart card
// ─────────────────────────────────────────────────────────────────────────────

function ModelCard({ model, festivals }: { model: MspModelResult, festivals: FestivalEntry[] }) {
  const [showFormula, setShowFormula] = useState(false);
  const [hideActual, setHideActual] = useState(false);
  const [hideModel, setHideModel]   = useState(false);
  const color = MODEL_COLORS[model.name] ?? '#94a3b8';

  // Build chart data — skip null predictions (warmup period)
  const chartData = model.per_day
    .filter(d => d.predicted_qty !== null)
    .map((d, i) => ({
      label: i % 10 === 0
        ? new Date(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
        : '',
      actual:    d.actual_qty,
      predicted: d.predicted_qty,
      date:      d.date,
    }));

  const festMap = buildFestivalMap(festivals);
  const visibleFestivals = festivals.filter(f => chartData.some(d => d.date === f.date));

  function CustomTip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    const actual    = payload.find((p:any)=>p.dataKey==='actual')?.value;
    const predicted = payload.find((p:any)=>p.dataKey==='predicted')?.value;
    const diff = (predicted != null && actual != null) ? (predicted - actual).toFixed(1) : null;
    const fest = payload[0]?.payload?.date ? festMap[payload[0].payload.date] : null;
    return (
      <div className="px-3 py-2.5 rounded-lg bg-zinc-900/95 border border-zinc-700/60 shadow-xl text-xs">
        <p className="text-zinc-400 mb-1.5 font-mono">{label || payload[0]?.payload?.date}</p>
        {fest && <div className="mb-2"><FestivalPill festival={fest} /></div>}
        {actual    != null && <p className="text-sky-400">Actual: <span className="font-bold font-mono">{actual}</span></p>}
        {predicted != null && <p style={{color}} className="mt-0.5">Predicted: <span className="font-bold font-mono">{Number(predicted).toFixed(1)}</span></p>}
        {diff != null && (
          <p className={`mt-1 text-[10px] font-mono ${parseFloat(diff)>0?'text-amber-400':'text-emerald-400'}`}>
            Diff: {parseFloat(diff)>0?'+':''}{diff}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/60 p-5 shadow-xl shadow-zinc-800/20 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-1.5 h-6 rounded-full" style={{background: color}}/>
          <div>
            <h3 className="text-sm font-bold text-zinc-100">{model.label}</h3>
            <p className="text-[10px] text-zinc-500 mt-0.5">Walk-forward evaluation · Sep–Dec 2025</p>
          </div>
        </div>
        <button
          onClick={() => setShowFormula(v => !v)}
          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border transition-all ${
            showFormula
              ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
              : 'bg-zinc-800/60 border-zinc-700/40 text-zinc-400 hover:border-amber-500/30 hover:text-amber-400'
          }`}
          title="Show formula"
        >ℹ</button>
      </div>

      <FormulaBox text={model.formula_description} visible={showFormula} />

      {/* Chart */}
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={chartData} margin={{top:5,right:15,left:-15,bottom:0}}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false}/>
          <XAxis dataKey="label" tick={{fill:'#71717a',fontSize:9}} axisLine={false} tickLine={false}/>
          <YAxis tick={{fill:'#71717a',fontSize:9}} axisLine={false} tickLine={false}/>
          <Tooltip content={<CustomTip/>}/>
          {visibleFestivals.map(f => {
            const c   = TIER_COLORS[f.tier as 1 | 2 | 3];
            const idx = chartData.findIndex(d => d.date === f.date);
            if (idx < 0) return null;
            return (
              <ReferenceLine
                key={f.date}
                x={chartData[idx]?.label || ''}
                stroke={c.dot}
                strokeDasharray="3 3"
                strokeOpacity={0.5}
                isFront={false}
                label={{ value: f.name.split(' ')[0], fill: c.dot, fontSize: 8, position: 'top' }}
              />
            );
          })}
          {!hideActual && (
            <Line type="monotone" dataKey="actual" name="Actual Sales"
              stroke="#38bdf8" strokeWidth={2} dot={false}
              activeDot={{r:3,fill:'#38bdf8',strokeWidth:0}}/>
          )}
          {!hideModel && (
            <Line type="monotone" dataKey="predicted" name={model.label}
              stroke={color} strokeWidth={1.5} strokeDasharray="5 3" dot={false}
              activeDot={{r:3,strokeWidth:0}} connectNulls/>
          )}
      </ComposedChart>
      </ResponsiveContainer>

      {/* Error badges */}
      <ErrorBadges metrics={model.error_metrics}/>

      {/* Legend (Interactive Toggles) */}
      <div className="flex gap-4">
        <button onClick={()=>setHideActual(!hideActual)} className={`flex items-center gap-1.5 text-[10px] transition-opacity ${hideActual?'opacity-40':'opacity-100'}`}>
          <div className="h-0.5 w-5 bg-sky-400 rounded"/>
          <span className="text-zinc-500">Actual</span>
        </button>
        <button onClick={()=>setHideModel(!hideModel)} className={`flex items-center gap-1.5 text-[10px] transition-opacity ${hideModel?'opacity-40':'opacity-100'}`}>
          <div className="h-0.5 w-5 rounded" style={{background:color,
            backgroundImage:`repeating-linear-gradient(90deg,${color} 0,${color} 4px,transparent 4px,transparent 7px)`}}/>
          <span className="text-zinc-500">Predicted</span>
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Overlay chart — all three models + actual on one canvas
// ─────────────────────────────────────────────────────────────────────────────

function OverlayChart({ data, filters, festivals }: { data: MspAccuracyResponse, filters: Filters, festivals: FestivalEntry[] }) {
  // Build unified date index
  const dateSet = new Set(data.actual_sales.map(d=>d.date));
  data.models.forEach(m => m.per_day.forEach(d => dateSet.add(d.date)));
  const dates = Array.from(dateSet).sort();

  const actualMap: Record<string,number> = {};
  data.actual_sales.forEach(d=>{ actualMap[d.date]=d.qty; });

  const predMaps: Record<string, Record<string,number|null>> = {};
  data.models.forEach(m=>{
    predMaps[m.name]={};
    m.per_day.forEach(d=>{ predMaps[m.name][d.date]=d.predicted_qty; });
  });

  // Filter chart data based on the 'days' slider (show last N days)
  const slicedDates = dates.slice(-filters.days);
  
  const chartData = slicedDates.map((d,i)=>({
    label: i%Math.max(1, Math.floor(filters.days/10))===0 ? new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short'}) : '',
    date: d,
    actual: actualMap[d]??null,
    ...Object.fromEntries(data.models.map(m=>[m.name, predMaps[m.name]?.[d]??null])),
  }));

  const festMap = buildFestivalMap(festivals);
  const visibleFestivals = festivals.filter(f => chartData.some(d => d.date === f.date));

  function CustomTip({ active, payload }: any) {
    if (!active||!payload?.length) return null;
    const dateStr = payload[0]?.payload?.date ? new Date(payload[0].payload.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    const fest = payload[0]?.payload?.date ? festMap[payload[0].payload.date] : null;
    return (
      <div className="px-3 py-2.5 rounded-lg bg-zinc-900/95 border border-zinc-700/60 shadow-xl text-xs">
        <p className="text-zinc-400 mb-2 font-mono border-b border-zinc-800 pb-1">{dateStr}</p>
        {fest && <div className="mb-2"><FestivalPill festival={fest} /></div>}
        {payload.map((p:any)=>(
          <div key={p.dataKey} className="flex justify-between gap-4">
            <span style={{color:p.color}} className="font-medium">{p.name}</span>
            <span style={{color:p.color}} className="font-mono font-bold">{Number(p.value).toFixed(1)}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-3 text-[10px] mb-2">
        {([1, 2, 3] as const).map(t => {
          const c = TIER_COLORS[t];
          return (
            <div key={t} className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${c.bg} ${c.border} ${c.text}`}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} />
              Tier {t} festival
            </div>
          );
        })}
      </div>
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={chartData} margin={{top:10,right:20,left:-10,bottom:0}}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false}/>
        <XAxis dataKey="label" tick={{fill:'#71717a',fontSize:10}} axisLine={false} tickLine={false}/>
        <YAxis tick={{fill:'#71717a',fontSize:10}} axisLine={false} tickLine={false}/>
        <Tooltip content={<CustomTip/>}/>
        <Legend wrapperStyle={{fontSize:'11px',paddingTop:'12px'}}
          formatter={(v)=><span className="text-zinc-300">{v}</span>}/>
        {visibleFestivals.map(f => {
          const c   = TIER_COLORS[f.tier as 1 | 2 | 3];
          const idx = chartData.findIndex(d => d.date === f.date);
          if (idx < 0) return null;
          return (
            <ReferenceLine
              key={f.date}
              x={chartData[idx]?.label || ''}
              stroke={c.dot}
              strokeDasharray="3 3"
              strokeOpacity={0.5}
              isFront={false}
              label={{ value: f.name.split(' ')[0], fill: c.dot, fontSize: 8, position: 'top' }}
            />
          );
        })}
        <Line type="monotone" dataKey="actual" name="Actual Sales"
          stroke="#38bdf8" strokeWidth={2.5} dot={false} connectNulls
          activeDot={{r:4,fill:'#38bdf8',strokeWidth:0}}/>
        {data.models.map(m=>(
          <Line key={m.name} type="monotone" dataKey={m.name} name={m.label}
            stroke={MODEL_COLORS[m.name]??'#94a3b8'} strokeWidth={1.5}
            strokeDasharray="5 3" dot={false} connectNulls
            activeDot={{r:3,strokeWidth:0}}/>
        ))}
      </ComposedChart>
    </ResponsiveContainer>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Accuracy summary table
// ─────────────────────────────────────────────────────────────────────────────

function AccuracyTable({ models }: { models: MspModelResult[] }) {
  const sorted = [...models].sort((a,b)=>a.error_metrics.mape - b.error_metrics.mape);
  const best = sorted[0];

  return (
    <div className="overflow-auto rounded-lg">
      <table className="w-full text-sm border-collapse">
        <thead className="sticky top-0 bg-zinc-900 z-10">
          <tr>
            {['Model','Baseline','MAE','MAPE','RMSE','Days','Accuracy'].map(c=>(
              <th key={c} className="px-4 py-2.5 text-left text-[10px] font-bold tracking-widest uppercase text-zinc-500 border-b border-zinc-800 whitespace-nowrap">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((m)=>{
            const e = m.error_metrics;
            const rating = accuracyRating(e.mape);
            const isBest = m.name === best.name;
            const c = MODEL_COLORS[m.name]??'#94a3b8';
            return (
              <tr key={m.name} className={`border-b border-zinc-800/50 transition-colors hover:bg-zinc-800/30 ${isBest?'bg-emerald-500/5':''}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{background:c}}/>
                    <span className="font-semibold text-zinc-200 text-xs">{m.label}</span>
                    {isBest && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold">⭐ Best</span>}
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-400">{m.baseline.toFixed(2)}</td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-300">{e.mae.toFixed(2)}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full border ${mapeColor(e.mape)}`}>{e.mape.toFixed(1)}%</span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-300">{e.rmse.toFixed(2)}</td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-500">{e.n_days}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-bold ${rating.cls}`}>{rating.label}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Manual Cross-Check Panel
// ─────────────────────────────────────────────────────────────────────────────

function CrossCheckPanel({ models }: { models: MspModelResult[] }) {
  const [entries, setEntries] = useState<CrossCheckEntry[]>([]);
  const [date,    setDate]    = useState('');
  const [qty,     setQty]     = useState('');
  const [error,   setError]   = useState('');

  // Build lookup: modelName → date → predicted_qty
  const lookup: Record<string, Record<string,number>> = {};
  models.forEach(m => {
    lookup[m.name] = {};
    m.per_day.forEach(d => {
      if (d.predicted_qty !== null) lookup[m.name][d.date] = d.predicted_qty;
    });
  });

  function addEntry() {
    if (!date || !qty) { setError('Enter both date and quantity.'); return; }
    const n = parseFloat(qty);
    if (isNaN(n) || n < 0) { setError('Quantity must be a non-negative number.'); return; }
    setError('');

    const preds: Record<string,number> = {};
    models.forEach(m => { preds[m.name] = lookup[m.name]?.[date] ?? 0; });
    setEntries(prev => {
      const filtered = prev.filter(e => e.date !== date);
      return [...filtered, { date, actualQty: n, predictions: preds }].sort((a,b)=>a.date.localeCompare(b.date));
    });
    setQty('');
  }

  function exportCsv() {
    const headers = ['Date','Actual Qty', ...models.map(m=>m.label+' Pred'), ...models.map(m=>m.label+' Err%')];
    const rows = entries.map(e => [
      e.date, e.actualQty,
      ...models.map(m => (e.predictions[m.name]??0).toFixed(2)),
      ...models.map(m => {
        const p = e.predictions[m.name]??0;
        return e.actualQty > 0 ? (Math.abs(p-e.actualQty)/e.actualQty*100).toFixed(1)+'%' : 'N/A';
      }),
    ]);
    const csv = [headers, ...rows].map(r=>r.join(',')).join('\n');
    const blob = new Blob([csv], { type:'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'msp-cross-check.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/60 p-5 shadow-xl shadow-zinc-800/20 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-1.5 h-6 rounded-full bg-sky-400"/>
          <div>
            <h3 className="text-sm font-bold text-zinc-100">Manual Cross-Check</h3>
            <p className="text-[10px] text-zinc-500 mt-0.5">Enter actual Jan 2026+ sales to compare against model predictions</p>
          </div>
        </div>
        {entries.length > 0 && (
          <div className="flex gap-2">
            <button onClick={exportCsv}
              className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 transition-colors font-medium">
              ↓ Export CSV
            </button>
            <button onClick={()=>setEntries([])}
              className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700/50 text-zinc-400 hover:bg-zinc-700 transition-colors">
              Clear All
            </button>
          </div>
        )}
      </div>

      {/* Input row */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold tracking-widest uppercase text-amber-400/70">Date (Jan 2026+)</label>
          <input type="date" value={date} min="2026-01-01"
            onChange={e=>setDate(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm bg-zinc-800/60 border border-zinc-700/50 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-amber-500/40 transition-all font-mono"/>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold tracking-widest uppercase text-amber-400/70">Actual Qty Sold</label>
          <input type="number" value={qty} min="0" step="1" placeholder="e.g. 5"
            onChange={e=>setQty(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&addEntry()}
            className="px-3 py-2 rounded-lg text-sm bg-zinc-800/60 border border-zinc-700/50 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-amber-500/40 transition-all font-mono w-36"/>
        </div>
        <button onClick={addEntry}
          className="px-4 py-2 rounded-lg bg-amber-500 text-zinc-900 font-bold text-sm hover:bg-amber-400 transition-colors shadow-lg shadow-amber-500/20">
          Add Entry
        </button>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      {/* Table */}
      {entries.length > 0 ? (
        <div className="overflow-auto rounded-lg">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 bg-zinc-900 z-10">
              <tr>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold tracking-widest uppercase text-zinc-500 border-b border-zinc-800">Date</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-bold tracking-widest uppercase text-zinc-500 border-b border-zinc-800">Actual</th>
                {models.map(m=>(
                  <th key={m.name+'_p'} className="px-3 py-2.5 text-left text-[10px] font-bold tracking-widest uppercase border-b border-zinc-800"
                    style={{color:(MODEL_COLORS[m.name]??'#94a3b8')+'99'}}>{m.label} Pred</th>
                ))}
                {models.map(m=>(
                  <th key={m.name+'_e'} className="px-3 py-2.5 text-left text-[10px] font-bold tracking-widest uppercase border-b border-zinc-800"
                    style={{color:(MODEL_COLORS[m.name]??'#94a3b8')+'99'}}>{m.label} Err%</th>
                ))}
                <th className="px-3 py-2.5 border-b border-zinc-800"/>
              </tr>
            </thead>
            <tbody>
              {entries.map(e=>(
                <tr key={e.date} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                  <td className="px-3 py-2.5 font-mono text-zinc-300">
                    {new Date(e.date).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}
                  </td>
                  <td className="px-3 py-2.5 font-mono font-bold text-zinc-100">{e.actualQty}</td>
                  {models.map(m=>(
                    <td key={m.name+'_p'} className="px-3 py-2.5 font-mono" style={{color:MODEL_COLORS[m.name]??'#94a3b8'}}>
                      {(e.predictions[m.name]??0).toFixed(1)}
                    </td>
                  ))}
                  {models.map(m=>{
                    const p = e.predictions[m.name]??0;
                    const pct = e.actualQty > 0 ? Math.abs(p-e.actualQty)/e.actualQty*100 : null;
                    return (
                      <td key={m.name+'_e'} className={`px-3 py-2.5 font-mono font-bold ${pct!=null?errColor(pct):'text-zinc-600'}`}>
                        {pct != null ? pct.toFixed(1)+'%' : '—'}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2.5">
                    <button onClick={()=>setEntries(p=>p.filter(x=>x.date!==e.date))}
                      className="text-zinc-600 hover:text-red-400 transition-colors text-xs">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-10 gap-2 border border-dashed border-zinc-800 rounded-xl">
          <span className="text-2xl opacity-30">📋</span>
          <p className="text-xs text-zinc-600">Add entries above to compare actual vs predicted sales</p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Single Day Predictor
// ─────────────────────────────────────────────────────────────────────────────

function SingleDayPrediction({ filters }: { filters: Filters }) {
  const [date, setDate] = useState('');
  const [result, setResult] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function predict() {
    if (!date) return;
    setLoading(true);
    setResult(null);
    setError('');

    try {
      const target = new Date(date);
      const start = new Date('2026-01-01');
      if (target < start) {
        throw new Error("Date must be Jan 1, 2026 or later");
      }
      
      const diffTime = Math.abs(target.getTime() - start.getTime());
      const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      
      console.log('Predicting for date:', date, 'Days from Jan 1:', days);

      // We use the compare endpoint to get all models, then filter for MSP ones
      const r = await api.compare({
        branch: filters.branch || null,
        brand:  filters.brand || null,
        model:  filters.model || null,
        price_range: filters.priceRange || null,
        days:   days,
        festival_multiplier: filters.festivalMultiplier,
      });

      // Extract the prediction for the last day (our target date)
      const lastIndex = r.future_dates.length - 1;
      const targetDateIso = r.future_dates[lastIndex];
      const preds: Record<string, number> = {};
      
      // Filter for our 3 MSP models
      const mspModels = ['median_dow', 'wma', 'sma'];
      r.models.forEach(m => {
        if (mspModels.includes(m.name)) {
          preds[m.label] = m.daily_predictions[lastIndex] ?? 0;
        }
      });

      // Check for actual sales
      const actual = r.actual_future_sales?.find(s => s.date === targetDateIso);
      if (actual) {
        preds['Actual Sales'] = actual.qty;
      }

      setResult(preds);

    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/60 p-5 shadow-xl shadow-zinc-800/20 flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <div className="w-1.5 h-6 rounded-full bg-emerald-400"/>
        <div>
          <h3 className="text-sm font-bold text-zinc-100">Single Day Predictor</h3>
          <p className="text-[10px] text-zinc-500 mt-0.5">Predict sales for a specific future date using MSP models</p>
        </div>
      </div>

      <div className="flex items-end gap-3">
        <div className="flex flex-col gap-1.5 flex-1">
          <label className="text-[10px] font-bold tracking-widest uppercase text-zinc-500">Target Date</label>
          <input type="date" value={date} min="2026-01-01"
            onChange={e=>setDate(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm bg-zinc-800/60 border border-zinc-700/50 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all font-mono"/>
        </div>
        <button onClick={predict} disabled={loading || !date}
          className="px-4 py-2 rounded-lg bg-emerald-500 text-zinc-900 font-bold text-sm hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed">
          {loading ? '...' : 'Predict'}
        </button>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {result && (
        <div className="grid grid-cols-3 gap-3 mt-2">
          {Object.entries(result).map(([label, qty]) => (
            <div key={label} className="bg-zinc-800/40 rounded-lg p-3 border border-zinc-700/30">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">{label}</p>
              <p className="text-xl font-mono font-bold text-zinc-200">{qty.toFixed(1)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ChartCard wrapper
// ─────────────────────────────────────────────────────────────────────────────

function ChartCard({ title, subtitle, children, accent='sky' }: {
  title:string; subtitle?:string; children:React.ReactNode;
  accent?:'sky'|'emerald'|'amber'|'violet'|'indigo';
}) {
  const map={sky:'bg-sky-400',emerald:'bg-emerald-400',amber:'bg-amber-400',violet:'bg-violet-400',indigo:'bg-indigo-400'};
  return (
    <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/60 p-5 shadow-xl shadow-zinc-800/20">
      <div className="flex items-center gap-2.5 mb-4">
        <div className={`w-1.5 h-6 rounded-full ${map[accent]}`}/>
        <div>
          <h3 className="text-sm font-bold text-zinc-200">{title}</h3>
          {subtitle && <p className="text-[10px] text-zinc-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function computeMetrics(perDay: { actual_qty: number; predicted_qty: number | null }[]) {
  const valid = perDay.filter(d => d.predicted_qty != null && d.actual_qty > 0);
  if (!valid.length) return { mae: 0, mape: 0, rmse: 0, n_days: 0 };
  
  let mae = 0, mape = 0, se = 0;
  valid.forEach(d => {
    const err = (d.predicted_qty!) - d.actual_qty;
    mae += Math.abs(err);
    mape += Math.abs(err) / d.actual_qty;
    se += err * err;
  });
  
  return {
    mae: mae / valid.length,
    mape: (mape / valid.length) * 100,
    rmse: Math.sqrt(se / valid.length),
    n_days: valid.length
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main MspAccuracy page
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_FILTERS: Filters = {
  branch:'', brand:'', model:'', priceRange:'', days:41, festivalMultiplier:1.0,
};

export default function MspAccuracy() {
  const [filters,  setFilters]  = useState<Filters>(DEFAULT_FILTERS);
  const [apiData,  setApiData]  = useState<MspAccuracyResponse | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string|null>(null);
  const [festivals, setFestivals] = useState<FestivalEntry[]>([]);
  const debounce = useRef<ReturnType<typeof setTimeout>|null>(null);

  // Recalculate metrics based on the days slider
  const data = useMemo(() => {
    if (!apiData) return null;
    if (!filters.days) return apiData;

    // Slice the per_day array for each model
    const models = apiData.models.map(m => {
      // Find index to slice from (assuming per_day is sorted)
      // Actually per_day might have null predictions at start (warmup).
      // We want the LAST N days of the entire available series.
      const sliced = m.per_day.slice(-filters.days);
      const metrics = computeMetrics(sliced);
      return { ...m, per_day: sliced, error_metrics: metrics };
    });
    
    // Also slice actual_sales? OverlayChart uses data.actual_sales
    // But data.actual_sales is independent.
    // OverlayChart logic: dates = union of actuals and predictions.
    // If we only slice predictions, actuals might still show?
    // Let's also slice actual_sales for consistency in OverlayChart if needed.
    // Actually OverlayChart creates dateSet from actual_sales AND models.
    // So we should slice actual_sales too.
    const actual_sales = apiData.actual_sales.slice(-filters.days);

    return { ...apiData, models, actual_sales };
  }, [apiData, filters.days]);

  const fetch = useCallback(async (f: Filters) => {
    setLoading(true); setError(null);
    try {
      const r = await api.mspAccuracy({
        branch: f.branch||null, brand: f.brand||null,
        model:  f.model||null,  price_range: f.priceRange||null,
        festival_multiplier: f.festivalMultiplier,
      });
      setApiData(r);
    } catch(e:any) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  function handleChange(u: Partial<Filters>) {
    const next = { ...filters, ...u };
    setFilters(next);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => fetch(next), 200);
  }

  useEffect(() => {
    fetch(filters);
    api.getFestivals().then(setFestivals).catch(() => {});
  }, []);

  return (
    <div className="flex gap-0 h-full">
      {/* Sidebar */}
      <aside className="w-72 shrink-0 border-r border-zinc-800/60 overflow-y-auto p-5 flex flex-col gap-6 bg-zinc-950/50">
        <FiltersPanel filters={filters} onChange={handleChange} />

        {/* Single Day Predictor */}
        <div className="border-t border-zinc-800/60 pt-4">
          <SingleDayPrediction filters={filters} />
        </div>

        {/* Festival multiplier mini control */}
        <div className="border-t border-zinc-800/60 pt-4 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 rounded-full bg-emerald-400"/>
            <span className="text-[10px] font-bold tracking-widest uppercase text-zinc-400">Festival Multiplier</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-zinc-400">Boost factor</span>
            <span className="font-mono font-black text-amber-400 text-lg">×{filters.festivalMultiplier.toFixed(1)}</span>
          </div>
          <input type="range" min={1.0} max={2.0} step={0.1} value={filters.festivalMultiplier}
            onChange={e=>handleChange({festivalMultiplier:parseFloat(e.target.value)})}
            className="w-full accent-amber-400 cursor-pointer"/>
          <div className="flex justify-between text-[10px] text-zinc-600"><span>1.0×</span><span>2.0×</span></div>
        </div>

        {festivals.length > 0 && (
          <div className="border-t border-zinc-800/60 pt-4">
            <FestivalCalendarPanel festivals={festivals} />
          </div>
        )}

        {/* Info box */}
        <div className="border-t border-zinc-800/60 pt-4">
          <div className="p-3 rounded-lg bg-zinc-800/40 border border-zinc-700/30 text-[10px] text-zinc-500 leading-relaxed">
            <p className="font-bold text-zinc-400 mb-1.5">About this page</p>
            <p>Walk-forward evaluation trains each model on expanding data and predicts one day ahead — simulating real-world use.</p>
            <p className="mt-1">SMA window: 3 days</p>
            <p className="mt-1">WMA window: 7 days</p>
            <p className="mt-1">Rolling window: 14 days</p>
            <p className="mt-1 text-amber-400/80">Festival calendar auto-applied. Tier 1 = 4×, Tier 2 = 2.75×, Tier 3 = 1.8×</p>
            <p className="mt-1.5 border-t border-zinc-700/30 pt-1.5">Training window: <span className="text-amber-400 font-mono">Sep – Dec 2025</span></p>
            <p className="mt-1">Predictions start: <span className="text-emerald-400 font-mono">Jan 2026+</span></p>
          </div>
        </div>

        {/* Status */}
        {error && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">{error}</div>}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-amber-400">
            <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
            Computing walk-forward evaluation…
          </div>
        )}
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">

        {loading && !data && (
          <div className="grid grid-cols-3 gap-5">
            <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/60 p-5"><Skeleton/></div>
            <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/60 p-5"><Skeleton/></div>
            <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/60 p-5"><Skeleton/></div>
          </div>
        )}

        {data && (
          <>
            {/* KPI row */}
            <div className="grid grid-cols-4 gap-4">
              <div className="rounded-xl bg-zinc-900/50 border border-zinc-800/50 p-4">
                <p className="text-[10px] font-bold tracking-widest uppercase text-zinc-500">Training Days</p>
                <p className="text-2xl font-black font-mono text-zinc-100 mt-1">{data.actual_sales.length}</p>
                <p className="text-[10px] text-zinc-500">Sep–Dec 2025</p>
              </div>
              {data.models.map(m=>(
                <div key={m.name} className="rounded-xl bg-zinc-900/50 border border-zinc-800/50 p-4">
                  <p className="text-[10px] font-bold tracking-widest uppercase text-zinc-500">{m.label}</p>
                  <p className="text-2xl font-black font-mono mt-1" style={{color:MODEL_COLORS[m.name]??'#94a3b8'}}>
                    {(100 - m.error_metrics.mape).toFixed(1)}%
                  </p>
                  <p className="text-[10px] text-zinc-500">Correctness</p>
                </div>
              ))}
            </div>

            {/* Three model cards */}
            <div className="grid grid-cols-3 gap-5">
              {data.models.map(m=><ModelCard key={m.name} model={m} festivals={festivals}/>)}
            </div>

            {/* Overlay chart */}
            <ChartCard
              title="All Models Overlay"
              subtitle={`Actual sales vs all three MSP model predictions · Last ${filters.days} days`}
              accent="indigo"
            >
              <OverlayChart data={data} filters={filters} festivals={festivals}/>
            </ChartCard>

            {/* Accuracy summary table */}
            <ChartCard
              title="Accuracy Summary"
              subtitle="Sorted by MAPE (lowest error = best). ⭐ marks the best-performing model."
              accent="amber"
            >
              <AccuracyTable models={data.models}/>
            </ChartCard>

            {/* Cross-check panel */}
            <CrossCheckPanel models={data.models}/>
          </>
        )}
      </main>
    </div>
  );
}
