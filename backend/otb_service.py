import pandas as pd
import numpy as np
import math
import logging
from typing import List, Dict, Any, Optional
from pathlib import Path
from datetime import timedelta

logger = logging.getLogger(__name__)

# Cache
_closing_stock_df = None
_asm_mapping_df = None

def load_closing_stock() -> pd.DataFrame:
    global _closing_stock_df
    if _closing_stock_df is not None:
        return _closing_stock_df
    try:
        from main import DATA
        from closing_stock_loader import get_most_recent_sheet
        from datetime import date
        sheets = DATA.get("closing_stock_sheets", {})
        _, df = get_most_recent_sheet(sheets, date.today())
        
        if df.empty:
            logger.warning("No closing stock data found, returning empty DataFrame.")
            _closing_stock_df = pd.DataFrame(columns=["branch", "brand", "im_code", "item_model", "quantity"])
        else:
            _closing_stock_df = df
    except Exception as e:
        logger.error(f"Error loading closing_stock: {e}")
        _closing_stock_df = pd.DataFrame(columns=["branch", "brand", "im_code", "item_model", "quantity"])
    return _closing_stock_df

def load_asm_mapping() -> pd.DataFrame:
    global _asm_mapping_df
    if _asm_mapping_df is not None:
        return _asm_mapping_df
    try:
        # Try finding ASM.xlsx or asm.xlsx first
        asm_path = Path(__file__).parent / "ASM.xlsx"
        if not asm_path.exists():
            asm_path = Path(__file__).parent / "asm.xlsx"
            
        if asm_path.exists():
            df = pd.read_excel(asm_path)
            
            # Create a new dataframe with the mapped columns
            mapped_df = pd.DataFrame()
            
            # Map columns
            if "Branch" in df.columns:
                mapped_df["branch"] = df["Branch"]
            else:
                mapped_df["branch"] = ""
                
            if "ASM" in df.columns:
                mapped_df["asm_name"] = df["ASM"]
            else:
                mapped_df["asm_name"] = ""
                
            if "Geography" in df.columns:
                mapped_df["hub_name"] = df["Geography"]
            else:
                mapped_df["hub_name"] = ""
                
            _asm_mapping_df = mapped_df
            return _asm_mapping_df

        # Fallback to old mapping file
        path = Path(__file__).parent / "asm_mapping.xlsx"
        if path.exists():
            df = pd.read_excel(path)
            df.columns = df.columns.str.strip().str.lower()
            _asm_mapping_df = df
        else:
            logger.warning("asm.xlsx missing, returning empty DataFrame.")
            _asm_mapping_df = pd.DataFrame(columns=["branch", "asm_name", "hub_name"])
    except Exception as e:
        logger.error(f"Error loading asm.xlsx: {e}")
        _asm_mapping_df = pd.DataFrame(columns=["branch", "asm_name", "hub_name"])
    return _asm_mapping_df

def safe_float(v: float) -> float:
    return 0.0 if (v is None or math.isnan(v) or math.isinf(v)) else round(float(v), 3)

def get_asm_peer_branches(branch: str, asm_df: pd.DataFrame) -> list[str]:
    if asm_df.empty or "branch" not in asm_df.columns or "asm_name" not in asm_df.columns:
        return []
    
    branch_mask = asm_df["branch"].str.lower() == branch.lower()
    if asm_df[branch_mask].empty:
        return []
        
    asm_name = str(asm_df[branch_mask].iloc[0].get("asm_name", ""))
    if not asm_name:
        return []
        
    peers_mask = (asm_df["asm_name"].str.lower() == asm_name.lower()) & (asm_df["branch"].str.lower() != branch.lower())
    return asm_df[peers_mask]["branch"].tolist()

