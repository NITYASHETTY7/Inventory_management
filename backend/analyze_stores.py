import pandas as pd
import numpy as np

# Read sales data
df = pd.read_excel('backend/Sales_Combined.xlsx', header=2)
# the column is usually 'Branch' and 'Qty' or 'Sum of Qty'
if 'Qty' not in df.columns and 'Sum of Qty' in df.columns:
    df.rename(columns={'Sum of Qty': 'Qty'}, inplace=True)

store_sales = df.groupby('Branch')['Qty'].sum().sort_values(ascending=False)
store_sales = store_sales[~store_sales.index.str.contains('Grand Total', case=False, na=False)]
store_sales = store_sales[~store_sales.index.str.contains('Closed', case=False, na=False)]

print("Total stores:", len(store_sales))
print("\n--- Highest Sales (Top 4) ---")
print(store_sales.head(4).to_string())

print("\n--- Medium Sales (Around Median, 3 stores) ---")
median_idx = len(store_sales) // 2
print(store_sales.iloc[median_idx-1:median_idx+2].to_string())

print("\n--- Low Sales (Bottom 3) ---")
print(store_sales.tail(3).to_string())

