import pandas as pd
import numpy as np
import math
import logging
from typing import List, Dict, Any
from pathlib import Path
from datetime import timedelta

logger = logging.getLogger(__name__)

# Cache variables
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

        path = Path(__file__).parent / "asm_mapping.xlsx"
        if path.exists():
            _asm_mapping_df = pd.read_excel(path)
        else:
            _asm_mapping_df = pd.DataFrame(columns=["branch", "asm_name", "hub_name"])
    except Exception as e:
        logger.error(f"Error loading asm_mapping.xlsx: {e}")
        _asm_mapping_df = pd.DataFrame(columns=["branch", "asm_name", "hub_name"])
    return _asm_mapping_df

_brand_map = None
def load_brand_map() -> dict:
    """Returns {im_code_lower: brand} from Brand Item-Model MOP.xlsx"""
    global _brand_map
    if _brand_map is not None:
        return _brand_map
    try:
        path = Path(__file__).parent / "data" / "Brand Item-Model MOP.xlsx"
        if not path.exists():
            path = Path(__file__).parent / "Brand Item-Model MOP.xlsx"
        df = pd.read_excel(path)
        _brand_map = dict(zip(df["Code"].astype(str).str.strip().str.lower(), df["Brand"].astype(str).str.strip()))
    except Exception as e:
        logger.error(f"Error loading brand map: {e}")
        _brand_map = {}
    return _brand_map

def safe_float(v: float) -> float:
    return 0.0 if (v is None or math.isnan(v) or math.isinf(v)) else round(float(v), 3)


def compute_avg_daily(
    sales_df: pd.DataFrame,
    branch: str,
    im_code: str,
    brand: str,
    lookback_days: int = 30,
) -> float:
    if sales_df.empty:
        return 0.0
        
    mask = (
        (sales_df["Branch"].str.lower() == branch.lower()) &
        (sales_df["Brand"].str.lower() == brand.lower())
    )
    if "im_code" in sales_df.columns:
        mask = mask & (sales_df["im_code"].str.lower() == im_code.lower())
    elif "I/M Code" in sales_df.columns:
        mask = mask & (sales_df["I/M Code"].str.lower() == im_code.lower())
        
    df_filtered = sales_df[mask]
    if df_filtered.empty:
        return 0.0
        
    if "Date" not in df_filtered.columns:
        return 0.0
        
    max_date = pd.to_datetime(df_filtered["Date"]).max()
    if pd.isna(max_date):
        return 0.0
        
    min_date = max_date - timedelta(days=lookback_days)
    df_recent = df_filtered[pd.to_datetime(df_filtered["Date"]) > min_date]
    
    qty_col = "Qty." if "Qty." in df_recent.columns else "Qty"
    total_sales = df_recent[qty_col].sum()
    return safe_float(total_sales / lookback_days)

def get_closing_stock(closing_stock_df: pd.DataFrame, branch: str, im_code: str, brand: str) -> float:
    if closing_stock_df.empty:
        return 0.0
        
    mask = (
        (closing_stock_df["branch"].str.lower() == branch.lower()) &
        (closing_stock_df["brand"].str.lower() == brand.lower())
    )
    if "im_code" in closing_stock_df.columns:
        mask = mask & (closing_stock_df["im_code"].str.lower() == im_code.lower())
        
    filtered = closing_stock_df[mask]
    if filtered.empty:
        return 0.0
    return safe_float(filtered["quantity"].sum())

def get_item_model(closing_stock_df: pd.DataFrame, im_code: str, brand: str) -> str:
    if closing_stock_df.empty:
        return "Unknown Model"
    mask = (closing_stock_df["brand"].str.lower() == brand.lower())
    if "im_code" in closing_stock_df.columns:
        mask = mask & (closing_stock_df["im_code"].str.lower() == im_code.lower())
    filtered = closing_stock_df[mask]
    if filtered.empty:
        return "Unknown Model"
    return str(filtered.iloc[0].get("item_model", "Unknown Model"))

