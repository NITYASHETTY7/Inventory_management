import React, { useEffect, useState } from "react";
import { AsmShuffleResult } from "../types/shuffle_types";

interface ShuffleAsmCardProps {
  result: AsmShuffleResult;
  onInitiateRequest?: (result: AsmShuffleResult) => void;
}

export const ShuffleAsmCard: React.FC<ShuffleAsmCardProps> = ({ result, onInitiateRequest }) => {
  const [coverageWidth, setCoverageWidth] = useState(0);

  useEffect(() => {
    // Animate the bar after a short delay
    const timer = setTimeout(() => {
      setCoverageWidth(result.coverage_pct);
    }, 100);
    return () => clearTimeout(timer);
  }, [result.coverage_pct]);

  return (
    <div className="glass-panel p-6 mb-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between mb-6 gap-4">
        <div className="flex gap-6 text-sm">
          <div>
            <span className="text-neutral-400">ASM:</span>{" "}
            <span className="text-neutral-300 font-medium">{result.asm_name}</span>
          </div>
          <div>
            <span className="text-neutral-400">Branch:</span>{" "}
            <span className="text-sky-400 font-medium">{result.requesting_branch}</span>
          </div>
          <div>
            <span className="text-neutral-400">Model:</span>{" "}
            <span className="text-neutral-300 font-medium">{result.brand} / {result.im_code}</span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-transparent rounded p-4 border border-white/10">
          <div className="text-neutral-400 text-xs mb-1">Shortage at Branch</div>
          <div className="text-red-400 text-2xl font-mono">
            {result.shortage.toLocaleString("en-IN")}
          </div>
        </div>
        <div className="bg-transparent rounded p-4 border border-white/10">
          <div className="text-neutral-400 text-xs mb-1">Coverable by Shuffle</div>
          <div className="text-sky-400 text-2xl font-mono flex items-baseline gap-2">
            {result.total_coverable.toLocaleString("en-IN")}
            <span className="text-xs text-neutral-400 font-sans">
              from {result.recommendations.length} stores
            </span>
          </div>
        </div>
        <div className="bg-transparent rounded p-4 border border-white/10">
          <div className="text-neutral-400 text-xs mb-1">Remaining After Shuffle</div>
          <div
            className={`text-2xl font-mono ${
              result.remaining_after_shuffle > 0 ? "text-amber-400" : "text-emerald-400"
            }`}
          >
            {result.remaining_after_shuffle.toLocaleString("en-IN")}
          </div>
        </div>
      </div>

      {/* Coverage Bar */}
      <div className="mb-8">
        <div className="flex justify-between text-xs mb-2">
          <span className="text-neutral-400">Shuffle Coverage</span>
          <span className="text-sky-400 font-medium">{Math.round(result.coverage_pct)}%</span>
        </div>
        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full bg-sky-500 transition-all duration-600 ease-out"
            style={{ width: `${coverageWidth}%` }}
          />
        </div>
      </div>

      {/* Transfer Plan Table */}
      {result.recommendations.length > 0 && (
        <div className="mb-8">
          <h4 className="text-sm text-neutral-400 mb-3">Transfer Plan</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="text-xs text-neutral-500 font-semibold tracking-wider uppercase bg-transparent">
                <tr>
                  <th className="px-4 py-2 rounded-tl">Donor Branch</th>
                  <th className="px-4 py-2">Donor Stock</th>
                  <th className="px-4 py-2">Donor MSP</th>
                  <th className="px-4 py-2">Available Excess</th>
                  <th className="px-4 py-2 text-right rounded-tr">Transfer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {result.recommendations.map((rec, i) => (
                  <tr key={i} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 font-medium text-neutral-300">
                      {rec.donor_branch} <span className="text-neutral-400 ml-2">→</span>
                    </td>
                    <td className="px-4 py-3 text-neutral-400 font-mono">
                      {rec.donor_stock.toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-3 text-neutral-400 font-mono">
                      {rec.donor_msp.toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-3 text-emerald-400/80 font-mono">
                      +{rec.donor_excess.toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="bg-sky-500/10 text-sky-400 font-bold px-2 py-1 rounded font-mono">
                        {rec.suggested_transfer.toLocaleString("en-IN")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ASM Peer Positions */}
      <div>
        <h4 className="text-sm text-neutral-400 mb-3">ASM Peer Positions</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {result.peer_positions.map((peer, i) => {
            const isSelected = peer.branch === result.requesting_branch;
            const borderColor = isSelected
              ? "border-sky-500/50 shadow-[0_0_10px_rgba(14,165,233,0.1)]"
              : peer.excess > 0
              ? "border-emerald-500/30"
              : peer.shortage > 0
              ? "border-red-500/30"
              : "border-white/10";

            return (
              <div
                key={i}
                className={`bg-transparent rounded p-3 border ${borderColor} transition-colors`}
              >
                <div
                  className={`text-xs font-medium mb-2 truncate ${
                    isSelected ? "text-sky-400" : "text-neutral-300"
                  }`}
                  title={peer.branch}
                >
                  {peer.branch}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                  <div>
                    <div className="text-neutral-500 text-[10px] uppercase">Stock</div>
                    <div className="font-mono text-neutral-400">
                      {peer.current_stock.toLocaleString("en-IN")}
                    </div>
                  </div>
                  <div>
                    <div className="text-neutral-500 text-[10px] uppercase">MSP</div>
                    <div className="font-mono text-neutral-400">
                      {peer.msp_20d.toLocaleString("en-IN")}
                    </div>
                  </div>
                </div>
                <div className="mt-1">
                  {peer.excess > 0 ? (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400">
                      +{peer.excess.toLocaleString("en-IN")} Excess
                    </span>
                  ) : peer.shortage > 0 ? (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-500/10 text-red-400">
                      -{peer.shortage.toLocaleString("en-IN")} Short
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
      </div>
    </div>
  );
};
