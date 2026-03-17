import re

with open('frontend/src/pages/OtbManagement.tsx', 'r') as f:
    content = f.read()

content = re.sub(
    r'import \{ Package, RefreshCw, AlertCircle, TrendingUp, Search, List \} from "lucide-react";',
    'import { Package, RefreshCw, AlertCircle, TrendingUp, Search, List } from "lucide-react";\nimport CustomSelect from "../components/CustomSelect";',
    content
)

new_render_filters = """
    return (
      <div className="glass-panel p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
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
        
        <div className="flex flex-wrap items-center gap-6 mb-4 mt-2">
"""

content = re.sub(
    r'    return \(\n      <div className="glass-panel p-5 mb-6">\n        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">.*?</div>\n        \n        <div className="flex flex-wrap items-center gap-6 mb-4 mt-2">',
    new_render_filters,
    content,
    flags=re.DOTALL
)

with open('frontend/src/pages/OtbManagement.tsx', 'w') as f:
    f.write(content)

print("Done fixing OtbManagement.tsx")
