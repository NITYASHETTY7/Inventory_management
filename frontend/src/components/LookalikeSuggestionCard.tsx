import React from 'react';
import { Check } from 'lucide-react';

interface LookalikeSuggestionCardProps {
  rank: number;
  im_code: string;
  item_model: string;
  brand: string;
  mop: number;
  price_band: string;
  lookalike_score: number;
  match_reason: string;
  days_of_data: number;
  is_direct_successor: boolean;
  isSelected: boolean;
  onSelect: () => void;
}

export const LookalikeSuggestionCard: React.FC<LookalikeSuggestionCardProps> = ({
  rank, item_model, mop, price_band, lookalike_score,
  match_reason, days_of_data, is_direct_successor, isSelected, onSelect
}) => {
  const getRankBadge = (r: number) => {
    if (r === 1) return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-amber-950 mr-2">#{r}</span>;
    if (r === 2) return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-zinc-400 text-zinc-900 mr-2">#{r}</span>;
    if (r === 3) return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-orange-700 text-orange-100 mr-2">#{r}</span>;
    return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-zinc-700 text-zinc-300 mr-2">#{r}</span>;
  };

  return (
    <div 
      className={`relative p-4 rounded-xl border transition-all cursor-pointer ${
        isSelected 
          ? 'bg-emerald-950/20 border-emerald-500/50 ring-1 ring-emerald-500/50' 
          : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50'
      }`}
      onClick={onSelect}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center">
          {getRankBadge(rank)}
          <h3 className="font-medium text-zinc-100">{item_model}</h3>
          {is_direct_successor && (
            <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold tracking-wider rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase flex items-center gap-1">
              ⭐ Successor
            </span>
          )}
        </div>
        <div className="text-right">
          <div className="text-emerald-400 font-medium">₹{mop.toLocaleString('en-IN')}</div>
          <div className="text-xs text-zinc-500">{price_band}</div>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-emerald-500 rounded-full" 
            style={{ width: `${lookalike_score}%` }}
          />
        </div>
        <div className="text-xs font-medium text-zinc-400 w-12 text-right">
          {lookalike_score}/100
        </div>
      </div>

      <div className="flex justify-between items-end">
        <div>
          <p className="text-xs italic text-zinc-400 max-w-[200px] truncate" title={match_reason}>
            "{match_reason}"
          </p>
          <p className="text-[10px] text-zinc-500 mt-1">
            {days_of_data} days of historical data
          </p>
        </div>
        <button
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            isSelected
              ? 'bg-emerald-500 text-zinc-950'
              : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
          }`}
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
        >
          {isSelected ? (
            <>
              <span>Use This</span>
              <Check className="w-3 h-3" />
            </>
          ) : (
            <span>Use This</span>
          )}
        </button>
      </div>
    </div>
  );
};
