import { useEffect, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, Cell, PieChart, Pie, LabelList, CartesianGrid } from 'recharts';
import { api } from '../services/api';
import type { BrandAffinityResponse, Filters } from '../types';

const BRAND_COLORS: Record<string, string> = {
  Samsung:  '#38bdf8',   // sky blue
  Apple:    '#a78bfa',   // violet
  Vivo:     '#34d399',   // emerald
  Realme:   '#f59e0b',   // amber
  Xiaomi:   '#fb7185',   // rose
  OPPO:     '#22d3ee',   // cyan
  OnePlus:  '#f472b6',   // pink
  Nokia:    '#60a5fa',   // blue
  Motorola: '#4ade80',   // green
  Nothing:  '#e879f9',   // fuchsia
};

function getBrandColor(b: string) {
  return BRAND_COLORS[b] || '#94a3b8';
}

function shortStoreName(full: string): string {
  const areaMatch = full.match(/\(([^)]+)\)/);
  const area      = areaMatch ? areaMatch[1].replace(' Station','').replace(' Road','') : '';
  const base      = full.split(' - ')[0].trim();
  return area ? `${base} · ${area}` : base;
}

function getHeatmapBg(pct: number): string {
  if (pct > 50) return `rgba(34, 197, 94, 0.7)`;
  if (pct > 20) return `rgba(234, 179, 8, 0.7)`;
  return `rgba(239, 68, 68, 0.7)`;
}

function getHeatmapText(pct: number): string {
  return '#ffffff';
}

