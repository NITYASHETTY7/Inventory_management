import pandas as pd
from datetime import date
from data_processing import load_clean_data, filter_data, build_daily_series
from brand_affinity import compute_brand_affinity
from price_affinity import compute_price_affinity
from statistical_model import _dow_mults

# Parameters
branch = "Arumbakkam  - 1 - (MMDA Colony)"
brand = "Apple"
price_range = "₹80k – ₹120k"
target_date = pd.Timestamp(date(2025, 12, 1)) # A random target date in the dataset

# 1. Base Prediction Data
df = filter_data(branch=branch, brand=brand, price_range=price_range)
daily, _ = build_daily_series(df)

start_7 = target_date - pd.Timedelta(days=7)
end_7 = target_date - pd.Timedelta(days=1)
past_7 = daily.loc[start_7:end_7]
avg7 = past_7.sum() / 7.0

start_28 = target_date - pd.Timedelta(days=28)
end_28 = target_date - pd.Timedelta(days=8)
past_28 = daily.loc[start_28:end_28]
avg28 = past_28.sum() / 21.0

start_60 = target_date - pd.Timedelta(days=60)
end_60 = target_date - pd.Timedelta(days=30)
past_60 = daily.loc[start_60:end_60]
avg60 = past_60.sum() / 31.0

w1, w2, w3 = 0.5, 0.3, 0.2
base_pred = (w1 * avg7) + (w2 * avg28) + (w3 * avg60)

print(f"--- BASE PREDICTION ---")
print(f"Target Date: {target_date.date()}")
print(f"past_7 mean: {avg7:.2f}, past_28 mean: {avg28:.2f}, past_60 mean: {avg60:.2f}")
print(f"Base Pred: {base_pred:.2f}")

# 2. Brand Affinity
aff_data = compute_brand_affinity()
brand_score = 0
for c in aff_data['cells']:
    if c['store'] == branch and c['brand'] == brand:
        brand_score = c['affinity_score']
        break
brand_mult = 0.5 + (brand_score / 100.0)

print(f"\n--- BRAND AFFINITY ---")
print(f"Brand Score: {brand_score:.2f}")
print(f"Brand Mult: {brand_mult:.2f}")

# 3. Price Affinity
price_aff_data = compute_price_affinity(brand=brand)
price_score = 0
for c in price_aff_data['cells']:
    if c['store'] == branch and c['band'] == price_range:
        price_score = c['affinity_score']
        break
price_mult = 0.5 + (price_score / 100.0)

print(f"\n--- PRICE AFFINITY ---")
print(f"Price Score: {price_score:.2f}")
print(f"Price Mult: {price_mult:.2f}")

# 4. DOW Multiplier
dow_series = pd.Series(daily.index.dayofweek, index=daily.index)
dow_multipliers = _dow_mults(daily, dow_series)
dow_mult = dow_multipliers.get(target_date.weekday(), 1.0)

print(f"\n--- DOW MULTIPLIER ---")
print(f"Target is weekday {target_date.weekday()} (Mon=0, Sun=6)")
print(f"DOW Mult: {dow_mult:.2f}")

# 5. Festival Multiplier
from festival_calendar import get_festival_multiplier
fest_m, fest_name = get_festival_multiplier(target_date.date())

print(f"\n--- FESTIVAL MULTIPLIER ---")
print(f"Festival: {fest_name}")
print(f"Festival Mult: {fest_m:.2f}")

final_pred = base_pred * brand_mult * price_mult * dow_mult * fest_m
print(f"\n--- FINAL ---")
print(f"Final Pred = {base_pred:.2f} * {brand_mult:.2f} * {price_mult:.2f} * {dow_mult:.2f} * {fest_m:.2f} = {final_pred:.2f}")

