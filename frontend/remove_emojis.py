import os
import re

def remove_emojis(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    original = content
    
    # Replace common emojis with text or remove them
    content = content.replace('⭐ Best', 'Best')
    content = content.replace('⭐ marks the best', 'Highlights the best')
    content = content.replace('📋', '')
    content = content.replace('ℹ', 'i')
    content = content.replace('✕', 'X')
    content = content.replace('↓ Export CSV', 'Export CSV')
    content = content.replace('🌟', '')
    content = content.replace('🟢', '')
    content = content.replace('🟡', '')
    content = content.replace('🔴', '')
    content = content.replace('🔵', '')
    content = content.replace('⚪', '')
    
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Removed emojis from {filepath}")

def main():
    for root, dirs, files in os.walk('frontend/src'):
        for file in files:
            if file.endswith('.tsx') or file.endswith('.ts'):
                remove_emojis(os.path.join(root, file))

if __name__ == "__main__":
    main()
