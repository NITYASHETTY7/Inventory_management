import math
import logging
import pandas as pd
from datetime import date
from curated_msp import run_curated_msp_window
from closing_stock_loader import get_most_recent_sheet, get_closing_stock, get_all_stocks_for_asm

logger = logging.getLogger(__name__)

from pathlib import Path

def load_mop_prices():
    mop_path = Path(__file__).parent / "Brand Item-Model MOP.xlsx"
    if not mop_path.exists():
        return {}
    try:
        df = pd.read_excel(mop_path)
        mapping = {}
        for _, row in df.iterrows():
            br = str(row.get("Brand", "")).strip().lower()
            code = str(row.get("Code", "")).strip().lower()
            try:
                price = float(row.get("MOP", 0.0))
            except:
                price = 0.0
            mapping[(br, code)] = price
        return mapping
    except Exception as e:
        logger.error(f"Error loading MOP prices: {e}")
        return {}

_mop_prices_cache = None
def get_item_price(brand: str, im_code: str) -> float:
    global _mop_prices_cache
    if _mop_prices_cache is None:
        _mop_prices_cache = load_mop_prices()
    return _mop_prices_cache.get((brand.strip().lower(), im_code.strip().lower()), 0.0)

def get_price_range_from_price(price: float):
    from data_processing import PRICE_BINS
    for min_v, max_v, label in PRICE_BINS:
        if min_v <= price < max_v:
            return label
    return None

BUFFER = 1  # minimum units a donor keeps after donating

def safe(v): 
    return 0.0 if (v is None or math.isnan(v) or math.isinf(v)) else round(float(v), 3)

def compute_msp_for_branches(
    price_range: str,
    branches: list[str],
    brand: str,
    im_code: str,
    item_model: str,
    prediction_date: date,
    sales_df: pd.DataFrame,
    w1: float = 0.5,
    w2: float = 0.3,
    w3: float = 0.2,
    apply_brand_affinity: bool = False,
    apply_price_affinity: bool = False,
    apply_dow: bool = False,
    apply_festival: bool = False,
) -> dict[str, float]:

    msp_by_branch = {}
    from data_processing import _extract_model
    from lookalike_service import get_sales_window, compute_wma_base, get_brand_affinity_multiplier, get_price_affinity_multiplier, get_price_band

    if im_code.strip().lower() == "all":
        model_str = None
    else:
        model_str = _extract_model(item_model) if item_model and item_model != "Unknown Model" else None

    if not model_str:
        return {b: 0.0 for b in branches}

    # Step 1: compute a base WMA from whichever branch has sales for this model
    # Try each branch, use the first one that has data, or aggregate across all
    base_avg7 = 0.0
    base_avg7_28 = 0.0
    base_avg30_60 = 0.0
    found_data = False

    for b in branches:
        w_dict = get_sales_window(sales_df, b, model_str, prediction_date)
        if w_dict["has_data"]:
            base_avg7 += w_dict["avg7"]
            base_avg7_28 += w_dict["avg7_28"]
            base_avg30_60 += w_dict["avg30_60"]
            found_data = True

    # If no branch in this ASM has sales, try all branches in sales_df
    if not found_data:
        all_branches = sales_df["Branch"].unique()
        count = 0
        for b in all_branches:
            w_dict = get_sales_window(sales_df, b, model_str, prediction_date)
            if w_dict["has_data"]:
                base_avg7 += w_dict["avg7"]
                base_avg7_28 += w_dict["avg7_28"]
                base_avg30_60 += w_dict["avg30_60"]
                count += 1
        if count > 0:
            # use average across all branches that have data
            base_avg7 /= count
            base_avg7_28 /= count
            base_avg30_60 /= count
            found_data = True

    if not found_data:
        return {b: 0.0 for b in branches}

    # Step 2: compute per-branch MSP using base WMA + branch-specific affinity
    from festival_calendar import get_festival_multiplier
    from datetime import timedelta

    for branch in branches:
        try:
            brand_aff = get_brand_affinity_multiplier(branch, brand) if apply_brand_affinity else 1.0
            price_aff = get_price_affinity_multiplier(branch, price_range) if apply_price_affinity else 1.0

            base = compute_wma_base(base_avg7, base_avg7_28, base_avg30_60, w1, w2, w3)

            total = 0.0
            for day in range(1, 21):
                d = prediction_date + timedelta(days=day)
                fest_m, _ = get_festival_multiplier(d)
                if not apply_festival:
                    fest_m = 1.0
                total += base * brand_aff * price_aff * fest_m

            msp_by_branch[branch] = safe(total)

        except Exception as e:
            logger.warning(f"Failed to compute MSP for {branch}: {e}")
            msp_by_branch[branch] = 0.0

    return msp_by_branch

