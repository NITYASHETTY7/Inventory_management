import pandas as pd
import numpy as np
import re
import math
from datetime import date, timedelta
from typing import List, Dict, Any, Tuple
from pathlib import Path

from data_processing import load_clean_data, PRICE_BINS, _extract_model
from brand_affinity import compute_brand_affinity
from price_affinity import compute_price_affinity
from festival_calendar import get_festival_multiplier

PREMIUM_BRANDS = ["Apple", "Samsung"]
BUDGET_BRANDS  = ["Oppo", "Vivo", "Realme", "Poco", "Motorola", "Nokia"]

def get_brand_affinity_multiplier(branch: str, brand: str) -> float:
    if not branch or not brand:
        return 1.0
    try:
        aff_data = compute_brand_affinity(branch=branch, brand=brand)
        if aff_data and "cells" in aff_data:
            for cell in aff_data["cells"]:
                if cell["store"] == branch and cell["brand"] == brand:
                    score = cell.get("affinity_score", 50)
                    return float(score) / 100.0 + 0.5
    except Exception:
        pass
    return 1.0

def get_price_affinity_multiplier(branch: str, price_band: str) -> float:
    if not branch or not price_band:
        return 1.0
    try:
        aff_data = compute_price_affinity(branch=branch)
        if aff_data and "cells" in aff_data:
            for cell in aff_data["cells"]:
                if cell["store"] == branch and cell["band"] == price_band:
                    score = cell.get("affinity_score", 50)
                    return float(score) / 100.0 + 0.5
    except Exception:
        pass
    return 1.0

def get_dow_multiplier(branch: str, model: str, sales_df: pd.DataFrame) -> dict:
    df = sales_df[(sales_df["Branch"] == branch) & (sales_df["Model"] == model)]
    if df.empty or len(df) < 14:
        return {i: 1.0 for i in range(7)}
    
    # daily sales
    daily = df.groupby("Date")["Qty"].sum().reset_index()
    daily["DOW"] = daily["Date"].dt.dayofweek
    dow_avg = daily.groupby("DOW")["Qty"].mean()
    overall_avg = daily["Qty"].mean()
    
    mults = {}
    for i in range(7):
        if overall_avg > 0 and i in dow_avg:
            mults[i] = float(dow_avg[i] / overall_avg)
        else:
            mults[i] = 1.0
    return mults

def get_price_band(mop: float) -> str:
    for min_v, max_v, label in PRICE_BINS:
        if min_v <= mop < max_v:
            return label
    return "Unknown"

def get_sales_window(sales_df: pd.DataFrame, branch: str, model: str, as_of_date: date) -> dict:
    df = sales_df[(sales_df["Branch"] == branch) & (sales_df["Model"] == model)].copy()
    if df.empty:
        return {"avg7": 0.0, "avg7_28": 0.0, "avg30_60": 0.0, "has_data": False}
    
    df["Date"] = pd.to_datetime(df["Date"]).dt.date
    daily = df.groupby("Date")["Qty"].sum()
    
    def get_avg(start_days, end_days):
        end_d = as_of_date - timedelta(days=start_days)
        start_d = as_of_date - timedelta(days=end_days)
        
        # generate continuous date range
        idx = pd.date_range(start=start_d, end=end_d)
        window_sales = daily.reindex(idx.date, fill_value=0)
        
        if len(window_sales) == 0:
            return 0.0
        return float(window_sales.mean())
    
    avg7 = get_avg(0, 7)
    avg7_28 = get_avg(8, 28)
    avg30_60 = get_avg(29, 60)
    
    return {
        "avg7": avg7,
        "avg7_28": avg7_28,
        "avg30_60": avg30_60,
        "has_data": (avg7 > 0 or avg7_28 > 0 or avg30_60 > 0)
    }