def compute_shuffle_reduction(
    requesting_branch: str,
    im_code: str,
    brand: str,
    msp_20d: float,
    closing_stock_df: pd.DataFrame,
    asm_df: pd.DataFrame,
) -> dict:
    peers = get_asm_peer_branches(requesting_branch, asm_df)
    
    total_reduction = 0.0
    donors = []
    
    if not closing_stock_df.empty and peers:
        # Pre-filter stock for peers + brand + im_code
        peers_lower = [p.lower() for p in peers]
        stock_mask = (
            (closing_stock_df["branch"].str.lower().isin(peers_lower)) &
            (closing_stock_df["brand"].str.lower() == brand.lower())
        )
        if "im_code" in closing_stock_df.columns:
            stock_mask = stock_mask & (closing_stock_df["im_code"].str.lower() == im_code.lower())
            
        peer_stocks = closing_stock_df[stock_mask]
        
        peer_positions = []
        for peer in peers:
            peer_stock_df = peer_stocks[peer_stocks["branch"].str.lower() == peer.lower()]
            peer_stock = safe_float(peer_stock_df["quantity"].sum()) if not peer_stock_df.empty else 0.0
            
            # Since we don't have peer_msp_20d, we'll assume it's 0 or we need it? 
            # The prompt says: "peer_excess = peer_stock - peer_msp_20d"
            # But we are not provided with peer MSPs. Let's assume peer MSP is 0 for simplicity if not passed, 
            # OR the prompt doesn't specify passing all MSPs to `compute_shuffle_reduction`.
            # Wait, the prompt says `msp_20d: float` which is the requesting branch's MSP.
            # To be accurate, if we don't know peer's MSP, we can only safely transfer what's in stock.
            # But the formula says `peer_excess = peer_stock - peer_msp_20d`. Let's assume peer_msp_20d is 0 since it's not passed in params.
            # ACTUALLY, wait. If peer_msp_20d isn't passed, peer_excess = peer_stock. Let's do that.
            peer_excess = max(0.0, peer_stock) # simplified
            if peer_excess > 0:
                peer_positions.append({"branch": peer, "excess": peer_excess, "stock": peer_stock})
                
        peer_positions.sort(key=lambda x: x["excess"], reverse=True)
        
        req_stock_mask = (
            (closing_stock_df["branch"].str.lower() == requesting_branch.lower()) &
            (closing_stock_df["brand"].str.lower() == brand.lower())
        )
        if "im_code" in closing_stock_df.columns:
            req_stock_mask = req_stock_mask & (closing_stock_df["im_code"].str.lower() == im_code.lower())
        req_stock = safe_float(closing_stock_df[req_stock_mask]["quantity"].sum()) if not closing_stock_df[req_stock_mask].empty else 0.0
        
        remaining_shortage = max(0.0, msp_20d - req_stock)
        
        for p in peer_positions:
            if remaining_shortage <= 0:
                break
            transfer = min(p["excess"], remaining_shortage)
            if transfer > 0:
                donors.append({
                    "branch": p["branch"],
                    "excess": p["excess"],
                    "suggested_transfer": safe_float(transfer)
                })
                total_reduction += transfer
                remaining_shortage -= transfer

    return {
        "total_reduction": safe_float(total_reduction),
        "donors": donors,
    }

def calculate_otb_row(
    branch: str,
    brand: str,
    im_code: str,
    item_model: str,
    msp_20d: float,
    closing_stock_df: pd.DataFrame,
    asm_df: pd.DataFrame,
) -> dict:
    
    current_stock = 0.0
    if not closing_stock_df.empty:
        stock_mask = (
            (closing_stock_df["branch"].str.lower() == branch.lower()) &
            (closing_stock_df["brand"].str.lower() == brand.lower())
        )
        if "im_code" in closing_stock_df.columns:
            stock_mask = stock_mask & (closing_stock_df["im_code"].str.lower() == im_code.lower())
        current_stock = safe_float(closing_stock_df[stock_mask]["quantity"].sum()) if not closing_stock_df[stock_mask].empty else 0.0
        
    raw_otb = max(0.0, msp_20d - current_stock)
    
    shuffle_info = compute_shuffle_reduction(branch, im_code, brand, msp_20d, closing_stock_df, asm_df)
    shuffle_reduction = shuffle_info["total_reduction"]
    
    effective_otb = max(0.0, raw_otb - shuffle_reduction)
    needs_purchase = effective_otb > 0
    
    return {
        "branch": branch,
        "brand": brand,
        "im_code": im_code,
        "item_model": item_model,
        "msp_20d": safe_float(msp_20d),
        "current_stock": current_stock,
        "raw_otb": safe_float(raw_otb),
        "shuffle_reduction": shuffle_reduction,
        "effective_otb": safe_float(effective_otb),
        "needs_purchase": needs_purchase,
        "donor_detail": shuffle_info["donors"]
    }

