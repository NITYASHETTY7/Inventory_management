import re

with open('frontend/src/pages/MspAccuracy.tsx', 'r') as f:
    content = f.read()

# 1. Remove CrossCheckPanel component and its usage
content = re.sub(r'// ─────────────────────────────────────────────────────────────────────────────\n// Manual Cross-Check Panel\n// ─────────────────────────────────────────────────────────────────────────────\n\nfunction CrossCheckPanel.*?^}\n', '', content, flags=re.MULTILINE|re.DOTALL)
content = re.sub(r'\{\/\* Cross-check panel \*\/\}\s*<CrossCheckPanel models=\{data\.models\}\/>', '', content)

# 2. Adjust OverlayChart height and Legend margins
content = re.sub(r'<ResponsiveContainer width="100%" height=\{260\}>', '<ResponsiveContainer width="100%" height={320}>', content)
content = re.sub(r'margin={{top:10,right:20,left:-10,bottom:0}}', 'margin={{top:10,right:20,left:-10,bottom:20}}', content)
content = re.sub(r"wrapperStyle={{fontSize:'11px',paddingTop:'12px'}}", "wrapperStyle={{fontSize:'11px',paddingTop:'20px', bottom:0}}", content)

# 3. Rearrange KPI cards to be next to OverlayChart
kpi_regex = r'\{\/\* KPI row \*\/\}\s*<div className="grid grid-cols-4 gap-4">\s*<div className="glass-card p-5">.*?</div>\s*</div>\s*\{\/\* Three model cards \*\/\}\s*<div className="grid grid-cols-3 gap-5">\s*\{data\.models\.map\(m=><ModelCard key=\{m\.name\} model=\{m\} festivals=\{festivals\}\/>\)\}\s*</div>\s*\{\/\* Overlay chart \*\/\}\s*<ChartCard\s*title="All Models Overlay"\s*subtitle=\{`Actual sales vs all three MSP model predictions · Last \$\{filters\.days\} days`\}\s*accent="indigo"\s*>\s*<OverlayChart data=\{data\} filters=\{filters\} festivals=\{festivals\}\/>\s*</ChartCard>'

new_layout = """{/* KPI + Overlay Chart */}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
              <div className="flex flex-col gap-4">
                <div className="glass-card p-5">
                  <p className="text-[10px] font-bold tracking-widest uppercase text-neutral-400">Total Training Days</p>
                  <p className="text-2xl font-black font-mono text-white mt-1">{data.actual_sales.length}</p>
                  <p className="text-[10px] text-neutral-400">Sep–Dec 2025</p>
                </div>
                {data.models.map(m=>(
                  <div key={m.name} className="glass-card p-5">
                    <p className="text-[10px] font-bold tracking-widest uppercase text-neutral-400">{m.label}</p>
                    <p className="text-2xl font-black font-mono mt-1" style={{color:MODEL_COLORS[m.name]??'#94a3b8'}}>
                      {(100 - m.error_metrics.mape).toFixed(1)}%
                    </p>
                    <p className="text-[10px] text-neutral-400">Correctness</p>
                  </div>
                ))}
              </div>
              <div className="xl:col-span-3 flex flex-col h-full">
                <ChartCard
                  title="All Models Overlay"
                  subtitle={`Actual sales vs all three MSP model predictions · Last ${filters.days} days`}
                  accent="indigo"
                >
                  <div className="flex-1 flex items-center justify-center min-h-[320px]">
                    <OverlayChart data={data} filters={filters} festivals={festivals}/>
                  </div>
                </ChartCard>
              </div>
            </div>

            {/* Three model cards */}
            <div className="grid grid-cols-3 gap-5">
              {data.models.map(m=><ModelCard key={m.name} model={m} festivals={festivals}/>)}
            </div>"""

content = re.sub(kpi_regex, new_layout, content, flags=re.MULTILINE|re.DOTALL)

with open('frontend/src/pages/MspAccuracy.tsx', 'w') as f:
    f.write(content)

print("Done fixing MspAccuracy.tsx")
