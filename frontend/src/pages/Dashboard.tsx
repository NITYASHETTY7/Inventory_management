import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import type { CompareResponse, FestivalEntry, Filters, PredictionResponse } from '../types';

import DailyBarChart from '../components/DailyBarChart';
import { FestivalCalendarPanel } from '../components/FestivalBadge';
import FiltersPanel from '../components/FiltersPanel';
import ModelComparisonChart from '../components/ModelComparisonChart';
import ModelSpreadChart from '../components/ModelSpreadChart';
import ModelSummaryTable from '../components/ModelSummaryTable';
import ThemeToggle from '../components/ThemeToggle';
import AsmDashboard from './AsmDashboard';
import BrandAffinity from './BrandAffinity';
import CuratedMspAccuracy from './CuratedMspAccuracy';
import LookalikePage from './LookalikePage';
import MspAccuracy from './MspAccuracy';
import OtbManagement from './OtbManagement';
import PriceAffinity from './PriceAffinity';
import ShuffleEngine from './ShuffleEngine';

import { ShuffleRunResult } from '../types/shuffle_otb_types';

import {
  Activity, AlertCircle,
  BarChart3,
  Bell,
  Box,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  Crosshair,
  Filter,
  HeartHandshake,
  Layers,
  LayoutDashboard,
  Link,
  Menu,
  RefreshCw,
  Settings,
  Tags,
  Target,
  User
} from 'lucide-react';

// ── Shared UI pieces ──────────────────────────────────────────────────────────

function ChartCard({ title, subtitle, children, icon: Icon, action }: {
  title:string; subtitle?:string; children:React.ReactNode;
  icon?: React.ElementType; action?: React.ReactNode;
}) {
  return (
    <div className="glass-card flex flex-col h-full overflow-hidden group">
      <div className="p-5 border-b border-white/5 flex items-start justify-between bg-white/[0.02]">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="p-2 rounded-lg bg-white/5 text-white/70 group-hover:text-white transition-colors">
              <Icon size={18} />
            </div>
          )}
          <div>
            <h3 className="text-sm font-semibold text-white tracking-wide">{title}</h3>
            {subtitle && <p className="text-xs text-neutral-400 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {action && <div>{action}</div>}
      </div>
      <div className="p-5 flex-1 relative">
        {children}
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, icon: Icon, trend }: { 
  label:string; value:string; sub?:string; icon?: React.ElementType; trend?: 'up' | 'down' | 'neutral' 
}) {
  return (
    <div className="glass-card p-5 group glass-card-hover">
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">{label}</span>
        {Icon && <Icon size={16} className="text-neutral-500 group-hover:text-white transition-colors" />}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold tracking-tight text-white">{value}</span>
      </div>
      {sub && (
        <div className="mt-2 flex items-center gap-1.5">
          {trend === 'up' && <ChevronRightIcon className="rotate-[-45deg] text-emerald-400" size={14} />}
          {trend === 'down' && <ChevronRightIcon className="rotate-[45deg] text-red-400" size={14} />}
          <span className={`text-xs ${trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-neutral-500'}`}>
            {sub}
          </span>
        </div>
      )}
    </div>
  );
}

function LoadingOverlay() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#0A0A0A]/60 backdrop-blur-sm rounded-xl z-20">
      <div className="flex flex-col items-center gap-3 glass-panel px-6 py-4">
        <RefreshCw className="animate-spin text-white" size={24} />
        <span className="text-sm font-medium text-white">Computing Data...</span>
      </div>
    </div>
  );
}

// ── Model label map ───────────────────────────────────────────────────────────

const MODEL_LABELS: Record<string,string> = {
  msp_curated:' Curated MSP', median_dow:'MSP Baseline', wma:'WMA-14', sma:'SMA-7',
  ets:'ETS', holts:"Holt's", holt_winters:'Holt-Winters',
  trimmed_mean:'Trimmed', iqr:'IQR', same_weekday:'Same-WD',
  seasonal_naive:'Seasonal', stl:'STL', ensemble:'Ensemble',
};

// ── Dashboard Layout ─────────────────────────────────────────────────────────────────

