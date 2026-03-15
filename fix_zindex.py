import re

def fix_file(filename, replacements):
    with open(filename, 'r') as f:
        content = f.read()
    
    for old, new in replacements:
        content = content.replace(old, new)
        
    with open(filename, 'w') as f:
        f.write(content)

# Fix ShuffleEngine.tsx
fix_file('frontend/src/pages/ShuffleEngine.tsx', [
    ('className="glass-panel p-5 mb-6"', 'className="glass-panel p-5 mb-6 relative z-50"')
])

# Fix OtbManagement.tsx
fix_file('frontend/src/pages/OtbManagement.tsx', [
    ('className="glass-panel p-5 mb-6"', 'className="glass-panel p-5 mb-6 relative z-50"')
])

# Fix LookalikePage.tsx
fix_file('frontend/src/pages/LookalikePage.tsx', [
    ('className="col-span-4 space-y-4 bg-zinc-900 p-5 rounded-xl border border-zinc-800"', 'className="col-span-4 space-y-4 bg-zinc-900 p-5 rounded-xl border border-zinc-800 relative z-50"'),
    ('className="bg-zinc-900 p-5 rounded-xl border border-zinc-800"', 'className="bg-zinc-900 p-5 rounded-xl border border-zinc-800 relative z-40"'),
    ('className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between"', 'className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between relative z-30"')
])

print("Fixed z-index!")