def compute_wma_base(avg7: float, avg7_28: float, avg30_60: float, w1: float, w2: float, w3: float) -> float:
    return (w1 * avg7) + (w2 * avg7_28) + (w3 * avg30_60)

def get_hype_multiplier(brand: str, days_since_launch: int, hype_duration_days: int = 14, peak_multiplier: float = 2.5) -> float:
    if days_since_launch > hype_duration_days:
        return 1.0
        
    if brand in PREMIUM_BRANDS:
        if days_since_launch <= 3:
            return peak_multiplier
        elif days_since_launch <= 7:
            return peak_multiplier * 0.7
        else:
            # linear decay from (peak_multiplier * 0.7) to 1.0
            start_val = peak_multiplier * 0.7
            decay_days = hype_duration_days - 7
            if decay_days <= 0: return 1.0
            current_day = days_since_launch - 7
            return start_val - ((start_val - 1.0) * (current_day / decay_days))
    else:
        # budget brands
        if days_since_launch <= 7:
            return 1.2
        return 1.0

def is_direct_successor(model_a: str, model_b: str) -> bool:
    # Extract suffix
    match_a = re.search(r'([A-Za-z\s]+?)(\d+)$', model_a.strip())
    match_b = re.search(r'([A-Za-z\s]+?)(\d+)$', model_b.strip())
    if match_a and match_b:
        prefix_a, num_a = match_a.groups()
        prefix_b, num_b = match_b.groups()
        if prefix_a.strip().lower() == prefix_b.strip().lower():
            if int(num_b) == int(num_a) + 1:
                return True
    return False

def get_model_catalog(sales_df: pd.DataFrame, mop_df: pd.DataFrame) -> List[Dict[str, Any]]:
    # build catalog from MOP + Sales
    catalog = []
    
    if mop_df is not None and not mop_df.empty:
        # Use MOP as base
        for _, row in mop_df.iterrows():
            im_code = str(row.get("Code", ""))
            item_model = str(row.get("Item/Model", ""))
            brand = str(row.get("Brand", ""))
            mop = float(row.get("MOP", 0.0)) if pd.notna(row.get("MOP")) else 0.0
            price_band = get_price_band(mop)
            
            # Map Item/Model to standard model name
            model_clean = _extract_model(item_model)
            
            model_sales = sales_df[sales_df["Model"] == model_clean]
            days_of_data = 0
            first_sale = ""
            last_sale = ""
            if not model_sales.empty:
                dates = pd.to_datetime(model_sales["Date"]).dt.date
                days_of_data = dates.nunique()
                first_sale = str(dates.min())
                last_sale = str(dates.max())
                brand = model_sales["Brand"].iloc[0] # use sales brand if available
                
            catalog.append({
                "im_code": im_code or model_clean,
                "item_model": model_clean,
                "brand": brand,
                "mop": mop,
                "price_band": price_band,
                "days_of_data": days_of_data,
                "first_sale": first_sale,
                "last_sale": last_sale
            })
    else:
        # Fallback to just sales df if mop is missing
        models = sales_df["Model"].unique()
        for m in models:
            model_sales = sales_df[sales_df["Model"] == m]
            brand = model_sales["Brand"].iloc[0]
            dates = pd.to_datetime(model_sales["Date"]).dt.date
            mop = float(model_sales["price"].iloc[0]) if "price" in model_sales.columns and not model_sales["price"].empty else 0.0
            catalog.append({
                "im_code": m,
                "item_model": m,
                "brand": brand,
                "mop": mop,
                "price_band": get_price_band(mop),
                "days_of_data": dates.nunique(),
                "first_sale": str(dates.min()),
                "last_sale": str(dates.max())
            })
    
    # Sort
    catalog.sort(key=lambda x: (x["brand"], x["item_model"]))
    return catalog

