import pandas as pd
from pathlib import Path

file_path = Path("backend/feb_sales.xlsx")

def extract_brand(item_model):
    if pd.isna(item_model):
        return "Unknown"
    parts = str(item_model).rsplit("-", 1)
    if len(parts) == 2:
        return parts[-1].strip()
    return "Unknown"

print(f"Reading {file_path}...")
# header=0 for this file based on previous check
df = pd.read_excel(file_path, header=0)

print("Columns:", df.columns.tolist())

if 'Item/Model' not in df.columns:
    print("Error: 'Item/Model' column not found!")
    # Check if normalized names match?
    # Based on previous check, columns include 'Item/Model'.
    pass

print("Extracting Brand...")
df['Brand'] = df['Item/Model'].apply(extract_brand)

print("Saving back to Excel...")
df.to_excel(file_path, index=False)
print("Done.")
