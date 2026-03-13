import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  ResponsiveContainer, ComposedChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend
} from 'recharts';
import { api } from '../services/api';
import type { Filters, CuratedMspResponse, CuratedMspDaily } from '../types';
import FiltersPanel from '../components/FiltersPanel';

const DEFAULT_FILTERS: Filters = {
  branch: '', brand: '', model: '', priceRange: '', days: 41, festivalMultiplier: 1.0,
  enableDow: false, enableFestival: false, enablePriceAffinity: false,
  w1: 0.5, w2: 0.3, w3: 0.2,
};

function ChartCard({ title, subtitle, children, accent='sky' }: {
  title: string; subtitle?: string; children: React.ReactNode;
  accent?: 'sky'|'emerald'|'amber'|'violet'|'indigo';
}) {
  const map={sky:'bg-sky-400',emerald:'bg-emerald-400',amber:'bg-amber-400',violet:'bg-violet-400',indigo:'bg-indigo-400'};
  return (
    <div className="relative glass-card p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className={`w-1.5 h-6 rounded-full ${map[accent]}`}/>
        <div>
          <h3 className="text-sm font-bold text-neutral-200">{title}</h3>
          {subtitle && <p className="text-[10px] text-neutral-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function CustomTip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const dateStr = payload[0]?.payload?.label || '';
  return (
    <div className="px-3 py-2.5 rounded-lg bg-black/80 backdrop-blur-xl border border-white/10 shadow-glass text-xs">
      <p className="text-neutral-400 mb-2 font-mono border-b border-white/5 pb-1">{dateStr}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex justify-between gap-4">
          <span style={{color: p.color}} className="font-medium">{p.name}</span>
          <span style={{color: p.color}} className="font-mono font-bold">{Number(p.value).toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
}

export default function CuratedMspAccuracy() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [apiData, setApiData] = useState<CuratedMspResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [aggregationWindow, setAggregationWindow] = useState(10);
  const [tableAggregationIndex, setTableAggregationIndex] = useState(4); // index 4 -> 30 days
  const [tableStartDate, setTableStartDate] = useState<string>('');
  const debounce = useRef<ReturnType<typeof setTimeout>|null>(null);

  const TABLE_WINDOWS = [1, 5, 15, 20, 30, 60];
  const tableAggregationWindow = TABLE_WINDOWS[tableAggregationIndex];

  const fetch = useCallback(async (f: Filters) => {
    setLoading(true); setError(null);
    try {
      const r = await api.curatedMsp({
        branch: f.branch || null, brand: f.brand || null,
        model: f.model || null, price_range: f.priceRange || null,
        festival_multiplier: 1.0,
        enable_dow: f.enableDow,
        enable_festival: f.enableFestival,
        enable_price_affinity: f.enablePriceAffinity,
        enable_brand_affinity: f.enableBrandAffinity,
        w1: f.w1 ?? 0.5,
        w2: f.w2 ?? 0.3,
        w3: f.w3 ?? 0.2,
      });
      setApiData(r);
    } catch(e: any) { setError(e.message); }
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
  }, []);

  const { chartData, rawData, currentEndDate, futureChartData, futureRawData } = useMemo(() => {
    if (!apiData || !apiData.daily_data) return { chartData: [], rawData: [], currentEndDate: '', futureChartData: [], futureRawData: [] };
    
    const slice = apiData.daily_data;
    const aggregatedData = [];
    
    const formatRange = (block: CuratedMspDaily[]) => {
      if (!block.length) return '';
      const start = new Date(block[0].date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      const end = new Date(block[block.length - 1].date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      return `${start} – ${end}`;
    };

    // Group into intervals of `aggregationWindow`
    for (let i = 0; i < slice.length; i += aggregationWindow) {
      const block = slice.slice(i, i + aggregationWindow);
      aggregatedData.push({
        label: formatRange(block),
        actual: block.reduce((sum, d) => sum + d.actual, 0),
        predicted: block.reduce((sum, d) => sum + d.predicted, 0),
      });
    }

    const futureAggregatedData = [];
    const futureSlice = apiData.future_daily_data || [];
    for (let i = 0; i < futureSlice.length; i += aggregationWindow) {
      const block = futureSlice.slice(i, i + aggregationWindow);
      futureAggregatedData.push({
        label: formatRange(block),
        actual: block.reduce((sum, d) => sum + d.actual, 0),
        predicted: block.reduce((sum, d) => sum + d.predicted, 0),
      });
    }
    
    const endDt = slice.length > 0 ? slice[slice.length - 1].date : '';
    const formattedEnd = endDt ? new Date(endDt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    
    return { chartData: aggregatedData, rawData: slice, currentEndDate: formattedEnd, futureChartData: futureAggregatedData, futureRawData: futureSlice };
  }, [apiData, aggregationWindow]);

  const startDateStr = rawData.length > 0 ? new Date(rawData[0].date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const futureStartDateStr = futureRawData.length > 0 ? new Date(futureRawData[0].date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const futureEndDateStr = futureRawData.length > 0 ? new Date(futureRawData[futureRawData.length - 1].date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

  return (
    <div className="flex gap-0 h-full">
      {/* Sidebar */}
      <aside className="w-72 shrink-0 border-r border-white/10 overflow-y-auto p-5 flex flex-col gap-6 bg-transparent">
        <FiltersPanel filters={filters} onChange={handleChange} hideDays={true} />

        {/* Algorithm Weights */}
        <div className="border-t border-white/10 pt-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-neutral-400 tracking-widest uppercase">Algorithm Weights</h3>
            {((filters.w1 ?? 0.5) !== 0.5 || (filters.w2 ?? 0.3) !== 0.3 || (filters.w3 ?? 0.2) !== 0.2) && (
              <button
                onClick={() => handleChange({ w1: 0.5, w2: 0.3, w3: 0.2 })}
                className="text-[10px] text-amber-400 hover:text-amber-300 transition-colors uppercase tracking-wider font-bold"
              >
                Reset
              </button>
            )}
          </div>
          
          <div className="flex flex-col gap-2">
            <label className="text-xs text-neutral-400 flex justify-between">
              <span>W1 (Avg 7 Days)</span>
              <span className="font-mono text-amber-400">{filters.w1?.toFixed(2)}</span>
            </label>
            <input type="range" min="0" max="1" step="0.05" value={filters.w1 ?? 0.5}
              onChange={e => handleChange({ w1: parseFloat(e.target.value) })}
              className="w-full accent-amber-400 h-1 bg-white/5 rounded-lg appearance-none cursor-pointer" />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs text-neutral-400 flex justify-between">
              <span>W2 (Avg 7-28 Days)</span>
              <span className="font-mono text-amber-400">{filters.w2?.toFixed(2)}</span>
            </label>
            <input type="range" min="0" max="1" step="0.05" value={filters.w2 ?? 0.3}
              onChange={e => handleChange({ w2: parseFloat(e.target.value) })}
              className="w-full accent-amber-400 h-1 bg-white/5 rounded-lg appearance-none cursor-pointer" />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs text-neutral-400 flex justify-between">
              <span>W3 (Avg 30-60 Days)</span>
              <span className="font-mono text-amber-400">{filters.w3?.toFixed(2)}</span>
            </label>
            <input type="range" min="0" max="1" step="0.05" value={filters.w3 ?? 0.2}
              onChange={e => handleChange({ w3: parseFloat(e.target.value) })}
              className="w-full accent-amber-400 h-1 bg-white/5 rounded-lg appearance-none cursor-pointer" />
          </div>
          
          {Math.abs((filters.w1 ?? 0.5) + (filters.w2 ?? 0.3) + (filters.w3 ?? 0.2) - 1.0) > 0.01 && (
            <p className="text-[10px] text-red-400 mt-1">Warning: Weights do not sum up to 1.0</p>
          )}
        </div>

        {/* Info box */}
        <div className="border-t border-white/10 pt-4">
          <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-[10px] text-neutral-400 leading-relaxed">
            <p className="font-bold text-neutral-400 mb-1.5">Curated MSP Algorithm</p>
            <p className="mt-1 font-mono text-[9px] text-neutral-300">1. Base = (W1×Avg7) + (W2×Avg7_28) + (W3×Avg30_60)</p>
            <p className="mt-1.5 font-mono text-[9px] text-amber-400">2. Final = Base × Brand_Affinity</p>
            <p className="font-mono text-[9px] text-amber-400 pl-10">× Price_Affinity</p>
            <p className="font-mono text-[9px] text-amber-400 pl-10">× DOW_Multiplier</p>
            <p className="font-mono text-[9px] text-amber-400 pl-10">× Festival_Multiplier</p>
            <p className="mt-2 text-neutral-400 italic">Adjustments only apply if enabled via controls.</p>
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
            Computing curated predictions…
          </div>
        )}
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">

        {loading && !apiData && (
          <div className="animate-pulse flex flex-col gap-3">
            <div className="h-4 bg-white/5 rounded w-1/3"/>
            <div className="h-48 bg-white/5 rounded-xl"/>
            <div className="h-4 bg-white/5 rounded w-1/2"/>
          </div>
        )}

        {apiData && chartData.length > 0 && (
          <>
            <div className="rounded-2xl bg-[#0A0A0A]/60 border border-white/10 p-5 shadow-xl flex flex-col gap-4 mb-2">
              <h3 className="text-sm font-bold text-neutral-200">Demand Adjustment Controls</h3>
              <div className="flex flex-col gap-3 sm:flex-row sm:gap-6 mt-1 flex-wrap">
                <label className="flex items-center gap-2.5 cursor-pointer group">
                  <div className="relative flex items-center justify-center">
                    <input 
                      type="checkbox" 
                      className="peer sr-only"
                      checked={filters.enableDow || false}
                      onChange={e => handleChange({ enableDow: e.target.checked })}
                    />
                    <div className="w-5 h-5 rounded border border-white/30 bg-white/5 peer-checked:bg-amber-500 peer-checked:border-amber-500 transition-all group-hover:border-amber-500/50"></div>
                    <svg className="absolute w-3 h-3 text-zinc-950 pointer-events-none opacity-0 peer-checked:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-sm text-neutral-300 group-hover:text-white transition-colors">Enable Day-of-Week Adjustment</span>
                </label>
                
                <label className="flex items-center gap-2.5 cursor-pointer group">
                  <div className="relative flex items-center justify-center">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={filters.enableFestival || false}
                      onChange={e => handleChange({ enableFestival: e.target.checked })}
                    />
                    <div className="w-5 h-5 rounded border border-white/30 bg-white/5 peer-checked:bg-amber-500 peer-checked:border-amber-500 transition-all group-hover:border-amber-500/50"></div>
                    <svg className="absolute w-3 h-3 text-zinc-950 pointer-events-none opacity-0 peer-checked:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-sm text-neutral-300 group-hover:text-white transition-colors">Enable Festival Demand Adjustment</span>
                </label>

                <label className={`flex items-center gap-2.5 ${(!filters.branch || !filters.priceRange) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer group'}`} title={(!filters.branch || !filters.priceRange) ? 'Please select a Branch and a Price Range from the filters to use this multiplier' : ''}>
                  <div className="relative flex items-center justify-center">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={filters.enablePriceAffinity || false}
                      disabled={!filters.branch || !filters.priceRange}
                      onChange={e => handleChange({ enablePriceAffinity: e.target.checked })}
                    />
                    <div className="w-5 h-5 rounded border border-white/30 bg-white/5 peer-checked:bg-amber-500 peer-checked:border-amber-500 transition-all group-hover:border-amber-500/50"></div>
                    <svg className="absolute w-3 h-3 text-zinc-950 pointer-events-none opacity-0 peer-checked:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm text-neutral-300 group-hover:text-white transition-colors">Enable Price Affinity</span>
                    {(!filters.branch || !filters.priceRange) && (
                      <span className="text-[9px] text-amber-500/80 uppercase tracking-widest font-bold mt-0.5">Requires Branch & Price Range</span>
                    )}
                  </div>
                </label>

                <label className={`flex items-center gap-2.5 ${(!filters.branch || !filters.brand) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer group'}`} title={(!filters.branch || !filters.brand) ? 'Please select a Branch and a Brand from the filters to use this multiplier' : ''}>
                  <div className="relative flex items-center justify-center">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={filters.enableBrandAffinity || false}
                      disabled={!filters.branch || !filters.brand}
                      onChange={e => handleChange({ enableBrandAffinity: e.target.checked })}
                    />
                    <div className="w-5 h-5 rounded border border-white/30 bg-white/5 peer-checked:bg-amber-500 peer-checked:border-amber-500 transition-all group-hover:border-amber-500/50"></div>
                    <svg className="absolute w-3 h-3 text-zinc-950 pointer-events-none opacity-0 peer-checked:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm text-neutral-300 group-hover:text-white transition-colors">Enable Brand Affinity</span>
                    {(!filters.branch || !filters.brand) && (
                      <span className="text-[9px] text-amber-500/80 uppercase tracking-widest font-bold mt-0.5">Requires Branch & Brand</span>
                    )}
                  </div>
                </label>
              </div>
            </div>

            <div className="rounded-2xl bg-[#0A0A0A]/60 border border-white/10 p-5 shadow-xl flex flex-col gap-4 mb-2">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-neutral-200">Aggregation Window</h3>
                <span className="font-mono text-amber-400 font-bold">{aggregationWindow} Days</span>
              </div>
              <input type="range" min="1" max="30" step="1" value={aggregationWindow}
                onChange={e => setAggregationWindow(parseInt(e.target.value))}
                className="w-full accent-amber-400 h-1 bg-white/5 rounded-lg appearance-none cursor-pointer" />
              <div className="flex justify-between text-[10px] text-neutral-400">
                <span>1 Day (Daily)</span>
                <span>30 Days (Monthly)</span>
              </div>
            </div>

            <ChartCard
              title="Prediction vs Actual Sales"
              subtitle={`Showing full horizon data starting from ${startDateStr} to ${currentEndDate}`}
              accent="amber"
            >
              <div className="absolute top-4 right-4">
                <button
                  onClick={() => setShowInfo(!showInfo)}
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border transition-all ${
                    showInfo
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                      : 'bg-white/5 border-white/20 text-neutral-400 hover:border-amber-500/30 hover:text-amber-400'
                  }`}
                  title="How is this calculated?"
                >i</button>
              </div>

              {showInfo && (
                <div className="p-5 border-l-2 border-amber-400 bg-white/5 rounded-r-lg text-xs text-neutral-300 leading-relaxed shadow-lg mb-4 space-y-4">
                  <div>
                    <p className="font-bold text-amber-400 mb-1 uppercase tracking-widest text-[10px]">Brand Affinity Calculation</p>
                    <div className="p-2 bg-[#0A0A0A]/60 rounded font-mono text-neutral-200 text-[11px] mb-2 border border-white/20">
                      Brand Affinity (BA) = Brand Sales / Category Average Sales
                    </div>
                    <p className="text-neutral-400 mb-1">Where:</p>
                    <ul className="list-disc pl-4 space-y-1 text-neutral-400">
                      <li><strong className="text-neutral-300">Brand Sales</strong> = Total sales of the selected brand for the product within the selected time window</li>
                      <li><strong className="text-neutral-300">Category Average Sales</strong> = Average sales of all brands within the same product category during the same time window</li>
                    </ul>
                  </div>

                  <div>
                    <p className="font-bold text-amber-400/80 mb-1 text-[10px] uppercase tracking-wider">Expanded Form</p>
                    <div className="p-2 bg-[#0A0A0A]/60 rounded font-mono text-neutral-200 text-[11px] border border-white/20">
                      BA = ( Σ Brand Daily Sales ) / ( Σ Category Daily Sales / Number of Brands )
                    </div>
                  </div>

                  <div>
                    <p className="font-bold text-amber-400/80 mb-1 text-[10px] uppercase tracking-wider">Interpretation</p>
                    <ul className="space-y-1 text-neutral-400">
                      <li><span className="text-emerald-400 font-mono">BA {'>'} 1</span> → Brand performs better than the category average</li>
                      <li><span className="text-neutral-300 font-mono">BA = 1</span> → Brand performance equals category average</li>
                      <li><span className="text-red-400 font-mono">BA {'<'} 1</span> → Brand performs below category average</li>
                    </ul>
                  </div>

                  <div className="pt-2 border-t border-white/20">
                    <p className="font-bold text-amber-400/80 mb-1 text-[10px] uppercase tracking-wider">Role in MSP Model</p>
                    <p className="text-neutral-400 mb-2">Brand & Price Affinity act as a demand adjustment multipliers in the MSP calculation:</p>
                    <div className="p-2 bg-[#0A0A0A]/60 rounded font-mono text-emerald-300 text-[11px] border border-emerald-900/50">
                      Demand = Baseline × Brand Affinity × Price Affinity
                    </div>
                  </div>
                </div>
              )}
              <div className="flex gap-4 mb-4">
                <div className="px-4 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30">
                  <p className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold mb-1">Total Predicted</p>
                  <p className="text-xl font-mono font-black text-emerald-400">
                    {rawData.reduce((sum, d) => sum + (d.predicted || 0), 0).toFixed(0)}
                  </p>
                </div>
                <div className="px-4 py-2 rounded-lg bg-sky-500/15 border border-sky-500/30">
                  <p className="text-[10px] uppercase tracking-widest text-sky-400 font-bold mb-1">Total Actual</p>
                  <p className="text-xl font-mono font-black text-sky-400">
                    {rawData.reduce((sum, d) => sum + (d.actual || 0), 0).toFixed(0)}
                  </p>
                </div>
                {(() => {
                  const totPred = rawData.reduce((sum, d) => sum + (d.predicted || 0), 0);
                  const totAct = rawData.reduce((sum, d) => sum + (d.actual || 0), 0);
                  const diff = totPred - totAct;

                  // Total Accuracy (1 - |Total Predicted - Total Actual| / Total Actual)
                  const absDiff = Math.abs(diff);
                  const acc = totAct > 0 ? Math.max(0, 100 - (absDiff / totAct) * 100) : 0;

                  const isOff = acc === 0 && totAct > 0;
                  return (
                    <>
                      <div className={`px-4 py-2 rounded-lg border ${isOff ? 'bg-red-500/15 border-red-500/30' : 'bg-violet-500/15 border-violet-500/30'}`} title="Calculated using Total Absolute Percentage Error">
                        <p className={`text-[10px] uppercase tracking-widest font-bold mb-1 ${isOff ? 'text-red-400' : 'text-violet-400'}`}>Total Accuracy</p>
                        <p className={`text-xl font-mono font-black ${isOff ? 'text-red-400' : 'text-violet-400'}`}>
                          {totAct > 0 ? acc.toFixed(1) + '%' : 'N/A'}
                        </p>
                      </div>
                      <div className="px-4 py-2 rounded-lg bg-amber-500/15 border border-amber-500/30" title="Overall volume difference over the entire period">
                        <p className="text-[10px] uppercase tracking-widest text-amber-400 font-bold mb-1">Volume Offset</p>
                        <p className="text-xl font-mono font-black text-amber-400">
                          {diff > 0 ? '+' : ''}{diff.toFixed(0)}
                        </p>
                      </div>
                    </>
                  );
                })()}
              </div>

              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={chartData} margin={{top:10, right:20, left:-10, bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false}/>
                  <XAxis dataKey="label" tick={{fill:'#71717a', fontSize:10}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fill:'#71717a', fontSize:10}} axisLine={false} tickLine={false}/>
                  <Tooltip content={<CustomTip/>}/>
                  <Legend wrapperStyle={{fontSize:'11px', paddingTop:'12px'}} formatter={(v) => <span className="text-neutral-300">{v}</span>}/>
                  
                  <Line
                    type="monotone"
                    dataKey="actual"
                    name="Actual Sales"
                    stroke="#38bdf8"
                    strokeWidth={2.5}
                    dot={{r:4, fill:'#38bdf8', strokeWidth:0}}
                    activeDot={{r:6, fill:'#38bdf8', strokeWidth:0}}
                  />
                  
                  <Line
                    type="monotone"
                    dataKey="predicted"
                    name="Curated MSP Prediction"
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    strokeDasharray="5 5"
                    dot={{r:4, fill:'#f59e0b', strokeWidth:0}}
                    activeDot={{r:6, fill:'#f59e0b', strokeWidth:0}}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Next Aggregation Window Orders Table */}
            {(rawData.length > 0 || futureRawData.length > 0) && (() => {
              const allData = [...rawData, ...futureRawData];
              const minDate = allData.length > 0 ? allData[0].date : '';
              const maxDate = allData.length > 0 ? allData[allData.length - 1].date : '';
              // Default to the start of future data, or start of all data if no future data
              const defaultStartDate = futureRawData.length > 0 ? futureRawData[0].date : minDate;
              const effectiveStartDate = tableStartDate || defaultStartDate;

              return (
                <ChartCard
                  title={`Suggested Orders for Next ${tableAggregationWindow} Days`}
                  subtitle={`Based on selected branch (${filters.branch || 'All'}) and projected demand for the period.`}
                  accent="indigo"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 bg-[#0A0A0A]/60 p-3 rounded-lg border border-white/10">
                    <div className="flex flex-col w-full sm:w-1/2">
                      <div className="flex justify-between items-center text-xs text-neutral-400 mb-2">
                        <span>Aggregation Window</span>
                        <span className="font-mono text-indigo-400 font-bold">{tableAggregationWindow} Days</span>
                      </div>
                      <input type="range" min="0" max={TABLE_WINDOWS.length - 1} step="1" value={tableAggregationIndex}
                        onChange={e => setTableAggregationIndex(parseInt(e.target.value))}
                        className="w-full accent-indigo-400 h-1.5 bg-white/5 rounded-lg appearance-none cursor-pointer" />
                      <div className="flex justify-between text-[10px] text-neutral-500 px-0.5 mt-1 font-mono">
                        {TABLE_WINDOWS.map(w => (
                          <span key={w}>{w}</span>
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex justify-end">
                      <label className="text-xs text-neutral-400 flex items-center gap-2">
                        Start Date:
                        <input
                          type="date"
                          className="bg-transparent border border-white/20 text-neutral-200 rounded px-2 py-1 outline-none focus:border-indigo-500 font-mono"
                          min={minDate}
                          max={maxDate}
                          value={effectiveStartDate}
                          onChange={e => setTableStartDate(e.target.value)}
                        />
                      </label>
                    </div>
                  </div>
                  <div className="overflow-x-auto border border-white/10 rounded-xl">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-[#0A0A0A]/60 border-b border-white/5/60 text-neutral-400">
                        <tr>
                          <th className="px-4 py-3 font-medium">Brand</th>
                          <th className="px-4 py-3 font-medium">Model Family (Clubbed)</th>
                          <th className="px-4 py-3 font-medium text-right">Projected MSP ({tableAggregationWindow}d)</th>
                          <th className="px-4 py-3 font-medium text-right">% of Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/40">
                        {(() => {
                          const startIndex = allData.findIndex(d => d.date >= effectiveStartDate);
                          const actualStartIndex = startIndex !== -1 ? startIndex : 0;
                          const nextWindowData = allData.slice(actualStartIndex, actualStartIndex + tableAggregationWindow);
                          const totalProjected = nextWindowData.reduce((sum, d) => sum + (d.predicted || 0), 0);
                        
                        // Dummy models logic, but scaled to the totalProjected
                        const ALL_DUMMY_MODELS = [
                          { brand: 'Apple', model: 'iPhone 15', share: 0.35 },
                          { brand: 'Apple', model: 'iPhone 16', share: 0.25 },
                          { brand: 'Apple', model: 'iPhone 14', share: 0.20 },
                          { brand: 'Apple', model: 'iPhone 13', share: 0.20 },
                          
                          { brand: 'Samsung', model: 'Galaxy A15', share: 0.35 },
                          { brand: 'Samsung', model: 'Galaxy M35', share: 0.25 },
                          { brand: 'Samsung', model: 'Galaxy S24', share: 0.25 },
                          { brand: 'Samsung', model: 'Galaxy A55', share: 0.15 },
                          
                          { brand: 'Vivo', model: 'Vivo Y28', share: 0.40 },
                          { brand: 'Vivo', model: 'Vivo T3x', share: 0.35 },
                          { brand: 'Vivo', model: 'Vivo V30', share: 0.25 },
                          
                          { brand: 'Oppo', model: 'Oppo A3', share: 0.45 },
                          { brand: 'Oppo', model: 'Oppo Reno 12', share: 0.35 },
                          { brand: 'Oppo', model: 'Oppo F25', share: 0.20 },
                          
                          { brand: 'Xiaomi', model: 'Redmi Note 13', share: 0.50 },
                          { brand: 'Xiaomi', model: 'Redmi 13C', share: 0.50 },
                          
                          { brand: 'Realme', model: 'Realme 12', share: 0.60 },
                          { brand: 'Realme', model: 'Realme C65', share: 0.40 },
                        ];

                        let displayModels = ALL_DUMMY_MODELS;
                        
                        // Default to top models across brands if no brand selected
                        if (!filters.brand) {
                          displayModels = [
                            { brand: 'Apple', model: 'iPhone 15', share: 0.25 },
                            { brand: 'Samsung', model: 'Galaxy A15', share: 0.20 },
                            { brand: 'Vivo', model: 'Vivo Y28', share: 0.15 },
                            { brand: 'Oppo', model: 'Oppo A3', share: 0.10 },
                            { brand: 'Xiaomi', model: 'Redmi Note 13', share: 0.10 },
                            { brand: 'Samsung', model: 'Galaxy M35', share: 0.08 },
                            { brand: 'Apple', model: 'iPhone 16', share: 0.07 },
                            { brand: 'Realme', model: 'Realme 12', share: 0.05 },
                          ];
                        } else {
                          displayModels = displayModels.filter(m => m.brand === filters.brand);
                        }

                        if (filters.model) {
                          displayModels = displayModels.filter(m => m.model === filters.model);
                        }

                        if (displayModels.length === 0) {
                          displayModels = [{ brand: filters.brand || 'Other', model: filters.model || 'Other Models', share: 1 }];
                        }

                        const totalShare = displayModels.reduce((sum, m) => sum + m.share, 0);
                        displayModels = displayModels.map(m => ({ ...m, normalizedShare: m.share / totalShare }));

                        return (
                          <>
                            {displayModels.map((m, idx) => {
                              const projectedMsp = Math.round(totalProjected * m.normalizedShare);
                              return (
                                <tr key={idx} className="hover:bg-white/5 transition-colors">
                                  <td className="px-4 py-3 text-neutral-300">{m.brand}</td>
                                  <td className="px-4 py-3 font-medium text-white">{m.model}</td>
                                  <td className="px-4 py-3 text-right text-indigo-400 font-bold">{projectedMsp}</td>
                                  <td className="px-4 py-3 text-right text-neutral-400">{(m.normalizedShare * 100).toFixed(0)}%</td>
                                </tr>
                              );
                            })}
                            <tr className="bg-[#0A0A0A]/60 font-bold border-t-2 border-white/10">
                              <td className="px-4 py-3 text-neutral-300" colSpan={2}>Total ({tableAggregationWindow} Days)</td>
                              <td className="px-4 py-3 text-right text-emerald-400">{Math.round(totalProjected)}</td>
                              <td className="px-4 py-3 text-right text-neutral-400">100%</td>
                            </tr>
                          </>
                        );
                        })()}
                      </tbody>
                    </table>
                  </div>
                </ChartCard>
              );
            })()}

            {futureChartData.length > 0 && (
              <ChartCard
                title="Future Prediction (3 Months)"
                subtitle={`Showing 3 months of projected demand from ${futureStartDateStr} to ${futureEndDateStr}`}
                accent="emerald"
              >
                <div className="flex gap-4 mb-4">
                  <div className="px-4 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30">
                    <p className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold mb-1">Total Projected Volume</p>
                    <p className="text-xl font-mono font-black text-emerald-400">
                      {futureRawData.reduce((sum, d) => sum + (d.predicted || 0), 0).toFixed(0)}
                    </p>
                  </div>
                </div>

                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={futureChartData} margin={{top:10, right:20, left:-10, bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false}/>
                    <XAxis dataKey="label" tick={{fill:'#71717a', fontSize:10}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fill:'#71717a', fontSize:10}} axisLine={false} tickLine={false}/>
                    <Tooltip content={<CustomTip/>}/>
                    <Legend wrapperStyle={{fontSize:'11px', paddingTop:'12px'}} formatter={(v) => <span className="text-neutral-300">{v}</span>}/>

                    <Line
                      type="monotone"
                      dataKey="predicted"
                      name="Future Projected Demand"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      strokeDasharray="5 5"
                      dot={{r:4, fill:'#10b981', strokeWidth:0}}
                      activeDot={{r:6, fill:'#10b981', strokeWidth:0}}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
          </>
        )}
      </main>
    </div>
  );
}
