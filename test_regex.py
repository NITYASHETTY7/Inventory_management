import re

samples = [
    "Realme C85 5G 6GB 128GB Peacock Green",
    "Realme C85 5G 6GB 128GB Parrot Purple",
    "Realme C85 5G 4GB 128GB Parrot Purple",
    "Realme C85 5G 4GB 128GB Peacock Green",
    "A60s 8GB 128GB Green",
    "T1 PRO 6GB 128GB Turbo Black",
    "APX Reco"
]

def clean_model(raw):
    # Match patterns like 4GB, 128GB, 1TB, etc. and remove everything after the first match
    # using regex split
    match = re.search(r'\b\d+(?:GB|TB|MB)\b', raw, flags=re.IGNORECASE)
    if match:
        return raw[:match.start()].strip()
    return raw

for s in samples:
    print(f"{s} -> {clean_model(s)}")
