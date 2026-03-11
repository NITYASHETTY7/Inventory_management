// pages/Dashboard.tsx
// Three-tab dashboard: Prediction | Model Comparison | MSP Accuracy

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import type { Filters, PredictionResponse, CompareResponse, FestivalEntry } from '../types';

import FiltersPanel         from '../components/FiltersPanel';
import { FestivalCalendarPanel } from '../components/FestivalBadge';
import PredictionControls   from '../components/PredictionControls';
import SalesChart           from '../components/SalesChart';
import PredictionChart      from '../components/PredictionChart';
import DailyBarChart        from '../components/DailyBarChart';
import PredictionTable      from '../components/PredictionTable';
import ModelComparisonChart from '../components/ModelComparisonChart';
import ModelSummaryTable    from '../components/ModelSummaryTable';
import ModelSpreadChart     from '../components/ModelSpreadChart';
import MspAccuracy          from './MspAccuracy';
import CuratedMspAccuracy   from './CuratedMspAccuracy';
import BrandAffinity        from './BrandAffinity';
import PriceAffinity        from './PriceAffinity';

// ── Shared UI pieces ──────────────────────────────────────────────────────────

function ChartCard({ title, subtitle, children, accent='sky' }: {
  title:string; subtitle?:string; children:React.ReactNode;
  accent?:'sky'|'emerald'|'amber'|'indigo'|'violet';
}) {
  const map={sky:'bg-sky-400',emerald:'bg-emerald-400',amber:'bg-amber-400',indigo:'bg-indigo-400',violet:'bg-violet-400'};
  return (
    <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/60 p-5 backdrop-blur-sm shadow-xl shadow-zinc-800/30">
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

function KpiCard({ label, value, sub, color }: { label:string; value:string; sub?:string; color?:string }) {
  return (
    <div className="rounded-xl bg-zinc-900/50 border border-zinc-800/50 p-4 flex flex-col gap-1">
      <span className="text-[10px] font-bold tracking-widest uppercase text-zinc-500">{label}</span>
      <span className="text-2xl font-black font-mono" style={{color:color??'#f1f5f9'}}>{value}</span>
      {sub && <span className="text-[10px] text-zinc-500">{sub}</span>}
    </div>
  );
}

function LoadingOverlay() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/60 backdrop-blur-[2px] rounded-2xl z-20">
      <div className="flex items-center gap-2 text-zinc-400 text-sm">
        <svg className="animate-spin h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
        </svg>
        Computing…
      </div>
    </div>
  );
}

