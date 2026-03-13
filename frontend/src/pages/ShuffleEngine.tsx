import React, { useState, useEffect, useMemo } from "react";
import { RefreshCw, Package, Search, AlertCircle, Settings2, MapPin, CheckCircle, ArrowRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, Cell, ResponsiveContainer } from "recharts";
import { api } from "../services/api";
import {
  fetchAsmList,
  fetchStockDates,
  fetchModelsForAsm,
  runShuffle,
  RunShuffleParams
} from "../services/shuffle_otb_api";
import { AsmGroup, ModelOption, ShuffleRunResult } from "../types/shuffle_otb_types";

interface ShuffleEngineProps {
  onShuffleComplete?: (result: ShuffleRunResult) => void;
}

export default function ShuffleEngine({ onShuffleComplete }: ShuffleEngineProps) {
  // Global App State Options
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
  const [applyBrandAffinity, setApplyBrandAffinity] = useState(true);
  const [applyPriceAffinity, setApplyPriceAffinity] = useState(true);
  const [applyDow, setApplyDow] = useState(true);
  const [applyFestival, setApplyFestival] = useState(true);

  // Run State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ShuffleRunResult | null>(null);

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
    <div className="glass-panel p-5 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {/* ASM */}
        <div>
          <label className="block text-xs font-bold text-neutral-500 font-semibold tracking-wider uppercase tracking-wider mb-1">ASM</label>
          <select
            value={selectedAsm}
            onChange={(e) => setSelectedAsm(e.target.value)}
            className="w-full bg-transparent border border-white/10 text-neutral-200 text-sm rounded focus:ring-emerald-500 focus:border-emerald-500 p-2"
          >
            <option value="">Select ASM</option>
            {asmList.map((a) => <option key={a.asm_name} value={a.asm_name}>{a.asm_name}</option>)}
          </select>
        </div>

        {/* Brand */}
        <div>
          <label className="block text-xs font-bold text-neutral-500 font-semibold tracking-wider uppercase tracking-wider mb-1">Brand Filter</label>
          <select
            value={selectedBrand}
            onChange={(e) => {
              setSelectedBrand(e.target.value);
              setSelectedModelStr("");
            }}
            className="w-full bg-transparent border border-white/10 text-neutral-200 text-sm rounded focus:ring-emerald-500 focus:border-emerald-500 p-2"
          >
            <option value="">All Brands</option>
            {allBrands.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        {/* Model */}
        <div>
          <label className="block text-xs font-bold text-neutral-500 font-semibold tracking-wider uppercase tracking-wider mb-1">Model</label>
          <select
            value={selectedModelStr}
            onChange={(e) => setSelectedModelStr(e.target.value)}
            className="w-full bg-transparent border border-white/10 text-neutral-200 text-sm rounded focus:ring-emerald-500 focus:border-emerald-500 p-2"
            disabled={!selectedAsm || !predictionDate}
          >
            <option value="">{modelsForAsm.length > 0 ? "Select Model" : "Awaiting ASM..."}</option>
            {selectedBrand && modelsForAsm.length > 0 && (
              <option value={JSON.stringify({ im_code: "ALL", brand: selectedBrand, item_model: `All ${selectedBrand} Models`, display_label: `All ${selectedBrand} Models` })}>
                All {selectedBrand} Models
              </option>
            )}
            {visibleModels.map((m) => (
              <option key={m.im_code} value={JSON.stringify(m)}>{m.display_label}</option>
            ))}
          </select>
        </div>

        {/* Prediction Date */}
        <div>
          <label className="block text-xs font-bold text-neutral-500 font-semibold tracking-wider uppercase tracking-wider mb-1">Prediction Date</label>
          <select
            value={predictionDate}
            onChange={(e) => setPredictionDate(e.target.value)}
            className="w-full bg-transparent border border-white/10 text-neutral-200 text-sm rounded focus:ring-emerald-500 focus:border-emerald-500 p-2"
          >
            <option value="">Select Date</option>
            {stockDates.map((d) => {
              const dObj = new Date(d);
              return <option key={d} value={d}>{dObj.toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' })}</option>;
            })}
          </select>
        </div>
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
    return (
      <div className="bg-[#0A0A0A]/60 border border-white/10 rounded p-3 mb-6 flex flex-wrap justify-between items-center gap-4 text-sm">
        <div className="flex gap-4">
          <div><span className="text-neutral-400">ASM:</span> <span className="text-neutral-200 font-medium">{result.asm_name}</span></div>
          <div><span className="text-neutral-400">Model:</span> <span className="text-neutral-200 font-medium">{result.item_model}</span></div>
          <div><span className="text-neutral-400">Predicted from:</span> <span className="text-emerald-400 font-medium">{dt}</span></div>
        </div>
        <div className="text-xs text-neutral-400">
          Closing stock as of: <span className="text-neutral-400">{stockDt}</span> · 20-day MSP window
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
                <span>Stock: <span className="text-sky-300">{p.closing_stock}</span></span>
                <span>MSP: <span className="text-emerald-300">{p.msp_20d}</span></span>
              </div>
              <div className={`text-xs font-bold px-2 py-1 rounded bg-transparent inline-block mb-2 ${
                p.shortage > 0 ? 'text-red-400' : p.excess > 0 ? 'text-emerald-400' : 'text-neutral-400'
              }`}>
                Position: {p.position > 0 ? '+' : ''}{p.position}
              </div>
              <div className="text-[10px] text-neutral-400 mt-1">
                {p.shortage > 0 ? `Needs: ${p.shortage} units` : p.excess > 0 ? `Can donate: ${p.excess} units` : 'Balanced'}
              </div>
            </div>
          ))}
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
                      <div>[{dPos?.closing_stock} stock | {dPos?.msp_20d} MSP]</div>
                      <div className="mt-1 opacity-70">[+{dPos?.excess} excess]</div>
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
                      <div>[{rPos?.closing_stock} stock | {rPos?.msp_20d} MSP]</div>
                      <div className="mt-1 opacity-70">[−{rPos?.shortage} shortage]</div>
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
      stock: p.closing_stock,
      msp: p.msp_20d,
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
        <p className="text-neutral-400 mt-1 text-sm">ASM-level dynamic rebalancing pipeline.</p>
      </div>

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
            <button className="px-4 py-3 text-sm font-medium border-b-2 border-emerald-500 text-emerald-400">
              Shuffle Plan
            </button>
            <div className="px-4 py-3 text-sm font-medium text-neutral-400 border-b-2 border-transparent">
              OTB Results → Switch to OTB Tab
            </div>
            <div className="px-4 py-3 text-sm font-medium text-neutral-400 border-b-2 border-transparent">
              Positions View
            </div>
          </div>
          {renderShufflePlan()}
          {renderPositionsGraph()}
        </div>
      )}
    </div>
  );
}
