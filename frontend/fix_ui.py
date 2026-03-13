import os
import re

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    original = content

    # Cards and Panels
    content = re.sub(r'rounded-2xl bg-zinc-900/60 border border-zinc-800/60 p-5 shadow-xl shadow-zinc-800/(?:20|30)', 'glass-card p-5', content)
    content = re.sub(r'rounded-xl bg-zinc-900/50 border border-zinc-800/50 p-4', 'glass-card p-5', content)
    content = re.sub(r'bg-zinc-800/40 border border-zinc-700/30', 'bg-white/5 border border-white/10', content)
    content = re.sub(r'bg-zinc-900/95 border border-zinc-700/60 shadow-xl', 'bg-black/80 backdrop-blur-xl border border-white/10 shadow-glass', content)

    # Tables
    content = re.sub(r'bg-zinc-900 z-10', 'bg-[#0A0A0A]/90 backdrop-blur-md z-10 border-b border-white/10', content)
    content = re.sub(r'border-b border-zinc-800/50 hover:bg-zinc-800/(?:30|40) transition-colors', 'border-b border-white/5 hover:bg-white/[0.03] transition-colors', content)
    content = re.sub(r'border-b border-zinc-800', 'border-b border-white/5', content)
    content = re.sub(r'text-zinc-500 uppercase tracking-wider', 'text-neutral-400 uppercase tracking-wider', content)
    content = re.sub(r'text-zinc-400', 'text-neutral-400', content)
    content = re.sub(r'text-zinc-300', 'text-neutral-300', content)
    content = re.sub(r'text-zinc-200', 'text-neutral-200', content)
    content = re.sub(r'text-zinc-100', 'text-white', content)
    
    # Inputs
    content = re.sub(r'bg-zinc-800/60 border border-zinc-700/50 text-zinc-200 focus:ring-2 focus:ring-(?:amber|emerald|sky)-500/40', 'glass-input', content)
    
    # Buttons
    content = re.sub(r'px-4 py-2 rounded-lg bg-(amber|emerald|sky)-500 text-zinc-900 font-bold text-sm hover:bg-\1-400 transition-colors shadow-lg shadow-\1-500/20', r'btn-primary', content)
    content = re.sub(r'px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700/50 text-zinc-400 hover:bg-zinc-700', 'btn-secondary', content)

    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Updated {filepath}")

def main():
    for root, dirs, files in os.walk('frontend/src'):
        for file in files:
            if file.endswith('.tsx') or file.endswith('.ts'):
                process_file(os.path.join(root, file))

if __name__ == "__main__":
    main()
