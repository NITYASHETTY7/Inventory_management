import React from "react";
import { CrossAsmOpportunity } from "../types/shuffle_types";

interface XmcOpportunityCardProps {
  opportunity: CrossAsmOpportunity;
  isHighlighted?: boolean;
  onInitiate?: (opp: CrossAsmOpportunity) => void;
}

export const XmcOpportunityCard: React.FC<XmcOpportunityCardProps> = ({
  opportunity,
  isHighlighted,
  onInitiate,
}) => {
  const {
    im_code,
    brand,
    item_model,
    ymc_branch,
    xmc_branch,
    ymc_avg_daily,
    xmc_avg_daily,
    ymc_stock,
    ymc_asm,
    xmc_asm,
    is_cross_asm,
    priority_score,
    recommended_transfer,
  } = opportunity;

  const accentColor = is_cross_asm ? "bg-red-500" : "bg-amber-500";
  const bgClass = isHighlighted ? "glass-card border-sky-500/50" : "glass-card";

  return (
    <div
      className={`relative flex flex-col rounded-lg border transition-all duration-300 ${bgClass} overflow-hidden`}
    >
      {/* Left accent bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${accentColor}`} />

      <div className="p-4 pl-5">
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded ${
                  priority_score >= 10
                    ? "bg-red-500/20 text-red-400"
                    : priority_score >= 5
                    ? "bg-amber-500/20 text-amber-400"
                    : "bg-white/10 text-neutral-300"
                }`}
              >
                Priority: {priority_score.toFixed(1)}
              </span>
              <span className="text-neutral-400 text-xs">
                {brand} / {im_code}
              </span>
            </div>
            <h3 className="text-neutral-200 font-medium text-lg truncate" title={item_model}>
              {item_model}
            </h3>
          </div>
          <div>
            {is_cross_asm ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                Cross-ASM
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Same-ASM
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 glass-panel p-4 mb-4">
          <div>
            <div className="text-neutral-400 text-xs uppercase tracking-wider mb-1">From</div>
            <div className="font-medium text-neutral-200 mb-2">{ymc_branch}</div>
            <div className="flex flex-col gap-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-amber-500 text-xs font-bold bg-amber-500/10 px-1.5 py-0.5 rounded">
                  YMC
                </span>
                <span className="text-neutral-400 font-mono text-xs">
                  {ymc_avg_daily.toFixed(2)}/day
                </span>
              </div>
              <div className="text-neutral-300 mt-1">
                <span className="font-mono font-medium">{ymc_stock}</span>{" "}
                <span className="text-neutral-400 text-xs">units in stock</span>
              </div>
            </div>
          </div>

          <div>
            <div className="text-neutral-400 text-xs uppercase tracking-wider mb-1">To</div>
            <div className="font-medium text-neutral-200 mb-2">{xmc_branch}</div>
            <div className="flex flex-col gap-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-emerald-500 text-xs font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">
                  XMC
                </span>
                <span className="text-neutral-400 font-mono text-xs">
                  {xmc_avg_daily.toFixed(2)}/day
                </span>
              </div>
              <div className="text-neutral-300 mt-1">
                <span className="font-mono font-medium">~{Math.round(xmc_avg_daily * 20)}</span>{" "}
                <span className="text-neutral-400 text-xs">units / 20d</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-2">
          <div className="text-xs text-neutral-400 flex items-center gap-2">
            <span>
              ASM: {ymc_asm} <span className="text-neutral-500 mx-1">→</span> {xmc_asm}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-neutral-300">
              Suggested:{" "}
              <span className="text-sky-400 font-mono font-bold bg-sky-500/10 px-2 py-0.5 rounded ml-1">
                Move {recommended_transfer} units
              </span>
            </span>
            <button
              onClick={() => onInitiate && onInitiate(opportunity)}
              className="btn-primary bg-sky-500 hover:bg-sky-400 text-[#0A0A0A] text-xs border-none"
            >
              Initiate Request
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
