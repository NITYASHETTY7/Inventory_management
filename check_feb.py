import pandas as pd

# Try to read header at row 2 (index 2)
df = pd.read_excel('backend/feb_sales.xlsx', header=2, nrows=10)
print("Columns:", df.columns)
print(df.head())