def compute_positions(
    branches: list[str],
    brand: str,
    im_code: str,
    msp_by_branch: dict[str, float],
    closing_stocks: dict[str, float],
) -> list[dict]:
    
    positions = []
    for branch in branches:
        stock = safe(closing_stocks.get(branch, 0.0))
        msp = safe(msp_by_branch.get(branch, 0.0))
        
        pos = stock - msp
        excess = max(0.0, pos)
        shortage = max(0.0, math.ceil(-pos) if -pos > 0 else 0.0)
        
        if excess > 0:
            status = "EXCESS"
        elif shortage > 0:
            status = "SHORTAGE"
        else:
            status = "BALANCED"
            
        positions.append({
            "branch": branch,
            "closing_stock": stock,
            "msp_20d": msp,
            "position": pos,
            "excess": excess,
            "shortage": shortage,
            "status": status
        })
    return positions

def resolve_asm_shuffle(
    positions: list[dict],
    distance_matrix: dict,
) -> dict:
    
    donors = [p for p in positions if p["excess"] > 0]
    donors.sort(key=lambda x: x["excess"], reverse=True)
    
    needy = [p for p in positions if p["shortage"] > 0]
    needy.sort(key=lambda x: x["shortage"], reverse=True)
    
    total_shortage_before = sum(p["shortage"] for p in needy)
    
    transfers = []
    
    post_shuffle = {}
    for p in positions:
        post_shuffle[p["branch"]] = {
            "branch": p["branch"],
            "closing_stock": p["closing_stock"],
            "msp_20d": p["msp_20d"],
            "original_shortage": p["shortage"],
            "shuffle_in": 0.0,
            "shuffle_out": 0.0,
            "effective_shortage": p["shortage"],
            "effective_otb": 0.0,
            "needs_purchase": False,
        }
        
    for nb in needy:
        remaining_shortage = nb["shortage"]
        if remaining_shortage <= 0:
            continue
            
        # Sort donors by distance (if available), else by excess
        # distance_matrix might be {"BranchA": {"BranchB": 5.0}}
        nb_name = nb["branch"]
        
        def donor_sort_key(d):
            dist = 999999
            if distance_matrix and nb_name in distance_matrix:
                dist = distance_matrix[nb_name].get(d["branch"], 999999)
            return (dist, -d["excess"])
            
        donors.sort(key=donor_sort_key)
        
        for d in donors:
            safe_excess = max(0.0, d["excess"] - BUFFER)
            if safe_excess <= 0:
                continue
                
            transfer = min(safe_excess, remaining_shortage)
            
            # Apply ceiling rounding to transfer quantities to ensure whole units
            transfer = math.ceil(transfer)
            
            if transfer > 0:
                dist = 0.0
                if distance_matrix and nb_name in distance_matrix:
                    dist = distance_matrix[nb_name].get(d["branch"], 0.0)
                    
                transfers.append({
                    "from_branch": d["branch"],
                    "to_branch": nb_name,
                    "quantity": safe(transfer),
                    "distance_km": safe(dist),
                    "drive_minutes": safe(dist * 2), # proxy if missing
                    "urgency": "HIGH" if transfer >= 10 else ("NORMAL" if transfer >= 5 else "NORMAL") # Just an example
                })
                
                d["excess"] -= transfer
                remaining_shortage -= transfer
                
                post_shuffle[d["branch"]]["shuffle_out"] += transfer
                post_shuffle[nb_name]["shuffle_in"] += transfer
                
            if remaining_shortage <= 0:
                break
                
        post_shuffle[nb_name]["effective_shortage"] = safe(remaining_shortage)
        post_shuffle[nb_name]["effective_otb"] = safe(remaining_shortage)
        post_shuffle[nb_name]["needs_purchase"] = remaining_shortage > 0

    all_shortage = len(needy) == len(positions) and len(positions) > 0
    all_excess = len(donors) == len(positions) and len(positions) > 0
    no_shuffle_possible = len(donors) == 0 and len(needy) > 0
    
    warning_message = ""
    if all_shortage:
        warning_message = "All branches need this model — no shuffle possible. Full OTB raised."
    elif all_excess:
        warning_message = "All branches overstocked. Consider hub shuffle or promotions."
    elif len(needy) == 0:
        warning_message = "Stocks balanced — no shuffle required."
        
    total_effective_otb = sum(p["effective_otb"] for p in post_shuffle.values())
    total_coverable = total_shortage_before - total_effective_otb
    total_units_moving = sum(t["quantity"] for t in transfers)
    
    return {
        "transfers": transfers,
        "post_shuffle_positions": list(post_shuffle.values()),
        "edge_cases": {
            "all_shortage": all_shortage,
            "all_excess": all_excess,
            "no_shuffle_possible": no_shuffle_possible,
            "warning_message": warning_message,
        },
        "summary": {
            "total_shortage_before": safe(total_shortage_before),
            "total_coverable_by_shuffle": safe(total_coverable),
            "total_effective_otb": safe(total_effective_otb),
            "total_transfers": len(transfers),
            "total_units_moving": safe(total_units_moving),
        }
    }

