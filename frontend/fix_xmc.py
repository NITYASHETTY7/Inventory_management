import os
import re

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    original = content

    content = re.sub(r'bg-\[\#0A0A0A\]/60 border-white/10', 'glass-card', content)
    content = re.sub(r'bg-white/5 border-sky-500/50', 'glass-card border-sky-500/50', content)
    content = re.sub(r'bg-transparent rounded-md p-3 mb-4 border border-white/10', 'glass-panel p-4 mb-4', content)
    content = re.sub(r'bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium py-1.5 px-3 rounded transition-colors', 'btn-primary bg-sky-500 hover:bg-sky-400 text-[#0A0A0A] text-xs border-none', content)

    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Updated {filepath}")

def main():
    files_to_process = [
        'frontend/src/components/XmcOpportunityCard.tsx'
    ]
    for filepath in files_to_process:
        if os.path.exists(filepath):
            process_file(filepath)

if __name__ == "__main__":
    main()
