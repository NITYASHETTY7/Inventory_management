import { useEffect, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, Cell, PieChart, Pie, LabelList, CartesianGrid } from 'recharts';
import { api } from '../services/api';
import type { Filters } from '../types';

const PRICE_COLORS: Record<string, string> = {
  "Under ₹10k":   '#38bdf8',   // sky blue
  "₹10k – ₹20k":  '#34d399',   // emerald
  "₹20k – ₹30k":  '#a78bfa',   // violet
  "₹30k – ₹50k":  '#f59e0b',   // amber
  "₹50k – ₹80k":  '#f472b6',   // pink
  "₹80k – ₹120k": '#fb7185',   // rose
  "Above ₹120k":  '#22d3ee',   // cyan
  "Unknown":      '#94a3b8'    // slate
};

function getBandColor(b: string) {
  return PRICE_COLORS[b] || '#94a3b8';
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

export default function PriceAffinity({ filters }: { filters: Filters }) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  const [activeTab, setActiveTab] = useState<'heatmap' | 'profile' | 'leaderboard'>('heatmap');
  
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [selectedBand, setSelectedBand] = useState<string>('');

  useEffect(() => {
    setLoading(true);
    api.getPriceAffinity({
      branch: filters.branch,
      brand: filters.brand,
      model: filters.model,
    })
      .then(d => {
        setData(d);
        if (d.stores && d.stores.length > 0) setSelectedStore(d.stores[0]);
        if (d.bands && d.bands.length > 0) setSelectedBand(d.bands[0]);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [filters.branch, filters.brand, filters.model]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-6">
        <svg className="animate-spin h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        <span className="text-zinc-500 font-mono text-sm">Loading price affinity data…</span>
      </div>
    );
  }

  if (error || !data || data.error) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2 rounded-full text-sm">
          {error || data?.error || 'Failed to load data'}
        </div>
      </div>
    );
  }

  const topBand = Object.entries(data.network_totals).sort((a:any,b:any) => b[1]-a[1])[0]?.[0] || '';
  
  let mostDiverseStore = '';
  let minDomShare = Infinity;
  for (const store of data.stores) {
    const prof = data.store_profiles[store];
    if (prof && prof.length > 0) {
      const dom = prof.find((p:any) => p.dominant);
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
            <div className="w-1.5 h-8 rounded-full bg-emerald-400" />
            <div>
              <h1 className="text-2xl font-black text-zinc-100">Price Affinity</h1>
              <p className="text-xs text-zinc-500 font-mono mt-0.5">Store sales distribution across price bands</p>
            </div>
          </div>
          <button
            onClick={() => setShowInfo(!showInfo)}
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border transition-all ${
              showInfo
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                : 'bg-zinc-800/60 border-zinc-700/40 text-zinc-400 hover:border-emerald-500/30 hover:text-emerald-400'
            }`}
            title="How is this calculated?"
          >ℹ</button>
        </div>

        {showInfo && (
          <div className="p-4 border-l-2 border-emerald-400 bg-zinc-800/80 rounded-r-lg text-xs text-zinc-300 leading-relaxed shadow-lg">
            <p className="font-bold text-emerald-400 mb-2 uppercase tracking-widest text-[10px]">Price Affinity Metrics</p>
            <p className="mb-2">Shows the percentage of total sales of a store that fall into each price band.</p>
            <p>Calculated based on actual units sold in historical data.</p>
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
            🏆 Price Band Leaderboard
          </button>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/60 p-5">
            <p className="text-[10px] font-bold tracking-widest uppercase text-zinc-500">Total Stores</p>
            <p className="text-2xl font-mono font-black mt-1 text-zinc-300">{data.stores.length}</p>
          </div>
          <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/60 p-5">
            <p className="text-[10px] font-bold tracking-widest uppercase text-zinc-500">Price Bands</p>
            <p className="text-2xl font-mono font-black mt-1 text-zinc-300">{data.bands.length}</p>
          </div>
          <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/60 p-5">
            <p className="text-[10px] font-bold tracking-widest uppercase text-zinc-500">Top Band (Network)</p>
            <p className="text-xl font-mono font-black mt-1 text-emerald-400">{topBand}</p>
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
                {data.bands.map((band:string) => (
                  <th key={band} className="p-2 border-b border-zinc-800 h-32 align-bottom">
                    <div className="flex flex-col items-center justify-end h-full gap-2">
                      <span className="text-xs font-bold text-zinc-300 whitespace-nowrap" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>{band}</span>
                      <span className="text-[9px] text-zinc-500 font-mono">{data.network_shares[band]}%</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.stores.map((store:string, i:number) => {
                let nameColor = 'text-zinc-500';
                if (i < 4) nameColor = 'text-emerald-400';
                else if (i < 7) nameColor = 'text-sky-400';

                return (
                  <tr key={store} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                    <td className="p-3 whitespace-nowrap">
                      <div className="flex justify-between items-center gap-4">
                        <span className={`text-xs font-bold ${nameColor}`}>{shortStoreName(store)}</span>
                        <span className="text-xs text-zinc-400 font-mono">{data.store_totals[store]}</span>
                      </div>
                    </td>
                    {data.bands.map((band:string) => {
                      const cell = data.cells.find((c:any) => c.store === store && c.band === band);
                      if (!cell) {
                        return <td key={band} className="p-1"><div className="w-full h-10 bg-zinc-900 rounded-lg flex items-center justify-center text-zinc-700 text-xs">—</div></td>;
                      }
                      const pct = cell.share_pct;
                      const bg = getHeatmapBg(pct);
                      const color = getHeatmapText(pct);
                      return (
                        <td key={band} className="p-1">
                          <div className="relative w-full min-w-[50px] h-10 rounded-lg flex items-center justify-center shadow-inner" style={{ backgroundColor: bg, color }}>
                            <span className="font-mono font-bold text-sm">{pct.toFixed(1)}%</span>
                            <span className="absolute top-0.5 right-1 text-[9px] font-mono opacity-50">#{cell.rank_in_network}</span>
                            {cell.dominant_band_flag && <span className="absolute top-0.5 left-1 text-[9px] text-emerald-400">★</span>}
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
            <div className="flex items-center gap-1.5 ml-4"><span className="text-emerald-400">★</span> Store's dominant price band</div>
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
              {data.stores.map((store:string, i:number) => {
                let nameColor = 'text-zinc-500';
                if (i < 4) nameColor = 'text-emerald-400';
                else if (i < 7) nameColor = 'text-sky-400';
                
                const domBand = data.top_band_per_store[store];
                const domColor = getBandColor(domBand);
                const isActive = store === selectedStore;

                return (
                  <button key={store} onClick={() => setSelectedStore(store)}
                    className={`flex flex-col gap-1.5 p-3 text-left rounded-xl transition-all border-l-2 ${isActive ? 'bg-zinc-800 border-emerald-400' : 'border-transparent hover:bg-zinc-800/40'}`}>
                    <div className="flex justify-between items-start gap-2">
                      <span className={`text-xs font-bold truncate ${nameColor}`}>{shortStoreName(store)}</span>
                      <span className="text-[10px] font-mono text-zinc-400">{data.store_totals[store]}</span>
                    </div>
                    {domBand && (
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: domColor }} />
                        <span className="text-[9px] font-mono text-zinc-500 truncate" style={{ color: domColor }}>{domBand}</span>
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
                <h3 className="text-xs font-bold tracking-widest uppercase text-zinc-500 mb-4">Units by Price Band</h3>
                <div className="flex-1 min-h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.store_profiles[selectedStore] || []} layout="vertical" margin={{top:0, right:40, left:20, bottom:0}}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="band" type="category" axisLine={false} tickLine={false} tick={{fill:'#71717a', fontSize:10}} width={80} />
                      <RechartsTooltip cursor={{fill:'#27272a', opacity:0.4}} contentStyle={{backgroundColor:'#18181b', borderColor:'#3f3f46', borderRadius:'8px', fontSize:'12px'}} itemStyle={{color:'#e4e4e7', fontFamily:'monospace'}} />
                      <Bar dataKey="units" radius={[0,4,4,0]}>
                        {(data.store_profiles[selectedStore] || []).map((entry:any, index:number) => (
                          <Cell key={`cell-${index}`} fill={getBandColor(entry.band)} />
                        ))}
                        <LabelList dataKey="share_pct" position="right" formatter={(v:any)=>`${v}%`} style={{fill:'#a1a1aa', fontSize:10, fontFamily:'monospace'}} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/60 p-5 shadow-xl shadow-zinc-800/20 flex flex-col items-center">
                <h3 className="text-xs font-bold tracking-widest uppercase text-zinc-500 mb-2 w-full text-left">Price Mix</h3>
                <div className="w-full h-[260px] relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={data.store_profiles[selectedStore] || []} dataKey="share_pct" nameKey="band" cx="50%" cy="50%" innerRadius={60} outerRadius={100} stroke="none" paddingAngle={2}>
                        {(data.store_profiles[selectedStore] || []).map((entry:any, index:number) => (
                          <Cell key={`cell-${index}`} fill={getBandColor(entry.band)} />
                        ))}
                      </Pie>
                      <RechartsTooltip formatter={(v:any)=>`${v}%`} contentStyle={{backgroundColor:'#18181b', borderColor:'#3f3f46', borderRadius:'8px', fontSize:'12px', fontFamily:'monospace'}} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Price<br/>Mix</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/60 shadow-xl shadow-zinc-800/20 overflow-hidden">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-zinc-900">
                  <tr>
                    <th className="px-4 py-3 text-[10px] font-bold tracking-widest uppercase text-zinc-500 border-b border-zinc-800">Price Band</th>
                    <th className="px-4 py-3 text-[10px] font-bold tracking-widest uppercase text-zinc-500 border-b border-zinc-800">Units</th>
                    <th className="px-4 py-3 text-[10px] font-bold tracking-widest uppercase text-zinc-500 border-b border-zinc-800">Share %</th>
                    <th className="px-4 py-3 text-[10px] font-bold tracking-widest uppercase text-zinc-500 border-b border-zinc-800">Rank in Network</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.store_profiles[selectedStore] || []).map((p:any) => (
                    <tr key={p.band} className={`border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors ${p.dominant ? 'bg-emerald-500/5' : ''}`}>
                      <td className="px-4 py-3 font-bold text-zinc-200" style={{color: getBandColor(p.band)}}>{p.band}</td>
                      <td className="px-4 py-3 font-mono text-zinc-300">{p.units}</td>
                      <td className="px-4 py-3 font-mono text-zinc-400">{p.share_pct}%</td>
                      <td className="px-4 py-3 font-mono text-zinc-500">#{p.rank}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECTION D: BAND LEADERBOARD */}
      {activeTab === 'leaderboard' && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap gap-2">
            {data.bands.map((band:string) => {
              const isActive = band === selectedBand;
              return (
                <button key={band} onClick={() => setSelectedBand(band)}
                  className={`px-4 py-2 rounded-xl border flex flex-col items-center transition-all ${isActive ? 'bg-zinc-800 text-zinc-100 border-zinc-600 shadow-md' : 'bg-zinc-900/50 text-zinc-500 border-zinc-800/50 hover:bg-zinc-800/50 hover:text-zinc-300'}`}>
                  <span className="font-bold">{band}</span>
                  <span className="text-[10px] font-mono mt-0.5 opacity-70">{data.network_totals[band]} units</span>
                </button>
              );
            })}
          </div>

          {selectedBand && (
            <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/60 p-6 shadow-xl shadow-zinc-800/20 flex flex-col gap-6">
              <div className="flex items-center gap-6 pb-4 border-b border-zinc-800/50">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl font-black shadow-lg" style={{ backgroundColor: getBandColor(selectedBand)+'20', color: getBandColor(selectedBand) }}>
                  ₹
                </div>
                <div>
                  <h2 className="text-2xl font-black text-zinc-100 tracking-wide">{selectedBand}</h2>
                  <div className="flex gap-4 mt-1 text-xs font-mono text-zinc-400">
                    <span>Network Total: <b className="text-zinc-200">{data.network_totals[selectedBand]}</b></span>
                    <span>Network Share: <b className="text-zinc-200">{data.network_shares[selectedBand]}%</b></span>
                    <span>Sold across <b className="text-zinc-200">{data.band_leaderboard[selectedBand]?.length || 0}</b> stores</span>
                  </div>
                </div>
              </div>

              <div className="h-[260px] w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.band_leaderboard[selectedBand] || []} margin={{top:20, right:0, left:-20, bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis dataKey="store" tickFormatter={shortStoreName} tick={{fill:'#71717a', fontSize:10}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fill:'#71717a', fontSize:10}} axisLine={false} tickLine={false} />
                    <RechartsTooltip cursor={{fill:'#27272a', opacity:0.4}} contentStyle={{backgroundColor:'#18181b', borderColor:'#3f3f46', borderRadius:'8px', fontSize:'12px'}} itemStyle={{color:'#e4e4e7', fontFamily:'monospace'}} labelFormatter={shortStoreName} />
                    <Bar dataKey="units" radius={[4,4,0,0]}>
                      {(data.band_leaderboard[selectedBand] || []).map((entry:any, index:number) => {
                        const bg = getHeatmapBg(entry.share_pct);
                        return <Cell key={`cell-${index}`} fill={bg.startsWith('var') ? '#71717a' : bg} />;
                      })}
                      <LabelList dataKey="share_pct" position="top" formatter={(v:any)=>v+'%'} style={{fill:'#a1a1aa', fontSize:10, fontFamily:'monospace'}} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
