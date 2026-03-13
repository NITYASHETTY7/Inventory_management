import React from "react";
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";
import { ModelPosition } from "../types/shuffle_types";

interface StockPositionCardProps {
  position: ModelPosition;
  onClick?: (pos: ModelPosition) => void;
  showSparkline?: boolean;
  sparklineData?: number[];
}

export const StockPositionCard: React.FC<StockPositionCardProps> = ({
  position,
  onClick,
  showSparkline,
  sparklineData,
}) => {
  const { item_model, im_code, current_stock, msp_20d, excess, shortage, velocity_class } =
    position;

  // Determine border colors
  let stateBorder = "border-white/10";
  let stateText = "text-neutral-400";
  let stateLabel = "Balanced";

  if (excess > 0) {
    stateBorder = "border-l-4 border-l-emerald-500 border-t-zinc-800 border-r-zinc-800 border-b-zinc-800";
    stateText = "text-emerald-400";
    stateLabel = `+${excess.toLocaleString("en-IN")} excess`;
  } else if (shortage > 0) {
    stateBorder = "border-l-4 border-l-red-500 border-t-zinc-800 border-r-zinc-800 border-b-zinc-800";
    stateText = "text-red-400";
    stateLabel = `-${shortage.toLocaleString("en-IN")} short`;
  }

  // Determine velocity badge color
  let velocityColor = "bg-white/5 text-neutral-300";
  if (velocity_class === "XMC") {
    velocityColor = "bg-emerald-500/20 text-emerald-400";
  } else if (velocity_class === "YMC") {
    velocityColor = "bg-amber-500/20 text-amber-400";
  }

  // Format sparkline data for Recharts
  const chartData = (sparklineData || []).map((val, i) => ({ day: i, val }));

  return (
    <div
      onClick={() => onClick && onClick(position)}
      className={`bg-[#0A0A0A]/60 rounded p-4 border ${stateBorder} cursor-pointer hover:bg-white/5 transition-colors flex flex-col justify-between h-full`}
    >
      <div>
        <div className="flex justify-between items-start mb-1">
          <h4
            className="text-neutral-200 font-medium text-sm leading-tight line-clamp-2"
            title={item_model}
          >
            {item_model}
          </h4>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ml-2 ${velocityColor}`}>
            {velocity_class}
          </span>
        </div>
        <div className="text-neutral-400 text-xs font-mono mb-4">{im_code}</div>

        <div className="grid grid-cols-2 gap-2 text-sm mb-4">
          <div>
            <span className="text-neutral-400 text-xs">Stock:</span>{" "}
            <span className="text-neutral-300 font-mono">
              {current_stock.toLocaleString("en-IN")}
            </span>
          </div>
          <div>
            <span className="text-neutral-400 text-xs">MSP:</span>{" "}
            <span className="text-neutral-300 font-mono">{msp_20d.toLocaleString("en-IN")}</span>
          </div>
        </div>
      </div>

      <div>
        {showSparkline && sparklineData && sparklineData.length > 0 && (
          <div className="h-10 w-full mb-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <YAxis hide domain={["auto", "auto"]} />
                <Line
                  type="monotone"
                  dataKey="val"
                  stroke="#0ea5e9"
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="pt-2 border-t border-white/10 flex items-center justify-between">
          <span className={`font-medium text-sm ${stateText}`}>{stateLabel}</span>
          {excess > 0 && <span className="text-emerald-500">↑</span>}
          {shortage > 0 && <span className="text-red-500">↓</span>}
        </div>
        
        {showSparkline && (
           <div className="mt-3 pt-3 border-t border-white/10">
             <button
               className="w-full bg-white/5 hover:bg-white/10 text-neutral-300 text-xs py-1.5 rounded transition-colors"
               onClick={(e) => {
                 e.stopPropagation();
                 // Since this is for ASM shuffle, maybe trigger parent callback?
                 if (onClick) onClick(position);
               }}
             >
               Find Donors
             </button>
           </div>
        )}
      </div>
    </div>
  );
};
