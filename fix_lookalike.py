import re

with open("frontend/src/pages/LookalikePage.tsx", "r") as f:
    content = f.read()

# Fix imports
content = re.sub(
    r"import \{ fetchBranches, fetchBrands \} from '\.\./services/api';",
    "import { api } from '../services/api';",
    content
)

content = re.sub(
    r"import \{ fetchAsmList, fetchStockDates \} from '\.\./services/shuffle_api';",
    "import { fetchAsmList, fetchStockDates } from '../services/shuffle_otb_api';",
    content
)

content = re.sub(
    r"import React, \{ useState, useEffect, useMemo \} from 'react';",
    "import React, { useState, useEffect } from 'react';",
    content
)

content = re.sub(
    r"import \{ Rocket, Store, BarChart3, ChevronDown, Check, Info \} from 'lucide-react';",
    "import { Rocket, Store, BarChart3 } from 'lucide-react';",
    content
)

content = re.sub(
    r"import \{ ComposedChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, Cell \} from 'recharts';",
    "import { ComposedChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';",
    content
)

# Fix API calls
content = re.sub(
    r"fetchBranches\(\)\.then\(b => \{ setBranches\(b\); if\(b\.length\) setTargetBranch\(b\[0\]\); \}\)\.catch\(console\.error\);",
    "api.getBranches().then(b => { setBranches(b); if(b.length) setTargetBranch(b[0]); }).catch(console.error);",
    content
)

content = re.sub(
    r"fetchBrands\(\)\.then\(b => \{ setBrands\(b\); if\(b\.length\) setTargetBrand\(b\[0\]\); \}\)\.catch\(console\.error\);",
    "api.getBrands().then(b => { setBrands(b); if(b.length) setTargetBrand(b[0]); }).catch(console.error);",
    content
)

content = re.sub(
    r"fetchStockDates\(\)\.then\(d => \{ setStockDates\(d\); if\(d\.length\) setPredictionDate\(d\[0\]\); \}\)\.catch\(console\.error\);",
    "fetchStockDates().then(d => { setStockDates(d.dates); if(d.dates.length) setPredictionDate(d.dates[0]); }).catch(console.error);",
    content
)

content = re.sub(
    r"fetchAsmList\(\)\.then\(a => \{ setAsmList\(a\); if\(a\.length\) setSelectedAsm\(a\[0\]\); \}\)\.catch\(console\.error\);",
    "fetchAsmList().then(a => { const names = a.map(x => x.asm_name); setAsmList(names); if(names.length) setSelectedAsm(names[0]); }).catch(console.error);",
    content
)

with open("frontend/src/pages/LookalikePage.tsx", "w") as f:
    f.write(content)
