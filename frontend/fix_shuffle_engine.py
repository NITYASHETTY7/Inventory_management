import re

with open('frontend/src/pages/ShuffleEngine.tsx', 'r') as f:
    content = f.read()

# Import CustomSelect
content = re.sub(
    r'import ShuffleMap from "../components/ShuffleMap";',
    'import ShuffleMap from "../components/ShuffleMap";\nimport CustomSelect from "../components/CustomSelect";',
    content
)

# Add engineMode state
content = re.sub(
    r'  const \[allBrands, setAllBrands\] = useState<string\[\]>\(\[\]\);',
    "  const [engineMode, setEngineMode] = useState<'asm'|'hub'>('asm');\n  const [allBrands, setAllBrands] = useState<string[]>([]);",
    content
)

# Update renderFilters to use CustomSelect
new_render_filters = """
  const renderFilters = () => (
    <div className="glass-panel p-5 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {/* ASM */}
        <CustomSelect
          label="ASM"
          value={selectedAsm}
          options={asmList.map(a => a.asm_name)}
          onChange={setSelectedAsm}
          placeholder="Select ASM"
        />

        {/* Brand */}
        <CustomSelect
          label="Brand Filter"
          value={selectedBrand}
          options={allBrands}
          onChange={(v) => { setSelectedBrand(v); setSelectedModelStr(""); }}
          placeholder="All Brands"
        />

        {/* Model */}
        <CustomSelect
          label="Model"
          value={selectedModelStr}
          options={
            selectedBrand && modelsForAsm.length > 0
              ? [
                  JSON.stringify({ im_code: "ALL", brand: selectedBrand, item_model: `All ${selectedBrand} Models`, display_label: `All ${selectedBrand} Models` }),
                  ...visibleModels.map(m => JSON.stringify(m))
                ]
              : visibleModels.map(m => JSON.stringify(m))
          }
          onChange={setSelectedModelStr}
          placeholder={modelsForAsm.length > 0 ? "Select Model" : "Awaiting ASM..."}
          formatLabel={(val) => {
            if (!val) return "Select Model";
            try { return JSON.parse(val).display_label || JSON.parse(val).item_model; } catch { return val; }
          }}
        />

        {/* Prediction Date */}
        <CustomSelect
          label="Prediction Date"
          value={predictionDate}
          options={stockDates}
          onChange={setPredictionDate}
          placeholder="Select Date"
          formatLabel={(d) => new Date(d).toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' })}
        />
      </div>

      {activeAsmObj && (
"""

content = re.sub(
    r'  const renderFilters = \(\) => \(\n    <div className="glass-panel p-5 mb-6">\n      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">.*?</div>\n\n      \{activeAsmObj && \(',
    new_render_filters,
    content,
    flags=re.DOTALL
)

# Add engineMode tabs at the top
tabs_replacement = """
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <RefreshCw className="text-emerald-500" /> Advanced Shuffle Engine
        </h1>
        <p className="text-neutral-400 mt-1 text-sm">Dynamic rebalancing pipeline.</p>
        
        <div className="flex gap-2 mt-6 border-b border-white/10 pb-2">
          <button 
            onClick={() => setEngineMode('asm')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${engineMode === 'asm' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-neutral-400 hover:bg-white/5'}`}
          >
            ASM-Level Shuffle
          </button>
          <button 
            onClick={() => setEngineMode('hub')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${engineMode === 'hub' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-neutral-400 hover:bg-white/5'}`}
          >
            Hub-Level Shuffle
          </button>
        </div>
      </div>

      {engineMode === 'hub' && (
        <div className="flex flex-col items-center justify-center py-20 px-4 glass-panel text-center">
          <MapPin size={48} className="text-emerald-500/50 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Hub-Level Shuffle Engine</h2>
          <p className="text-neutral-400 max-w-md mx-auto">
            This module will compute broad inventory rebalancing between regional distribution hubs. Currently in development.
          </p>
        </div>
      )}

      {engineMode === 'asm' && (
        <>
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded mb-6 flex items-center gap-3 text-sm">
              <AlertCircle size={18} /> {error}
            </div>
          )}

          {renderFilters()}
"""

content = re.sub(
    r'      <div className="mb-6">\n        <h1 className="text-2xl font-bold text-white flex items-center gap-3">\n          <RefreshCw className="text-emerald-500" /> Advanced Shuffle Engine\n        </h1>\n        <p className="text-neutral-400 mt-1 text-sm">ASM-level dynamic rebalancing pipeline.</p>\n      </div>\n\n      \{error && \(\n        <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded mb-6 flex items-center gap-3 text-sm">\n          <AlertCircle size=\{18\} /> \{error\}\n        </div>\n      \)\}\n\n      \{renderFilters\(\)\}',
    tabs_replacement,
    content,
    flags=re.DOTALL
)

# close the fragment for asm mode
content = re.sub(
    r'          \{renderPositionsGraph\(\)\}\n        </div>\n      \)\}\n    </div>\n  \);\n}',
    "          {renderPositionsGraph()}\n        </div>\n      )}\n        </>\n      )}\n    </div>\n  );\n}",
    content
)


with open('frontend/src/pages/ShuffleEngine.tsx', 'w') as f:
    f.write(content)

print("Done fixing ShuffleEngine.tsx")