def auto_suggest_lookalikes(target_im_code: str, target_brand: str, target_mop: float, model_catalog: List[Dict[str, Any]], top_n: int = 3) -> List[Dict[str, Any]]:
    target_item_model = target_im_code
    for c in model_catalog:
        if c["im_code"] == target_im_code:
            target_item_model = c["item_model"]
            break

    suggestions = []
    match_target = re.search(r'([A-Za-z\s]+?)(\d+)$', target_item_model.strip())

    for c in model_catalog:
        if c["im_code"] == target_im_code or c["item_model"] == target_item_model:
            continue
        if c["days_of_data"] < 30:
            continue

        # Price filter — must be within 30% of target MOP
        # Price filter — same brand gets 50% tolerance, cross-brand gets 30%
        if target_mop > 0 and c["mop"] > 0:
            price_ratio = abs(c["mop"] - target_mop) / target_mop
            same_brand = target_brand and c["brand"].lower() == target_brand.lower()
            max_ratio = 0.50 if same_brand else 0.30
            if price_ratio > max_ratio:
                continue

        score = 0
        match_reason = []
        is_succ = False

        if match_target:
            target_prefix, target_num = match_target.groups()
            match_c = re.search(r'([A-Za-z\s]+?)(\d+)$', c["item_model"].strip())
            if match_c:
                c_prefix, c_num = match_c.groups()
                if target_prefix.strip().lower() == c_prefix.strip().lower():
                    score += 50
                    match_reason.append(f"Same series ({target_prefix.strip()})")
                    gen_diff = abs(int(target_num) - int(c_num))
                    score -= (5 * gen_diff)
                    if gen_diff > 0:
                        match_reason.append(f"{gen_diff} generation(s) apart")
                    if int(target_num) == int(c_num) + 1:
                        is_succ = True
                        score += 20

        if target_brand and c["brand"].lower() == target_brand.lower():
            score += 30
            if not any("Same series" in r for r in match_reason):
                match_reason.append("Same brand")
        else:
            # Heavy penalty for cross-brand matches
            score -= 40


        mop_diff = abs(target_mop - c["mop"])
        price_score = max(0, 20 - (mop_diff / 1000.0))
        score += price_score
        if price_score > 10:
            match_reason.append(f"Similar price (±₹{mop_diff:,.0f})")

        suggestions.append({
            "im_code": c["im_code"],
            "item_model": c["item_model"],
            "brand": c["brand"],
            "mop": c["mop"],
            "price_band": c["price_band"],
            "lookalike_score": max(0, min(100, int(score))),
            "match_reason": ", ".join(match_reason) if match_reason else "General fallback",
            "days_of_data": c["days_of_data"],
            "is_direct_successor": is_succ
        })

    suggestions.sort(key=lambda x: x["lookalike_score"], reverse=True)

    # Deduplicate by item_model
    seen_models = set()
    unique_suggestions = []
    for s in suggestions:
        if s["item_model"] not in seen_models:
            seen_models.add(s["item_model"])
            unique_suggestions.append(s)

   
    # Fallback 1: same brand, relax price filter to 50%
    if not unique_suggestions:
        for c in model_catalog:
            if c["im_code"] == target_im_code or c["item_model"] == target_item_model:
                continue
            if c["days_of_data"] < 7:
                continue
            if target_brand and c["brand"].lower() != target_brand.lower():
                continue
            mop_diff = abs(target_mop - c["mop"])
            if target_mop > 0 and c["mop"] > 0:
                price_ratio = mop_diff / target_mop
                if price_ratio > 0.50:
                    continue
            unique_suggestions.append({
                "im_code": c["im_code"],
                "item_model": c["item_model"],
                "brand": c["brand"],
                "mop": c["mop"],
                "price_band": c["price_band"],
                "lookalike_score": max(0, min(100, int(30 + max(0, 20 - mop_diff / 1000.0)))),
                "match_reason": f"Same brand, ±₹{mop_diff:,.0f} price diff",
                "days_of_data": c["days_of_data"],
                "is_direct_successor": False
            })
        unique_suggestions.sort(key=lambda x: x["lookalike_score"], reverse=True)
        seen = set()
        deduped = []
        for s in unique_suggestions:
            if s["item_model"] not in seen:
                seen.add(s["item_model"])
                deduped.append(s)
        unique_suggestions = deduped

    # Fallback 2: same brand, any price
    if not unique_suggestions:
        for c in model_catalog:
            if c["im_code"] == target_im_code or c["item_model"] == target_item_model:
                continue
            if c["days_of_data"] < 7:
                continue
            if target_brand and c["brand"].lower() != target_brand.lower():
                continue
            mop_diff = abs(target_mop - c["mop"])
            unique_suggestions.append({
                "im_code": c["im_code"],
                "item_model": c["item_model"],
                "brand": c["brand"],
                "mop": c["mop"],
                "price_band": c["price_band"],
                "lookalike_score": max(0, min(100, int(20 + max(0, 20 - mop_diff / 1000.0)))),
                "match_reason": f"Same brand fallback, ±₹{mop_diff:,.0f} price diff",
                "days_of_data": c["days_of_data"],
                "is_direct_successor": False
            })
        unique_suggestions.sort(key=lambda x: x["lookalike_score"], reverse=True)
        seen = set()
        deduped = []
        for s in unique_suggestions:
            if s["item_model"] not in seen:
                seen.add(s["item_model"])
                deduped.append(s)
        unique_suggestions = deduped

    # Fallback 3: any brand, closest price (last resort)
    if not unique_suggestions:
        for c in model_catalog:
            if c["im_code"] == target_im_code or c["item_model"] == target_item_model:
                continue
            if c["days_of_data"] < 14:
                continue
            mop_diff = abs(target_mop - c["mop"])
            unique_suggestions.append({
                "im_code": c["im_code"],
                "item_model": c["item_model"],
                "brand": c["brand"],
                "mop": c["mop"],
                "price_band": c["price_band"],
                "lookalike_score": max(0, min(100, int(10 + max(0, 20 - mop_diff / 1000.0)))),
                "match_reason": f"⚠️ Cross-brand fallback (no same-brand data), ±₹{mop_diff:,.0f} price diff",
                "days_of_data": c["days_of_data"],
                "is_direct_successor": False
            })
        unique_suggestions.sort(key=lambda x: x["lookalike_score"], reverse=True)
        seen = set()
        deduped = []
        for s in unique_suggestions:
            if s["item_model"] not in seen:
                seen.add(s["item_model"])
                deduped.append(s)
        unique_suggestions = deduped

    return unique_suggestions[:top_n]

