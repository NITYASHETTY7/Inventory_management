import { AlertCircle, ArrowRight, MapPin, Package, RefreshCw, Settings2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import CustomSelect from "../components/CustomSelect";
import ShuffleMap from "../components/ShuffleMap";
import { api } from "../services/api";
import {
  fetchAsmList,
  fetchModelsForAsm,
  fetchStockDates,
  runShuffle,
  RunShuffleParams
} from "../services/shuffle_otb_api";
import { AsmGroup, ModelOption, ShuffleRunResult } from "../types/shuffle_otb_types";

interface ShuffleEngineProps {
  onShuffleComplete?: (result: ShuffleRunResult) => void;
  onSwitchToOtb?: () => void;
}

// ─── Cross-ASM Tab ───────────────────────────────────────────────────────────
function CrossAsmPanel({ selectedAsm, predictionDate, asmList }: {
  selectedAsm: string; predictionDate: string; asmList: AsmGroup[];
}) {
  const [crossRecs, setCrossRecs] = useState<any[]>([]);
  const [loading, setLoading]     = useState(false);
  const [loaded, setLoaded]       = useState(false);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => { setLoaded(false); setCrossRecs([]); }, [selectedAsm, predictionDate]);

  const fetchAll = async () => {
  if (!selectedAsm) { setError('Please select an ASM first.'); return; }
  setLoading(true); setError(null);
  try {
    const BASE = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:8000/api';
    const weekParam = 'week_date=' + encodeURIComponent(predictionDate);
    const otherAsms = asmList.map(a => a.asm_name).filter(a => a !== selectedAsm);

    // Fetch MY ASM deficit-surplus
    const myRaw = await fetch(
      `${BASE}/shuffling/deficit-surplus?asm_name=${encodeURIComponent(selectedAsm)}&${weekParam}`
    ).then(r => r.json()).catch(() => []);
    const myData: any[] = Array.isArray(myRaw) ? myRaw : [];

    // Fetch all other ASMs
    const results = await Promise.all(
      otherAsms.map(asm =>
        Promise.all([
          fetch(`${BASE}/shuffling/deficit-surplus?asm_name=${encodeURIComponent(asm)}&${weekParam}`).then(r => r.json()).catch(() => []),
          fetch(`${BASE}/shuffling/classifications?asm_name=${encodeURIComponent(asm)}&${weekParam}`).then(r => r.json()).catch(() => []),
        ]).then(([rows, classes]) => ({
          asm,
          rows: Array.isArray(rows) ? rows : [],
          xmcModels: new Set((Array.isArray(classes) ? classes : []).filter((c: any) => c.classification === 'XMC').map((c: any) => c.im_code)),
        }))
      )
    );

    // Build surplus from MY ASM
    const surplusRows = myData.filter((r: any) => (r.surplus ?? 0) > 0);

    // Build deficit map from other ASMs
    const deficitMap: Record<string, any[]> = {};
    results.forEach(({ asm, rows, xmcModels }) => {
      rows.filter((r: any) => (r.deficit ?? 0) > 0).forEach((r: any) => {
        if (!deficitMap[r.im_code]) deficitMap[r.im_code] = [];
        deficitMap[r.im_code].push({ ...r, asm_name: asm, xmc_models: xmcModels });
      });
    });

    // Match surplus → deficit
    const recs: any[] = [];
    surplusRows.forEach((s: any) => {
      const matches = deficitMap[s.im_code];
      if (!matches?.length) return;
      matches.forEach((d: any) => {
        recs.push({
          from_branch: s.branch, from_asm: selectedAsm,
          to_branch: d.branch,   to_asm: d.asm_name,
          itemmodel: s.itemmodel, brand: s.brand,
          surplus_units: Math.ceil(s.surplus),
          deficit_units: Math.ceil(d.deficit),
          suggested_units: Math.min(Math.ceil(s.surplus), Math.ceil(d.deficit)),
          xmc_opportunity: d.xmc_models?.has(s.im_code) ?? false,
        });
      });
    });

    recs.sort((a, b) => {
      if (a.xmc_opportunity && !b.xmc_opportunity) return -1;
      if (!a.xmc_opportunity && b.xmc_opportunity) return 1;
      return b.suggested_units - a.suggested_units;
    });

    setCrossRecs(recs);
    setLoaded(true);
  } catch (e: any) {
    setError('Failed to load cross-ASM data: ' + e.message);
  } finally {
    setLoading(false);
  }
};

  const exportCsv = () => {
    if (!crossRecs.length) return;
    const keys = Object.keys(crossRecs[0]);
    const csv = [keys.join(','), ...crossRecs.map(r => keys.map(k => r[k] ?? '').join(','))].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'cross_asm_opportunities.csv'; a.click();
  };

  if (!loaded && !loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="text-4xl">🔀</div>
      <p className="text-neutral-400 text-sm text-center max-w-md">
        Detect models with surplus in one ASM that have high demand (XMC) in another ASM
      </p>
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <button onClick={fetchAll}
        className="px-6 py-2.5 rounded-lg bg-purple-500/20 border border-purple-500/40 text-purple-400 font-bold text-sm hover:bg-purple-500/30 transition-colors">
        🔍 Analyse Cross-ASM Opportunities
      </button>
    </div>
  );

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="w-8 h-8 border-2 border-white/10 border-t-purple-400 rounded-full animate-spin"/>
      <p className="text-neutral-500 text-xs">Scanning all ASMs for cross-ASM opportunities...</p>
    </div>
  );

  if (crossRecs.length === 0) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="text-4xl">✓</div>
      <p className="text-neutral-400 text-sm">No cross-ASM opportunities found in the last 30 days</p>
      <button onClick={() => { setLoaded(false); setCrossRecs([]); }}
        className="text-xs px-4 py-1.5 rounded-lg border border-white/10 text-neutral-400 hover:bg-white/5">
        ↺ Refresh
      </button>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Summary bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <span className="px-3 py-1.5 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-400 text-xs font-bold">
          🔀 {crossRecs.length} Cross-ASM Opportunities
        </span>
        <div className="ml-auto flex gap-2">
          <button onClick={() => { setLoaded(false); setCrossRecs([]); }}
            className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-neutral-400 hover:bg-white/5 transition-colors">
            ↺ Refresh
          </button>
          <button onClick={exportCsv}
            className="text-xs px-3 py-1.5 rounded-lg border border-amber-500/30 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 font-bold transition-colors">
            Export CSV ↓
          </button>
        </div>
      </div>

      {/* Fixed columns table */}
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-[#0A0A0A]/90 sticky top-0">
            <tr>
              {['From Branch','From ASM','To Branch','To ASM','Model','Brand','Surplus','Deficit','Move'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[10px] font-bold tracking-widest uppercase text-neutral-500 border-b border-white/10 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {crossRecs.map((r, i) => (
              <tr key={i} className={`border-b border-white/5 hover:bg-white/[0.03] transition-colors ${r.xmc_opportunity ? 'bg-purple-500/[0.04]' : ''}`}>
                <td className="px-4 py-3 text-xs text-neutral-200">{r.from_branch}</td>
                <td className="px-4 py-3 text-xs text-amber-400 font-bold">{r.from_asm}</td>
                <td className="px-4 py-3 text-xs text-neutral-200">{r.to_branch}</td>
                <td className="px-4 py-3 text-xs text-purple-400 font-bold">{r.to_asm}</td>
                <td className="px-4 py-3 text-xs text-neutral-200 font-mono">{r.itemmodel}</td>
                <td className="px-4 py-3 text-xs text-neutral-400">{r.brand}</td>
                <td className="px-4 py-3 text-xs text-emerald-400 font-bold font-mono">{r.surplus_units}</td>
                <td className="px-4 py-3 text-xs text-red-400 font-bold font-mono">{r.deficit_units}</td>
                <td className="px-4 py-3 text-xs">
                  <span className="text-sky-400 font-black font-mono text-sm">{r.suggested_units}</span>
                  {r.xmc_opportunity && <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30 font-bold">XMC</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ShuffleEngine({ onShuffleComplete, onSwitchToOtb }: ShuffleEngineProps) {
  // Global App State Options
  const [engineMode, setEngineMode] = useState<'asm'|'hub'>('asm');
  const [allBrands, setAllBrands] = useState<string[]>([]);
  const [asmList, setAsmList] = useState<AsmGroup[]>([]);
  const [stockDates, setStockDates] = useState<string[]>([]);

  // User Selection State
  const [selectedAsm, setSelectedAsm] = useState<string>("");
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [selectedModelStr, setSelectedModelStr] = useState<string>(""); // JSON string of ModelOption
  const [predictionDate, setPredictionDate] = useState<string>("");

  // Dynamic Options
  const [modelsForAsm, setModelsForAsm] = useState<ModelOption[]>([]);

  // MSP Weights
  const [showWeights, setShowWeights] = useState(false);
  const [w1, setW1] = useState(0.5);
  const [w2, setW2] = useState(0.3);
  const [w3, setW3] = useState(0.2);
  const [applyBrandAffinity, setApplyBrandAffinity] = useState(false);
  const [applyPriceAffinity, setApplyPriceAffinity] = useState(false);
  const [applyDow, setApplyDow] = useState(false);
  const [applyFestival, setApplyFestival] = useState(false);

  // Run State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ShuffleRunResult | null>(null);
  const [shuffleTab, setShuffleTab] = useState<'shuffle' | 'positions'| 'crossasm'>('shuffle');

  // Load initial filter data
  useEffect(() => {
    api.getBrands().then(setAllBrands).catch(console.error);
    fetchAsmList().then(setAsmList).catch(console.error);
    fetchStockDates().then((res) => {
      setStockDates(res.dates);
      if (res.dates.length > 0) {
        setPredictionDate(res.dates[res.dates.length - 1]); // default to latest
      }
    }).catch(console.error);
  }, []);

  // Reload models when ASM or Prediction Date changes
  useEffect(() => {
    if (selectedAsm && predictionDate) {
      fetchModelsForAsm(selectedAsm, predictionDate)
        .then((res) => {
          setModelsForAsm(res);
          // if previously selected model is not in new list, clear it
          if (selectedModelStr) {
            const current = JSON.parse(selectedModelStr) as ModelOption;
            if (!res.find((m) => m.im_code === current.im_code)) {
              setSelectedModelStr("");
            }
          }
        })
        .catch(console.error);
    } else {
      setModelsForAsm([]);
    }
  }, [selectedAsm, predictionDate]);

  const activeAsmObj = asmList.find((a) => a.asm_name === selectedAsm);
  const weightSum = w1 + w2 + w3;
  const isWeightValid = Math.abs(weightSum - 1.0) < 0.001;

  // Filter models by brand if a brand is selected
  const visibleModels = selectedBrand
    ? modelsForAsm.filter((m) => m.brand === selectedBrand)
    : modelsForAsm;

  const handleRun = async () => {
    if (!selectedAsm || !selectedModelStr || !predictionDate) {
      setError("Please select ASM, Model, and Prediction Date.");
      return;
    }
    if (!isWeightValid) {
      setError("Weights W1, W2, W3 must sum to exactly 1.0");
      return;
    }

    const modelObj = JSON.parse(selectedModelStr) as ModelOption;

    setLoading(true);
    setError(null);

    const params: RunShuffleParams = {
      asm_name: selectedAsm,
      brand: modelObj.brand,
      im_code: modelObj.im_code,
      prediction_date: predictionDate,
      w1, w2, w3,
      apply_brand_affinity: applyBrandAffinity,
      apply_price_affinity: applyPriceAffinity,
      apply_dow: applyDow,
      apply_festival: applyFestival,
    };

    try {
      const res = await runShuffle(params);
      setResult(res);
      if (onShuffleComplete) {
        onShuffleComplete(res);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Shuffle run failed");
    } finally {
      setLoading(false);
    }
  };


  const renderFilters = () => (
    <div className="glass-panel p-5 mb-6 relative z-50">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
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

      {activeAsmObj && (

        <div className="mb-4 flex flex-wrap gap-2 items-center">
          <span className="text-xs text-neutral-400">Branches in {selectedAsm}:</span>
          {activeAsmObj.branches.map(b => (
            <span key={b} className="bg-white/5 text-neutral-300 px-2 py-0.5 rounded text-xs border border-white/20">{b}</span>
          ))}
        </div>
      )}

      {/* Weights Panel */}
      <div className="border-t border-white/10 pt-4">
        <button
          onClick={() => setShowWeights(!showWeights)}
          className="flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-200 transition-colors mb-2"
        >
          <Settings2 size={16} /> MSP Weights {showWeights ? "▲" : "▼"}
        </button>
        
        {showWeights && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 glass-panel p-5">
            <div>
              <div className="flex justify-between text-xs mb-2">
                <span className="text-neutral-400">W1 (Last 7d)</span>
                <span className="text-neutral-200 font-mono">{w1.toFixed(2)}</span>
              </div>
              <input type="range" min="0" max="1" step="0.05" value={w1} onChange={e => setW1(parseFloat(e.target.value))} className="w-full accent-emerald-500 mb-4" />
              
              <div className="flex justify-between text-xs mb-2">
                <span className="text-neutral-400">W2 (Days 8-28)</span>
                <span className="text-neutral-200 font-mono">{w2.toFixed(2)}</span>
              </div>
              <input type="range" min="0" max="1" step="0.05" value={w2} onChange={e => setW2(parseFloat(e.target.value))} className="w-full accent-emerald-500 mb-4" />
              
              <div className="flex justify-between text-xs mb-2">
                <span className="text-neutral-400">W3 (Days 29-60)</span>
                <span className="text-neutral-200 font-mono">{w3.toFixed(2)}</span>
              </div>
              <input type="range" min="0" max="1" step="0.05" value={w3} onChange={e => setW3(parseFloat(e.target.value))} className="w-full accent-emerald-500" />
              
              <div className={`mt-2 text-xs font-bold ${isWeightValid ? 'text-emerald-500' : 'text-red-500'}`}>
                Sum: {weightSum.toFixed(2)} {isWeightValid ? "✓" : "⚠️ Must = 1.0"}
              </div>
            </div>
            
            <div className="space-y-3">
              {[
                { label: "Brand Affinity", val: applyBrandAffinity, set: setApplyBrandAffinity },
                { label: "Price Affinity", val: applyPriceAffinity, set: setApplyPriceAffinity },
                { label: "Day of Week (DOW)", val: applyDow, set: setApplyDow },
                { label: "Festival Multiplier", val: applyFestival, set: setApplyFestival }
              ].map((t) => (
                <label key={t.label} className="flex items-center gap-3 text-sm text-neutral-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={t.val}
                    onChange={(e) => t.set(e.target.checked)}
                    className="rounded bg-[#0A0A0A]/60 border-white/20 text-emerald-500 focus:ring-emerald-500"
                  />
                  {t.label}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      <button
        onClick={handleRun}
        disabled={loading || !isWeightValid}
        className="w-full mt-4 flex justify-center items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded text-sm font-medium transition-colors disabled:opacity-50"
      >
        {loading ? <RefreshCw size={16} className="animate-spin" /> : <Package size={16} />}
        {loading ? "Running Engine..." : "Run Shuffle Engine"}
      </button>
    </div>
  );

  const renderResultHeader = () => {
    if (!result) return null;
    const dt = new Date(result.prediction_date).toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' });
    const stockDt = new Date(result.closing_stock_date_used).toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' });
    
    // Financial Metrics
    const formatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
    const moneySaved = result.otb_summary.money_saved_from_shuffle || 0;
    const otbSaved = result.otb_summary.otb_value_saved || 0;
    const totalUnits = result.shuffle_result.summary.total_units_moving || 0;
    const totalRequests = result.shuffle_result.summary.total_transfers || 0;

    return (
      <div className="mb-6 space-y-4">
        <div className="bg-[#0A0A0A]/60 border border-white/10 rounded p-3 flex flex-wrap justify-between items-center gap-4 text-sm">
          <div className="flex gap-4">
            <div><span className="text-neutral-400">ASM:</span> <span className="text-neutral-200 font-medium">{result.asm_name}</span></div>
            <div><span className="text-neutral-400">Model:</span> <span className="text-neutral-200 font-medium">{result.item_model}</span></div>
            <div><span className="text-neutral-400">Predicted from:</span> <span className="text-emerald-400 font-medium">{dt}</span></div>
          </div>
          <div className="text-xs text-neutral-400">
            Closing stock as of: <span className="text-neutral-400">{stockDt}</span> · 20-day MSP window
          </div>
        </div>
        
        {/* Financial Impact Panel */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded p-4 flex flex-col items-center justify-center text-center">
            <span className="text-xs text-emerald-400 font-semibold uppercase tracking-wider mb-1">Total Units Shuffled</span>
            <span className="text-2xl font-mono text-emerald-50">{totalUnits}</span>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded p-4 flex flex-col items-center justify-center text-center">
            <span className="text-xs text-emerald-400 font-semibold uppercase tracking-wider mb-1">Transfer Requests</span>
            <span className="text-2xl font-mono text-emerald-50">{totalRequests}</span>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded p-4 flex flex-col items-center justify-center text-center">
            <span className="text-xs text-amber-400 font-semibold uppercase tracking-wider mb-1">Money Saved via Shuffle</span>
            <span className="text-xl md:text-2xl font-mono text-amber-50">{formatter.format(moneySaved)}</span>
          </div>
        </div>
      </div>
    );
  };

  const renderShufflePlan = () => {
    if (!result) return null;
    const { positions, shuffle_result } = result;

    return (
      <div className="space-y-6">
        {shuffle_result.edge_cases.warning_message && (
          <div className={`p-4 rounded border text-sm font-medium flex items-center gap-2 ${
            shuffle_result.edge_cases.no_shuffle_possible 
              ? (shuffle_result.edge_cases.all_excess ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-400')
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
          }`}>
            <AlertCircle size={16} /> {shuffle_result.edge_cases.warning_message}
          </div>
        )}

        <div className="flex overflow-x-auto gap-4 pb-2 snap-x">
          {positions.map((p, i) => (
            <div key={i} className={`min-w-[200px] shrink-0 snap-start bg-[#0A0A0A]/60 p-4 rounded-lg border-y border-r border-l-4 ${
              p.shortage > 0 ? 'border-l-red-500 border-white/10' : p.excess > 0 ? 'border-l-emerald-500 border-white/10' : 'border-white/10'
            }`}>
              <div className="font-medium text-neutral-200 mb-2 truncate" title={p.branch}>{p.branch}</div>
              <div className="flex justify-between text-xs text-neutral-400 font-mono mb-2">
                <span>Stock: <span className="text-sky-300">{Number(p.closing_stock).toFixed(1)}</span></span>
                <span>MSP: <span className="text-emerald-300">{Number(p.msp_20d).toFixed(1)}</span></span>
              </div>
              <div className={`text-xs font-bold px-2 py-1 rounded bg-transparent inline-block mb-2 ${
                p.shortage > 0 ? 'text-red-400' : p.excess > 0 ? 'text-emerald-400' : 'text-neutral-400'
              }`}>
                Position: {p.position > 0 ? '+' : ''}{Number(p.position).toFixed(1)}
              </div>
              <div className="text-[10px] text-neutral-400 mt-1">
                {p.shortage > 0 ? `Needs: ${Number(p.shortage).toFixed(1)} units` : p.excess > 0 ? `Can donate: ${Number(p.excess).toFixed(1)} units` : 'Balanced'}
              </div>
            </div>
          ))}
        </div>

        <div className="glass-panel p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <MapPin size={18} className="text-emerald-400" />
            <h4 className="text-sm font-medium text-neutral-200">Geographic Shuffle Routing</h4>
          </div>
          <div className="h-[450px] w-full rounded-xl overflow-hidden border border-white/10 relative">
            {shuffle_result.transfers.length > 0 ? (
              <ShuffleMap transfers={shuffle_result.transfers} />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-neutral-500 italic text-sm z-10">
                No transfers required on the map.
              </div>
            )}
          </div>
        </div>

        <div className="bg-[#0A0A0A]/60 border border-white/10 rounded p-6">
          <h4 className="text-sm font-medium text-neutral-400 mb-4">Transfer Flow Diagram</h4>
          {shuffle_result.transfers.length === 0 ? (
            <div className="text-neutral-500 text-sm italic py-4">No transfers needed or possible.</div>
          ) : (
            <div className="space-y-4">
              {shuffle_result.transfers.map((t, i) => {
                const dPos = positions.find(p => p.branch === t.from_branch);
                const rPos = positions.find(p => p.branch === t.to_branch);
                return (
                  <div key={i} className="flex items-center gap-4 text-xs font-mono">
                    <div className="w-1/3 bg-emerald-500/10 border border-emerald-500/30 rounded p-2 text-emerald-400">
                      <div className="font-bold text-sm truncate">{t.from_branch}</div>
                      <div>[{Number(dPos?.closing_stock || 0).toFixed(1)} stock | {Number(dPos?.msp_20d || 0).toFixed(1)} MSP]</div>
                      <div className="mt-1 opacity-70">[+{Number(dPos?.excess || 0).toFixed(1)} excess]</div>
                    </div>
                    
                    <div className="w-1/3 flex flex-col items-center justify-center text-center">
                      <div className="text-sky-400 font-bold mb-1">{t.quantity} units</div>
                      <div className="text-[10px] text-neutral-400 mb-1 leading-tight px-1 break-words line-clamp-2 max-w-[120px]">
                        {(t as any).item_model ? (t as any).item_model.split('-')[0].trim() : result.item_model.split('-')[0].trim()}
                      </div>
                      <div className="flex items-center w-full">
                        <div className="flex-1 h-px bg-sky-500/50"></div>
                        <ArrowRight size={14} className="text-sky-500 -ml-1" />
                      </div>
                      {t.distance_km > 0 && (
                        <div className="text-[10px] text-neutral-400 mt-1">{t.distance_km} km · {t.drive_minutes} min</div>
                      )}
                    </div>

                    <div className="w-1/3 bg-red-500/10 border border-red-500/30 rounded p-2 text-red-400">
                      <div className="font-bold text-sm truncate">{t.to_branch}</div>
                      <div>[{Number(rPos?.closing_stock || 0).toFixed(1)} stock | {Number(rPos?.msp_20d || 0).toFixed(1)} MSP]</div>
                      <div className="mt-1 opacity-70">[−{Number(rPos?.shortage || 0).toFixed(1)} shortage]</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderPositionsGraph = () => {
    if (!result) return null;
    const { positions } = result;

    const chartData = positions.map(p => ({
      name: p.branch.substring(0, 15) + (p.branch.length > 15 ? '...' : ''),
      stock: Number(p.closing_stock.toFixed(1)),
      msp: Number(p.msp_20d.toFixed(1)),
    }));

    return (
      <div className="bg-[#0A0A0A]/60 border border-white/10 rounded p-4 h-96 mt-6">
        <h4 className="text-sm font-medium text-neutral-400 mb-4">Stock vs MSP Grouped View</h4>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: "#71717a", fontSize: 10 }} angle={-45} textAnchor="end" />
            <YAxis tick={{ fill: "#71717a", fontSize: 10 }} />
            <Tooltip contentStyle={{ backgroundColor: "#18181b", borderColor: "#27272a", color: "#e4e4e7" }} />
            <Legend verticalAlign="top" height={36} />
            <Bar dataKey="stock" name="Closing Stock" fill="#0ea5e9" radius={[2, 2, 0, 0]} />
            <Bar dataKey="msp" name="MSP 20d" fill="#10b981" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  return (
    <div className="p-6 bg-transparent min-h-screen text-neutral-200">

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <RefreshCw className="text-emerald-500" /> Advanced Shuffle Engine
        </h1>
        <p className="text-neutral-400 mt-1 text-sm">Dynamic rebalancing pipeline.</p>
        
        <div className="flex gap-2 mt-6 border-b border-white/10 pb-2">
          <button 
            onClick={() => setEngineMode('asm')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${engineMode === 'asm' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-neutral-400 hover:bg-white/5'}`}
          >
            ASM-Level Shuffle
          </button>
          <button 
            onClick={() => setEngineMode('hub')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${engineMode === 'hub' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-neutral-400 hover:bg-white/5'}`}
          >
            Hub-Level Shuffle
          </button>
        </div>
      </div>

      {engineMode === 'hub' && (
        <div className="flex flex-col items-center justify-center py-20 px-4 glass-panel text-center">
          <MapPin size={48} className="text-emerald-500/50 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Hub-Level Shuffle Engine</h2>
          <p className="text-neutral-400 max-w-md mx-auto">
            This module will compute broad inventory rebalancing between regional distribution hubs. Currently in development.
          </p>
        </div>
      )}

      {engineMode === 'asm' && (
        <>
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded mb-6 flex items-center gap-3 text-sm">
              <AlertCircle size={18} /> {error}
            </div>
          )}

          {renderFilters()}


      {result && (
        <div className="mt-8 animate-in fade-in slide-in-from-bottom-4">
          {renderResultHeader()}
          <div className="mb-6 border-b border-white/5 flex gap-1">
  <button
    onClick={() => setShuffleTab('shuffle')}
    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
      shuffleTab === 'shuffle' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-neutral-400 hover:text-neutral-200'
    }`}
  >
    Shuffle Plan
  </button>
  <button
  onClick={() => onSwitchToOtb?.()}
  className="px-4 py-3 text-sm font-medium border-b-2 border-transparent text-neutral-400 hover:text-amber-400 transition-colors"
>
  OTB Results → Switch to OTB Tab
</button>
  <button
    onClick={() => setShuffleTab('positions')}
    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
      shuffleTab === 'positions' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-neutral-400 hover:text-neutral-200'
    }`}
  >
    Positions View
  </button>
  
<button
  onClick={() => setShuffleTab('crossasm')}
  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
    shuffleTab === 'crossasm' ? 'border-purple-500 text-purple-400' : 'border-transparent text-neutral-400 hover:text-neutral-200'
  }`}
>
  🔀 Cross-ASM
</button>
</div>

{shuffleTab === 'shuffle' && renderShufflePlan()}
{shuffleTab === 'shuffle' && renderPositionsGraph()}
{shuffleTab === 'positions' && result && (
  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
    {result.positions.map((p, i) => {
      const borderColor = p.shortage > 0
        ? 'border-red-500/30'
        : p.excess > 0
        ? 'border-emerald-500/30'
        : 'border-white/10';
      return (
        <div key={i} className={`bg-transparent rounded p-3 border ${borderColor}`}>
          <div className="text-xs font-medium mb-2 truncate text-neutral-300" title={p.branch}>{p.branch}</div>
          <div className="grid grid-cols-2 gap-2 text-xs mb-2">
            <div>
              <div className="text-neutral-500 text-[10px] uppercase">Stock</div>
              <div className="font-mono text-neutral-400">{Number(p.closing_stock).toFixed(1)}</div>
            </div>
            <div>
              <div className="text-neutral-500 text-[10px] uppercase">MSP</div>
              <div className="font-mono text-neutral-400">{Number(p.msp_20d).toFixed(2)}</div>
            </div>
          </div>
          <div className="mt-1">
            {p.excess > 0 ? (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400">
                +{p.excess.toLocaleString('en-IN')} Excess
              </span>
            ) : p.shortage > 0 ? (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-500/10 text-red-400">
                -{p.shortage.toLocaleString('en-IN')} Short
              </span>
            ) : (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/5 text-neutral-400">
                Balanced
              </span>
            )}
          </div>
        </div>
      );
    })}
  </div>
)}

{shuffleTab === 'crossasm' && (
  <CrossAsmPanel
    selectedAsm={selectedAsm}
    predictionDate={predictionDate}
    asmList={asmList}
  />
)}
  
        </div>
      )}
        </>
      )}
    </div>
  );
}