def compute_store_positions(
    branches: list[str],
    im_code: str,
    brand: str,
    msp_predictions: dict,
    closing_stock_df: pd.DataFrame,
    sales_df: pd.DataFrame,
    lookback_days: int = 30,
) -> list[dict]:
    positions = []
    
    # Pre-filter sales data for efficiency
    if not sales_df.empty:
        sales_mask = (sales_df["Brand"].str.lower() == brand.lower())
        if "im_code" in sales_df.columns:
            sales_mask = sales_mask & (sales_df["im_code"].str.lower() == im_code.lower())
        elif "I/M Code" in sales_df.columns:
            sales_mask = sales_mask & (sales_df["I/M Code"].str.lower() == im_code.lower())
        
        filtered_sales_df = sales_df[sales_mask]
    else:
        filtered_sales_df = pd.DataFrame()

    for branch in branches:
        current_stock = get_closing_stock(closing_stock_df, branch, im_code, brand)
        
        branch_msp_dict = msp_predictions.get(branch, {})
        msp_20d = safe_float(branch_msp_dict.get(im_code, branch_msp_dict.get(im_code.upper(), branch_msp_dict.get(im_code.lower(), 0.0))))
        
        position = safe_float(current_stock - msp_20d)
        excess = max(0.0, position)
        shortage = max(0.0, -position)
        
        avg_daily = compute_avg_daily(filtered_sales_df, branch, im_code, brand, lookback_days)
        velocity_class = classify_velocity(avg_daily)
        
        item_model = get_item_model(closing_stock_df, im_code, brand)
        
        positions.append({
            "branch": branch,
            "im_code": im_code,
            "brand": brand,
            "item_model": item_model,
            "msp_20d": msp_20d,
            "current_stock": current_stock,
            "position": position,
            "excess": excess,
            "shortage": shortage,
            "velocity_class": velocity_class,
            "avg_daily": avg_daily
        })
        
    return positions

def recommend_asm_shuffle(
    requesting_branch: str,
    im_code: str,
    brand: str,
    msp_predictions: dict,
    closing_stock_df: pd.DataFrame,
    asm_mapping_df: pd.DataFrame,
    sales_df: pd.DataFrame,
) -> dict:
    
    if asm_mapping_df.empty:
        asm_name = "Unknown ASM"
        asm_peers = []
    else:
        branch_mask = asm_mapping_df["branch"].str.lower() == requesting_branch.lower()
        if not asm_mapping_df[branch_mask].empty:
            asm_name = str(asm_mapping_df[branch_mask].iloc[0].get("asm_name", "Unknown ASM"))
            asm_peers = asm_mapping_df[asm_mapping_df["asm_name"].str.lower() == asm_name.lower()]["branch"].tolist()
        else:
            asm_name = "Unknown ASM"
            asm_peers = []
            
    if requesting_branch not in asm_peers:
        asm_peers.append(requesting_branch)
        
    positions = compute_store_positions(asm_peers, im_code, brand, msp_predictions, closing_stock_df, sales_df)
    
    req_pos = next((p for p in positions if p["branch"].lower() == requesting_branch.lower()), None)
    if not req_pos:
        req_pos = {
            "branch": requesting_branch, "msp_20d": 0.0, "current_stock": 0.0, 
            "position": 0.0, "excess": 0.0, "shortage": 0.0, 
            "velocity_class": "YMC", "avg_daily": 0.0
        }
        
    shortage = req_pos["shortage"]
    recommendations = []
    total_coverable = 0.0
    
    if shortage > 0:
        donors = [p for p in positions if p["branch"].lower() != requesting_branch.lower() and p["excess"] > 0]
        donors.sort(key=lambda x: x["excess"], reverse=True)
        
        remaining_shortage = shortage
        for donor in donors:
            if remaining_shortage <= 0:
                break
            transfer_qty = min(donor["excess"], remaining_shortage)
            recommendations.append({
                "donor_branch": donor["branch"],
                "donor_stock": donor["current_stock"],
                "donor_msp": donor["msp_20d"],
                "donor_excess": donor["excess"],
                "suggested_transfer": safe_float(transfer_qty)
            })
            total_coverable += transfer_qty
            remaining_shortage -= transfer_qty
            
    remaining_after_shuffle = max(0.0, shortage - total_coverable)
    coverage_pct = safe_float((total_coverable / shortage * 100) if shortage > 0 else 100.0)
    
    return {
        "requesting_branch": requesting_branch,
        "im_code": im_code,
        "brand": brand,
        "shortage": shortage,
        "asm_name": asm_name,
        "peer_positions": positions,
        "recommendations": recommendations,
        "total_coverable": safe_float(total_coverable),
        "remaining_after_shuffle": safe_float(remaining_after_shuffle),
        "coverage_pct": coverage_pct,
        "shuffle_level": "ASM"
    }