def find_store_lookalikes(new_lat: float, new_lon: float, existing_stores_df: pd.DataFrame, top_n: int = 3, max_radius_km: float = 15.0) -> List[Dict[str, Any]]:
    # Haversine
    def haversine(lat1, lon1, lat2, lon2):
        R = 6371.0
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R * c
        
    stores = []
    for _, row in existing_stores_df.iterrows():
        branch = row.get("branch") or row.get("Branch")
        lat = row.get("lat") or row.get("Latitude")
        lon = row.get("lon") or row.get("Longitude")
        
        if pd.isna(lat) or pd.isna(lon) or not branch:
            continue
            
        dist = haversine(new_lat, new_lon, float(lat), float(lon))
        if dist <= max_radius_km:
            stores.append({
                "branch": branch,
                "distance_km": round(dist, 1)
            })
            
    stores.sort(key=lambda x: x["distance_km"])
    stores = stores[:top_n]
    
    # Calculate weights
    total_inv = sum(1.0 / (s["distance_km"] + 0.1) for s in stores)
    for s in stores:
        s["weight"] = (1.0 / (s["distance_km"] + 0.1)) / total_inv
        s["weight"] = round(s["weight"], 2)
        
    # ensure sum is exactly 1.0
    if stores:
        stores[0]["weight"] += 1.0 - sum(s["weight"] for s in stores)
        
    return stores