def build_full_asm_report(
    asm_name: str,
    brand: str,
    im_code: str,
    item_model: str,
    prediction_date: date,
    sales_df: pd.DataFrame,
    closing_stock_sheets: dict,
    asm_mapping_df: pd.DataFrame,
    distance_matrix: dict,
    msp_weights: dict,
    multiplier_flags: dict,
) -> dict:
    
    branches_in_asm = []
    if not asm_mapping_df.empty:
        mask = asm_mapping_df["asm_name"].astype(str).str.strip().str.lower() == asm_name.lower()
        branches_in_asm = asm_mapping_df[mask]["branch"].tolist()
        
    if not branches_in_asm:
        # Fallback if asm not found, maybe empty report
        pass
        
    # Get stocks
    closing_stocks = get_all_stocks_for_asm(
        closing_stock_sheets,
        branches_in_asm,
        im_code,
        brand,
        prediction_date
    )
    
    used_date, _ = get_most_recent_sheet(closing_stock_sheets, prediction_date)
    closing_stock_date_used = used_date.isoformat()
    
    item_price = get_item_price(brand, im_code)

# Fallback: search MOP cache by im_code only if price not found
    if item_price == 0.0:
        global _mop_prices_cache
        if _mop_prices_cache is None:
            _mop_prices_cache = load_mop_prices()
        for (b, code), price in _mop_prices_cache.items():
            if code == im_code.strip().lower():
                item_price = price
                print(f">>> MOP fallback found: {item_price} for im_code={im_code}")
                break

    computed_price_range = get_price_range_from_price(item_price)
    
    
    msp_by_branch = compute_msp_for_branches(
        price_range=computed_price_range,
        branches=branches_in_asm,
        brand=brand,
        im_code=im_code,
        item_model=item_model,
        prediction_date=prediction_date,
        sales_df=sales_df,
        w1=msp_weights.get("w1", 0.5),
        w2=msp_weights.get("w2", 0.3),
        w3=msp_weights.get("w3", 0.2),
        apply_brand_affinity=multiplier_flags.get("apply_brand_affinity", True),
        apply_price_affinity=multiplier_flags.get("apply_price_affinity", True),
        apply_dow=multiplier_flags.get("apply_dow", True),
        apply_festival=multiplier_flags.get("apply_festival", True),
    )


    
    positions = compute_positions(branches_in_asm, brand, im_code, msp_by_branch, closing_stocks)
    
    shuffle_result = resolve_asm_shuffle(positions, distance_matrix)
    
    branches_needing_po = [
        {"branch": p["branch"], "effective_otb": p["effective_otb"]}
        for p in shuffle_result["post_shuffle_positions"] if p["effective_otb"] > 0
    ]
    
    total_units_moving = sum(t["quantity"] for t in shuffle_result["transfers"])
    savings_from_shuffle = float(total_units_moving * item_price)
    otb_savings = float(shuffle_result["summary"]["total_coverable_by_shuffle"] * item_price)

    total_raw_otb_cost = float(shuffle_result["summary"]["total_shortage_before"] * item_price)
    total_effective_otb_cost = float(shuffle_result["summary"]["total_effective_otb"] * item_price)

    otb_summary = {
        "total_raw_otb": shuffle_result["summary"]["total_shortage_before"],
        "total_shuffle_reduction": shuffle_result["summary"]["total_coverable_by_shuffle"],
        "total_effective_otb": shuffle_result["summary"]["total_effective_otb"],
        "branches_needing_po": branches_needing_po,
        "po_to_manufacturer": shuffle_result["summary"]["total_effective_otb"],
        "money_saved_from_shuffle": savings_from_shuffle,
        "otb_value_saved": otb_savings,
        "total_raw_otb_cost": total_raw_otb_cost,
        "total_effective_otb_cost": total_effective_otb_cost,
    }
    
    return {
        "asm_name": asm_name,
        "brand": brand,
        "im_code": im_code,
        "item_model": item_model,
        "prediction_date": prediction_date.isoformat(),
        "closing_stock_date_used": closing_stock_date_used,
        "branches_in_asm": branches_in_asm,
        "msp_by_branch": msp_by_branch,
        "closing_stocks": closing_stocks,
        "positions": positions,
        "shuffle_result": shuffle_result,
        "otb_summary": otb_summary,
    }