def recommend_hub_shuffle(
    im_code: str,
    brand: str,
    msp_predictions: dict,
    closing_stock_df: pd.DataFrame,
    asm_mapping_df: pd.DataFrame,
    sales_df: pd.DataFrame,
) -> list[dict]:
    
    if asm_mapping_df.empty:
        return []
        
    hubs = asm_mapping_df["hub_name"].dropna().unique()
    all_recommendations = []
    
    for hub in hubs:
        hub_branches = asm_mapping_df[asm_mapping_df["hub_name"] == hub]["branch"].tolist()
        if not hub_branches:
            continue
            
        positions = compute_store_positions(hub_branches, im_code, brand, msp_predictions, closing_stock_df, sales_df)
        
        excess_stores = [p for p in positions if p["excess"] > 0]
        shortage_stores = [p for p in positions if p["shortage"] > 0]
        
        excess_stores.sort(key=lambda x: x["excess"], reverse=True)
        shortage_stores.sort(key=lambda x: x["shortage"], reverse=True)
        
        for short_store in shortage_stores:
            remaining_shortage = short_store["shortage"]
            for ex_store in excess_stores:
                if remaining_shortage <= 0:
                    break
                if ex_store["excess"] <= 0:
                    continue
                    
                transfer_qty = min(ex_store["excess"], remaining_shortage)
                if transfer_qty > 0:
                    all_recommendations.append({
                        "hub_name": str(hub),
                        "from_branch": ex_store["branch"],
                        "to_branch": short_store["branch"],
                        "im_code": im_code,
                        "brand": brand,
                        "transfer_qty": safe_float(transfer_qty),
                        "from_stock": ex_store["current_stock"],
                        "from_msp": ex_store["msp_20d"],
                        "from_excess": ex_store["excess"],
                        "to_shortage": short_store["shortage"],
                        "to_msp": short_store["msp_20d"],
                        "shuffle_level": "HUB"
                    })
                    
                    ex_store["excess"] -= transfer_qty
                    remaining_shortage -= transfer_qty
                    
    all_recommendations.sort(key=lambda x: x["transfer_qty"], reverse=True)
    return all_recommendations[:100]
def classify_models_by_velocity(sales_df: pd.DataFrame, lookback_days: int = 30) -> dict:
    """Returns {im_code_lower: 'XMC'|'NORMAL'|'YMC'} based on 80/20 sales share."""
    if sales_df.empty:
        return {}

    im_code_col = "im_code" if "im_code" in sales_df.columns else "I/M Code"
    if im_code_col not in sales_df.columns:
        return {}
    

    max_date = pd.to_datetime(sales_df["Date"]).max()
    min_date = max_date - timedelta(days=lookback_days)
    recent = sales_df[pd.to_datetime(sales_df["Date"]) > min_date].copy()

    if recent.empty:
        return {}

    qty_col = "Qty." if "Qty." in recent.columns else "Qty"
    model_sales = (
    recent.groupby(im_code_col)[qty_col]
        .sum()
        .reset_index()
        .rename(columns={im_code_col: "im_code", qty_col: "total_qty"})
        .sort_values("total_qty", ascending=False)
    )

    total = model_sales["total_qty"].sum()
    if total == 0:
        return {}

    model_sales["cumulative_pct"] = model_sales["total_qty"].cumsum() / total * 100

    result = {}
    for _, row in model_sales.iterrows():
        key = str(row["im_code"]).lower()
        if row["cumulative_pct"] <= 80:
            result[key] = "XMC"
        elif row["cumulative_pct"] > 80:
            result[key] = "YMC"
    return result


