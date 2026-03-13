import pandas as pd
from backend.data_processing import _load_model_family_map, load_clean_data

df = load_clean_data()
extracted_models = df['Model'].unique()
families = set(_load_model_family_map())

ungrouped = [m for m in extracted_models if m not in families]

print(f"Total extracted models (unique): {len(extracted_models)}")
print(f"Total families loaded: {len(families)}")
print(f"Ungrouped models count: {len(ungrouped)}")
for ex in ungrouped[:50]:
    print(f"Ungrouped: {ex}")
