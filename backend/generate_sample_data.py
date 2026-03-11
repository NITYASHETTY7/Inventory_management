"""
generate_sample_data.py
-----------------------
Generates a realistic sales_data.csv covering Sep 1 – Dec 31 2025.

HOW TO USE YOUR OWN DATA
-------------------------
Simply replace sales_data.csv in the backend/ folder with your own file.
Supported formats: .xlsx or .csv
Required columns: Branch | I/M Code | Item/Model | Date | Qty.
Date format: DD/MM/YYYY
Brand is extracted from the trailing "-Brand" suffix in Item/Model.

Run this script only if you want fresh sample data:
    python generate_sample_data.py
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta

np.random.seed(42)

BRANCHES = [
    "Adambakkam - 2 - (Jayalakshmi Theatre)",
    "Alwarpet - 2 - (Ramasamy Naicken Street)",
    "Anna Nagar - 3 - (Tower Circle)",
    "Velachery - 1 - (Phoenix Mall)",
    "T Nagar - 4 - (Pondy Bazaar)",
    "Porur - 2 - (Ramapuram Junction)",
]

PHONES = [
    ("Vivo V60 12 256 MB",    "Vivo V60 5G 12GB 256GB Moonlight Blue-Vivo",          "Vivo"),
    ("SM-A176BZBMINU",        "Samsung A17 5G 8GB 128GB Blue-Samsung",               "Samsung"),
    ("SM-S938BZKGINS",        "Samsung S25 Ultra 12GB 512GB Titanium Black-Samsung",  "Samsung"),
    ("RMX4091",               "Realme GT 7 Pro 12GB 256GB Mars Red-Realme",           "Realme"),
    ("2409BPN0EG",            "Xiaomi 15 12GB 512GB Midnight Black-Xiaomi",           "Xiaomi"),
    ("CPH2691",               "OPPO Reno 13 8GB 256GB Ivory White-OPPO",             "OPPO"),
    ("iPhone16PM-256-BT",     "Apple iPhone 16 Pro Max 256GB Black Titanium-Apple",   "Apple"),
    ("iPhone16-128-BK",       "Apple iPhone 16 128GB Black-Apple",                   "Apple"),
    ("PH2716",                "OnePlus 13 12GB 512GB Midnight Ocean-OnePlus",         "OnePlus"),
    ("NokiaG42-128-PK",       "Nokia G42 5G 6GB 128GB So Pink-Nokia",                "Nokia"),
    ("V2324",                 "Vivo Y200 8GB 128GB Sequoia Green-Vivo",              "Vivo"),
    ("SM-A556EZKAINS",        "Samsung A55 5G 8GB 256GB Navy-Samsung",               "Samsung"),
    ("RMX3686",               "Realme Narzo 60X 4GB 64GB Nebula Purple-Realme",       "Realme"),
    ("23049PCD8G",            "Xiaomi Redmi Note 13 Pro 8GB 256GB Arctic White-Xiaomi","Xiaomi"),
    ("MD1Q4HN/A",             "Apple iPhone 16e 128GB Black-Apple",                  "Apple"),
]

# Weekend spike, Diwali boost in Oct
DOW_MULT   = {0:0.80,1:0.85,2:0.90,3:1.00,4:1.10,5:1.45,6:1.55}
DIWALI     = {datetime(2025,10,20),datetime(2025,10,21),datetime(2025,10,22),
              datetime(2025,10,23),datetime(2025,10,24)}
BASE_UNITS = {"Apple":3,"Samsung":4,"Vivo":3,"Xiaomi":2,
              "Realme":2,"OPPO":2,"OnePlus":2,"Nokia":1}

start = datetime(2025, 9, 1)
end   = datetime(2025, 12, 31)

rows = []
cur  = start
while cur <= end:
    dow_m   = DOW_MULT[cur.weekday()]
    fest_m  = 1.8 if cur in DIWALI else 1.0
    for branch in BRANCHES:
        for im_code, item_model, brand in PHONES:
            base     = BASE_UNITS.get(brand, 2)
            mean_qty = max(0.1, base * dow_m * fest_m * np.random.uniform(0.6, 1.4))
            qty      = int(np.random.poisson(mean_qty))
            if qty > 0:
                rows.append({
                    "Branch":     branch,
                    "I/M Code":   im_code,
                    "Item/Model": item_model,
                    "Date":       cur.strftime("%d/%m/%Y"),
                    "Qty.":       qty,
                })
    cur += timedelta(days=1)

df = pd.DataFrame(rows)
df.to_csv("sales_data.csv", index=False)
print(f"Generated {len(df):,} rows covering {start.date()} → {end.date()} → sales_data.csv")
