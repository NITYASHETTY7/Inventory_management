import pandas as pd
from pathlib import Path

file_path = Path("backend/Sales_Combined.xlsx")

def extract_brand(item_model):
    if pd.isna(item_model):
        return "Unknown"
    parts = str(item_model).rsplit("-", 1)
    if len(parts) == 2:
        return parts[-1].strip()
    return "Unknown"

print(f"Reading {file_path}...")
df_all = pd.read_excel(file_path, header=None)

# Find the header row (index 2)
header_row_idx = 2
headers = df_all.iloc[header_row_idx]

# Find Item/Model column index
im_col_idx = -1
for i, h in enumerate(headers):
    if str(h).strip() == 'Item/Model':
        im_col_idx = i
        break

if im_col_idx == -1:
    print("Could not find Item/Model column in header row")
    exit(1)

print(f"Found 'Item/Model' at column index {im_col_idx}")

# Add new column index
new_col_idx = len(df_all.columns)
df_all[new_col_idx] = None  # Create new column

# Set header title
df_all.iloc[header_row_idx, new_col_idx] = 'Brand'

print("Extracting Brand...")
# Apply extraction to all data rows
for i in range(header_row_idx + 1, len(df_all)):
    val = df_all.iloc[i, im_col_idx]
    brand = extract_brand(val)
    df_all.iloc[i, new_col_idx] = brand

print("Writing file...")
df_all.to_excel(file_path, index=False, header=False)
print("Done.")
