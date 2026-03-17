import re

with open('frontend/src/pages/LookalikePage.tsx', 'r') as f:
    content = f.read()

if 'import CustomSelect' not in content:
    content = content.replace('import { api } from "../services/api";', 'import { api } from "../services/api";\nimport CustomSelect from "../components/CustomSelect";')

# 1. Target Branch
content = re.sub(
    r'<select className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-sm" value=\{targetBranch\} onChange=\{e=>setTargetBranch\(e\.target\.value\)\}>\s*\{branches\.map\(b => <option key=\{b\} value=\{b\}>\{b\}</option>\)\}\s*</select>',
    '<CustomSelect label="" value={targetBranch} options={branches} onChange={setTargetBranch} placeholder="Select Branch" />',
    content, flags=re.MULTILINE
)

# 2. Brand
content = re.sub(
    r'<select className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-sm" value=\{targetBrand\} onChange=\{e=>setTargetBrand\(e\.target\.value\)\}>\s*\{brands\.map\(b => <option key=\{b\} value=\{b\}>\{b\}</option>\)\}\s*</select>',
    '<CustomSelect label="" value={targetBrand} options={brands} onChange={setTargetBrand} placeholder="Select Brand" />',
    content, flags=re.MULTILINE
)

# 3. Model (Sparse)
content = re.sub(
    r'<select className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-sm" value=\{targetModel\} onChange=\{e=>\{\s*setTargetModel\(e\.target\.value\);\s*const cat = catalog\.find\(c => c\.im_code === e\.target\.value\);\s*if\(cat\) setTargetMop\(cat\.mop\);\s*\}\}>\s*\{catalog\.filter\(c => c\.brand === targetBrand && c\.days_of_data < 14\)\.map\(c => \(\s*<option key=\{c\.im_code\} value=\{c\.im_code\}>\{c\.item_model\} \(\{c\.days_of_data\}d\)</option>\s*\)\)\}\s*</select>',
    '''<CustomSelect label="" value={targetModel} options={catalog.filter(c => c.brand === targetBrand && c.days_of_data < 14).map(c => c.im_code)} onChange={(v) => {
                    setTargetModel(v);
                    const cat = catalog.find(c => c.im_code === v);
                    if(cat) setTargetMop(cat.mop);
                  }} placeholder="Select Model" formatLabel={(val) => {
                    const cat = catalog.find(c => c.im_code === val);
                    return cat ? `${cat.item_model} (${cat.days_of_data}d)` : val;
                  }} />''',
    content, flags=re.MULTILINE
)

# 4. Brand (second one in the new_store scenario)
content = re.sub(
    r'<select className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-sm mb-3" value=\{targetBrand\} onChange=\{e=>setTargetBrand\(e\.target\.value\)\}>\s*\{brands\.map\(b => <option key=\{b\} value=\{b\}>\{b\}</option>\)\}\s*</select>',
    '<div className="mb-3"><CustomSelect label="" value={targetBrand} options={brands} onChange={setTargetBrand} placeholder="Select Brand" /></div>',
    content, flags=re.MULTILINE
)

# 5. Model to predict
content = re.sub(
    r'<select className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-sm" value=\{targetModel\} onChange=\{e=>\{\s*setTargetModel\(e\.target\.value\);\s*const cat = catalog\.find\(c => c\.im_code === e\.target\.value\);\s*if\(cat\) setTargetMop\(cat\.mop\);\s*\}\}>\s*\{catalog\.filter\(c => c\.brand === targetBrand\)\.map\(c => \(\s*<option key=\{c\.im_code\} value=\{c\.im_code\}>\{c\.item_model\}</option>\s*\)\)\}\s*</select>',
    '''<CustomSelect label="" value={targetModel} options={catalog.filter(c => c.brand === targetBrand).map(c => c.im_code)} onChange={(v) => {
                    setTargetModel(v);
                    const cat = catalog.find(c => c.im_code === v);
                    if(cat) setTargetMop(cat.mop);
                  }} placeholder="Select Model" formatLabel={(val) => {
                    const cat = catalog.find(c => c.im_code === val);
                    return cat ? cat.item_model : val;
                  }} />''',
    content, flags=re.MULTILINE
)

# 6. Prediction Start Date
content = re.sub(
    r'<select className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-sm" value=\{predictionDate\} onChange=\{e=>setPredictionDate\(e\.target\.value\)\}>\s*\{stockDates\.map\(d => <option key=\{d\} value=\{d\}>\{d\}</option>\)\}\s*</select>',
    '<CustomSelect label="" value={predictionDate} options={stockDates} onChange={setPredictionDate} placeholder="Select Date" />',
    content, flags=re.MULTILINE
)

# 7. ASM selection in OTB panel
content = re.sub(
    r'<select className="bg-zinc-950 border border-zinc-700 rounded p-2 text-sm w-48" value=\{selectedAsm\} onChange=\{e=>setSelectedAsm\(e\.target\.value\)\}>\s*\{asmList\.map\(a => <option key=\{a\} value=\{a\}>\{a\}</option>\)\}\s*</select>',
    '<div className="w-48"><CustomSelect label="" value={selectedAsm} options={asmList} onChange={setSelectedAsm} placeholder="Select ASM" /></div>',
    content, flags=re.MULTILINE
)

with open('frontend/src/pages/LookalikePage.tsx', 'w') as f:
    f.write(content)
