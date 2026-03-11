with open('frontend/src/pages/MspAccuracy.tsx', 'r') as f:
    c = f.read()

c = c.replace('LineChart, ComposedChart', 'ComposedChart')
c = c.replace('const TICK_INTERVAL = 13; // ~every 2 weeks on a 120-day series', '')
c = c.replace('sorted.map((m,i)=>{', 'sorted.map((m)=>{')

with open('frontend/src/pages/MspAccuracy.tsx', 'w') as f:
    f.write(c)

with open('frontend/src/services/api.ts', 'r') as f:
    c2 = f.read()
    
c2 = c2.replace("const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api';", "const BASE = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:8000/api';")

with open('frontend/src/services/api.ts', 'w') as f:
    f.write(c2)