def find_price_brand_lookalikes(brand: str, target_mop: float, price_band_tolerance: float, sales_df: pd.DataFrame, mop_df: pd.DataFrame, min_days_of_data: int = 14) -> List[Dict[str, Any]]:
    catalog = get_model_catalog(sales_df, mop_df)
    filtered = []
    for c in catalog:
        if c["brand"].lower() == brand.lower() and c["days_of_data"] >= min_days_of_data:
            if abs(c["mop"] - target_mop) <= price_band_tolerance:
                # Score them
                mop_diff = abs(c["mop"] - target_mop)
                score = max(0, 100 - (mop_diff / 100.0))
                
                c["lookalike_score"] = score
                c["match_reason"] = f"Same brand, ±₹{mop_diff:,.0f} price diff"
                filtered.append(c)
                
    filtered.sort(key=lambda x: x["lookalike_score"], reverse=True)
    return filtered

def compute_lookalike_msp_full(
    scenario: str,
    target_branch: str,
    target_im_code: str,
    target_brand: str,
    target_mop: float,
    days_since_launch: int,
    is_direct_successor: bool,
    lookalike_im_codes: List[str],
    lookalike_weights: List[float],
    prediction_date: date,
    sales_df: pd.DataFrame,
    mop_df: pd.DataFrame,
    hype_duration_days: int,
    peak_multiplier: float,
    w1: float, w2: float, w3: float,
    apply_brand_affinity: bool,
    apply_price_affinity: bool,
    apply_dow: bool,
    apply_festival: bool,
) -> dict:
    # 1. Blend lookalikes
    blended_avg7 = 0.0
    blended_avg7_28 = 0.0
    blended_avg30_60 = 0.0
    
    catalog = get_model_catalog(sales_df, mop_df)
    def get_model_name(im_code):
        for c in catalog:
            if c["im_code"] == im_code:
                return c["item_model"]
        return im_code

    lookalike_used = []
    
    # For new store scenario, the lookalikes are stores, not models!
    # Wait, the prompt says "lookalike_im_codes".
    # If scenario == "new_store", lookalike_im_codes are branches? 
    # Ah, the prompt struct:
    # "lookalike_im_codes" and "lookalike_weights". If scenario is new_store, maybe we pass branches in another param or reuse these?
    # Actually, in section 6 compute_lookalike_msp_full signature: target_branch is the NEW branch? No, target_branch is string.
    # The prompt structure says "lookalike_used: [ { im_code, item_model, branch, lookalike_score, weight, distance_km } ]"
    # If new_store, the branch is the lookalike branch, im_code is target_im_code.
    
    if scenario == "new_store":
        # lookalike_im_codes contains the branches!
        for br, w in zip(lookalike_im_codes, lookalike_weights):
            target_model = get_model_name(target_im_code)
            w_dict = get_sales_window(sales_df, br, target_model, prediction_date)
            blended_avg7 += w_dict["avg7"] * w
            blended_avg7_28 += w_dict["avg7_28"] * w
            blended_avg30_60 += w_dict["avg30_60"] * w
            lookalike_used.append({
                "im_code": target_im_code,
                "item_model": target_model,
                "branch": br,
                "lookalike_score": 100,
                "is_direct_successor": False,
                "weight": w,
                "distance_km": 0.0 # would need actual distance
            })
    else:
        for im_code, w in zip(lookalike_im_codes, lookalike_weights):
            model_name = get_model_name(im_code)
            w_dict = get_sales_window(sales_df, target_branch, model_name, prediction_date)
            blended_avg7 += w_dict["avg7"] * w
            blended_avg7_28 += w_dict["avg7_28"] * w
            blended_avg30_60 += w_dict["avg30_60"] * w
            lookalike_used.append({
                "im_code": im_code,
                "item_model": model_name,
                "branch": target_branch,
                "lookalike_score": 100 if len(lookalike_im_codes)==1 else 50, # approx
                "is_direct_successor": is_direct_successor,
                "weight": w,
                "distance_km": 0.0
            })
            
    target_price_band = get_price_band(target_mop)
    
    brand_aff = get_brand_affinity_multiplier(target_branch, target_brand) if apply_brand_affinity else 1.0
    price_aff = get_price_affinity_multiplier(target_branch, target_price_band) if apply_price_affinity else 1.0
    
    # Get DOW from the primary lookalike model/branch
    if lookalike_used:
        pri = lookalike_used[0]
        dow_mults = get_dow_multiplier(pri["branch"], pri["item_model"], sales_df)
    else:
        dow_mults = {i: 1.0 for i in range(7)}
        
    daily_breakdown = []
    base_msp_series = []
    affinity_msp_series = []
    final_msp_series = []
    
    msp_20d_total = 0.0
    base_msp_20d_total = 0.0
    affinity_msp_20d_total = 0.0
    
    # Generate 20 days
    for day in range(1, 21):
        d = prediction_date + timedelta(days=day)
        
        base = compute_wma_base(blended_avg7, blended_avg7_28, blended_avg30_60, w1, w2, w3)
        dow_m = dow_mults.get(d.weekday(), 1.0) if apply_dow else 1.0
        
        fest_m, _ = get_festival_multiplier(d)
        if not apply_festival: fest_m = 1.0
            
        hype_m = get_hype_multiplier(target_brand, days_since_launch + day, hype_duration_days, peak_multiplier) if scenario == "new_model" else 1.0
        
        aff_pred = base * brand_aff * price_aff * dow_m * fest_m
        final_pred = aff_pred * hype_m
        
        daily_breakdown.append({
            "date": str(d),
            "base": round(base, 2),
            "brand_aff": round(brand_aff, 2),
            "price_aff": round(price_aff, 2),
            "dow_mult": round(dow_m, 2),
            "fest_mult": round(fest_m, 2),
            "hype_mult": round(hype_m, 2),
            "predicted": round(final_pred, 2),
            "data_source": "lookalike"
        })
        
        base_msp_series.append({"date": str(d), "predicted": round(base, 2)})
        affinity_msp_series.append({"date": str(d), "predicted": round(aff_pred, 2)})
        final_msp_series.append({"date": str(d), "predicted": round(final_pred, 2)})
        
        base_msp_20d_total += base
        affinity_msp_20d_total += aff_pred
        msp_20d_total += final_pred

    confidence = "HIGH"
    if scenario == "sparse_data":
        confidence = "MEDIUM"
    elif scenario == "new_model" and not is_direct_successor:
        confidence = "MEDIUM"
        
    return {
        "scenario": scenario,
        "target": {
            "branch": target_branch,
            "im_code": target_im_code,
            "item_model": get_model_name(target_im_code),
            "brand": target_brand,
            "mop": target_mop,
            "price_band": target_price_band,
            "days_since_launch": days_since_launch,
            "is_direct_successor": is_direct_successor,
        },
        "lookalike_used": lookalike_used,
        "multipliers_applied": {
            "brand_affinity": round(brand_aff, 2),
            "price_affinity": round(price_aff, 2),
            "w1": w1, "w2": w2, "w3": w3
        },
        "daily_breakdown": daily_breakdown,
        "base_msp_series": base_msp_series,
        "affinity_msp_series": affinity_msp_series,
        "final_msp_series": final_msp_series,
        "msp_20d_total": round(msp_20d_total, 2),
        "base_msp_20d_total": round(base_msp_20d_total, 2),
        "affinity_msp_20d_total": round(affinity_msp_20d_total, 2),
        "hype_uplift": round(msp_20d_total - affinity_msp_20d_total, 2),
        "confidence": confidence
    }