function Tab({ label, active, onClick, badge }: {label:string;active:boolean;onClick:()=>void;badge?:string}) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-150 ${
        active ? 'bg-zinc-800 text-zinc-100 shadow-inner' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40'
      }`}>
      {label}
      {badge && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold">{badge}</span>}
    </button>
  );
}

// ── Model label map ───────────────────────────────────────────────────────────

const MODEL_LABELS: Record<string,string> = {
  msp_curated:'🌟 Curated MSP', median_dow:'MSP Baseline', wma:'WMA-14', sma:'SMA-7',
  ets:'ETS', holts:"Holt's", holt_winters:'Holt-Winters',
  trimmed_mean:'Trimmed', iqr:'IQR', same_weekday:'Same-WD',
  seasonal_naive:'Seasonal', stl:'STL', ensemble:'Ensemble',
};

// ── Dashboard ─────────────────────────────────────────────────────────────────

type TabId = 'prediction' | 'comparison' | 'accuracy' | 'curated_accuracy' | 'brand_affinity' | 'price_affinity';
const DEFAULT: Filters = { branch:'', brand:'', model:'', priceRange:'', days:41, festivalMultiplier:1.0 };

export default function Dashboard() {
  const [filters,       setFilters]       = useState<Filters>(DEFAULT);
  const [activeTab,     setActiveTab]     = useState<TabId>('prediction');
  const [activeModel,   setActiveModel]   = useState('msp_curated');
  const [predResult,    setPredResult]    = useState<PredictionResponse|null>(null);
  const [compareResult, setCompareResult] = useState<CompareResponse|null>(null);
  const [loadingPred,   setLoadingPred]   = useState(false);
  const [loadingCmp,    setLoadingCmp]    = useState(false);
  const [error,         setError]         = useState<string|null>(null);
  const [festivals,     setFestivals]     = useState<FestivalEntry[]>([]);
  const db = useRef<ReturnType<typeof setTimeout>|null>(null);

  const fetchPred = useCallback(async (f:Filters, mn:string) => {
    setLoadingPred(true); setError(null);
    try {
      setPredResult(await api.predict({
        branch:f.branch||null, brand:f.brand||null, model:f.model||null,
        price_range:f.priceRange||null,
        days:f.days, festival_multiplier:f.festivalMultiplier, model_name:mn,
      }));
    } catch(e:any) { setError(e.message); }
    finally { setLoadingPred(false); }
  }, []);

  const fetchCmp = useCallback(async (f:Filters) => {
    setLoadingCmp(true); setError(null);
    try {
      setCompareResult(await api.compare({
        branch:f.branch||null, brand:f.brand||null, model:f.model||null,
        price_range:f.priceRange||null,
        days:f.days, festival_multiplier:f.festivalMultiplier,
      }));
    } catch(e:any) { setError(e.message); }
    finally { setLoadingCmp(false); }
  }, []);

  function handleChange(u:Partial<Filters>) {
    const next = { ...filters, ...u };
    setFilters(next);
    if (db.current) clearTimeout(db.current);
    const delay = ('days' in u || 'festivalMultiplier' in u) ? 150 : 0;
    db.current = setTimeout(() => {
      if (activeTab==='prediction'||activeTab==='comparison') fetchPred(next, activeModel);
      if (activeTab==='comparison') fetchCmp(next);
    }, delay);
  }

  function handleTabChange(tab:TabId) {
    setActiveTab(tab);
    if (tab==='comparison' && !compareResult) fetchCmp(filters);
  }

  function handleSelectModel(name:string) {
    setActiveModel(name);
    setActiveTab('prediction');
    fetchPred(filters, name);
  }

  useEffect(() => {
    fetchPred(filters, activeModel);
    api.getFestivals().then(setFestivals).catch(() => {});
  }, []);

  // KPIs
  const totalPred   = predResult?.prediction_table.reduce((s,r)=>s+r.predicted_qty,0) ?? 0;
  const avgHist     = predResult?.historical_sales.length
    ? predResult.historical_sales.reduce((s,d)=>s+d.qty,0)/predResult.historical_sales.length : 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100" style={{fontFamily:"'DM Mono','Courier New',monospace"}}>

      {/* Topbar */}
      <header className="border-b border-zinc-800/80 px-6 py-4 flex items-center justify-between sticky top-0 bg-zinc-950/90 backdrop-blur-md z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
            <span className="text-zinc-900 font-black text-xs"></span>
          </div>
          <div>
            <h1 className="text-sm font-bold text-zinc-100 tracking-tight">MSP Analytics</h1>
            <p className="text-[10px] text-zinc-500">Dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {error && <span className="text-xs text-red-400 bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20 max-w-xs truncate">{error}</span>}
          {activeTab==='prediction' && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300">
              {MODEL_LABELS[activeModel]??activeModel}
            </div>
          )}
          <div className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border ${
            (loadingPred||loadingCmp)
              ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
              : 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${(loadingPred||loadingCmp)?'bg-amber-400 animate-pulse':'bg-emerald-400'}`}/>
            {(loadingPred||loadingCmp)?'Computing':'Live'}
          </div>
        </div>
      </header>

      {/* Tab bar */}
      <div className="border-b border-zinc-800/60 px-6 py-2 flex items-center gap-1 bg-zinc-950/80">
        <Tab label="📈 Prediction"       active={activeTab==='prediction'}  onClick={()=>handleTabChange('prediction')}  />
        <Tab label=" Model Comparison"  active={activeTab==='comparison'}  onClick={()=>handleTabChange('comparison')}  badge="12"/>
        <Tab label=" MSP Accuracy"      active={activeTab==='accuracy'}    onClick={()=>handleTabChange('accuracy')}    />
        <Tab label=" Curated Accuracy"  active={activeTab==='curated_accuracy'} onClick={()=>handleTabChange('curated_accuracy')} />
        <Tab label=" Brand Affinity"    active={activeTab==='brand_affinity'} onClick={()=>handleTabChange('brand_affinity')} />
        <Tab label=" Price Affinity"    active={activeTab==='price_affinity'} onClick={()=>handleTabChange('price_affinity')} />
      </div>

      {/* ── ACCURACY TAB — full bleed, has its own sidebar ── */}
      {activeTab==='accuracy' && (
        <div className="h-[calc(100vh-105px)]">
          <MspAccuracy />
        </div>
      )}

      {activeTab==='curated_accuracy' && (
        <div className="h-[calc(100vh-105px)]">
          <CuratedMspAccuracy />
        </div>
      )}

      {/* ── PREDICTION + COMPARISON + BRAND AFFINITY + PRICE AFFINITY — share sidebar ── */}
      {activeTab!=='accuracy' && activeTab!=='curated_accuracy' && (
        <div className="flex h-[calc(100vh-105px)]">

          {/* Sidebar */}
          <aside className="w-72 shrink-0 border-r border-zinc-800/60 overflow-y-auto p-5 flex flex-col gap-6 bg-zinc-950/50">
            <FiltersPanel filters={filters} onChange={handleChange} />
            <div className="border-t border-zinc-800/60 pt-5">
              <PredictionControls filters={filters} onChange={handleChange}
                modelStats={predResult?.model_stats??null} />
            </div>
            {festivals.length > 0 && (
              <div className="border-t border-zinc-800/60 pt-5">
                <FestivalCalendarPanel festivals={festivals} />
              </div>
            )}
          </aside>

          <main className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">

            {/* ════ PREDICTION TAB ════ */}
            {activeTab==='prediction' && (
              <>
                <div className="grid grid-cols-4 gap-4">
                  <KpiCard label="Training Days"     value={predResult?.historical_sales.length.toLocaleString()??'—'} sub="Sep–Dec 2025"/>
                  <KpiCard label="Avg Daily Sales"   value={avgHist>0?avgHist.toFixed(1):'—'} sub="units / day"/>
                  <KpiCard label={`${filters.days}-Day Forecast`} value={totalPred>0?totalPred.toFixed(0):'—'} sub="predicted units" color="#34d399"/>
                  <KpiCard label="Festival Boost"    value={`×${filters.festivalMultiplier.toFixed(1)}`} sub={`+${((filters.festivalMultiplier-1)*100).toFixed(0)}% demand`} color="#f59e0b"/>
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <div className="relative">{loadingPred&&<LoadingOverlay/>}
                    <ChartCard title="Historical Sales (Sep–Dec 2025)" subtitle={filters.brand?`${filters.brand}${filters.model?` · ${filters.model}`:''}`:'All brands'} accent="sky">
                      <SalesChart data={predResult?.historical_sales??[]} baseline={predResult?.model_stats.baseline??0} festivals={festivals} />
                    </ChartCard>
                  </div>
                  <div className="relative">{loadingPred&&<LoadingOverlay/>}
                    <ChartCard title="Predicted Sales — Jan 2026+" subtitle={`${MODEL_LABELS[activeModel]} · ${filters.days} days · ×${filters.festivalMultiplier.toFixed(1)}`} accent="emerald">
                      <PredictionChart data={predResult?.predicted_sales??[]} actualSales={predResult?.actual_future_sales??[]}/>
                    </ChartCard>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <div className="relative">{loadingPred&&<LoadingOverlay/>}
                    <ChartCard title="Daily Breakdown" subtitle="Weekday vs Weekend" accent="indigo">
                      <DailyBarChart data={predResult?.predicted_sales??[]}/>
                    </ChartCard>
                  </div>
                  <div className="relative">{loadingPred&&<LoadingOverlay/>}
                    <ChartCard title="Prediction Table" subtitle={`${filters.days}-day detail`} accent="amber">
                      <PredictionTable rows={predResult?.prediction_table??[]}/>
                    </ChartCard>
                  </div>
                </div>
              </>
            )}

            {/* ════ COMPARISON TAB ════ */}
            {activeTab==='comparison' && (
              <>
                <div className="grid grid-cols-4 gap-4">
                  <KpiCard label="Models Compared" value="12" sub="statistical methods" color="#a78bfa"/>
                  <KpiCard label="Forecast Days"   value={`${filters.days}d`} sub="all models same horizon"/>
                  <KpiCard label="Festival Boost"  value={`×${filters.festivalMultiplier.toFixed(1)}`} sub="applied uniformly" color="#f59e0b"/>
                  <KpiCard label="Ensemble Total"  color="#94a3b8"
                    value={compareResult?(compareResult.models.find(m=>m.name==='ensemble')?.total_predicted.toFixed(0)??'—'):'—'}
                    sub="median of all models"/>
                </div>

                <div className="relative">{loadingCmp&&<LoadingOverlay/>}
                  <ChartCard title="All 12 Models — Overlay" subtitle="Toggle · double-click to isolate · dashed = Ensemble" accent="violet">
                    <ModelComparisonChart models={compareResult?.models??[]} futureDates={compareResult?.future_dates??[]} actualSales={compareResult?.actual_future_sales??[]}/>
                  </ChartCard>
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <div className="relative">{loadingCmp&&<LoadingOverlay/>}
                    <ChartCard title="Avg Daily Forecast" subtitle="With min–max error bars" accent="amber">
                      <ModelSpreadChart rows={compareResult?.summary_table??[]}/>
                    </ChartCard>
                  </div>
                  <div className="relative">{loadingCmp&&<LoadingOverlay/>}
                    <ChartCard title="Model Summary" subtitle="Click row to use in Prediction tab" accent="sky">
                      <ModelSummaryTable rows={compareResult?.summary_table??[]} selectedModel={activeModel} onSelectModel={handleSelectModel}/>
                    </ChartCard>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button onClick={()=>fetchCmp(filters)} disabled={loadingCmp}
                    className="text-sm px-5 py-2 rounded-lg bg-zinc-800 border border-zinc-700/60 text-zinc-300 hover:bg-zinc-700 transition-colors disabled:opacity-50">
                    {loadingCmp?'Computing…':'↺ Re-run Comparison'}
                  </button>
                </div>
              </>
            )}

            {/* ════ BRAND AFFINITY TAB ════ */}
            {activeTab === 'brand_affinity' && (
              <BrandAffinity filters={filters} />
            )}

            {/* ════ PRICE AFFINITY TAB ════ */}
            {activeTab === 'price_affinity' && (
              <PriceAffinity filters={filters} />
            )}

          </main>
        </div>
      )}
    </div>
  );
}
