import sys

def patch(file):
    with open(file, 'r') as f:
        lines = f.readlines()
    if 'from typing import Optional' not in ''.join(lines):
        for i, line in enumerate(lines):
            if not line.startswith('from __future__'):
                lines.insert(i, 'from typing import Optional\n')
                break
    with open(file, 'w') as f:
        f.writelines(lines)

patch('api_routes.py')
patch('prediction_service.py')
