import pandas as pd
from datetime import date, timedelta
from data_processing import filter_data, get_historical_summary, build_daily_series, filter_actual_data
from brand_affinity import compute_brand_affinity
from price_affinity import compute_price_affinity
from statistical_model import _dow_mults
from festival_calendar import get_festival_multiplier

def get_dynamic_affinity_multiplier(branch: str, brand: str, model: str = None, price_range: str = None) -> float:
    if not branch or not brand:
        return 1.0
    
    try:
        affinity_data = compute_brand_affinity(model=model, price_range=price_range)
        if affinity_data and affinity_data['cells']:
            for cell in affinity_data['cells']:
                if cell['store'] == branch and cell['brand'] == brand:
                    affinity_score = cell['affinity_score']
                    multiplier = 0.5 + (affinity_score / 100.0)
                    return multiplier
    except Exception as e:
        print(f"Could not calculate dynamic brand affinity, falling back to 1.0. Error: {e}")
    
    return 1.0

def get_dynamic_price_affinity_multiplier(branch: str, price_range: str, brand: str = None, model: str = None) -> float:
    if not branch or not price_range:
        return 1.0
    
    try:
        affinity_data = compute_price_affinity(brand=brand, model=model)
        if affinity_data and 'cells' in affinity_data:
            for cell in affinity_data['cells']:
                if cell['store'] == branch and cell['band'] == price_range:
                    affinity_score = cell['affinity_score']
                    multiplier = 0.5 + (affinity_score / 100.0)
                    return multiplier
    except Exception as e:
        print(f"Could not calculate dynamic price affinity, falling back to 1.0. Error: {e}")
    
    return 1.0

def run_curated_msp_window(branch: str, brand: str, model: str, price_range: str, enable_dow: bool = False, enable_festival: bool = False, enable_price_affinity: bool = False, enable_brand_affinity: bool = False, w1: float = 0.5, w2: float = 0.3, w3: float = 0.2):
    # Get all data to compute moving averages dynamically
    # We need data up to Feb 10
    df = filter_data(branch=branch, brand=brand, model=model, price_range=price_range)
    daily, _ = build_daily_series(df)

    if daily.empty:
        start_date = date(2025, 9, 1)
        end_date = date(2026, 2, 10)
        dates = [start_date + timedelta(days=i) for i in range((end_date - start_date).days + 1)]
        daily_data = [{"date": d.isoformat(), "actual": 0, "predicted": 0, "avg7": 0, "avg28": 0, "avg60": 0, "affinity": 1.0} for d in dates]
        return {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "daily_data": daily_data
        }
    
    df_actual = filter_actual_data(branch=branch, brand=brand, model=model, price_range=price_range)
    daily_actual, _ = build_daily_series(df_actual)
    
    # Automatically detect earliest available sales date
    if not daily.empty:
        start_date = daily.index.min().date()
    else:
        start_date = date(2025, 9, 1)
        
    end_date = date(2026, 2, 10)
    
    # Generate date range
    dates = [start_date + timedelta(days=i) for i in range((end_date - start_date).days + 1)]
    
    dow_series = pd.Series(daily.index.dayofweek, index=daily.index)
    if enable_dow and not daily.empty:
        dow_multipliers = _dow_mults(daily, dow_series)
    else:
        dow_multipliers = {i: 1.0 for i in range(7)}
    
    affinity = get_dynamic_affinity_multiplier(branch, brand, model, price_range) if enable_brand_affinity else 1.0
    price_affinity = get_dynamic_price_affinity_multiplier(branch, price_range, brand, model) if enable_price_affinity else 1.0
    
    daily_data = []
    
    for d in dates:
        ts_d = pd.Timestamp(d)
        
        # Calculate moving averages strictly before `d`
        # Using .loc for faster slicing
        start_7 = ts_d - pd.Timedelta(days=7)
        end_7 = ts_d - pd.Timedelta(days=1)
        past_7 = daily.loc[start_7:end_7]
        avg7 = past_7.sum() / 7.0
        
        start_28 = ts_d - pd.Timedelta(days=28)
        end_28 = ts_d - pd.Timedelta(days=8)
        past_28 = daily.loc[start_28:end_28]
        avg28 = past_28.sum() / 21.0
        
        start_60 = ts_d - pd.Timedelta(days=60)
        end_60 = ts_d - pd.Timedelta(days=30)
        past_60 = daily.loc[start_60:end_60]
        avg60 = past_60.sum() / 31.0
        
        # Formula
        base_pred = (w1 * avg7) + (w2 * avg28) + (w3 * avg60)
        
        dow_mult = dow_multipliers.get(d.weekday(), 1.0) if enable_dow else 1.0
        
        if enable_festival:
            fest_m, _ = get_festival_multiplier(d)
        else:
            fest_m = 1.0
            
        final_pred = base_pred * affinity * price_affinity * dow_mult * fest_m
        
        if ts_d < pd.Timestamp(2026, 1, 1):
            actual_val = daily.get(ts_d, 0)
        else:
            actual_val = daily_actual.get(ts_d, 0)
            # Update daily with actual sales so the moving average window keeps moving properly!
            daily[ts_d] = actual_val
        
        # Ensure we don't have NaNs
        import math
        if math.isnan(final_pred): final_pred = 0
        if math.isnan(actual_val): actual_val = 0
            
        daily_data.append({
            "date": d.isoformat(),
            "actual": float(actual_val),
            "predicted": float(final_pred),
            "avg7": float(avg7),
            "avg28": float(avg28),
            "avg60": float(avg60),
            "affinity": float(affinity)
        })
        
    future_daily_data = []
    future_start_date = date(2026, 2, 10)
    future_end_date = future_start_date + timedelta(days=90) # 3 months
    future_dates = [future_start_date + timedelta(days=i) for i in range((future_end_date - future_start_date).days + 1)]
    
    # We will use the same 'daily' series to compute moving averages, 
    # but for future dates, we append the PREDICTED value so it feeds back into the MA
    for d in future_dates:
        ts_d = pd.Timestamp(d)
        
        start_7 = ts_d - pd.Timedelta(days=7)
        end_7 = ts_d - pd.Timedelta(days=1)
        past_7 = daily.loc[start_7:end_7]
        avg7 = past_7.sum() / 7.0
        
        start_28 = ts_d - pd.Timedelta(days=28)
        end_28 = ts_d - pd.Timedelta(days=8)
        past_28 = daily.loc[start_28:end_28]
        avg28 = past_28.sum() / 21.0
        
        start_60 = ts_d - pd.Timedelta(days=60)
        end_60 = ts_d - pd.Timedelta(days=30)
        past_60 = daily.loc[start_60:end_60]
        avg60 = past_60.sum() / 31.0
        
        base_pred = (w1 * avg7) + (w2 * avg28) + (w3 * avg60)
        dow_mult = dow_multipliers.get(d.weekday(), 1.0) if enable_dow else 1.0
        
        if enable_festival:
            fest_m, _ = get_festival_multiplier(d)
        else:
            fest_m = 1.0
            
        final_pred = base_pred * affinity * price_affinity * dow_mult * fest_m
        if math.isnan(final_pred): final_pred = 0
        
        # Feed prediction back into the series for future moving averages
        daily[ts_d] = final_pred
        
        future_daily_data.append({
            "date": d.isoformat(),
            "actual": 0.0, # no actual for future
            "predicted": float(final_pred),
            "avg7": float(avg7),
            "avg28": float(avg28),
            "avg60": float(avg60),
            "affinity": float(affinity)
        })

    return {
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "daily_data": daily_data,
        "future_daily_data": future_daily_data
    }
