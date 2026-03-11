import pandas as pd
import numpy as np
import json
import os
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

ALLOWED_BRANCHES = [
    "Anna Nagar - 1 - (Near Thirumangalam Metro Station)",
    "Hosur - 2 - (Bagalur Circle)",
    "Vadapalani - 1 - (Near Signal)",
    "Chengalpattu - 2 - (GST Road)",
    "Virudhachalam - 1 - (ARK Complex)",
    "Dindigul - 3 - (Salai Road)",
    "Ambattur - 2 - (Near Rakki Cenimas)"
]

def build_profiles():
    file_path = os.path.join(os.path.dirname(__file__), 'Sales_Combined.xlsx')
    output_path = os.path.join(os.path.dirname(__file__), 'store_profiles.json')
    
    if not os.path.exists(file_path):
        print(f"Error: {file_path} not found.")
        return
        
    print(f"Building store profiles from {file_path}...")
    
    # Read the data, skipping the top rows usually skipped (header=2 in data_processing, let's just use data_processing logic or skip rows here)
    # actually data_processing uses header=2
    # but wait, existing build_store_profiles.py doesn't use header=2?
    # I'll just use the same as data_processing:
    # Actually let's just read it directly, the columns should match
    try:
        df = pd.read_excel(file_path, header=2)
    except Exception:
        df = pd.read_excel(file_path)

    # Clean columns to match data_processing exactly just in case
    df.columns = df.columns.str.strip()
    rename = {}
    for col in df.columns:
        low = col.lower().replace(".", "").replace(" ", "")
        if low in ("qty", "quantity", "sales", "units", "sumofqty"):
            rename[col] = "Qty"
        elif low == "itemmodel":
            rename[col] = "Item/Model"
        elif low == "branch":
            rename[col] = "Branch"
        elif low in ("date", "docdate"):
            rename[col] = "Date"
    df.rename(columns=rename, inplace=True)
    
    if "Branch" in df.columns:
        df["Branch"] = df["Branch"].ffill()
    if "Brand" in df.columns:
        df["Brand"] = df["Brand"].replace("Unknown", np.nan).ffill()
    if "Item/Model" in df.columns:
        df["Item/Model"] = df["Item/Model"].ffill()

    def _extract_brand(item_model: str) -> str:
        parts = str(item_model).rsplit("-", 1)
        return parts[-1].strip() if len(parts) == 2 else "Unknown"

    if "Brand" not in df.columns:
        df["Brand"] = df["Item/Model"].apply(_extract_brand)

    df = df[df['Branch'].isin(ALLOWED_BRANCHES)]
    
    df['Date'] = pd.to_datetime(df['Date'], dayfirst=True, errors="coerce")
    df.dropna(subset=["Date"], inplace=True)

    start_date = pd.to_datetime('2025-09-01')
    end_date = pd.to_datetime('2025-12-31')
    df = df[(df['Date'] >= start_date) & (df['Date'] <= end_date)]
    
    date_range = pd.date_range(start=start_date, end=end_date)
    
    # Actually we need Item/Model from the data. The prompt says: "For every unique (Branch × Brand × Item/Model)"
    # BUT wait, the model name should match how it's used later. data_processing extracts Model.
    def _extract_model(item_model: str) -> str:
        parts = str(item_model).rsplit("-", 1)
        return parts[0].strip() if len(parts) == 2 else str(item_model).strip()
    
    df["Model"] = df["Item/Model"].apply(_extract_model)

    grouped = df.groupby(['Branch', 'Brand', 'Model'])
    
    profiles = {}
    sparse_count = 0
    dense_count = 0
    total_segments = 0
    
    for (branch, brand, model_name), group in grouped:
        daily_sales = group.groupby('Date')['Qty'].sum().reindex(date_range, fill_value=0)
        
        if daily_sales.sum() == 0:
            continue
            
        first_sale_idx = daily_sales[daily_sales > 0].index.min()
        last_sale_idx = daily_sales[daily_sales > 0].index.max()
        days_with_data = (last_sale_idx - first_sale_idx).days + 1
        
        if days_with_data < 14:
            continue
            
        series = daily_sales[first_sale_idx:]
        
        mean_daily = float(series.mean())
        is_sparse = mean_daily < 3.0
        
        non_zero = series[series > 0]
        mean_nonzero_daily = float(non_zero.mean()) if len(non_zero) > 0 else 0.0
        
        zero_day_ratio = float((series == 0).mean())
        
        dow_multipliers = {}
        df_series = series.reset_index()
        df_series.columns = ['Date', 'Qty']
        df_series['DOW'] = df_series['Date'].dt.weekday
        
        dow_means = df_series.groupby('DOW')['Qty'].mean()
        overall_mean = df_series['Qty'].mean()
        
        for dow in range(7):
            if dow in dow_means and overall_mean > 0:
                dow_multipliers[str(dow)] = float(dow_means[dow] / overall_mean)
            else:
                dow_multipliers[str(dow)] = 1.0
                
        best_window = 5 if is_sparse else 14
        
        std_dev = float(series.std())
        volatility = float(std_dev / mean_daily) if mean_daily > 0 else 999.0
        
        if branch not in profiles:
            profiles[branch] = {}
        if brand not in profiles[branch]:
            profiles[branch][brand] = {}
            
        profiles[branch][brand][model_name] = {
            "mean_daily": round(mean_daily, 2),
            "mean_nonzero_daily": round(mean_nonzero_daily, 2),
            "zero_day_ratio": round(zero_day_ratio, 2),
            "dow_multipliers": {str(k): round(v, 2) for k, v in dow_multipliers.items()},
            "best_window": best_window,
            "is_sparse": is_sparse,
            "volatility": round(volatility, 2)
        }
        
        total_segments += 1
        if is_sparse:
            sparse_count += 1
        else:
            dense_count += 1
            
    with open(output_path, 'w') as f:
        json.dump(profiles, f, indent=2)
        
    print(f"✓ CHANGE 1 complete — Built store profiles: {total_segments} total segments ({sparse_count} sparse, {dense_count} dense).")

if __name__ == "__main__":
    build_profiles()