type TabId = 'prediction' | 'comparison' | 'accuracy' | 'curated_accuracy' | 'brand_affinity' | 'price_affinity' | 'otb_management' | 'shuffle_engine' | 'asm' | 'lookalike';
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
  const [lastShuffleResult, setLastShuffleResult] = useState<ShuffleRunResult | null>(null);
  const db = useRef<ReturnType<typeof setTimeout>|null>(null);
  
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [analyticsExpanded, setAnalyticsExpanded] = useState(true);
  const [affinityExpanded, setAffinityExpanded] = useState(false);

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

  // Sidebar Items Definition
  const NavItem = ({ icon: Icon, label, id, isActive, onClick, badge }: any) => (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200 group ${
        isActive 
          ? 'bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]' 
          : 'text-neutral-400 hover:bg-white/5 hover:text-white'
      }`}
    >
      <div className="flex items-center gap-3 overflow-hidden">
        <Icon size={18} className={`${isActive ? 'text-white' : 'text-neutral-500 group-hover:text-white'} shrink-0 transition-colors`} />
        {sidebarOpen && <span className="text-sm font-medium whitespace-nowrap">{label}</span>}
      </div>
      {sidebarOpen && badge && (
        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-white/10 text-white border border-white/5">
          {badge}
        </span>
      )}
    </button>
  );

  return (
    <div className="flex h-screen bg-[#0A0A0A] text-neutral-200 overflow-hidden font-sans relative">
      
      {/* ── MOBILE OVERLAY ── */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-20" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── SIDEBAR ── */}
      <aside 
        className={`fixed md:relative flex flex-col border-r border-white/10 bg-black/80 md:bg-black/40 backdrop-blur-2xl transition-all duration-300 z-30 shrink-0 h-full ${
          sidebarOpen ? 'w-64 translate-x-0' : '-translate-x-full md:translate-x-0 md:w-20'
        }`}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-white to-neutral-400 flex items-center justify-center shrink-0 shadow-lg">
              <Activity size={18} className="text-black" />
            </div>
            {sidebarOpen && (
              <div className="flex flex-col">
                <span className="font-bold text-white text-sm tracking-tight leading-tight">Sangeetha Analytics</span>
                <span className="text-[10px] text-neutral-500 font-medium">Enterprise Edition</span>
              </div>
            )}
          </div>
          {sidebarOpen && (
            <button onClick={() => setSidebarOpen(false)} className="p-1 rounded-md text-neutral-500 hover:text-white hover:bg-white/10 transition-colors hidden md:block">
              <ChevronLeft size={18} />
            </button>
          )}
        </div>

        {!sidebarOpen && (
          <div className="flex justify-center mt-4 hidden md:flex">
             <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-md text-neutral-500 hover:text-white hover:bg-white/10 transition-colors">
              <Menu size={20} />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-1 hide-scrollbar">
          {sidebarOpen && <div className="px-3 mb-2 text-[10px] font-semibold text-neutral-500 uppercase tracking-widest mt-2">Core</div>}
          <NavItem icon={LayoutDashboard} label="Prediction" id="prediction" isActive={activeTab === 'prediction'} onClick={() => handleTabChange('prediction')} />
          
          {sidebarOpen && <div className="px-3 mb-2 text-[10px] font-semibold text-neutral-500 uppercase tracking-widest mt-6 flex justify-between items-center cursor-pointer group" onClick={() => setAnalyticsExpanded(!analyticsExpanded)}>
            <span>Analytics</span>
            <ChevronDown size={14} className={`transition-transform ${analyticsExpanded ? '' : '-rotate-90'} group-hover:text-white`} />
          </div>}
          
          {(analyticsExpanded || !sidebarOpen) && (
            <div className="flex flex-col gap-1">
              <NavItem icon={BarChart3} label="Model Comparison" id="comparison" isActive={activeTab === 'comparison'} onClick={() => handleTabChange('comparison')} badge="12" />
              <NavItem icon={Target} label="Model Accuracy" id="accuracy" isActive={activeTab === 'accuracy'} onClick={() => handleTabChange('accuracy')} />
              <NavItem icon={Crosshair} label="MSP" id="curated_accuracy" isActive={activeTab === 'curated_accuracy'} onClick={() => handleTabChange('curated_accuracy')} />
            </div>
          )}

          {sidebarOpen && <div className="px-3 mb-2 text-[10px] font-semibold text-neutral-500 uppercase tracking-widest mt-6 flex justify-between items-center cursor-pointer group" onClick={() => setAffinityExpanded(!affinityExpanded)}>
            <span>Affinity</span>
            <ChevronDown size={14} className={`transition-transform ${affinityExpanded ? '' : '-rotate-90'} group-hover:text-white`} />
          </div>}
          
          {(affinityExpanded || !sidebarOpen) && (
            <div className="flex flex-col gap-1">
              <NavItem icon={HeartHandshake} label="Brand Affinity" id="brand_affinity" isActive={activeTab === 'brand_affinity'} onClick={() => handleTabChange('brand_affinity')} />
              <NavItem icon={Tags} label="Price Affinity" id="price_affinity" isActive={activeTab === 'price_affinity'} onClick={() => handleTabChange('price_affinity')} />
            </div>
          )}

          {sidebarOpen && <div className="px-3 mb-2 text-[10px] font-semibold text-neutral-500 uppercase tracking-widest mt-6">Operations</div>}
          <NavItem icon={Layers} label="OTB Management" id="otb_management" isActive={activeTab === 'otb_management'} onClick={() => handleTabChange('otb_management')} />
          <NavItem icon={RefreshCw} label="Shuffle Engine" id="shuffle_engine" isActive={activeTab === 'shuffle_engine'} onClick={() => handleTabChange('shuffle_engine')} />
          <NavItem icon={Box} label="ASM Mapping" id="asm" isActive={activeTab === 'asm'} onClick={() => handleTabChange('asm')} />
          <NavItem icon={Link} label="Lookalike" id="lookalike" isActive={activeTab === 'lookalike'} onClick={() => handleTabChange('lookalike')} />
        </div>

        <div className="p-4 border-t border-white/5 shrink-0">
          <button className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-white/5 transition-colors group">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0 border border-white/10 group-hover:border-white/30 transition-colors">
              <User size={16} className="text-white/80" />
            </div>
            {sidebarOpen && (
              <div className="flex flex-col items-start overflow-hidden text-left">
                <span className="text-sm font-medium text-white truncate w-full">Administrator</span>
                <span className="text-xs text-neutral-500 truncate w-full">admin@sangeethaanalytics.com</span>
              </div>
            )}
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        
        {/* Top Header */}
        <header className="h-16 glass-panel border-x-0 border-t-0 rounded-none flex items-center justify-between px-4 md:px-6 z-10 shrink-0 sticky top-0 bg-[#0A0A0A]/80 backdrop-blur-xl">
          <div className="flex items-center gap-4 flex-1">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 -ml-2 text-neutral-400 hover:text-white rounded-md">
              <Menu size={20} />
            </button>
          </div>
          
          <div className="flex items-center gap-3 md:gap-5">
            {error && (
              <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 px-3 py-1.5 rounded-full border border-red-500/20 max-w-xs truncate shadow-sm">
                <AlertCircle size={14} />
                <span className="truncate">{error}</span>
              </div>
            )}
            
            {activeTab === 'prediction' && (
              <div className="hidden sm:flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-white/80 shadow-sm">
                <Activity size={14} className="text-emerald-400" />
                {MODEL_LABELS[activeModel] ?? activeModel}
              </div>
            )}
            
            <div className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border shadow-sm transition-colors ${
              (loadingPred||loadingCmp)
                ? 'text-amber-400 border-amber-500/20 bg-amber-500/10'
                : 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10'}`}>
              {(loadingPred||loadingCmp) ? (
                <RefreshCw size={12} className="animate-spin text-amber-400" />
              ) : (
                <CheckCircle2 size={12} className="text-emerald-400" />
              )}
              <span className="font-medium">{(loadingPred||loadingCmp) ? 'Computing' : 'System Live'}</span>
            </div>

            <div className="h-6 w-px bg-white/10 mx-1 hidden md:block"></div>

            <ThemeToggle />

            <button className="relative p-2 text-neutral-400 hover:text-white hover:bg-white/5 rounded-full transition-colors hidden md:block">
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-500 border-2 border-[#0A0A0A]"></span>
            </button>
            <button className="p-2 text-neutral-400 hover:text-white hover:bg-white/5 rounded-full transition-colors hidden md:block">
              <Settings size={18} />
            </button>
          </div>
        </header>

        {/* Dynamic Content Area */}
        <div className="flex-1 overflow-y-auto">
          
          {/* Full bleed tabs (own scrolling inside components or full height) */}
          <div className={`h-full ${['accuracy', 'curated_accuracy', 'otb_management', 'shuffle_engine', 'asm', 'lookalike'].includes(activeTab) ? 'block' : 'hidden'}`}>
            <div className={`h-full ${activeTab === 'accuracy' ? 'block' : 'hidden'}`}>
              <MspAccuracy />
            </div>
            <div className={`h-full ${activeTab === 'curated_accuracy' ? 'block' : 'hidden'}`}>
              <CuratedMspAccuracy />
            </div>
            <div className={`h-full ${activeTab === 'otb_management' ? 'block' : 'hidden'}`}>
              <OtbManagement lastShuffleResult={lastShuffleResult} />
            </div>
            <div className={`h-full ${activeTab === 'shuffle_engine' ? 'block' : 'hidden'}`}>
              <ShuffleEngine onShuffleComplete={(res) => setLastShuffleResult(res)} />
            </div>
            <div className={`h-full ${activeTab === 'asm' ? 'block' : 'hidden'}`}>
              <AsmDashboard />
            </div>
            <div className={`h-full ${activeTab === 'lookalike' ? 'block' : 'hidden'}`}>
              <LookalikePage onOtbGenerated={(res) => setLastShuffleResult(res)} />
            </div>
          </div>

          {/* Grid Layout tabs (Prediction, Comparison, Affinity) */}
          <div className={`h-full relative ${['prediction', 'comparison', 'brand_affinity', 'price_affinity'].includes(activeTab) ? 'flex' : 'hidden'}`}>
            {/* Inner Sidebar for Filters */}
            {filtersOpen && (
              <aside className="w-[300px] shrink-0 border-r border-white/5 overflow-y-auto bg-black/20 backdrop-blur-md hidden xl:block z-10 custom-scrollbar relative">
                <button onClick={() => setFiltersOpen(false)} className="absolute top-4 right-4 p-1.5 text-neutral-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-md transition-colors" title="Collapse Filters">
                  <ChevronLeft size={16} />
                </button>
                <div className="p-5 flex flex-col gap-6 mt-6">
                  <FiltersPanel filters={filters} onChange={handleChange} />
                  <div className="h-px bg-white/5 w-full"></div>
                  <PredictionControls filters={filters} onChange={handleChange} modelStats={predResult?.model_stats??null} />
                  {festivals.length > 0 && (
                    <>
                      <div className="h-px bg-white/5 w-full"></div>
                      <FestivalCalendarPanel festivals={festivals} />
                    </>
                  )}
                </div>
              </aside>
            )}

            <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 flex flex-col gap-6 custom-scrollbar relative">
              {!filtersOpen && (
                <div className="hidden xl:flex mb-2">
                  <button onClick={() => setFiltersOpen(true)} className="p-2 text-neutral-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-md shadow-sm border border-white/10 transition-colors flex items-center gap-2" title="Expand Filters">
                    <Filter size={16} /> <span className="text-xs font-medium">Filters</span>
                  </button>
                </div>
              )}
              
              {/* PREDICTION TAB */}
              <div className={`max-w-7xl mx-auto w-full flex-col gap-6 animate-in fade-in duration-500 ${activeTab === 'prediction' ? 'flex' : 'hidden'}`}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <KpiCard label="Training Data"     value={predResult?.historical_sales.length.toLocaleString()??'—'} sub="Sep–Dec 2025" icon={Box} trend="neutral"/>
                      <KpiCard label="Avg Daily Sales"   value={avgHist>0?avgHist.toFixed(1):'—'} sub="Units per day" icon={Activity} trend="neutral"/>
                      <KpiCard label={`${filters.days}-Day Forecast`} value={totalPred>0?totalPred.toLocaleString():'—'} sub="Predicted total units" icon={Target} trend="up"/>
                      <KpiCard label="Festival Boost"    value={`×${filters.festivalMultiplier.toFixed(1)}`} sub={`+${((filters.festivalMultiplier-1)*100).toFixed(0)}% projected demand`} icon={Tags} trend="up"/>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="relative min-h-[400px]">
                        {loadingPred && <LoadingOverlay/>}
                        <ChartCard title="Historical Performance" subtitle={filters.brand?`${filters.brand}${filters.model?` · ${filters.model}`:''}`:'All Brands Overview'} icon={BarChart3}>
                          <SalesChart data={predResult?.historical_sales??[]} baseline={predResult?.model_stats.baseline??0} festivals={festivals} />
                        </ChartCard>
                      </div>
                      <div className="relative min-h-[400px]">
                        {loadingPred && <LoadingOverlay/>}
                        <ChartCard title="AI Forecast Projection" subtitle={`${MODEL_LABELS[activeModel]} Model · ${filters.days} Days Outlook · Multiplier ×${filters.festivalMultiplier.toFixed(1)}`} icon={Activity}>
                          <PredictionChart data={predResult?.predicted_sales??[]} actualSales={predResult?.actual_future_sales??[]}/>
                        </ChartCard>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="relative min-h-[350px]">
                        {loadingPred && <LoadingOverlay/>}
                        <ChartCard title="Day-of-Week Distribution" subtitle="Weekday vs Weekend Trends" icon={Layers}>
                          <DailyBarChart data={predResult?.predicted_sales??[]}/>
                        </ChartCard>
                      </div>
                      <div className="relative min-h-[350px]">
                        {loadingPred && <LoadingOverlay/>}
                        <ChartCard title="Detailed Forecast Table" subtitle={`${filters.days}-Day Granular Breakdown`} icon={Box}>
                          <PredictionTable rows={predResult?.prediction_table??[]}/>
                        </ChartCard>
                      </div>
                    </div>
                  </div>

                {/* COMPARISON TAB */}
                  <div className={`max-w-7xl mx-auto w-full flex-col gap-6 animate-in fade-in duration-500 ${activeTab === 'comparison' ? 'flex' : 'hidden'}`}>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <KpiCard label="Models Analyzed" value="12" sub="Statistical algorithms" icon={Layers} trend="neutral" />
                      <KpiCard label="Forecast Horizon" value={`${filters.days}d`} sub="Uniform projection period" icon={Target} trend="neutral" />
                      <KpiCard label="Event Multiplier" value={`×${filters.festivalMultiplier.toFixed(1)}`} sub="Globally applied" icon={Tags} trend="up" />
                      <KpiCard label="Ensemble Output" value={compareResult?(compareResult.models.find(m=>m.name==='ensemble')?.total_predicted.toLocaleString()??'—'):'—'} sub="Median consensus" icon={Activity} trend="neutral"/>
                    </div>

                    <div className="relative min-h-[500px]">
                      {loadingCmp && <LoadingOverlay/>}
                      <ChartCard 
                        title="Algorithmic Comparison Matrix" 
                        subtitle="Interactive Overlay · Double-click to isolate · Dashed line denotes Ensemble consensus" 
                        icon={Activity}
                        action={
                          <button onClick={()=>fetchCmp(filters)} disabled={loadingCmp} className="btn-secondary text-xs py-1.5 px-3">
                            <RefreshCw size={14} className={loadingCmp ? 'animate-spin' : ''} />
                            <span>{loadingCmp ? 'Syncing...' : 'Recalculate'}</span>
                          </button>
                        }
                      >
                        <ModelComparisonChart models={compareResult?.models??[]} futureDates={compareResult?.future_dates??[]} actualSales={compareResult?.actual_future_sales??[]}/>
                      </ChartCard>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="relative min-h-[400px]">
                        {loadingCmp && <LoadingOverlay/>}
                        <ChartCard title="Variance Analysis" subtitle="Average Daily Forecast with Min/Max Error Bounds" icon={BarChart3}>
                          <ModelSpreadChart rows={compareResult?.summary_table??[]}/>
                        </ChartCard>
                      </div>
                      <div className="relative min-h-[400px]">
                        {loadingCmp && <LoadingOverlay/>}
                        <ChartCard title="Model Performance Leaderboard" subtitle="Select a model to apply globally" icon={Target}>
                          <ModelSummaryTable rows={compareResult?.summary_table??[]} selectedModel={activeModel} onSelectModel={handleSelectModel}/>
                        </ChartCard>
                      </div>
                    </div>
                  </div>

                {/* AFFINITY TABS */}
                  <div className={`max-w-7xl mx-auto w-full animate-in fade-in duration-500 ${activeTab === 'brand_affinity' ? 'block' : 'hidden'}`}>
                    <BrandAffinity filters={filters} />
                  </div>
                  <div className={`max-w-7xl mx-auto w-full animate-in fade-in duration-500 ${activeTab === 'price_affinity' ? 'block' : 'hidden'}`}>
                    <PriceAffinity filters={filters} />
                  </div>

              </main>
            </div>
        </div>
      </div>
      
      {/* Global utility styles scoped for this layout that haven't been migrated yet */}
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(255, 255, 255, 0.1);
          border-radius: 20px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
}
