import re

with open('frontend/src/components/CustomSelect.tsx', 'r') as f:
    content = f.read()

# Replace <div className="relative" ref={dropdownRef}>
new_div = '<div className={`relative ${isOpen ? "z-50" : "z-10"}`} ref={dropdownRef}>'
content = content.replace('<div className="relative" ref={dropdownRef}>', new_div)

with open('frontend/src/components/CustomSelect.tsx', 'w') as f:
    f.write(content)

print("Fixed CustomSelect stacking!")
