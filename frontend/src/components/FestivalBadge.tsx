// components/FestivalBadge.tsx
// Festival UI primitives — markers, pills, sidebar panel

import type { FestivalEntry } from '../types';

export const TIER_COLORS = {
  1: { dot: '#f59e0b', bg: 'bg-amber-500/20',   border: 'border-amber-500/50',   text: 'text-amber-300',   label: 'T1' },
  2: { dot: '#a78bfa', bg: 'bg-violet-500/20',  border: 'border-violet-500/50',  text: 'text-violet-300',  label: 'T2' },
  3: { dot: '#34d399', bg: 'bg-emerald-500/15', border: 'border-emerald-500/40', text: 'text-emerald-300', label: 'T3' },
} as const;

/**
 * Build a lookup map: date string → FestivalEntry.
 * Includes festival day, lead day, and trail day (if applicable).
 * Used by chart components to look up annotations by date string.
 */
export function buildFestivalMap(festivals: FestivalEntry[]): Record<string, FestivalEntry> {
  const map: Record<string, FestivalEntry> = {};
  for (const f of festivals) {
    map[f.date]      = f;
    map[f.lead_date] = { ...f, name: f.name + ' (Eve)',   day_mult: f.lead_mult };
    if (f.trail_date) {
      map[f.trail_date] = { ...f, name: f.name + ' (After)', day_mult: f.trail_mult! };
    }
    if (f.trail2_date) {
      map[f.trail2_date] = { ...f, name: f.name + ' (After 2)', day_mult: f.trail2_mult! };
    }
  }
  return map;
}

/** Compact inline pill — used inside chart tooltips */
export function FestivalPill({ festival }: { festival: FestivalEntry }) {
  const c = TIER_COLORS[festival.tier as 1 | 2 | 3];
  return (
    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold mt-1 ${c.bg} ${c.border} ${c.text}`}>
      <span className="opacity-60">{c.label}</span>
      <span>{festival.name}</span>
      <span className="opacity-60">×{Number(festival.day_mult).toFixed(1)}</span>
    </div>
  );
}

/**
 * Sidebar panel showing upcoming festivals (next 8).
 * Shows tier badge, name, date, days-until countdown, and multiplier.
 */
export function FestivalCalendarPanel({ festivals }: { festivals: FestivalEntry[] }) {
  const today    = new Date().toISOString().slice(0, 10);
  const upcoming = festivals.filter(f => f.date >= today).slice(0, 8);
  if (!upcoming.length) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-1 h-5 rounded-full bg-amber-400" />
        <span className="text-[10px] font-bold tracking-widest uppercase text-neutral-400">
          Upcoming Festivals
        </span>
      </div>

      {upcoming.map(f => {
        const c          = TIER_COLORS[f.tier as 1 | 2 | 3];
        const daysUntil  = Math.ceil((new Date(f.date).getTime() - Date.now()) / 86400000);
        return (
          <div key={f.date + f.name}
            className={`flex items-start gap-2 p-2.5 rounded-lg border ${c.bg} ${c.border}`}>
            <div className="flex flex-col items-center shrink-0 mt-0.5">
              <span className={`text-[9px] font-black px-1 rounded ${c.text}`}>{c.label}</span>
              <div className="w-0.5 h-3 rounded-full mt-0.5" style={{ background: c.dot }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-[11px] font-bold truncate ${c.text}`}>{f.name}</p>
              <p className="text-[10px] text-neutral-400 font-mono mt-0.5">
                {new Date(f.date).toLocaleDateString('en-GB', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })}
                {daysUntil <= 30 && (
                  <span className="ml-1.5 text-amber-400 font-bold">
                    {daysUntil === 0 ? 'TODAY' : daysUntil === 1 ? 'Tomorrow' : `${daysUntil}d`}
                  </span>
                )}
              </p>
              <p className={`text-[9px] font-mono mt-0.5 opacity-70 ${c.text}`}>
                ×{Number(f.day_mult).toFixed(1)} day boost
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
