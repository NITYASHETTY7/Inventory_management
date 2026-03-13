import pandas as pd
dates = pd.to_datetime(["2025-09-05", "2025-09-10"])
s = pd.Series([10, 20], index=dates)
print("loc output:")
start = pd.Timestamp("2025-09-01")
end = pd.Timestamp("2025-09-07")
print(s.loc[start:end])
print("Sum:", s.loc[start:end].sum())
