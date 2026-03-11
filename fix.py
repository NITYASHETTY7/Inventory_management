with open('frontend/src/pages/BrandAffinity.tsx', 'r') as f:
    c = f.read()
c = c.replace('Score < 30', 'Score < 30')
with open('frontend/src/pages/BrandAffinity.tsx', 'w') as f:
    f.write(c)
