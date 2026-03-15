import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer } from 'recharts';

interface HypeCurvePreviewProps {
  brandTier: "premium" | "budget";
  peakMultiplier: number;
  hypeDurationDays: number;
  height?: number;
}

export const HypeCurvePreview: React.FC<HypeCurvePreviewProps> = ({
  brandTier, peakMultiplier, hypeDurationDays, height = 80
}) => {
  const data = useMemo(() => {
    const pts = [];
    for (let day = 1; day <= 20; day++) {
      let val = 1.0;
      if (day <= hypeDurationDays) {
        if (brandTier === "premium") {
          if (day <= 3) val = peakMultiplier;
          else if (day <= 7) val = peakMultiplier * 0.7;
          else {
            const startVal = peakMultiplier * 0.7;
            const decayDays = hypeDurationDays - 7;
            if (decayDays > 0) {
              const currentDay = day - 7;
              val = startVal - ((startVal - 1.0) * (currentDay / decayDays));
            }
          }
        } else {
          if (day <= 7) val = 1.2;
        }
      }
      pts.push({ day, value: Math.max(1.0, val) });
    }
    return pts;
  }, [brandTier, peakMultiplier, hypeDurationDays]);

  const color = brandTier === 'premium' ? '#f59e0b' : '#a1a1aa';
  const fillOpacity = brandTier === 'premium' ? 0.2 : 0.1;

  return (
    <div style={{ height, width: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="hypeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={fillOpacity}/>
              <stop offset="95%" stopColor={color} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <XAxis 
            dataKey="day" 
            tick={{ fontSize: 10, fill: '#71717a' }} 
            tickLine={false} 
            axisLine={{ stroke: '#3f3f46' }} 
            interval={4} 
          />
          <YAxis 
            domain={[1, 4]} 
            tick={{ fontSize: 10, fill: '#71717a' }} 
            tickLine={false} 
            axisLine={false} 
            tickFormatter={(v) => `${v}×`}
          />
          <Area 
            type="monotone" 
            dataKey="value" 
            stroke={color} 
            strokeWidth={2}
            fillOpacity={1} 
            fill="url(#hypeGradient)" 
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
