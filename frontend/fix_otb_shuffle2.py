import os
import re

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    original = content

    # General Glass UI Replacements
    content = re.sub(r'bg-\[\#0A0A0A\]/60 border border-white/10 rounded-xl p-4', 'glass-card p-5', content)
    content = re.sub(r'bg-\[\#0A0A0A\]/60 border border-white/10 rounded-xl', 'glass-card', content)
    content = re.sub(r'bg-\[\#0A0A0A\]/60 border border-white/10 rounded-lg', 'glass-panel', content)

    # Buttons
    content = re.sub(r'bg-amber-600 hover:bg-amber-500 text-white py-2 rounded text-sm font-medium transition-colors', 'btn-primary bg-amber-500 hover:bg-amber-400 text-[#0A0A0A] border-none py-2.5', content)
    content = re.sub(r'bg-amber-600 hover:bg-amber-500 text-white font-medium py-2 px-4 rounded transition-colors', 'btn-primary bg-amber-500 hover:bg-amber-400 text-[#0A0A0A] border-none py-2.5', content)
    content = re.sub(r'bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2 px-4 rounded transition-colors', 'btn-primary bg-emerald-500 hover:bg-emerald-400 text-[#0A0A0A] border-none', content)
    content = re.sub(r'bg-sky-600 hover:bg-sky-500 text-white font-medium py-2 px-4 rounded transition-colors', 'btn-primary bg-sky-500 hover:bg-sky-400 text-[#0A0A0A] border-none', content)
    
    content = re.sub(r'bg-white/5 border border-white/10 text-neutral-300 hover:bg-white/10 px-4 py-2 rounded text-sm transition-colors', 'btn-secondary', content)

    # Table styles
    content = re.sub(r'bg-[#0A0A0A]/60', 'bg-transparent', content)  # clean up any missed table headers/footers

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
