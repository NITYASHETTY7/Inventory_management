from data_processing import load_clean_data
import pandas as pd
df = load_clean_data()
BINS = [
    (0, 10000, "Under ₹10k"),
    (10000, 20000, "₹10k – ₹20k"),
    (20000, 30000, "₹20k – ₹30k"),
    (30000, 50000, "₹30k – ₹50k"),
    (50000, 80000, "₹50k – ₹80k"),
    (80000, 120000, "₹80k – ₹120k"),
    (120000, float('inf'), "Above ₹120k")
]

def get_price_ranges(brand=None):
    d = df
    if brand:
        d = d[d["Brand"] == brand]
    valid = []
    for min_v, max_v, label in BINS:
        if ((d["price"] >= min_v) & (d["price"] < max_v)).any():
            valid.append(label)
    return valid

print("All:", get_price_ranges())
print("Apple:", get_price_ranges("Apple"))
print("POCO:", get_price_ranges("POCO"))
