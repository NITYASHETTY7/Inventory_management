import os
import re

# 1. Update `api_routes.py`
api_path = "backend/api_routes.py"
with open(api_path, "r") as f:
    content = f.read()

# Change apply_brand_affinity, apply_price_affinity, apply_dow, apply_festival defaults to False
content = re.sub(r'apply_brand_affinity: bool = True', 'apply_brand_affinity: bool = False', content)
content = re.sub(r'apply_price_affinity: bool = True', 'apply_price_affinity: bool = False', content)
content = re.sub(r'apply_dow: bool = True', 'apply_dow: bool = False', content)
content = re.sub(r'apply_festival: bool = True', 'apply_festival: bool = False', content)

with open(api_path, "w") as f:
    f.write(content)


# 2. Update `curated_msp.py`
msp_path = "backend/curated_msp.py"
with open(msp_path, "r") as f:
    content = f.read()

# add validation for multipliers
multiplier_fix = """
        dow_mult = dow_multipliers.get(d.weekday(), 1.0) if enable_dow else 1.0
        
        if enable_festival:
            fest_m, _ = get_festival_multiplier(d)
        else:
            fest_m = 1.0
            
        # CLAMP MULTIPLIERS to avoid extreme scaling errors
        affinity = max(0.5, min(1.5, affinity))
        price_affinity = max(0.5, min(1.5, price_affinity))
        dow_mult = max(0.5, min(2.0, dow_mult))
        fest_m = max(1.0, min(2.0, fest_m))
        
        final_pred = base_pred * affinity * price_affinity * dow_mult * fest_m
"""

content = re.sub(r'''\s*dow_mult = dow_multipliers.get\(d.weekday\(\), 1.0\) if enable_dow else 1.0\s*
\s*if enable_festival:
\s*fest_m, _ = get_festival_multiplier\(d\)
\s*else:
\s*fest_m = 1.0\s*
\s*final_pred = base_pred \* affinity \* price_affinity \* dow_mult \* fest_m''', multiplier_fix, content)

with open(msp_path, "w") as f:
    f.write(content)

print("Backend files patched.")
