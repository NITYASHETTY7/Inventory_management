import re

def fix_file(filename, replacements):
    with open(filename, 'r') as f:
        content = f.read()
    
    for old, new in replacements:
        content = content.replace(old, new)
        
    with open(filename, 'w') as f:
        f.write(content)

fix_file('frontend/src/pages/Dashboard.tsx', [
    ('MSP Analytics', 'Sangeetha Analytics'),
    ('mspanalytics.com', 'sangeethaanalytics.com'),
])

fix_file('frontend/index.html', [
    ('PhoneRetail Analytics', 'Sangeetha Analytics'),
    ('PhoneRetail Analytics — Sales Prediction Dashboard', 'Sangeetha Analytics Dashboard'),
])

fix_file('backend/main.py', [
    ('Phone Retail Sales Prediction API', 'Sangeetha Analytics API'),
    ('Phone Retail', 'Sangeetha'),
])

print("Done renaming!")
