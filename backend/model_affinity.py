from data_processing import filter_data
import pandas as pd
import numpy as np
from pathlib import Path

# Load the external mapping file once
try:
    checkpoint_path = Path(__file__).parent / "launch_date_checkpoint.csv"
    mop_df = pd.read_csv(checkpoint_path)
    # Create a mapping from 'Model_Family' to 'India_Launch_Quarter'
    mop_df = mop_df.dropna(subset=['Model_Family', 'India_Launch_Quarter'])
    # The models returned by data_processing are already clubbed to Model_Family!
    model_to_quarter = dict(zip(mop_df['Model_Family'].str.strip(), mop_df['India_Launch_Quarter'].str.strip()))
except Exception as e:
    print(f"Warning: Could not load launch_date_checkpoint.csv: {e}")
    model_to_quarter = {}

def compute_model_affinity(branch=None, brand=None, price_range=None) -> dict:
    df = filter_data(branch=branch, brand=brand, price_range=price_range)
    
    if df.empty:
        return {"cells": []}

    # If branch is None, we just group by model for the whole network
    # Otherwise group by branch and model
    if branch:
        df = df[df["Branch"] == branch]
        
    model_totals = df.groupby("Model")["Qty"].sum().reset_index()
    model_totals.rename(columns={"Qty": "raw_units"}, inplace=True)
    
    grand_total = df["Qty"].sum()
    
    cells = []
    for _, row in model_totals.iterrows():
        model = row["Model"]
        qty = row["raw_units"]
        
        share_pct = (qty / grand_total * 100) if grand_total > 0 else 0.0
        
        # Look up quarter from the mapping
        quarter = model_to_quarter.get(model.strip(), "Unknown")
        
        cells.append({
            "model": model,
            "raw_units": float(qty),
            "share_pct": round(float(share_pct), 1),
            "quarter": quarter
        })
        
    return {
        "cells": cells,
    }
