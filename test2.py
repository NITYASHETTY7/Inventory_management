import pandas as pd
from datetime import date
from backend.data_processing import filter_data, build_daily_series

branch = "Arumbakkam  - 1 - (MMDA Colony)"
brand = "Apple"
price_range = "₹80k – ₹120k"

df = filter_data(branch=branch, brand=brand, price_range=price_range)
daily, _ = build_daily_series(df)

ts_d = pd.Timestamp(date(2025, 12, 1))

start_7 = ts_d - pd.Timedelta(days=7)
end_7 = ts_d - pd.Timedelta(days=1)
past_7 = daily.loc[start_7:end_7]

print(past_7)
print("Length:", len(past_7))
print("Mean:", past_7.mean())
print("Actual 7 day average:", past_7.sum() / 7.0)

