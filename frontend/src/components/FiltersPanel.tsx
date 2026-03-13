import { useEffect, useState, useRef } from 'react';
import { api } from '../services/api';
import type { Filters } from '../types';
import { Filter, ChevronDown, Calendar, Store, Tag, Box, IndianRupee } from 'lucide-react';

interface Props {
  filters:  Filters;
  onChange: (u: Partial<Filters>) => void;
  hideDays?: boolean;
}

function Select({ label, value, options, onChange, placeholder, formatLabel, groupedOptions, icon: Icon }: {
  label: string; value: string; options: string[];
  onChange: (v: string) => void; placeholder: string;
  formatLabel?: (o: string) => string;
  groupedOptions?: { groupName: string; items: string[] }[];
  icon?: React.ElementType;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getDisplayValue = () => {
    if (!value) return <span className="text-neutral-500">{placeholder}</span>;
    return formatLabel ? formatLabel(value) : value;
  };

  const OptionItem = ({ o }: { o: string }) => {
    const isSelected = value === o;
    return (
      <div 
        onClick={() => { onChange(o); setIsOpen(false); }}
        className={`px-3 py-2 cursor-pointer text-sm transition-all duration-200 ${
          isSelected 
            ? 'bg-gradient-to-r from-emerald-500/20 via-sky-500/20 to-amber-500/20 text-white font-medium border-l-2 border-amber-400' 
            : 'text-neutral-300 hover:bg-white/10 hover:text-white border-l-2 border-transparent hover:border-white/20'
        }`}
      >
        {formatLabel ? formatLabel(o) : o}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-1.5 group" ref={dropdownRef}>
      <label className="text-xs font-semibold tracking-wide text-neutral-400 flex items-center gap-1.5 group-focus-within:text-white transition-colors">
        {Icon && <Icon size={14} className="text-neutral-500 group-focus-within:text-white transition-colors" />}
        {label}
      </label>
      <div className="relative">
        <div className="absolute -inset-[1px] bg-gradient-to-r from-emerald-500/0 via-amber-500/0 to-sky-500/0 group-focus-within:from-emerald-500/40 group-focus-within:via-amber-500/40 group-focus-within:to-sky-500/40 rounded-lg transition-all duration-500 blur-sm pointer-events-none" />
        
        <div 
          onClick={() => setIsOpen(!isOpen)}
          className={`relative w-full px-3 py-2 rounded-lg text-sm bg-black/40 border text-white transition-all cursor-pointer shadow-sm flex items-center justify-between ${
            isOpen ? 'border-white/30 bg-white/5' : 'border-white/10 hover:border-white/20'
          }`}
        >
          <div className="truncate pr-4">
            {getDisplayValue()}
          </div>
          <ChevronDown size={14} className={`text-neutral-500 transition-transform duration-300 ${isOpen ? 'rotate-180 text-white' : ''}`} />
        </div>

        {isOpen && (
          <div className="absolute z-50 mt-2 w-full max-h-60 overflow-y-auto rounded-lg bg-[#111] border border-white/10 shadow-glass py-1 custom-scrollbar">
            <div 
              onClick={() => { onChange(""); setIsOpen(false); }}
              className={`px-3 py-2 cursor-pointer text-sm text-neutral-500 hover:bg-white/5 hover:text-white transition-colors ${!value ? 'bg-white/5 text-white' : ''}`}
            >
              {placeholder}
            </div>
            
            {groupedOptions ? (
              groupedOptions.map(g => (
                <div key={g.groupName}>
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-500 bg-black/20 mt-1">
                    {g.groupName}
                  </div>
                  {g.items.map(o => <OptionItem key={o} o={o} />)}
                </div>
              ))
            ) : (
              options.map(o => <OptionItem key={o} o={o} />)
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const STORE_TIERS: Record<string, string> = {
  "Redhills  - 2 - (GNT Road)": "High Vol",
  "Arumbakkam  - 1 - (MMDA Colony)": "High Vol",
  "Cuddalore  - 1 - (Lawrence Road)": "High Vol",
  "Tirunelveli - 2 - (Junction)": "Mid Vol",
  "Coimbatore - 4 - (Tatabad)": "Mid Vol",
  "Sivaganga  - 1 - (Gandhi Road)": "Low Vol",
  "Tirupathur  - 1 - (Periyar Nagar)": "Low Vol",
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
    return `${b} — ${share.toFixed(1)}%`;
  };

  const getPriceRangeLabel = (pr: string) => {
    const share = priceRangeShareMap[pr];
    if (share !== undefined) {
      return `${pr} — ${share.toFixed(1)}%`;
    }
    return pr;
  };

  const getQuarterValue = (q: string) => {
    if (!q || q === 'Unknown') return 0;
    const match = q.match(/Q([1-4])[\s-]+(\d{4})/);
    if (match) {
      return parseInt(match[2]) * 10 + parseInt(match[1]);
    }
    return 0;
  };

  const modelsByQuarter: Record<string, string[]> = {};
  models.forEach(m => {
    const q = modelStatsMap[m]?.quarter || 'Unknown';
    if (!modelsByQuarter[q]) modelsByQuarter[q] = [];
    modelsByQuarter[q].push(m);
  });

  const sortedQuarters = Object.keys(modelsByQuarter).sort((a, b) => getQuarterValue(b) - getQuarterValue(a));

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
    if (stats && stats.raw_units > 0) {
      return `${m} — ${stats.raw_units} units (${stats.share.toFixed(1)}%)`;
    }
    return m;
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2 pb-2 border-b border-white/5">
        <Filter size={16} className="text-white" />
        <span className="text-sm font-semibold text-white">Analysis Filters</span>
      </div>

      <div className="flex flex-col gap-4">
        <Select label="Branch" value={filters.branch} options={branches} icon={Store}
          onChange={v => onChange({ branch: v })} placeholder="All Branches"
          formatLabel={o => STORE_TIERS[o] ? `[${STORE_TIERS[o]}] ${o}` : o}
          groupedOptions={[
            { groupName: "Curated Branches", items: branches.filter(b => STORE_TIERS[b]) },
            { groupName: "Other Branches", items: branches.filter(b => !STORE_TIERS[b]) }
          ]} />
          
        <Select label="Brand" value={filters.brand} options={sortedBrands} icon={Tag}
          onChange={v => onChange({ brand: v, model: '', priceRange: '' })} placeholder="All Brands"
          formatLabel={getBrandShareLabel} />
          
        {priceRanges.length > 0 && (
          <Select label="Price Range" value={filters.priceRange} options={priceRanges} icon={IndianRupee}
              onChange={v => onChange({ priceRange: v, model: '' })} placeholder="All Prices"
              formatLabel={getPriceRangeLabel} />
        )}
        
        <Select label="Device Model" value={filters.model} options={models} icon={Box}
          onChange={v => onChange({ model: v })} placeholder="All Models"
          groupedOptions={groupedModelsOptions}
          formatLabel={getModelLabel} />

        {!hideDays && (
          <div className="flex flex-col gap-3 pt-2">
            <div className="flex justify-between items-center group-focus-within:text-white">
              <label className="text-xs font-semibold tracking-wide text-neutral-400 flex items-center gap-1.5 transition-colors">
                <Calendar size={14} className="text-neutral-500" />
                Forecast Horizon
              </label>
              <span className="text-xs font-mono font-bold text-white bg-white/10 px-2 py-0.5 rounded-md border border-white/10">
                {filters.days} days
              </span>
            </div>
            <div className="px-1">
              <input type="range" min={1} max={120} step={1} value={filters.days}
                onChange={e => onChange({ days: parseInt(e.target.value) })}
                className="w-full" />
              <div className="flex justify-between mt-1.5 text-[10px] text-neutral-500 font-medium">
                <span>1d</span>
                <span>120d</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
