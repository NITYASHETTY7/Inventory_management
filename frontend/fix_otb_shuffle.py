import os
import re

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    original = content

    # Panels and Cards
    content = re.sub(r'bg-\[\#0A0A0A\]/60 border border-white/10 rounded-lg p-4', 'glass-panel p-5', content)
    content = re.sub(r'bg-\[\#0A0A0A\]/60 border border-white/10 rounded-lg', 'glass-panel', content)
    content = re.sub(r'border border-white/10 rounded-lg p-4', 'glass-panel p-5', content)
    
    # Selects and Inputs
    content = re.sub(r'w-full bg-transparent border border-white/10 text-neutral-200 text-sm rounded p-2', 'glass-input w-full', content)
    content = re.sub(r'className="w-full border border-white/10 bg-transparent rounded p-2 text-white"', 'className="glass-input w-full"', content)
    
    # Text colors
    content = re.sub(r'text-neutral-400 uppercase', 'text-neutral-500 font-semibold tracking-wider uppercase', content)

    # Buttons
    content = re.sub(r'bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2 px-4 rounded transition-colors', 'btn-primary bg-emerald-500 hover:bg-emerald-400 text-[#0A0A0A] border-none', content)
    content = re.sub(r'bg-sky-600 hover:bg-sky-500 text-white font-medium py-2 px-4 rounded transition-colors', 'btn-primary bg-sky-500 hover:bg-sky-400 text-[#0A0A0A] border-none', content)

    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Updated {filepath}")

def main():
    files_to_process = [
        'frontend/src/pages/ShuffleEngine.tsx',
        'frontend/src/pages/OtbManagement.tsx',
        'frontend/src/components/ShuffleAsmCard.tsx',
        'frontend/src/components/OtbTable.tsx'
    ]
    for filepath in files_to_process:
        if os.path.exists(filepath):
            process_file(filepath)

if __name__ == "__main__":
    main()
