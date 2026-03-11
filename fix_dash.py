with open('frontend/src/pages/Dashboard.tsx', 'r') as f:
    c = f.read()

# Fix Imports
if "import BrandAffinity" not in c:
    c = c.replace("import MspAccuracy          from './MspAccuracy';", "import MspAccuracy          from './MspAccuracy';\nimport BrandAffinity        from './BrandAffinity';")

# Fix Tabs Type
c = c.replace("type TabId = 'prediction' | 'comparison' | 'accuracy';", "type TabId = 'prediction' | 'comparison' | 'accuracy' | 'brand_affinity';")

# Fix Tabs Bar
if "label=\"💜 Brand Affinity\"" not in c:
    c = c.replace("<Tab label=\"🎯 MSP Accuracy\"      active={activeTab==='accuracy'}    onClick={()=>handleTabChange('accuracy')}    />", "<Tab label=\"🎯 MSP Accuracy\"      active={activeTab==='accuracy'}    onClick={()=>handleTabChange('accuracy')}    />\n        <Tab label=\"💜 Brand Affinity\"    active={activeTab==='brand_affinity'} onClick={()=>handleTabChange('brand_affinity')} />")

# Fix Render
if "BrandAffinity />" not in c:
    insert_block = """
      {/* ── BRAND AFFINITY TAB — full bleed ── */}
      {activeTab === 'brand_affinity' && (
        <div className="h-[calc(100vh-105px)] overflow-y-auto">
          <BrandAffinity />
        </div>
      )}
"""
    c = c.replace("{/* ── ACCURACY TAB", insert_block + "\n      {/* ── ACCURACY TAB")

# Fix sidebar sharing
c = c.replace("{activeTab!=='accuracy' && (", "{activeTab!=='accuracy' && activeTab!=='brand_affinity' && (")

with open('frontend/src/pages/Dashboard.tsx', 'w') as f:
    f.write(c)

