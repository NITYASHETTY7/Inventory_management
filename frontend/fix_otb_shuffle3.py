import os
import re

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    original = content

    content = re.sub(r'bg-transparent p-4 rounded border border-white/10', 'glass-panel p-5', content)
    content = re.sub(r'h-80 border border-white/10 bg-transparent rounded p-4', 'glass-panel p-5 h-80', content)
    content = re.sub(r'bg-transparent border border-white/10 text-neutral-200 text-sm rounded p-2', 'glass-input', content)
    content = re.sub(r'overflow-hidden border border-white/10 rounded bg-transparent', 'overflow-hidden glass-panel', content)

    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Updated {filepath}")

def main():
    files_to_process = [
        'frontend/src/pages/ShuffleEngine.tsx',
        'frontend/src/pages/OtbManagement.tsx'
    ]
    for filepath in files_to_process:
        if os.path.exists(filepath):
            process_file(filepath)

if __name__ == "__main__":
    main()
