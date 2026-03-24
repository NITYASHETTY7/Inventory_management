import { BarChart3, Rocket, Store } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import CustomSelect from '../components/CustomSelect';
import { HypeCurvePreview } from '../components/HypeCurvePreview';
import { LookalikeSuggestionCard } from '../components/LookalikeSuggestionCard';
import { api } from '../services/api';
import { computeLookalikeMsp, fetchModelCatalog, sendToOtb, suggestLookalikes, suggestStoreProximity } from '../services/lookalike_api';
import { fetchAsmList, fetchStockDates } from '../services/shuffle_otb_api';
import { LookalikeMspRequest, LookalikeMspResult, LookalikeSuggestion, LookalikScenario, ModelCatalogItem, StoreProximitySuggestion } from '../types/lookalike_types';

export const LookalikePage: React.FC<{ onOtbGenerated?: (res: any) => void; initialScenario?: 'new_model' | 'new_store' | 'sparse_data' }> = ({ onOtbGenerated, initialScenario }) => {
  const [scenario, setScenario] = useState<LookalikScenario>(initialScenario || 'new_model');
  const [catalog, setCatalog] = useState<ModelCatalogItem[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [stockDates, setStockDates] = useState<string[]>([]);
  const [asmList, setAsmList] = useState<string[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [computing, setComputing] = useState(false);
  
  // New Model Form
  const [targetBrand, setTargetBrand] = useState('');
  const [targetModel, setTargetModel] = useState('');
  const [targetMop, setTargetMop] = useState<number>(15000);
  const [daysSinceLaunch, setDaysSinceLaunch] = useState(0);
  const [targetBranch, setTargetBranch] = useState('');
  
  // New Store Form
  const [newStoreLat, setNewStoreLat] = useState<number>(11.0168);
  const [newStoreLon, setNewStoreLon] = useState<number>(76.9558);
  
  // Sparse Data Form
  const [sparseTolerance, setSparseTolerance] = useState<number>(5000);
  
  // Suggestions
  const [suggestions, setSuggestions] = useState<LookalikeSuggestion[]>([]);
  const [storeSuggestions, setStoreSuggestions] = useState<StoreProximitySuggestion[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);
  
  // Parameters
  const [w1, setW1] = useState(0.5);
  const [w2, setW2] = useState(0.3);
  const [w3, setW3] = useState(0.2);
  const [predictionDate, setPredictionDate] = useState('');
  const [applyBrandAff, setApplyBrandAff] = useState(true);
  const [applyPriceAff, setApplyPriceAff] = useState(true);
  const [applyDow, setApplyDow] = useState(true);
  const [applyFest, setApplyFest] = useState(true);
  
  // Hype
  const [brandTier, setBrandTier] = useState<"premium"|"budget">("budget");
  const [peakHype, setPeakHype] = useState(2.5);
  const [hypeDuration, setHypeDuration] = useState(14);
  const [isDirectSucc, setIsDirectSucc] = useState(false);
  
  // Result
  const [result, setResult] = useState<LookalikeMspResult | null>(null);
  const [selectedAsm, setSelectedAsm] = useState('');
  const [asmGroups, setAsmGroups] = useState<any[]>([]);
  const [otbSent, setOtbSent] = useState(false);

  useEffect(() => {
    fetchModelCatalog().then(setCatalog).catch(console.error);
    api.getBranches().then(b => { setBranches(b); if(b.length) setTargetBranch(b[0]); }).catch(console.error);
    api.getBrands().then(b => { setBrands(b); if(b.length) setTargetBrand(b[0]); }).catch(console.error);
    fetchStockDates().then(d => { setStockDates(d.dates); if(d.dates.length) setPredictionDate(d.dates[0]); }).catch(console.error);
    fetchAsmList().then(a => { const names = a.map(x => x.asm_name); setAsmList(names); if(names.length) setSelectedAsm(names[0]); setAsmGroups(a); }).catch(console.error);
  }, []);

  useEffect(() => {
    if (['Apple', 'Samsung'].includes(targetBrand)) setBrandTier('premium');
    else setBrandTier('budget');
  }, [targetBrand]);

  useEffect(() => {
    if (!targetBranch || asmGroups.length === 0) return;
    const match = asmGroups.find(a =>
      a.branches && a.branches.some((b: string) => b.trim().toLowerCase() === targetBranch.trim().toLowerCase())
    );
    if (match) setSelectedAsm(match.asm_name);
  }, [targetBranch, asmGroups]);

  const handleScenarioSwitch = (s: LookalikScenario) => {
    setScenario(s);
    setSuggestions([]);
    setStoreSuggestions([]);
    setSelectedSuggestion(null);
    setResult(null);
  };

  const handleSuggest = async () => {
    setLoading(true);
    try {
      if (scenario === 'new_store') {
        const res = await suggestStoreProximity({ new_branch_lat: newStoreLat, new_branch_lon: newStoreLon, top_n: 3 });
        setStoreSuggestions(res);
      } else {
        const res = await suggestLookalikes({
          target_im_code: targetModel,
          target_brand: targetBrand,
          target_mop: targetMop,
          scenario,
          price_band_tolerance: sparseTolerance
        });
        setSuggestions(res);
        if (res.length > 0) {
          setSelectedSuggestion(res[0].im_code);
          if (res[0].is_direct_successor) {
            setIsDirectSucc(true);
            setHypeDuration(21);
            setPeakHype(3.0);
          } else {
            setIsDirectSucc(false);
            setHypeDuration(14);
            setPeakHype(2.5);
          }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCompute = async () => {
    setComputing(true);
    setOtbSent(false);
    try {
      let reqImCodes: string[] = [];
      let reqWeights: number[] = [];
      
      if (scenario === 'new_store') {
        reqImCodes = storeSuggestions.map(s => s.branch);
        reqWeights = storeSuggestions.map(s => s.weight);
      } else {
        if (!selectedSuggestion) return;
        reqImCodes = [selectedSuggestion];
        reqWeights = [1.0];
      }

      const req: LookalikeMspRequest = {
        scenario,
        target_branch: targetBranch,
        target_im_code: targetModel || "Unknown",
        target_brand: targetBrand,
        target_mop: targetMop,
        days_since_launch: daysSinceLaunch,
        is_direct_successor: isDirectSucc,
        lookalike_im_codes: reqImCodes,
        lookalike_weights: reqWeights,
        prediction_date: predictionDate || new Date().toISOString().split('T')[0],
        hype_duration_days: hypeDuration,
        peak_multiplier: peakHype,
        w1, w2, w3,
        apply_brand_affinity: applyBrandAff,
        apply_price_affinity: applyPriceAff,
        apply_dow: applyDow,
        apply_festival: applyFest
      };
      
      const res = await computeLookalikeMsp(req);
      setResult(res);
    } catch (e) {
      console.error(e);
    } finally {
      setComputing(false);
    }
  };

  const sendOtb = async () => {
    if (!result || !selectedAsm) return;
    try {
      const res = await sendToOtb({ lookalike_result: result, asm_name: selectedAsm });
      setOtbSent(true);
      if (onOtbGenerated) onOtbGenerated(res);
    } catch (e) {
      console.error(e);
    }
  };

  const wSum = w1 + w2 + w3;
  const isWValid = Math.abs(wSum - 1.0) < 0.01;

  // Render ...
  return (
    <div className="p-6 space-y-6 text-zinc-100 max-w-7xl mx-auto">
      <header>
        <h1 className="text-2xl font-bold">Lookalike Intelligence</h1>
        <p className="text-zinc-400">Predict sales for new models and stores using historical pattern matching.</p>
      </header>

      {/* Scenario Header - no switching cards */}
      <div className="flex items-center gap-3 p-4 rounded-xl border bg-sky-950/30 border-sky-500 ring-1 ring-sky-500 w-fit">
        <div className="p-2 w-10 h-10 rounded-lg flex items-center justify-center bg-sky-500/20 text-sky-400">
          {scenario === 'new_model' ? <Rocket size={20} /> : scenario === 'new_store' ? <Store size={20} /> : <BarChart3 size={20} />}
        </div>
        <div>
          <h3 className="font-bold text-lg">
            {scenario === 'new_model' ? 'New Model Launch' : scenario === 'new_store' ? 'New Store Opening' : 'Sparse Data Fallback'}
          </h3>
          <p className="text-sm text-zinc-400">
            {scenario === 'new_model' ? 'No history for this model yet. Use a predecessor.' : scenario === 'new_store' ? 'Brand new branch, borrow pattern from nearby stores.' : 'Model exists but < 14 days of sales. Use price+brand similar models.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left Form */}
        <div className="col-span-4 space-y-4 bg-zinc-900 p-5 rounded-xl border border-zinc-800 relative z-50">
          <h2 className="font-semibold text-lg border-b border-zinc-800 pb-3">Target Details</h2>
          
          {scenario !== 'new_store' && (
            <>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Launch Branch <span className="text-zinc-600">(used to identify ASM territory)</span></label>
                <CustomSelect label="" value={targetBranch} options={branches} onChange={setTargetBranch} placeholder="Select Branch" />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Brand</label>
                <CustomSelect label="" value={targetBrand} options={brands} onChange={setTargetBrand} placeholder="Select Brand" />
              </div>
              {scenario === 'sparse_data' ? (
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Model (Sparse)</label>
                  <CustomSelect label="" value={targetModel} options={[...new Map(catalog.filter(c => c.brand === targetBrand && c.days_of_data < 14).map(c => [c.item_model, c.im_code])).values()]} onChange={(v) => {
                    setTargetModel(v);
                    const cat = catalog.find(c => c.im_code === v);
                    if(cat) setTargetMop(cat.mop);
                  }} placeholder="Select Model" formatLabel={(val) => {
                    const cat = catalog.find(c => c.im_code === val);
                    return cat ? `${cat.item_model} (${cat.days_of_data}d)` : val;
                  }} />
                </div>
              ) : (
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">New Model Name</label>
                  <input type="text" className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-sm" placeholder="e.g. Galaxy A16" value={targetModel} onChange={e=>setTargetModel(e.target.value)} />
                </div>
              )}
              <div>
                <label className="block text-xs text-zinc-400 mb-1">MOP (₹)</label>
                <input type="number" className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-sm" value={targetMop} onChange={e=>setTargetMop(Number(e.target.value))} />
              </div>
              {scenario === 'new_model' && (
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Days Since Launch</label>
                  <input type="number" className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-sm" value={daysSinceLaunch} onChange={e=>setDaysSinceLaunch(Number(e.target.value))} />
                </div>
              )}
              {scenario === 'sparse_data' && (
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Price Tolerance (±₹)</label>
                  <input type="range" min="1000" max="10000" step="1000" className="w-full accent-emerald-500" value={sparseTolerance} onChange={e=>setSparseTolerance(Number(e.target.value))} />
                  <div className="text-right text-xs text-zinc-500 mt-1">±₹{sparseTolerance.toLocaleString()}</div>
                </div>
              )}
            </>
          )}

          {scenario === 'new_store' && (
            <>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">New Branch Name</label>
                <input type="text" className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-sm" placeholder="e.g. Sholinganallur" value={targetBranch} onChange={e=>setTargetBranch(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs text-zinc-400 mb-1">Lat</label>
                  <input type="number" className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-sm" value={newStoreLat} onChange={e=>setNewStoreLat(Number(e.target.value))} />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-zinc-400 mb-1">Lon</label>
                  <input type="number" className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-sm" value={newStoreLon} onChange={e=>setNewStoreLon(Number(e.target.value))} />
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-zinc-800">
                <label className="block text-xs text-zinc-400 mb-1">Brand</label>
                <div className="mb-3"><CustomSelect label="" value={targetBrand} options={brands} onChange={setTargetBrand} placeholder="Select Brand" /></div>
                <label className="block text-xs text-zinc-400 mb-1">Model to predict</label>
                <CustomSelect label="" value={targetModel} options={[...new Map(catalog.filter(c => c.brand === targetBrand).map(c => [c.item_model, c.im_code])).values()]} onChange={(v) => {
                    setTargetModel(v);
                    const cat = catalog.find(c => c.im_code === v);
                    if(cat) setTargetMop(cat.mop);
                  }} placeholder="Select Model" formatLabel={(val) => {
                    const cat = catalog.find(c => c.im_code === val);
                    return cat ? cat.item_model : val;
                  }} />
              </div>
            </>
          )}

          <button 
            className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-sm font-medium rounded-lg mt-4 transition-colors"
            onClick={handleSuggest}
            disabled={loading}
          >
            {loading ? 'Finding...' : scenario === 'new_store' ? 'Find Nearby Stores' : 'Auto-Suggest Lookalikes'}
          </button>
        </div>

        {/* Right Suggestions */}
        <div className="col-span-8 space-y-4">
          <div className="bg-zinc-900 p-5 rounded-xl border border-zinc-800 min-h-[300px]">
            <h2 className="font-semibold text-lg border-b border-zinc-800 pb-3 mb-4">Lookalike Selection</h2>
            
            {scenario !== 'new_store' && suggestions.length > 0 && (
              <div className="space-y-3">
                {suggestions.map((s, i) => (
                  <LookalikeSuggestionCard
                    key={s.im_code}
                    rank={i+1}
                    {...s}
                    isSelected={selectedSuggestion === s.im_code}
                    onSelect={() => setSelectedSuggestion(s.im_code)}
                  />
                ))}
              </div>
            )}

            {scenario === 'new_store' && storeSuggestions.length > 0 && (
              <div className="space-y-3">
                {storeSuggestions.map((s, i) => (
                  <div key={s.branch} className="p-4 bg-zinc-950 rounded-lg border border-zinc-800 flex items-center justify-between">
                    <div>
                      <div className="font-medium">{s.branch}</div>
                      <div className="text-xs text-zinc-500">{s.distance_km} km away</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-sky-400">Weight: {(s.weight * 100).toFixed(0)}%</div>
                      <div className="w-32 h-2 bg-zinc-800 rounded-full mt-1 overflow-hidden">
                        <div className="h-full bg-sky-500" style={{width: `${s.weight * 100}%`}}></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {suggestions.length === 0 && storeSuggestions.length === 0 && (
              <div className="flex items-center justify-center h-48 text-zinc-500 text-sm">
                Fill target details and click "Auto-Suggest"
              </div>
            )}
          </div>
          
          {scenario === 'new_model' && (
            <div className="bg-zinc-900 p-5 rounded-xl border border-zinc-800 relative z-40">
              <h2 className="font-semibold text-sm text-zinc-400 mb-4">Hype Parameters</h2>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs mb-1">Brand Tier</label>
                    <div className="flex gap-2">
                      <button className={`flex-1 py-1.5 text-xs rounded border ${brandTier==='premium'?'bg-amber-500/20 text-amber-400 border-amber-500/50':'bg-zinc-800 border-zinc-700'}`} onClick={()=>setBrandTier('premium')}>Premium 🔥</button>
                      <button className={`flex-1 py-1.5 text-xs rounded border ${brandTier==='budget'?'bg-zinc-200 text-zinc-900 border-zinc-300':'bg-zinc-800 border-zinc-700'}`} onClick={()=>setBrandTier('budget')}>Budget</button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs mb-1">Peak Multiplier: {peakHype}×</label>
                    <input type="range" min="1" max="4" step="0.1" className="w-full accent-amber-500" value={peakHype} onChange={e=>setPeakHype(Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="block text-xs mb-1">Duration: {hypeDuration} days</label>
                    <input type="range" min="7" max="28" step="1" className="w-full accent-amber-500" value={hypeDuration} onChange={e=>setHypeDuration(Number(e.target.value))} />
                  </div>
                </div>
                <div>
                  <HypeCurvePreview brandTier={brandTier} peakMultiplier={peakHype} hypeDurationDays={hypeDuration} height={120} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Common Parameters & Compute Button */}
      <div className="bg-zinc-900 p-5 rounded-xl border border-zinc-800 relative z-40">
        <div className="flex gap-6 items-center">
          <div className="flex-1">
            <label className="block text-xs text-zinc-400 mb-1">Prediction Start Date</label>
            <CustomSelect label="" value={predictionDate} options={stockDates} onChange={setPredictionDate} placeholder="Select Date" />
          </div>
          
          <div className="flex-[2] grid grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] text-zinc-500">W1 (Last 7d)</label>
              <input type="number" step="0.1" className="w-full bg-transparent border-b border-zinc-700 text-sm focus:outline-none" value={w1} onChange={e=>setW1(Number(e.target.value))} />
            </div>
            <div>
              <label className="block text-[10px] text-zinc-500">W2 (8-28d)</label>
              <input type="number" step="0.1" className="w-full bg-transparent border-b border-zinc-700 text-sm focus:outline-none" value={w2} onChange={e=>setW2(Number(e.target.value))} />
            </div>
            <div>
              <label className="block text-[10px] text-zinc-500">W3 (29-60d)</label>
              <input type="number" step="0.1" className="w-full bg-transparent border-b border-zinc-700 text-sm focus:outline-none" value={w3} onChange={e=>setW3(Number(e.target.value))} />
            </div>
            {!isWValid && <div className="col-span-3 text-[10px] text-red-400">Weights must sum to 1.0</div>}
          </div>

          <div className="flex-[2] grid grid-cols-2 gap-y-2 text-xs">
            <label className="flex items-center gap-2"><input type="checkbox" checked={applyBrandAff} onChange={e=>setApplyBrandAff(e.target.checked)} className="accent-emerald-500" /> Brand Affinity</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={applyPriceAff} onChange={e=>setApplyPriceAff(e.target.checked)} className="accent-emerald-500" /> Price Affinity</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={applyDow} onChange={e=>setApplyDow(e.target.checked)} className="accent-emerald-500" /> DOW Pattern</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={applyFest} onChange={e=>setApplyFest(e.target.checked)} className="accent-emerald-500" /> Festival Scale</label>
          </div>

          <div className="flex-1">
            <button 
              className={`w-full py-3 rounded-lg font-bold text-sm transition-colors ${!isWValid ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-purple-600 text-white hover:bg-purple-500'}`}
              disabled={!isWValid || computing}
              onClick={handleCompute}
            >
              {computing ? 'Generating...' : 'Generate Lookalike MSP'}
            </button>
          </div>
        </div>
      </div>

      {/* Results Rendering */}
      {result && (
        <div className="bg-zinc-950 p-6 rounded-xl border border-zinc-800 space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold mb-1">Lookalike MSP for {result.target.item_model} at {result.target.branch}</h2>
              <div className="text-sm text-zinc-400">
                Prediction window: 20 days from {predictionDate} &middot; Price band: {result.target.price_band}
              </div>
              <div className="text-sm text-emerald-400 mt-1">
                Brand Affinity: {result.multipliers_applied.brand_affinity}× &middot; Price Affinity: {result.multipliers_applied.price_affinity}×
              </div>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1 ${
              result.confidence === 'HIGH' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
              result.confidence === 'MEDIUM' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
              'bg-red-500/10 text-red-400 border-red-500/20'
            }`}>
              {result.confidence} CONFIDENCE
            </div>
          </div>

          {result.target.is_direct_successor && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-sm text-amber-400 flex items-center gap-2">
              <span>⭐</span>
              <strong>Direct Successor Detected:</strong> Hype defaults applied automatically.
            </div>
          )}

          {/* Cards */}
          <div className="grid grid-cols-5 gap-4">
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
              <div className="text-xs text-zinc-500 uppercase tracking-wide">Base WMA</div>
              <div className="text-xl font-medium mt-1 text-zinc-300">{Math.round(result.base_msp_20d_total)}</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
              <div className="text-xs text-emerald-500 uppercase tracking-wide">With Affinity</div>
              <div className="text-xl font-medium mt-1 text-emerald-400">{Math.round(result.affinity_msp_20d_total)}</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
              <div className="text-xs text-amber-500 uppercase tracking-wide">Hype Uplift</div>
              <div className="text-xl font-medium mt-1 text-amber-400">+{Math.round(result.hype_uplift)}</div>
            </div>
            <div className="bg-purple-900/20 border border-purple-500/30 p-4 rounded-xl">
              <div className="text-xs text-purple-400 uppercase tracking-wide font-bold">Final MSP</div>
              <div className="text-2xl font-bold mt-1 text-purple-300">{Math.round(result.msp_20d_total)}</div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-2 gap-6">
            <div className="col-span-2 h-[300px] bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <h3 className="text-sm font-medium mb-2">Daily MSP Projection</h3>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={result.daily_breakdown} margin={{ top: 5, right: 20, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#71717a' }} tickFormatter={v=>v.slice(5)} />
                  <YAxis tick={{ fontSize: 10, fill: '#71717a' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  
                  <Line type="monotone" dataKey="base" name="WMA Base" stroke="#52525b" strokeDasharray="3 3" strokeWidth={1} dot={false} />
                  <Line type="monotone" dataKey={(d) => d.base * d.brand_aff * d.price_aff * d.dow_mult * d.fest_mult} name="MSP with Affinity" stroke="#10b981" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="predicted" name="Final MSP (with hype)" stroke="#a855f7" strokeWidth={3} dot={{r: 2}} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="h-[250px] bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <h3 className="text-sm font-medium mb-2">Multiplier Breakdown</h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={result.daily_breakdown} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v,i)=>`D${i+1}`} />
                  <YAxis tick={{ fontSize: 10 }} domain={[0, 'auto']} />
                  <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', fontSize: '10px' }} />
                  <Bar dataKey="brand_aff" stackId="a" fill="#10b981" name="Brand Aff" />
                  <Bar dataKey="price_aff" stackId="a" fill="#38bdf8" name="Price Aff" />
                  <Bar dataKey="dow_mult" stackId="a" fill="#f59e0b" name="DOW" />
                  <Bar dataKey="fest_mult" stackId="a" fill="#ef4444" name="Festival" />
                  <Bar dataKey="hype_mult" stackId="a" fill="#a855f7" name="Hype" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            
            <div className="h-[250px] bg-zinc-900 border border-zinc-800 rounded-xl p-4 overflow-auto">
              <h3 className="text-sm font-medium mb-2">Lookalikes Used</h3>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-zinc-500 border-b border-zinc-800">
                    <th className="pb-2 font-normal">Model / Branch</th>
                    <th className="pb-2 font-normal text-right">Score</th>
                    <th className="pb-2 font-normal text-right">Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {result.lookalike_used.map((lu, i) => (
                    <tr key={i} className="border-b border-zinc-800/50">
                      <td className="py-2 flex items-center gap-2">
                        {lu.item_model} @ {lu.branch}
                        {lu.is_direct_successor && <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1 rounded">⭐</span>}
                      </td>
                      <td className="py-2 text-right text-emerald-400">{lu.lookalike_score}</td>
                      <td className="py-2 text-right text-sky-400">{(lu.weight * 100).toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* OTB Send Panel */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between relative z-30">
            <div>
              <h3 className="font-semibold text-lg text-zinc-200">Use this MSP in Shuffle + OTB</h3>
              <p className="text-sm text-zinc-400">Inject the lookalike MSP into the ASM shuffle pipeline.</p>
            </div>
            <div className="flex gap-3 items-center">
              <div className="w-48"><CustomSelect label="" value={selectedAsm} options={asmList} onChange={setSelectedAsm} placeholder="Select ASM" /></div>
              <button 
                className={`px-4 py-2 font-medium rounded-lg shadow transition-all ${otbSent ? 'bg-emerald-600 text-white' : 'bg-amber-600 hover:bg-amber-500 text-white'}`}
                onClick={sendOtb}
                disabled={otbSent}
              >
                {otbSent ? '✅ Sent to OTB' : 'Send to OTB Engine'}
              </button>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default LookalikePage;