export default function BrandAffinity({ filters }: { filters: Filters }) {
  const [data, setData] = useState<BrandAffinityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  const [activeTab, setActiveTab] = useState<'heatmap' | 'profile' | 'leaderboard'>('heatmap');
  
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [selectedBrand, setSelectedBrand] = useState<string>('');

  useEffect(() => {
    setLoading(true);
    api.getBrandAffinity({
      branch: filters.branch,
      brand: filters.brand,
      model: filters.model,
      price_range: filters.priceRange,
    })
      .then(d => {
        setData(d);
        if (d.stores.length > 0) setSelectedStore(d.stores[0]);
        if (d.brands.length > 0) setSelectedBrand(d.brands[0]);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [filters]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-6">
        <svg className="animate-spin h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        <span className="text-zinc-500 font-mono text-sm">Loading brand affinity data…</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2 rounded-full text-sm">
          {error || 'Failed to load data'}
        </div>
      </div>
    );
  }

  const topBrand = Object.entries(data.network_totals).sort((a,b) => b[1]-a[1])[0]?.[0] || '';
  
  let mostDiverseStore = '';
  let minDomShare = Infinity;
  for (const store of data.stores) {
    const prof = data.store_profiles[store];
    if (prof && prof.length > 0) {
      const dom = prof.find(p => p.dominant);
      if (dom && dom.share_pct < minDomShare) {
        minDomShare = dom.share_pct;
        mostDiverseStore = store;
      }
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* SECTION A: PAGE HEADER & CONTROLS */}
      <div className="flex flex-col gap-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-8 rounded-full bg-amber-400" />
            <div>
              <h1 className="text-2xl font-black text-zinc-100">Brand Affinity</h1>
              <p className="text-xs text-zinc-500 font-mono mt-0.5">How strongly each store leans toward each brand · Sep–Dec 2025</p>
            </div>
          </div>
          <button
            onClick={() => setShowInfo(!showInfo)}
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border transition-all ${
              showInfo
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                : 'bg-zinc-800/60 border-zinc-700/40 text-zinc-400 hover:border-amber-500/30 hover:text-amber-400'
            }`}
            title="How is this calculated?"
          >ℹ</button>
        </div>

        {showInfo && (
          <div className="p-4 border-l-2 border-amber-400 bg-zinc-800/80 rounded-r-lg text-xs text-zinc-300 leading-relaxed shadow-lg">
            <p className="font-bold text-amber-400 mb-2 uppercase tracking-widest text-[10px]">How Brand Affinity is Calculated</p>
            <p className="mb-2"><strong>1. Store Share:</strong> We calculate what percentage of a store's total sales comes from a specific brand. <br/><span className="text-zinc-500 italic">(e.g., If Store A sells 100 phones and 30 are Vivo, Vivo's Store Share is 30%)</span></p>
            <p className="mb-2"><strong>2. Network Share:</strong> We calculate that brand's overall share across the entire network. <br/><span className="text-zinc-500 italic">(e.g., If Vivo accounts for 20% of all sales network-wide)</span></p>
            <p><strong>3. Affinity Score:</strong> The Store Share is divided by the Network Share (then scaled out of 50). <br/><span className="text-zinc-500 italic">(e.g., A store selling 30% Vivo when the network average is 20% shows a high positive affinity for Vivo)</span></p>
          </div>
        )}

        <div className="flex gap-2 p-1 rounded-xl bg-zinc-900/50 border border-zinc-800/50 w-fit">
          <button onClick={() => setActiveTab('heatmap')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab==='heatmap'?'bg-zinc-800 text-zinc-100 border border-zinc-700':'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40'}`}>
            🔥 Affinity Heatmap
          </button>
          <button onClick={() => setActiveTab('profile')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab==='profile'?'bg-zinc-800 text-zinc-100 border border-zinc-700':'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40'}`}>
            🏪 Store Profile
          </button>
          <button onClick={() => setActiveTab('leaderboard')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab==='leaderboard'?'bg-zinc-800 text-zinc-100 border border-zinc-700':'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40'}`}>
            🏆 Brand Leaderboard
          </button>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/60 p-5">
            <p className="text-[10px] font-bold tracking-widest uppercase text-zinc-500">Total Stores</p>
            <p className="text-2xl font-mono font-black mt-1 text-zinc-300">{data.stores.length}</p>
          </div>
          <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/60 p-5">
            <p className="text-[10px] font-bold tracking-widest uppercase text-zinc-500">Total Brands</p>
            <p className="text-2xl font-mono font-black mt-1 text-zinc-300">{data.brands.length}</p>
          </div>
          <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/60 p-5">
            <p className="text-[10px] font-bold tracking-widest uppercase text-zinc-500">Top Brand (Network)</p>
            <p className="text-2xl font-mono font-black mt-1 text-amber-400">{topBrand}</p>
          </div>
          <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/60 p-5">
            <p className="text-[10px] font-bold tracking-widest uppercase text-zinc-500">Most Diverse Store</p>
            <p className="text-sm font-mono font-bold mt-1.5 text-sky-400 truncate" title={mostDiverseStore}>{shortStoreName(mostDiverseStore)}</p>
          </div>
        </div>
      </div>

      {/* SECTION B: AFFINITY HEATMAP */}
      {activeTab === 'heatmap' && (
        <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/60 p-6 shadow-xl shadow-zinc-800/20 overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="p-2 border-b border-zinc-800"></th>
                {data.brands.map(brand => (
                  <th key={brand} className="p-2 border-b border-zinc-800 h-32 align-bottom">
                    <div className="flex flex-col items-center justify-end h-full gap-2">
                      <span className="text-xs font-bold text-zinc-300 whitespace-nowrap" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>{brand}</span>
                      <span className="text-[9px] text-zinc-500 font-mono">{data.network_shares[brand]}%</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.stores.map((store, i) => {
                let nameColor = 'text-zinc-500';
                if (i < 4) nameColor = 'text-amber-400';
                else if (i < 7) nameColor = 'text-sky-400';

                return (
                  <tr key={store} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                    <td className="p-3 whitespace-nowrap">
                      <div className="flex justify-between items-center gap-4">
                        <span className={`text-xs font-bold ${nameColor}`}>{shortStoreName(store)}</span>
                        <span className="text-xs text-zinc-400 font-mono">{data.store_totals[store]}</span>
                      </div>
                    </td>
                    {data.brands.map(brand => {
                      const cell = data.cells.find(c => c.store === store && c.brand === brand);
                      if (!cell) {
                        return <td key={brand} className="p-1"><div className="w-full h-10 bg-zinc-900 rounded-lg flex items-center justify-center text-zinc-700 text-xs">—</div></td>;
                      }
                      const score = cell.affinity_score;
                      const pct = cell.share_pct;
                      const bg = getHeatmapBg(pct);
                      const color = getHeatmapText(pct);
                      return (
                        <td key={brand} className="p-1">
                          <div className="relative w-full min-w-[50px] h-10 rounded-lg flex items-center justify-center shadow-inner" style={{ backgroundColor: bg, color }}>
                            <span className="font-mono font-bold text-sm">{pct.toFixed(1)}%</span>
                            <span className="absolute top-0.5 right-1 text-[9px] font-mono opacity-50">#{cell.rank_in_network}</span>
                            {cell.dominant_brand_flag && <span className="absolute top-0.5 left-1 text-[9px] text-amber-400">★</span>}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex gap-4 mt-6 text-[10px] font-mono text-zinc-400 items-center justify-center">
            
            <div className="flex items-center gap-1.5 ml-4"><span className="text-amber-400">★</span> Store's dominant brand</div>
          </div>
        </div>
      )}

      {/* SECTION C: STORE PROFILE */}
      {activeTab === 'profile' && (
        <div className="flex gap-6 h-[700px]">
          <div className="w-80 shrink-0 flex flex-col rounded-2xl bg-zinc-900/60 border border-zinc-800/60 overflow-hidden shadow-xl shadow-zinc-800/20">
            <div className="p-4 border-b border-zinc-800/60 bg-zinc-900">
              <h2 className="text-xs font-bold tracking-widest uppercase text-zinc-500">Select Store</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
              {data.stores.map((store, i) => {
                let nameColor = 'text-zinc-500';
                if (i < 4) nameColor = 'text-amber-400';
                else if (i < 7) nameColor = 'text-sky-400';
                
                const domBrand = data.top_brand_per_store[store];
                const domColor = getBrandColor(domBrand);
                const isActive = store === selectedStore;

                return (
                  <button key={store} onClick={() => setSelectedStore(store)}
                    className={`flex flex-col gap-1.5 p-3 text-left rounded-xl transition-all border-l-2 ${isActive ? 'bg-zinc-800 border-amber-400' : 'border-transparent hover:bg-zinc-800/40'}`}>
                    <div className="flex justify-between items-start gap-2">
                      <span className={`text-xs font-bold truncate ${nameColor}`}>{shortStoreName(store)}</span>
                      <span className="text-[10px] font-mono text-zinc-400">{data.store_totals[store]}</span>
                    </div>
                    {domBrand && (
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: domColor }} />
                        <span className="text-[9px] font-mono text-zinc-500 truncate" style={{ color: domColor }}>{domBrand}</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-5 overflow-y-auto">
            <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/60 p-5 shadow-xl shadow-zinc-800/20">
              <h2 className="text-lg font-bold text-zinc-100">{selectedStore}</h2>
              <p className="text-xs text-zinc-400 font-mono mt-1">Total Units: {data.store_totals[selectedStore]}</p>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/60 p-5 shadow-xl shadow-zinc-800/20 flex flex-col">
                <h3 className="text-xs font-bold tracking-widest uppercase text-zinc-500 mb-4">Units by Brand</h3>
                <div className="flex-1 min-h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.store_profiles[selectedStore] || []} layout="vertical" margin={{top:0, right:40, left:20, bottom:0}}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="brand" type="category" axisLine={false} tickLine={false} tick={{fill:'#71717a', fontSize:10}} width={70} />
                      <RechartsTooltip cursor={{fill:'#27272a', opacity:0.4}} contentStyle={{backgroundColor:'#18181b', borderColor:'#3f3f46', borderRadius:'8px', fontSize:'12px'}} itemStyle={{color:'#e4e4e7', fontFamily:'monospace'}} />
                      <Bar dataKey="units" radius={[0,4,4,0]}>
                        {(data.store_profiles[selectedStore] || []).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={getBrandColor(entry.brand)} />
                        ))}
                        <LabelList dataKey="affinity_score" position="right" formatter={(v:any)=>`Score: ${v}`} style={{fill:'#a1a1aa', fontSize:10, fontFamily:'monospace'}} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/60 p-5 shadow-xl shadow-zinc-800/20 flex flex-col items-center">
                <h3 className="text-xs font-bold tracking-widest uppercase text-zinc-500 mb-2 w-full text-left">Brand Mix</h3>
                <div className="w-full h-[260px] relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={data.store_profiles[selectedStore] || []} dataKey="share_pct" nameKey="brand" cx="50%" cy="50%" innerRadius={60} outerRadius={100} stroke="none" paddingAngle={2}>
                        {(data.store_profiles[selectedStore] || []).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={getBrandColor(entry.brand)} />
                        ))}
                      </Pie>
                      <RechartsTooltip formatter={(v:any)=>`${v}%`} contentStyle={{backgroundColor:'#18181b', borderColor:'#3f3f46', borderRadius:'8px', fontSize:'12px', fontFamily:'monospace'}} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Brand<br/>Mix</span>
                  </div>
                </div>
                <div className="flex flex-wrap justify-center gap-3 mt-2">
                  {(data.store_profiles[selectedStore] || []).map(p => (
                    <div key={p.brand} className="flex items-center gap-1.5 text-[10px] font-mono">
                      <div className="w-2 h-2 rounded-full" style={{backgroundColor: getBrandColor(p.brand)}} />
                      <span className="text-zinc-300">{p.brand}</span>
                      <span className="text-zinc-500">{p.share_pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/60 shadow-xl shadow-zinc-800/20 overflow-hidden">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-zinc-900">
                  <tr>
                    <th className="px-4 py-3 text-[10px] font-bold tracking-widest uppercase text-zinc-500 border-b border-zinc-800">Brand</th>
                    <th className="px-4 py-3 text-[10px] font-bold tracking-widest uppercase text-zinc-500 border-b border-zinc-800">Units</th>
                    <th className="px-4 py-3 text-[10px] font-bold tracking-widest uppercase text-zinc-500 border-b border-zinc-800">Share %</th>
                    <th className="px-4 py-3 text-[10px] font-bold tracking-widest uppercase text-zinc-500 border-b border-zinc-800">Affinity Score</th>
                    <th className="px-4 py-3 text-[10px] font-bold tracking-widest uppercase text-zinc-500 border-b border-zinc-800">Rank in Network</th>
                    <th className="px-4 py-3 text-[10px] font-bold tracking-widest uppercase text-zinc-500 border-b border-zinc-800">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.store_profiles[selectedStore] || []).map(p => {
                    let status = { text: 'Weak', cls: 'text-zinc-600' };
                    if (p.affinity_score >= 70) status = { text: '★ Strong', cls: 'text-amber-400 font-bold' };
                    else if (p.affinity_score >= 50) status = { text: 'Above Avg', cls: 'text-sky-400' };
                    else if (p.affinity_score >= 30) status = { text: 'Average', cls: 'text-zinc-400' };

                    return (
                      <tr key={p.brand} className={`border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors ${p.dominant ? 'bg-amber-500/5' : ''}`}>
                        <td className="px-4 py-3 font-bold text-zinc-200" style={{color: getBrandColor(p.brand)}}>{p.brand}</td>
                        <td className="px-4 py-3 font-mono text-zinc-300">{p.units}</td>
                        <td className="px-4 py-3 font-mono text-zinc-400">{p.share_pct}%</td>
                        <td className="px-4 py-3 font-mono font-bold text-zinc-100">{p.affinity_score.toFixed(1)}</td>
                        <td className="px-4 py-3 font-mono text-zinc-500">#{p.rank}</td>
                        <td className={`px-4 py-3 text-xs ${status.cls}`}>{status.text}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECTION D: BRAND LEADERBOARD */}
      {activeTab === 'leaderboard' && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap gap-2">
            {data.brands.map(brand => {
              const isActive = brand === selectedBrand;
              return (
                <button key={brand} onClick={() => setSelectedBrand(brand)}
                  className={`px-4 py-2 rounded-xl border flex flex-col items-center transition-all ${isActive ? 'bg-zinc-800 text-zinc-100 border-zinc-600 shadow-md' : 'bg-zinc-900/50 text-zinc-500 border-zinc-800/50 hover:bg-zinc-800/50 hover:text-zinc-300'}`}>
                  <span className="font-bold">{brand}</span>
                  <span className="text-[10px] font-mono mt-0.5 opacity-70">{data.network_totals[brand]} units</span>
                </button>
              );
            })}
          </div>

          {selectedBrand && (
            <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/60 p-6 shadow-xl shadow-zinc-800/20 flex flex-col gap-6">
              <div className="flex items-center gap-6 pb-4 border-b border-zinc-800/50">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl font-black shadow-lg" style={{ backgroundColor: getBrandColor(selectedBrand)+'20', color: getBrandColor(selectedBrand) }}>
                  {selectedBrand.charAt(0)}
                </div>
                <div>
                  <h2 className="text-2xl font-black text-zinc-100 tracking-wide">{selectedBrand}</h2>
                  <div className="flex gap-4 mt-1 text-xs font-mono text-zinc-400">
                    <span>Network Total: <b className="text-zinc-200">{data.network_totals[selectedBrand]}</b></span>
                    <span>Network Share: <b className="text-zinc-200">{data.network_shares[selectedBrand]}%</b></span>
                    <span>Sold across <b className="text-zinc-200">{data.brand_leaderboard[selectedBrand]?.length || 0}</b> stores</span>
                  </div>
                </div>
              </div>

              <div className="h-[260px] w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.brand_leaderboard[selectedBrand] || []} margin={{top:20, right:0, left:-20, bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis dataKey="store" tickFormatter={shortStoreName} tick={{fill:'#71717a', fontSize:10}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fill:'#71717a', fontSize:10}} axisLine={false} tickLine={false} />
                    <RechartsTooltip cursor={{fill:'#27272a', opacity:0.4}} contentStyle={{backgroundColor:'#18181b', borderColor:'#3f3f46', borderRadius:'8px', fontSize:'12px'}} itemStyle={{color:'#e4e4e7', fontFamily:'monospace'}} labelFormatter={shortStoreName} />
                    <Bar dataKey="units" radius={[4,4,0,0]}>
                      {(data.brand_leaderboard[selectedBrand] || []).map((entry, index) => {
                        const bg = getHeatmapBg(entry.affinity_score);
                        return <Cell key={`cell-${index}`} fill={bg.startsWith('var') ? '#71717a' : bg} />;
                      })}
                      <LabelList dataKey="affinity_score" position="top" formatter={(v:any)=>v} style={{fill:'#a1a1aa', fontSize:10, fontFamily:'monospace'}} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="overflow-hidden rounded-xl border border-zinc-800/50 mt-4">
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-zinc-900">
                    <tr>
                      <th className="px-4 py-3 text-[10px] font-bold tracking-widest uppercase text-zinc-500 border-b border-zinc-800">Rank</th>
                      <th className="px-4 py-3 text-[10px] font-bold tracking-widest uppercase text-zinc-500 border-b border-zinc-800">Store</th>
                      <th className="px-4 py-3 text-[10px] font-bold tracking-widest uppercase text-zinc-500 border-b border-zinc-800">Units</th>
                      <th className="px-4 py-3 text-[10px] font-bold tracking-widest uppercase text-zinc-500 border-b border-zinc-800">Store Share %</th>
                      <th className="px-4 py-3 text-[10px] font-bold tracking-widest uppercase text-zinc-500 border-b border-zinc-800">Affinity Score</th>
                      <th className="px-4 py-3 text-[10px] font-bold tracking-widest uppercase text-zinc-500 border-b border-zinc-800">Volume Tier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.brand_leaderboard[selectedBrand] || []).map((entry, idx) => {
                      let tier = { text: 'Low Volume', cls: 'text-zinc-500' };
                      if (idx < 4) tier = { text: 'High Volume', cls: 'text-amber-400' };
                      else if (idx < 7) tier = { text: 'Mid Volume', cls: 'text-sky-400' };

                      return (
                        <tr key={entry.store} className={`border-b border-zinc-800/30 hover:bg-zinc-800/50 transition-colors ${idx === 0 ? 'bg-amber-500/10' : idx % 2 === 0 ? 'bg-zinc-800/20' : ''}`}>
                          <td className="px-4 py-3 font-mono font-bold text-zinc-300">{idx === 0 ? '🏆 ' : ''}{entry.rank}</td>
                          <td className="px-4 py-3 font-bold text-zinc-200">{shortStoreName(entry.store)}</td>
                          <td className="px-4 py-3 font-mono text-zinc-300">{entry.units}</td>
                          <td className="px-4 py-3 font-mono text-zinc-400">{entry.share_pct}%</td>
                          <td className="px-4 py-3 font-mono font-bold text-zinc-100">{entry.affinity_score.toFixed(1)}</td>
                          <td className={`px-4 py-3 text-xs font-bold ${tier.cls}`}>{tier.text}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
