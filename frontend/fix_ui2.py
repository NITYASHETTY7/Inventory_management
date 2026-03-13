import os
import re

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    original = content

    # Other common styles
    content = re.sub(r'bg-zinc-800(?:/\d+)?', 'bg-white/5', content)
    content = re.sub(r'bg-zinc-900(?:/\d+)?', 'bg-[#0A0A0A]/60', content)
    content = re.sub(r'bg-zinc-950(?:/\d+)?', 'bg-transparent', content)
    content = re.sub(r'border-zinc-800(?:/\d+)?', 'border-white/10', content)
    content = re.sub(r'border-zinc-700(?:/\d+)?', 'border-white/20', content)
    content = re.sub(r'text-zinc-600', 'text-neutral-500', content)
    content = re.sub(r'text-zinc-500', 'text-neutral-400', content)
    content = re.sub(r'text-zinc-400', 'text-neutral-300', content)
    content = re.sub(r'text-zinc-300', 'text-neutral-200', content)
    content = re.sub(r'text-zinc-200', 'text-neutral-100', content)
    content = re.sub(r'text-zinc-100', 'text-white', content)
    content = re.sub(r'bg-zinc-700(?:/\d+)?', 'bg-white/10', content)
    content = re.sub(r'bg-zinc-600(?:/\d+)?', 'bg-white/20', content)
    content = re.sub(r'border-zinc-600(?:/\d+)?', 'border-white/30', content)

    # Some old buttons
    content = re.sub(r'bg-amber-500 text-zinc-900 font-bold text-sm hover:bg-amber-400 transition-colors shadow-lg shadow-amber-500/20', r'btn-primary', content)

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
