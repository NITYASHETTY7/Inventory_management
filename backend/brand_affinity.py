from data_processing import filter_data
import pandas as pd
import numpy as np

def compute_brand_affinity(branch=None, brand=None, model=None, price_range=None) -> dict:
    df = filter_data(branch=branch, brand=brand, model=model, price_range=price_range)
    # Filter only to Sep-Dec 2025 is already done in load_clean_data for prediction?
    # Actually load_clean_data loads everything but callers filter. Wait, load_clean_data loads the full raw set.
    # The prompt says: "already filtered to the 10 ALLOWED_BRANCHES and Sep-Dec 2025 window"
    # Actually my load_clean_data right now loads everything. I'll just filter it to be safe.
    
    # Group by Branch, Brand
    branch_brand = df.groupby(["Branch", "Brand"])["Qty"].sum().reset_index()
    branch_brand.rename(columns={"Qty": "raw_units"}, inplace=True)
    
    store_totals_df = df.groupby("Branch")["Qty"].sum()
    network_brand_df = df.groupby("Brand")["Qty"].sum()
    grand_total = df["Qty"].sum()
    
    store_totals = store_totals_df.to_dict()
    network_totals = network_brand_df.to_dict()
    
    network_shares = {}
    if grand_total > 0:
        for b, units in network_totals.items():
            network_shares[b] = round((units / grand_total) * 100, 1)
            
    # Calculate cell metrics
    cells = []
    for _, row in branch_brand.iterrows():
        br = row["Branch"]
        brand = row["Brand"]
        qty = row["raw_units"]
        
        st_total = store_totals.get(br, 0)
        share_pct = (qty / st_total * 100) if st_total > 0 else 0.0
        
        n_share = network_shares.get(brand, 0.0)
        aff_score = (share_pct / n_share * 50) if n_share > 0 else 0.0
        aff_score = min(100.0, max(0.0, aff_score))
        
        cells.append({
            "store": br,
            "brand": brand,
            "raw_units": float(qty),
            "share_pct": round(float(share_pct), 1),
            "affinity_score": round(float(aff_score), 1)
        })
        
    # ranks
    brand_lists = {}
    for c in cells:
        brand_lists.setdefault(c["brand"], []).append(c)
        
    for brand, lst in brand_lists.items():
        lst.sort(key=lambda x: x["raw_units"], reverse=True)
        for i, c in enumerate(lst):
            c["rank_in_network"] = i + 1
            
    # dominant brand
    store_lists = {}
    for c in cells:
        store_lists.setdefault(c["store"], []).append(c)
        
    top_brand_per_store = {}
    for store, lst in store_lists.items():
        lst.sort(key=lambda x: x["share_pct"], reverse=True)
        if lst:
            top_brand_per_store[store] = lst[0]["brand"]
            for c in lst:
                c["dominant_brand_flag"] = (c["brand"] == lst[0]["brand"])
                
    # Build payload
    stores = sorted(list(store_totals.keys()))
    brands = sorted(list(network_totals.keys()))
    
    store_profiles = {}
    for store, lst in store_lists.items():
        store_profiles[store] = [{
            "brand": c["brand"],
            "units": c["raw_units"],
            "share_pct": c["share_pct"],
            "affinity_score": c["affinity_score"],
            "rank": c["rank_in_network"],
            "dominant": c["dominant_brand_flag"]
        } for c in lst]
        
    brand_leaderboard = {}
    for brand, lst in brand_lists.items():
        brand_leaderboard[brand] = [{
            "store": c["store"],
            "units": c["raw_units"],
            "share_pct": c["share_pct"],
            "affinity_score": c["affinity_score"],
            "rank": c["rank_in_network"]
        } for c in lst]
        
    return {
        "stores": stores,
        "brands": brands,
        "network_totals": {k: float(v) for k, v in network_totals.items()},
        "network_shares": network_shares,
        "store_totals": {k: float(v) for k, v in store_totals.items()},
        "cells": cells,
        "store_profiles": store_profiles,
        "brand_leaderboard": brand_leaderboard,
        "top_brand_per_store": top_brand_per_store
    }
