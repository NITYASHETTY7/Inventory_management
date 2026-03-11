from data_processing import load_clean_data, PRICE_BINS
import pandas as pd

def compute_price_affinity(branch=None, brand=None, model=None) -> dict:
    df = load_clean_data()
    
    # Filter by optional parameters (excluding price_range itself because we are comparing price ranges)
    if branch: df = df[df["Branch"] == branch]
    if brand:  df = df[df["Brand"] == brand]
    if model:  df = df[df["Model"] == model]
    
    if "price" not in df.columns:
        return {"error": "Price data not available"}

    # Assign price bands
    def get_band(price):
        for min_v, max_v, label in PRICE_BINS:
            if price >= min_v and price < max_v:
                return label
        return "Unknown"
        
    df["PriceBand"] = df["price"].apply(get_band)
    
    # Group by Branch and PriceBand
    branch_band = df.groupby(["Branch", "PriceBand"])["Qty"].sum().reset_index()
    branch_band.rename(columns={"Qty": "raw_units"}, inplace=True)
    
    store_totals_df = df.groupby("Branch")["Qty"].sum()
    network_band_df = df.groupby("PriceBand")["Qty"].sum()
    grand_total = df["Qty"].sum()
    
    store_totals = store_totals_df.to_dict()
    network_totals = network_band_df.to_dict()
    
    network_shares = {}
    if grand_total > 0:
        for b, units in network_totals.items():
            network_shares[b] = round((units / grand_total) * 100, 1)
            
    # Ordered list of price bands based on PRICE_BINS
    all_bands = [label for _, _, label in PRICE_BINS]
    bands_present = [b for b in all_bands if b in network_totals]
    
    cells = []
    for _, row in branch_band.iterrows():
        br = row["Branch"]
        band = row["PriceBand"]
        qty = row["raw_units"]
        
        st_total = store_totals.get(br, 0)
        share_pct = (qty / st_total * 100) if st_total > 0 else 0.0
        
        n_share = network_shares.get(band, 0.0)
        aff_score = (share_pct / n_share * 50) if n_share > 0 else 0.0
        aff_score = min(100.0, max(0.0, aff_score))
        
        cells.append({
            "store": br,
            "band": band,
            "raw_units": float(qty),
            "share_pct": round(float(share_pct), 1),
            "affinity_score": round(float(aff_score), 1)
        })
        
    band_lists = {}
    for c in cells:
        band_lists.setdefault(c["band"], []).append(c)
        
    for band, lst in band_lists.items():
        lst.sort(key=lambda x: x["raw_units"], reverse=True)
        for i, c in enumerate(lst):
            c["rank_in_network"] = i + 1
            
    store_lists = {}
    for c in cells:
        store_lists.setdefault(c["store"], []).append(c)
        
    top_band_per_store = {}
    for store, lst in store_lists.items():
        lst.sort(key=lambda x: x["share_pct"], reverse=True)
        if lst:
            top_band_per_store[store] = lst[0]["band"]
            for c in lst:
                c["dominant_band_flag"] = (c["band"] == lst[0]["band"])
                
    stores = sorted(list(store_totals.keys()))
    
    store_profiles = {}
    for store, lst in store_lists.items():
        store_profiles[store] = [{
            "band": c["band"],
            "units": c["raw_units"],
            "share_pct": c["share_pct"],
            "affinity_score": c["affinity_score"],
            "rank": c["rank_in_network"],
            "dominant": c["dominant_band_flag"]
        } for c in lst]
        
    band_leaderboard = {}
    for band, lst in band_lists.items():
        band_leaderboard[band] = [{
            "store": c["store"],
            "units": c["raw_units"],
            "share_pct": c["share_pct"],
            "affinity_score": c["affinity_score"],
            "rank": c["rank_in_network"]
        } for c in lst]
        
    return {
        "stores": stores,
        "bands": bands_present,
        "network_totals": {k: float(v) for k, v in network_totals.items()},
        "network_shares": network_shares,
        "store_totals": {k: float(v) for k, v in store_totals.items()},
        "cells": cells,
        "store_profiles": store_profiles,
        "band_leaderboard": band_leaderboard,
        "top_band_per_store": top_band_per_store
    }
