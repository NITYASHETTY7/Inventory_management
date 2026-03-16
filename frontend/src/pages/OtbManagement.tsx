import { AlertCircle, List, Package, RefreshCw, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import CustomSelect from "../components/CustomSelect";
import { api } from "../services/api";
import {
  fetchAllocationRank,
  fetchAsmList,
  fetchModelsForAsm,
  fetchStockDates,
  runOtb,
  RunShuffleParams
} from "../services/shuffle_otb_api";
import { AllocationRankedStore, AsmGroup, ModelOption, OtbRunResult, ShuffleRunResult } from "../types/shuffle_otb_types";

interface OtbManagementProps {
  lastShuffleResult?: ShuffleRunResult | null;
}

export default function OtbManagement({ lastShuffleResult }: OtbManagementProps) {
  // Mode A state
  const [allBrands, setAllBrands] = useState<string[]>([]);
  const [asmList, setAsmList] = useState<AsmGroup[]>([]);
  const [stockDates, setStockDates] = useState<string[]>([]);

  const [selectedAsm, setSelectedAsm] = useState<string>("");
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [selectedModelStr, setSelectedModelStr] = useState<string>(""); 
  const [predictionDate, setPredictionDate] = useState<string>("");
  const [modelsForAsm, setModelsForAsm] = useState<ModelOption[]>([]);

  const [applyBrandAffinity, setApplyBrandAffinity] = useState(false);
  const [applyPriceAffinity, setApplyPriceAffinity] = useState(false);
  const [applyDow, setApplyDow] = useState(false);
  const [applyFestival, setApplyFestival] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Result state
  const [otbResult, setOtbResult] = useState<OtbRunResult | null>(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState<"table" | "stagger">("table");

  // Staggered Order State
  const [budget, setBudget] = useState<number>(500);
  const [staggerDays, setStaggerDays] = useState<number>(10);
  const [avgUnitPrice, setAvgUnitPrice] = useState<number>(15000);
  const [staggerSchedule, setStaggerSchedule] = useState<any[]>([]);
  const [loadingStagger, setLoadingStagger] = useState(false);

  // Allocation State
  const [allocBrand, setAllocBrand] = useState("");
  const [allocModelName, setAllocModelName] = useState("");
  const [allocModels, setAllocModels] = useState<string[]>([]);
  const [rankedStores, setRankedStores] = useState<AllocationRankedStore[]>([]);
  const [loadingAlloc, setLoadingAlloc] = useState(false);

  const [isCustomMode, setIsCustomMode] = useState(false);

  // Load initial filter data
  useEffect(() => {
    if (lastShuffleResult && !isCustomMode) {
      // Setup mock otb result from shuffle result
      setOtbResult({
        asm_name: lastShuffleResult.asm_name,
        brand: lastShuffleResult.brand,
        im_code: lastShuffleResult.im_code,
        prediction_date: lastShuffleResult.prediction_date,
        closing_stock_date_used: lastShuffleResult.closing_stock_date_used,
        otb_table: lastShuffleResult.shuffle_result.post_shuffle_positions,
        otb_summary: lastShuffleResult.otb_summary,
        transfers: lastShuffleResult.shuffle_result.transfers
      });
      return; // Do not load filters in Mode B
    }

    api.getBrands().then(setAllBrands).catch(console.error);
    fetchAsmList().then(setAsmList).catch(console.error);
    fetchStockDates().then((res) => {
      setStockDates(res.dates);
      if (res.dates.length > 0) setPredictionDate(res.dates[res.dates.length - 1]);
    }).catch(console.error);
  }, [lastShuffleResult, isCustomMode]);

  useEffect(() => {
    if ((!lastShuffleResult || isCustomMode) && selectedAsm && predictionDate) {
      fetchModelsForAsm(selectedAsm, predictionDate).then((res) => {
        setModelsForAsm(res);
        if (selectedModelStr) {
          const current = JSON.parse(selectedModelStr) as ModelOption;
          if (!res.find((m) => m.im_code === current.im_code)) setSelectedModelStr("");
        }
      }).catch(console.error);
    } else {
      if (!lastShuffleResult || isCustomMode) setModelsForAsm([]);
    }
  }, [selectedAsm, predictionDate, lastShuffleResult, isCustomMode]);

  useEffect(() => {
    if (allocBrand) {
      api.getModels(allocBrand).then(setAllocModels).catch(console.error);
    } else {
      setAllocModels([]);
    }
  }, [allocBrand]);

  const handleRunOtb = async () => {
    if (!selectedAsm || !selectedModelStr || !predictionDate) {
      setError("Please select ASM, Model, and Prediction Date.");
      return;
    }
    const modelObj = JSON.parse(selectedModelStr) as ModelOption;
    setLoading(true);
    setError(null);
    try {
      const params: RunShuffleParams = {
        asm_name: selectedAsm, brand: modelObj.brand, im_code: modelObj.im_code, prediction_date: predictionDate,
        w1: 0.5, w2: 0.3, w3: 0.2, apply_brand_affinity: applyBrandAffinity, apply_price_affinity: applyPriceAffinity, apply_dow: applyDow, apply_festival: applyFestival,
      };
      const res = await runOtb(params);
      setOtbResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "OTB run failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateSchedule = async () => {
    const totalEffectiveOtbUnits = otbResult?.otb_summary.total_effective_otb || 0;
    if (totalEffectiveOtbUnits <= 0) {
      alert("Total Effective OTB is 0. No order required.");
      return;
    }
    setLoadingStagger(true);
    try {
      const BASE = (import.meta as any).env?.VITE_API_URL ?? "http://localhost:8000/api";
      const res = await fetch(`${BASE}/otb/stagger-schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          total_units: totalEffectiveOtbUnits,
          total_budget_crore: budget,
          stagger_days: staggerDays,
        }),
      });
      const data = await res.json();
      setStaggerSchedule(data.schedule);
    } catch (err: unknown) {
      console.error(err);
      alert("Failed to generate schedule.");
    } finally {
      setLoadingStagger(false);
    }
  };

  const handleRankStores = async () => {
    if (!allocBrand) {
      alert("Please provide a Brand.");
      return;
    }
    setLoadingAlloc(true);
    try {
      const res = await fetchAllocationRank(allocModelName, allocBrand);
      setRankedStores(res.ranked_stores);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAlloc(false);
    }
  };

  const renderFilters = () => {
    if (lastShuffleResult && !isCustomMode) {
      return (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-4 rounded-lg flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-3">
          <div className="text-sm font-medium">
            Showing OTB results from last shuffle run — {lastShuffleResult.asm_name} · {lastShuffleResult.item_model}
          </div>
          <button 
            onClick={() => { setIsCustomMode(true); setOtbResult(null); }} 
            className="btn-secondary text-xs"
          >
            <RefreshCw size={14} /> New Calculation
          </button>
        </div>
      );
    }

    const visibleModels = selectedBrand ? modelsForAsm.filter(m => m.brand === selectedBrand) : modelsForAsm;


    return (
      <div className="glass-panel p-5 mb-6 relative z-50">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          {/* ASM */}
          <CustomSelect
            label="ASM"
            value={selectedAsm}
            options={asmList.map(a => a.asm_name)}
            onChange={setSelectedAsm}
            placeholder="Select ASM"
          />

          {/* Brand */}
          <CustomSelect
            label="Brand Filter"
            value={selectedBrand}
            options={allBrands}
            onChange={(v) => { setSelectedBrand(v); setSelectedModelStr(""); }}
            placeholder="All Brands"
          />

          {/* Model */}
          <CustomSelect
            label="Model"
            value={selectedModelStr}
            options={
              selectedBrand && modelsForAsm.length > 0
                ? [
                    JSON.stringify({ im_code: "ALL", brand: selectedBrand, item_model: `All ${selectedBrand} Models`, display_label: `All ${selectedBrand} Models` }),
                    ...visibleModels.map(m => JSON.stringify(m))
                  ]
                : visibleModels.map(m => JSON.stringify(m))
            }
            onChange={setSelectedModelStr}
            placeholder={modelsForAsm.length > 0 ? "Select Model" : "Awaiting ASM..."}
            formatLabel={(val) => {
              if (!val) return "Select Model";
              try { return JSON.parse(val).display_label || JSON.parse(val).item_model; } catch { return val; }
            }}
          />

          {/* Prediction Date */}
          <CustomSelect
            label="Prediction Date"
            value={predictionDate}
            options={stockDates}
            onChange={setPredictionDate}
            placeholder="Select Date"
            formatLabel={(d) => new Date(d).toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' })}
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-6 mb-4 mt-2">

          <label className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer">
            <input type="checkbox" checked={applyBrandAffinity} onChange={e => setApplyBrandAffinity(e.target.checked)} className="rounded bg-[#0A0A0A]/60 border-white/20 text-amber-500 focus:ring-amber-500" />
            Brand Affinity
          </label>
          <label className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer">
            <input type="checkbox" checked={applyPriceAffinity} onChange={e => setApplyPriceAffinity(e.target.checked)} className="rounded bg-[#0A0A0A]/60 border-white/20 text-amber-500 focus:ring-amber-500" />
            Price Affinity
          </label>
          <label className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer">
            <input type="checkbox" checked={applyDow} onChange={e => setApplyDow(e.target.checked)} className="rounded bg-[#0A0A0A]/60 border-white/20 text-amber-500 focus:ring-amber-500" />
            Day of Week (DOW)
          </label>
          <label className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer">
            <input type="checkbox" checked={applyFestival} onChange={e => setApplyFestival(e.target.checked)} className="rounded bg-[#0A0A0A]/60 border-white/20 text-amber-500 focus:ring-amber-500" />
            Festival Multiplier
          </label>
        </div>

        <button onClick={handleRunOtb} disabled={loading} className="w-full flex justify-center items-center gap-2 btn-primary bg-amber-500 hover:bg-amber-400 text-[#0A0A0A] border-none py-2.5 mt-4">
          {loading ? <RefreshCw size={16} className="animate-spin" /> : <Package size={16} />}
          {loading ? "Calculating..." : "Calculate OTB"}
        </button>
      </div>
    );
  };

  const renderSummary = () => {
    if (!otbResult) return null;
    const s = otbResult.otb_summary;
    const formatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
    
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="glass-card p-5">
          <div className="text-neutral-400 text-xs font-bold uppercase tracking-wider mb-1">Total Raw OTB</div>
          <div className="text-amber-400 text-2xl font-mono">{s.total_raw_otb.toLocaleString('en-IN', {maximumFractionDigits: 0})} units</div>
        </div>
        <div className="glass-card p-5">
          <div className="text-neutral-400 text-xs font-bold uppercase tracking-wider mb-1">Covered by Shuffle</div>
          <div className="text-sky-400 text-2xl font-mono">{s.total_shuffle_reduction > 0 ? `${s.total_shuffle_reduction.toLocaleString('en-IN', {maximumFractionDigits: 0})}` : '0'} units</div>
        </div>
        <div className="glass-card p-5 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent pointer-events-none" />
          <div className="text-neutral-400 text-xs font-bold uppercase tracking-wider mb-1 relative">PO to Manufacturer</div>
          <div className={`text-2xl font-mono font-black relative ${s.po_to_manufacturer > 0 ? "text-red-400" : "text-emerald-400"}`}>
            {s.po_to_manufacturer.toLocaleString('en-IN', {maximumFractionDigits: 0})} units
          </div>
        </div>
        
        {s.total_raw_otb_cost !== undefined && (
          <div className="glass-card p-5 border-amber-500/20">
            <div className="text-neutral-400 text-xs font-bold uppercase tracking-wider mb-1">Cost Before Shuffling</div>
            <div className="text-amber-400 text-xl font-mono">{formatter.format(s.total_raw_otb_cost)}</div>
          </div>
        )}
        
        {s.otb_value_saved !== undefined && (
          <div className="glass-card p-5 border-sky-500/20">
            <div className="text-neutral-400 text-xs font-bold uppercase tracking-wider mb-1">Savings From Shuffle</div>
            <div className="text-sky-400 text-xl font-mono">{formatter.format(s.otb_value_saved)}</div>
          </div>
        )}
        
        {s.total_effective_otb_cost !== undefined && (
          <div className="glass-card p-5 border-red-500/20">
            <div className="text-neutral-400 text-xs font-bold uppercase tracking-wider mb-1">Cost After Shuffling</div>
            <div className="text-red-400 text-xl font-mono font-black">{formatter.format(s.total_effective_otb_cost)}</div>
          </div>
        )}
      </div>
    );
  };

  const renderOtbTable = () => {
    if (!otbResult) return null;
    return (
      <div className="overflow-x-auto glass-panel">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="text-xs text-neutral-500 font-semibold tracking-wider uppercase bg-transparent">
            <tr>
              <th className="px-4 py-3">Branch</th>
              <th className="px-4 py-3 text-right">Closing Stock</th>
              <th className="px-4 py-3 text-right">MSP 20d</th>
              <th className="px-4 py-3 text-right">Raw OTB</th>
              <th className="px-4 py-3 text-right">Shuffle In</th>
              <th className="px-4 py-3 text-right">Net OTB</th>
              <th className="px-4 py-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {otbResult.otb_table.map((row, i) => (
              <tr key={i} className={`hover:bg-white/5 transition-colors ${row.effective_otb === 0 ? 'opacity-60' : ''}`}>
                <td className="px-4 py-3 font-medium text-neutral-200">{row.branch}</td>
                <td className="px-4 py-3 text-right font-mono text-sky-300">{Math.round(Number(row.closing_stock)).toLocaleString('en-IN')}</td>
                <td className="px-4 py-3 text-right font-mono text-emerald-300">{Math.round(Number(row.msp_20d)).toLocaleString('en-IN')}</td>
                <td className="px-4 py-3 text-right font-mono text-amber-400">{Math.round(Number(row.original_shortage)).toLocaleString('en-IN')}</td>
                <td className="px-4 py-3 text-right font-mono text-sky-400">{row.shuffle_in > 0 ? `${Math.round(Number(row.shuffle_in)).toLocaleString('en-IN')}` : '—'}</td>
                <td className={`px-4 py-3 text-right font-mono font-bold ${row.effective_otb > 0 ? 'text-red-400' : 'text-neutral-400'}`}>{Math.round(Number(row.effective_otb)).toLocaleString('en-IN')}</td>
                <td className="px-4 py-3 text-center">
                  {row.needs_purchase ? (
                    <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2.5 py-1 rounded-full text-xs font-bold">RAISE PO</span>
                  ) : (
                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full text-xs font-bold">SUFFICIENT</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderAllocationPanel = () => {
    return (
      <div className="glass-card p-6 mt-8">
        <div className="flex items-center gap-3 mb-1">
          <TrendingUp className="text-emerald-500" size={20} />
          <h3 className="text-lg font-medium text-neutral-200">Preferential Allocation Ranking</h3>
        </div>
        <p className="text-sm text-neutral-400 mb-6">If manufacturer supply {'<'} PO quantity, allocate in this order:</p>

        <div className="flex flex-wrap items-center gap-4 mb-6">
          <select value={allocBrand} onChange={(e) => { setAllocBrand(e.target.value); setAllocModelName(""); }} className="glass-input w-48">
            <option value="">Select Brand</option>
            {allBrands.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <select value={allocModelName} onChange={(e) => setAllocModelName(e.target.value)} disabled={!allocBrand} className="glass-input w-64">
            <option value="">All Models</option>
            {allocModels.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <button onClick={handleRankStores} disabled={loadingAlloc} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded text-sm transition-colors">
            {loadingAlloc ? <RefreshCw size={16} className="animate-spin" /> : <List size={16} />} Rank Stores
          </button>
        </div>

        {rankedStores.length > 0 && (
          <div className="overflow-hidden glass-panel">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-neutral-400 bg-[#0A0A0A]/60">
                <tr><th className="px-4 py-3 text-center">Rank</th><th className="px-4 py-3">Branch</th><th className="px-4 py-3 text-right">60d Sales</th><th className="px-4 py-3 text-right">Avg/Day</th><th className="px-4 py-3 w-1/3">Priority</th></tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {rankedStores.map((store, i) => {
                  const maxSold = Math.max(1, rankedStores[0].total_sold);
                  const pct = Math.max(5, (store.total_sold / maxSold) * 100);
                  return (
                    <tr key={i} className="hover:bg-white/5">
                      <td className="px-4 py-3 text-center font-mono">
                        <span className="bg-black text-white px-2 py-1 rounded-md border border-white/20 shadow-sm font-bold">#{store.rank || i+1}</span>
                      </td>
                      <td className="px-4 py-3 text-neutral-200">{store.branch}</td>
                      <td className="px-4 py-3 text-right font-mono text-emerald-400">{store.total_sold}</td>
                      <td className="px-4 py-3 text-right font-mono text-neutral-400">{store.avg_daily.toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <div className="w-full h-2 bg-white/5 rounded-full"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} /></div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 bg-transparent min-h-screen text-neutral-200">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3"><Package className="text-amber-500" /> OTB Management</h1>
      </div>
      {error && <div className="bg-red-500/10 text-red-400 p-3 rounded mb-6 flex items-center gap-3 text-sm"><AlertCircle size={18} /> {error}</div>}
      
      {renderFilters()}
      {renderSummary()}
      
      {otbResult && (
        <>
          <div className="mb-6 border-b border-white/5 flex gap-1">
            <button onClick={() => setActiveTab("table")} className={`px-4 py-3 text-sm border-b-2 ${activeTab === 'table' ? 'border-amber-500 text-amber-400' : 'border-transparent text-neutral-400'}`}>OTB Table</button>
            <button onClick={() => setActiveTab("stagger")} className={`px-4 py-3 text-sm border-b-2 ${activeTab === 'stagger' ? 'border-amber-500 text-amber-400' : 'border-transparent text-neutral-400'}`}>Staggered Order</button>
          </div>
          {activeTab === "table" && renderOtbTable()}
          {activeTab === "stagger" && (
            <div className="glass-card p-6">
              <h3 className="text-lg font-medium text-neutral-200 mb-2">Staggered Order Planning</h3>
              <p className="text-sm text-neutral-400 mb-6">
                Total Effective OTB: <span className="text-red-400 font-bold">{(otbResult?.otb_summary.total_effective_otb || 0).toLocaleString("en-IN")} units</span> across{" "}
                <span className="text-neutral-200">{otbResult?.otb_table.length || 0} models</span>
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
                <div className="glass-panel p-5">
                  <label className="block text-xs font-bold text-neutral-500 font-semibold tracking-wider uppercase tracking-wider mb-2">Budget (₹ Crore)</label>
                  <input
                    type="number"
                    value={budget}
                    onChange={(e) => setBudget(Number(e.target.value))}
                    className="w-full bg-[#0A0A0A]/60 border border-white/10 rounded p-2 text-neutral-200 font-mono focus:border-amber-500 outline-none"
                  />
                </div>
                <div className="glass-panel p-5">
                  <label className="block text-xs font-bold text-neutral-500 font-semibold tracking-wider uppercase tracking-wider mb-2">Stagger over (days): {staggerDays}</label>
                  <input
                    type="range"
                    min={2}
                    max={30}
                    value={staggerDays}
                    onChange={(e) => setStaggerDays(Number(e.target.value))}
                    className="w-full mt-2 accent-amber-500"
                  />
                </div>
                <div className="glass-panel p-5">
                  <label className="block text-xs font-bold text-neutral-500 font-semibold tracking-wider uppercase tracking-wider mb-2">Avg Unit Price (₹)</label>
                  <input
                    type="number"
                    value={avgUnitPrice}
                    onChange={(e) => setAvgUnitPrice(Number(e.target.value))}
                    className="w-full bg-[#0A0A0A]/60 border border-white/10 rounded p-2 text-neutral-200 font-mono focus:border-amber-500 outline-none"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleGenerateSchedule}
                    disabled={loadingStagger || (otbResult?.otb_summary.total_effective_otb || 0) <= 0}
                    className="w-full bg-amber-600 hover:bg-amber-500 text-white py-2.5 rounded text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {loadingStagger ? "Generating..." : "Generate Schedule"}
                  </button>
                </div>
              </div>

              {staggerSchedule.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="glass-panel p-5 h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={staggerSchedule} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                        <XAxis dataKey="day" tick={{ fill: "#71717a", fontSize: 12 }} />
                        <YAxis tick={{ fill: "#71717a", fontSize: 12 }} />
                        <Tooltip contentStyle={{ backgroundColor: "#18181b", borderColor: "#27272a", color: "#e4e4e7" }} itemStyle={{ color: "#fbbf24" }} />
                        <Bar dataKey="units_to_order" name="Units to Order" radius={[4, 4, 0, 0]}>
                          {staggerSchedule.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={index % 2 === 0 ? "#f59e0b" : "#d97706"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  
                  <div className="overflow-hidden glass-panel">
                    <div className="max-h-80 overflow-y-auto">
                      <table className="w-full text-sm text-left whitespace-nowrap">
                        <thead className="text-xs text-neutral-500 font-semibold tracking-wider uppercase bg-[#0A0A0A]/60 sticky top-0">
                          <tr><th className="px-4 py-3">Day</th><th className="px-4 py-3 text-right">Units</th><th className="px-4 py-3 text-right">Budget (₹ Cr)</th><th className="px-4 py-3 text-right">Cumulative</th></tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/50">
                          {staggerSchedule.map((row, i) => (
                            <tr key={i} className="hover:bg-white/5">
                              <td className="px-4 py-2 font-medium text-neutral-300">Day {row.day}</td>
                              <td className="px-4 py-2 text-right font-mono text-amber-400 font-bold">{row.units_to_order.toLocaleString("en-IN")}</td>
                              <td className="px-4 py-2 text-right font-mono text-neutral-400">₹{row.budget_crore.toFixed(2)}</td>
                              <td className="px-4 py-2 text-right font-mono text-neutral-400">{row.cumulative_units.toLocaleString("en-IN")}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {renderAllocationPanel()}
    </div>
  );
}