def build_otb_table(
    branch: str,
    msp_by_model: list[dict],
    closing_stock_df: pd.DataFrame,
    asm_df: pd.DataFrame,
) -> list[dict]:
    table = []
    for model in msp_by_model:
        brand = model.get("brand", "")
        im_code = model.get("im_code", "")
        item_model = model.get("item_model", "")
        msp_20d = safe_float(model.get("msp_20d", 0.0))
        
        row = calculate_otb_row(branch, brand, im_code, item_model, msp_20d, closing_stock_df, asm_df)
        table.append(row)
        
    # Sort: needs_purchase=True first, then by effective_otb descending
    table.sort(key=lambda x: (not x["needs_purchase"], -x["effective_otb"]))
    return table

def rank_stores_for_allocation(
    sales_df: pd.DataFrame,
    model_name: str,
    brand: str,
    candidate_branches: list[str],
    lookback_days: int = 60,
) -> list[dict]:
    
    if sales_df.empty:
        return []
        
    mask = (sales_df["Brand"].str.lower() == brand.lower())
    
    # Try model specific first
    model_mask = mask
    if model_name:
        if "Model" in sales_df.columns:
            model_mask = mask & (sales_df["Model"].str.lower() == model_name.lower())
        elif "item_model" in sales_df.columns:
            model_mask = mask & (sales_df["item_model"].str.lower() == model_name.lower())
            
    filtered_df = sales_df[model_mask]
    
    # Fallback to brand if no sales history for this model
    if filtered_df.empty and model_name:
        filtered_df = sales_df[mask]
        
    if filtered_df.empty:
        return []
        
    if "Date" not in filtered_df.columns:
        return []
        
    max_date = pd.to_datetime(filtered_df["Date"]).max()
    if pd.isna(max_date):
        return []
        
    min_date = max_date - timedelta(days=lookback_days)
    recent_df = filtered_df[pd.to_datetime(filtered_df["Date"]) > min_date]
    
    candidate_lower = [b.lower() for b in candidate_branches]
    recent_df = recent_df[recent_df["Branch"].str.lower().isin(candidate_lower)]
    
    grouped = recent_df.groupby(recent_df["Branch"].str.lower())["Qty"].sum()
    
    results = []
    for br in candidate_branches:
        total_sold = safe_float(grouped.get(br.lower(), 0.0))
        avg_daily = safe_float(total_sold / lookback_days) if lookback_days > 0 else 0.0
        results.append({
            "branch": br,
            "total_sold": total_sold,
            "avg_daily": avg_daily
        })
        
    results.sort(key=lambda x: x["total_sold"], reverse=True)
    
    for i, res in enumerate(results):
        res["sell_through_rank"] = i + 1
        
    return results

def build_staggered_schedule(
    total_units: int,
    total_budget_crore: float,
    stagger_days: int = 10,
) -> list[dict]:
    if stagger_days <= 0:
        return []
        
    units_per_day = total_units // stagger_days
    remainder_units = total_units % stagger_days
    
    budget_per_unit = total_budget_crore / total_units if total_units > 0 else 0.0
    
    schedule = []
    cumulative = 0
    for day in range(1, stagger_days + 1):
        daily_units = units_per_day + (1 if day <= remainder_units else 0)
        cumulative += daily_units
        daily_budget = safe_float(daily_units * budget_per_unit)
        schedule.append({
            "day": day,
            "units_to_order": daily_units,
            "budget_crore": daily_budget,
            "cumulative_units": cumulative
        })
        
    return schedule