def aggregate_reports(reports):
    if not reports: return {}
    base = reports[0]
    agg = {
        "asm_name": base["asm_name"],
        "brand": base["brand"],
        "im_code": "ALL",
        "item_model": f"All {base['brand']} Models",
        "prediction_date": base["prediction_date"],
        "closing_stock_date_used": base["closing_stock_date_used"],
        "branches_in_asm": base["branches_in_asm"],
        "msp_by_branch": {b: 0.0 for b in base["branches_in_asm"]},
        "closing_stocks": {b: 0.0 for b in base["branches_in_asm"]},
        "positions": [],
        "shuffle_result": {
            "transfers": [],
            "post_shuffle_positions": [],
            "edge_cases": {"all_shortage": False, "all_excess": False, "no_shuffle_possible": False, "warning_message": ""},
            "summary": {
                "total_shortage_before": 0, "total_coverable_by_shuffle": 0,
                "total_effective_otb": 0, "total_transfers": 0, "total_units_moving": 0
            }
        },
        "otb_summary": {
            "total_raw_otb": 0, "total_shuffle_reduction": 0, "total_effective_otb": 0,
            "branches_needing_po": [], "po_to_manufacturer": 0,
            "money_saved_from_shuffle": 0.0, "otb_value_saved": 0.0,
            "total_raw_otb_cost": 0.0, "total_effective_otb_cost": 0.0
        }
    }
    
    pos_map = {b: {"branch": b, "closing_stock": 0, "msp_20d": 0, "position": 0, "excess": 0, "shortage": 0, "status": "BALANCED"} for b in base["branches_in_asm"]}
    post_pos_map = {b: {"branch": b, "closing_stock": 0, "msp_20d": 0, "original_shortage": 0, "shuffle_in": 0, "shuffle_out": 0, "effective_shortage": 0, "effective_otb": 0, "needs_purchase": False} for b in base["branches_in_asm"]}
    
    for r in reports:
        for b, v in r["msp_by_branch"].items(): agg["msp_by_branch"][b] += v
        for b, v in r["closing_stocks"].items(): agg["closing_stocks"][b] += v
        
        agg["otb_summary"]["money_saved_from_shuffle"] += r["otb_summary"].get("money_saved_from_shuffle", 0.0)
        agg["otb_summary"]["otb_value_saved"] += r["otb_summary"].get("otb_value_saved", 0.0)
        agg["otb_summary"]["total_raw_otb_cost"] += r["otb_summary"].get("total_raw_otb_cost", 0.0)
        agg["otb_summary"]["total_effective_otb_cost"] += r["otb_summary"].get("total_effective_otb_cost", 0.0)
        
        for p in r["positions"]:
            b = p["branch"]
            pos_map[b]["closing_stock"] += p["closing_stock"]
            pos_map[b]["msp_20d"] += p["msp_20d"]
            pos_map[b]["position"] += p["position"]
            pos_map[b]["excess"] += p["excess"]
            pos_map[b]["shortage"] += p["shortage"]
            
        for t in r["shuffle_result"]["transfers"]:
            t["item_model"] = r["item_model"]
            agg["shuffle_result"]["transfers"].append(t)
            
        for pp in r["shuffle_result"]["post_shuffle_positions"]:
            b = pp["branch"]
            post_pos_map[b]["closing_stock"] += pp["closing_stock"]
            post_pos_map[b]["msp_20d"] += pp["msp_20d"]
            post_pos_map[b]["original_shortage"] += pp["original_shortage"]
            post_pos_map[b]["shuffle_in"] += pp["shuffle_in"]
            post_pos_map[b]["shuffle_out"] += pp["shuffle_out"]
            post_pos_map[b]["effective_shortage"] += pp["effective_shortage"]
            post_pos_map[b]["effective_otb"] += pp["effective_otb"]
            
        agg["shuffle_result"]["summary"]["total_shortage_before"] += r["shuffle_result"]["summary"]["total_shortage_before"]
        agg["shuffle_result"]["summary"]["total_coverable_by_shuffle"] += r["shuffle_result"]["summary"]["total_coverable_by_shuffle"]
        agg["shuffle_result"]["summary"]["total_effective_otb"] += r["shuffle_result"]["summary"]["total_effective_otb"]
        agg["shuffle_result"]["summary"]["total_transfers"] += r["shuffle_result"]["summary"]["total_transfers"]
        agg["shuffle_result"]["summary"]["total_units_moving"] += r["shuffle_result"]["summary"]["total_units_moving"]
        
        agg["otb_summary"]["total_raw_otb"] += r["otb_summary"]["total_raw_otb"]
        agg["otb_summary"]["total_shuffle_reduction"] += r["otb_summary"]["total_shuffle_reduction"]
        agg["otb_summary"]["total_effective_otb"] += r["otb_summary"]["total_effective_otb"]
        agg["otb_summary"]["po_to_manufacturer"] += r["otb_summary"]["po_to_manufacturer"]

    for b, p in pos_map.items():
        p["status"] = "EXCESS" if p["excess"] > 0 else "SHORTAGE" if p["shortage"] > 0 else "BALANCED"
        agg["positions"].append(p)
        
    for b, pp in post_pos_map.items():
        pp["needs_purchase"] = pp["effective_otb"] > 0
        agg["shuffle_result"]["post_shuffle_positions"].append(pp)
        if pp["effective_otb"] > 0:
            agg["otb_summary"]["branches_needing_po"].append({"branch": b, "effective_otb": pp["effective_otb"]})
            
    return agg
