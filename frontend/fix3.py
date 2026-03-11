with open('src/pages/BrandAffinity.tsx', 'r') as f:
    c = f.read()
import re
c = re.sub(r'function getScoreColor[\s\S]*?\}', '', c, count=1)
with open('src/pages/BrandAffinity.tsx', 'w') as f:
    f.write(c)