def detect_cross_asm_xmc(
    sales_df: pd.DataFrame,
    closing_stock_df: pd.DataFrame,
    asm_mapping_df: pd.DataFrame,
    lookback_days: int = 30,
) -> list[dict]:
    brand_map = load_brand_map()
    if closing_stock_df.empty or sales_df.empty:
        return []

    # ✅ Classify ALL models globally using 80/20 rule
    velocity_map = classify_models_by_velocity(sales_df, lookback_days)

    asm_dict = {}
    if not asm_mapping_df.empty:
        asm_dict = dict(zip(asm_mapping_df["branch"].str.lower(), asm_mapping_df["asm_name"]))

    stock_groups = closing_stock_df[closing_stock_df["quantity"] > 0].groupby(["im_code", "brand"])

    opportunities = []
    im_code_col = "im_code" if "im_code" in sales_df.columns else "I/M Code"
    if im_code_col not in sales_df.columns:
        return []
    qty_col = "Qty." if "Qty." in sales_df.columns else "Qty"

    for (im_code, brand), group in stock_groups:
        velocity = velocity_map.get(str(im_code).lower(), "NORMAL")

        # For cross-ASM: find branches with YMC stock of a model
        # that is XMC elsewhere — but since classification is global,
        # we look for: branches with SURPLUS stock of a YMC model
        # where other branches of DIFFERENT ASM have shortage of same model

        # Get branches with stock for this model
        branches_with_stock = group[group["quantity"] > 0]["branch"].tolist()

        sales_mask = (
            (sales_df["Brand"].str.lower() == str(brand).lower()) &
            (sales_df[im_code_col].str.lower() == str(im_code).lower())
        )
        model_sales_df = sales_df[sales_mask]

        # Classify per-branch velocity for this model
        branch_velocities = {}
        all_branches = set(b.lower() for b in branches_with_stock)
        if not model_sales_df.empty:
            all_branches.update(model_sales_df["Branch"].str.lower().unique())

        for br_lower in all_branches:
            br_name = next((b for b in sales_df["Branch"].unique() if str(b).lower() == br_lower), br_lower)
            avg_d = compute_avg_daily(model_sales_df, br_name, str(im_code), str(brand), lookback_days)
            branch_velocities[br_lower] = {
                "avg_daily": avg_d,
                "orig_name": br_name
            }

        # Branches with stock but low sales = YMC donors
        ymc_branches = []
        xmc_branches = []

        for br_lower, data in branch_velocities.items():
            stock_val = group[group["branch"].str.lower() == br_lower]["quantity"].sum() if not group.empty else 0
            br_velocity = velocity_map.get(str(im_code).lower(), "NORMAL")

            # A branch is a donor if it has stock AND this model is slow-moving there
            if stock_val > 0 and data["avg_daily"] < 0.05:
                ymc_branches.append({
                    "branch": data["orig_name"],
                    "avg_daily": data["avg_daily"],
                    "stock": float(stock_val)
                })
            # A branch is a receiver if this model sells well there
            elif data["avg_daily"] >= 0.05:
                xmc_branches.append({
                    "branch": data["orig_name"],
                    "avg_daily": data["avg_daily"]
                })

        if not ymc_branches or not xmc_branches:
            continue

        item_model = str(group["item_model"].iloc[0]) if "item_model" in group.columns else "Unknown"

        for ymc in ymc_branches:
            for xmc in xmc_branches:
                ymc_asm = str(asm_dict.get(ymc["branch"].lower(), "Unknown"))
                xmc_asm = str(asm_dict.get(xmc["branch"].lower(), "Unknown"))

                is_cross = ymc_asm.lower() != xmc_asm.lower()
                if not is_cross:
                    continue  # skip same-ASM, those are handled by shuffle engine

                priority_score = safe_float(xmc["avg_daily"] * ymc["stock"])
                if priority_score <= 0:
                    continue

                rec_transfer = max(1, min(int(ymc["stock"]), int(xmc["avg_daily"] * 20)))

                opportunities.append({
                    "ymc_branch": ymc["branch"],
                    "ymc_asm": ymc_asm,
                    "xmc_branch": xmc["branch"],
                    "xmc_asm": xmc_asm,
                    "im_code": str(im_code),
                    "brand": brand_map.get(str(im_code).lower(), str(brand)),
                    "item_model": item_model,
                    "global_velocity": velocity,
                    "ymc_stock": safe_float(ymc["stock"]),
                    "ymc_avg_daily": safe_float(ymc["avg_daily"]),
                    "xmc_avg_daily": safe_float(xmc["avg_daily"]),
                    "priority_score": priority_score,
                    "recommended_transfer": rec_transfer,
                    "action_label": f"Move {rec_transfer} units: {ymc['branch']} → {xmc['branch']}"
                })

    opportunities.sort(key=lambda x: x["priority_score"], reverse=True)
    return opportunities[:50]

