// components/FiltersPanel.tsx
import { useEffect, useState } from 'react';
import { api } from '../services/api';
import type { Filters } from '../types';

interface Props {
  filters:  Filters;
  onChange: (u: Partial<Filters>) => void;
  hideDays?: boolean;
}

function Select({ label, value, options, onChange, placeholder, formatLabel, groupedOptions }: {
  label: string; value: string; options: string[];
  onChange: (v: string) => void; placeholder: string;
  formatLabel?: (o: string) => string;
  groupedOptions?: { groupName: string; items: string[] }[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-bold tracking-widest uppercase text-amber-400/70">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg text-sm bg-zinc-800/60 border border-zinc-700/50 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-amber-500/40 transition-all appearance-none cursor-pointer pr-8"
        >
          <option value="">{placeholder}</option>
          {groupedOptions ? (
            groupedOptions.map(g => (
              <optgroup key={g.groupName} label={g.groupName}>
                {g.items.map(o => <option key={o} value={o}>{formatLabel ? formatLabel(o) : o}</option>)}
              </optgroup>
            ))
          ) : (
            options.map(o => (
              <option key={o} value={o}>{formatLabel ? formatLabel(o) : o}</option>
            ))
          )}
        </select>
        <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">▾</div>
      </div>
    </div>
  );
}

const STORE_TIERS: Record<string, string> = {
  "Redhills  - 2 - (GNT Road)": "🟢 High",
  "Arumbakkam  - 1 - (MMDA Colony)": "🟢 High",
  "Cuddalore  - 1 - (Lawrence Road)": "🟢 High",
  "Tirunelveli - 2 - (Junction)": "🟡 Mid",
  "Coimbatore - 4 - (Tatabad)": "🟡 Mid",
  "Sivaganga  - 1 - (Gandhi Road)": "🔴 Low",
  "Tirupathur  - 1 - (Periyar Nagar)": "🔴 Low",
};

export default function FiltersPanel({ filters, onChange, hideDays }: Props) {
  const [branches, setBranches] = useState<string[]>([]);
  const [brands,   setBrands]   = useState<string[]>([]);
  const [models,   setModels]   = useState<string[]>([]);
  const [priceRanges, setPriceRanges] = useState<string[]>([]);
  const [brandShareMap, setBrandShareMap] = useState<Record<string, number>>({});
  const [priceRangeShareMap, setPriceRangeShareMap] = useState<Record<string, number>>({});
  const [modelStatsMap, setModelStatsMap] = useState<Record<string, { share: number, quarter: string, raw_units: number }>>({});

  useEffect(() => {
    api.getBranches().then(setBranches).catch(()=>{});
    api.getBrands().then(setBrands).catch(()=>{});
    api.getModels().then(setModels).catch(()=>{});
  }, []);

  useEffect(() => {
    api.getModels(filters.brand || undefined, filters.priceRange || undefined).then(setModels).catch(()=>{});
    api.getPriceRanges(filters.brand || undefined).then(setPriceRanges).catch(()=>{});
  }, [filters.brand, filters.priceRange]);

  useEffect(() => {
    if (filters.branch) {
      api.getBrandAffinity({ branch: filters.branch })
        .then(res => {
          const newMap: Record<string, number> = {};
          res.cells.forEach(c => {
            if (c.store === filters.branch) {
              newMap[c.brand] = c.share_pct;
            }
          });
          setBrandShareMap(newMap);
        })
        .catch(() => setBrandShareMap({}));
    } else {
      setBrandShareMap({});
    }
  }, [filters.branch]);

  useEffect(() => {
    if (filters.branch) {
      api.getPriceAffinity({ branch: filters.branch, brand: filters.brand || undefined })
        .then(res => {
          const newMap: Record<string, number> = {};
          if (res.cells) {
            res.cells.forEach((c:any) => {
              if (c.store === filters.branch) {
                newMap[c.band] = c.share_pct;
              }
            });
          }
          setPriceRangeShareMap(newMap);
        })
        .catch(() => setPriceRangeShareMap({}));
    } else {
      setPriceRangeShareMap({});
    }
  }, [filters.branch, filters.brand]);

  useEffect(() => {
    api.getModelAffinity({ branch: filters.branch || undefined, brand: filters.brand || undefined, price_range: filters.priceRange || undefined })
      .then(res => {
        const newMap: Record<string, { share: number, quarter: string, raw_units: number }> = {};
        if (res.cells) {
          res.cells.forEach((c:any) => {
            newMap[c.model] = { share: c.share_pct, quarter: c.quarter, raw_units: c.raw_units };
          });
        }
        setModelStatsMap(newMap);
      })
      .catch(() => setModelStatsMap({}));
  }, [filters.branch, filters.brand, filters.priceRange]);

  // Sort brands based on share if available
  const sortedBrands = [...brands].sort((a, b) => {
    const shareA = brandShareMap[a] ?? -1;
    const shareB = brandShareMap[b] ?? -1;
    if (shareA !== shareB) return shareB - shareA;
    return a.localeCompare(b);
  });

  const getBrandShareLabel = (b: string) => {
    const share = brandShareMap[b];
    if (share === undefined) return b;
    let emoji = '🔴';
    if (share >= 20) emoji = '🟢';
    else if (share >= 10) emoji = '🟡';
    return `${emoji} ${b} (${share.toFixed(1)}%)`;
  };

  const getPriceRangeLabel = (pr: string) => {
    const share = priceRangeShareMap[pr];
    if (share !== undefined) {
      return `${pr} (${share.toFixed(1)}% of sales)`;
    }
    return pr;
  };

  // Process models: group by quarter and sort
  const getQuarterValue = (q: string) => {
    if (!q || q === 'Unknown') return 0;
    const match = q.match(/Q([1-4])[\s-]+(\d{4})/);
    if (match) {
      return parseInt(match[2]) * 10 + parseInt(match[1]);
    }
    return 0;
  };

  const getQuarterEmoji = (q: string) => {
    if (q.startsWith('Q1')) return '🔴';
    if (q.startsWith('Q2')) return '🟡';
    if (q.startsWith('Q3')) return '🟢';
    if (q.startsWith('Q4')) return '🔵';
    return '⚪';
  };

  // 1. Assign each model a quarter
  const modelsByQuarter: Record<string, string[]> = {};
  models.forEach(m => {
    const q = modelStatsMap[m]?.quarter || 'Unknown';
    if (!modelsByQuarter[q]) modelsByQuarter[q] = [];
    modelsByQuarter[q].push(m);
  });

  // 2. Sort the quarters
  const sortedQuarters = Object.keys(modelsByQuarter).sort((a, b) => getQuarterValue(b) - getQuarterValue(a));

  // 3. Sort models within each quarter by sales descending
  const groupedModelsOptions = sortedQuarters.map(q => {
    const items = [...modelsByQuarter[q]].sort((a, b) => {
      const salesA = modelStatsMap[a]?.raw_units || 0;
      const salesB = modelStatsMap[b]?.raw_units || 0;
      if (salesA !== salesB) return salesB - salesA;
      return a.localeCompare(b);
    });
    return { groupName: q, items };
  });

  const getModelLabel = (m: string) => {
    const stats = modelStatsMap[m];
    const emoji = getQuarterEmoji(stats?.quarter || 'Unknown');
    if (stats && stats.raw_units > 0) {
      return `${emoji} ${m} (${stats.raw_units} sales, ${stats.share.toFixed(1)}%)`;
    }
    return `${emoji} ${m}`;
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="w-1 h-5 rounded-full bg-amber-400" />
        <span className="text-[10px] font-bold tracking-widest uppercase text-zinc-400">Filters</span>
      </div>

      <Select label="Branch" value={filters.branch} options={branches}
        onChange={v => onChange({ branch: v })} placeholder="All Branches"
        formatLabel={o => STORE_TIERS[o] ? `${STORE_TIERS[o]} | ${o}` : o}
        groupedOptions={[
          { groupName: "Curated Branches", items: branches.filter(b => STORE_TIERS[b]) },
          { groupName: "Other Branches", items: branches.filter(b => !STORE_TIERS[b]) }
        ]} />
      <Select label="Brand" value={filters.brand} options={sortedBrands}
        onChange={v => onChange({ brand: v, model: '', priceRange: '' })} placeholder="All Brands"
        formatLabel={getBrandShareLabel} />
      {priceRanges.length > 0 && (
        <Select label="Price Range" value={filters.priceRange} options={priceRanges}
            onChange={v => onChange({ priceRange: v, model: '' })} placeholder="All Prices"
            formatLabel={getPriceRangeLabel} />
      )}
      <Select label="Model" value={filters.model} options={models}
        onChange={v => onChange({ model: v })} placeholder="All Models"
        groupedOptions={groupedModelsOptions}
        formatLabel={getModelLabel} />

      {!hideDays && (
        <div className="flex flex-col gap-2 pt-1">
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-bold tracking-widest uppercase text-amber-400/70">Forecast Days</label>
            <span className="text-sm font-mono font-bold text-amber-400">{filters.days}d</span>
          </div>
          <input type="range" min={1} max={120} step={1} value={filters.days}
            onChange={e => onChange({ days: parseInt(e.target.value) })}
            className="w-full accent-amber-400 cursor-pointer" />
          <div className="flex justify-between text-[10px] text-zinc-600">
            <span>1 day</span><span>120 days</span>
          </div>
        </div>
      )}
    </div>
  );
}