def get_branch_shuffle_summary(
    branch: str,
    sales_df: pd.DataFrame,
    closing_stock_df: pd.DataFrame,
    asm_mapping_df: pd.DataFrame,
    msp_predictions: dict,
    lookback_days: int = 30,
) -> dict:
    
    asm_name = "Unknown"
    hub_name = "Unknown"
    
    if not asm_mapping_df.empty:
        mask = asm_mapping_df["branch"].str.lower() == branch.lower()
        if not asm_mapping_df[mask].empty:
            row = asm_mapping_df[mask].iloc[0]
            asm_name = str(row.get("asm_name", "Unknown"))
            hub_name = str(row.get("hub_name", "Unknown"))
            
    # Get all models with stock
    stock_models = []
    if not closing_stock_df.empty:
        stock_mask = closing_stock_df["branch"].str.lower() == branch.lower()
        br_stock_df = closing_stock_df[stock_mask]
        for _, row in br_stock_df.iterrows():
            if "im_code" in row and "brand" in row:
                stock_models.append((str(row["im_code"]), str(row["brand"])))
                
    # Also get models from msp_predictions for this branch
    br_msp = msp_predictions.get(branch, {})
    for im_code in br_msp.keys():
        # Try to find brand
        brand = "Unknown"
        if not closing_stock_df.empty:
            b_mask = closing_stock_df["im_code"].str.lower() == im_code.lower()
            if not closing_stock_df[b_mask].empty:
                brand = str(closing_stock_df[b_mask].iloc[0].get("brand", "Unknown"))
        if (im_code, brand) not in stock_models:
            stock_models.append((im_code, brand))
            
    # Remove duplicates
    stock_models = list(set(stock_models))
    
    model_positions = []
    total_excess = 0.0
    total_shortage = 0.0
    models_with_excess = 0
    models_with_shortage = 0
    
    for im_code, brand in stock_models:
        pos = compute_store_positions([branch], im_code, brand, msp_predictions, closing_stock_df, sales_df, lookback_days)
        if pos:
            p = pos[0]
            model_positions.append(p)
            total_excess += p["excess"]
            total_shortage += p["shortage"]
            if p["excess"] > 0:
                models_with_excess += 1
            if p["shortage"] > 0:
                models_with_shortage += 1
                
    # Sort for top donations (excess > 0, prefer YMC)
    # Give priority to YMC, then normal, then XMC
    def donation_score(p):
        v = p["velocity_class"]
        sc = 3 if v == "YMC" else 2 if v == "NORMAL" else 1
        return (sc, p["excess"])
        
    top_donations = [p for p in model_positions if p["excess"] > 0]
    top_donations.sort(key=donation_score, reverse=True)
    
    # Sort for top needs (shortage > 0, prefer XMC)
    def need_score(p):
        v = p["velocity_class"]
        sc = 3 if v == "XMC" else 2 if v == "NORMAL" else 1
        return (sc, p["shortage"])
        
    top_needs = [p for p in model_positions if p["shortage"] > 0]
    top_needs.sort(key=need_score, reverse=True)
    
    return {
        "branch": branch,
        "asm_name": asm_name,
        "hub_name": hub_name,
        "total_models": len(model_positions),
        "models_with_excess": models_with_excess,
        "models_with_shortage": models_with_shortage,
        "total_excess_units": safe_float(total_excess),
        "total_shortage_units": safe_float(total_shortage),
        "model_positions": model_positions,
        "top_donations": top_donations[:5],
        "top_needs": top_needs[:5]
    }
