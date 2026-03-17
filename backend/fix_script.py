import os
import re

path = "backend/shuffle_otb_service.py"
with open(path, "r") as f:
    content = f.read()

# Add load_mop_prices function
mop_func = """
def load_mop_prices():
    from pathlib import Path
    import pandas as pd
    mop_path = Path(__file__).parent / "Brand Item-Model MOP.xlsx"
    if not mop_path.exists():
        return {}
    try:
        df = pd.read_excel(mop_path)
        mapping = {}
        for _, row in df.iterrows():
            brand = str(row.get("Brand", "")).strip().lower()
            im_code = str(row.get("Item/SKU", "")).strip().lower()
            try:
                price = float(row.get("Price (MOP)", 0.0))
            except:
                price = 0.0
            mapping[(brand, im_code)] = price
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

def get_price_range_from_price(price: float) -> str:
    from data_processing import PRICE_BINS
    for min_v, max_v, label in PRICE_BINS:
        if min_v <= price < max_v:
            return label
    return None

"""

# Insert it after imports
content = re.sub(r'logger = logging.getLogger\(__name__\)\n', 'logger = logging.getLogger(__name__)\n' + mop_func, content)

# Modify compute_msp_for_branches to take price_range
content = re.sub(r'def compute_msp_for_branches\(', 'def compute_msp_for_branches(\n    price_range: str,', content)

# Find where run_curated_msp_window is called
content = re.sub(r'price_range=None,', 'price_range=price_range,', content)

# Modify build_full_asm_report to fetch price and pass price_range
build_full_asm_report_mod = """
    # Get price and price range
    item_price = get_item_price(brand, im_code)
    computed_price_range = get_price_range_from_price(item_price)

    msp_by_branch = compute_msp_for_branches(
        price_range=computed_price_range,
"""

content = re.sub(r'\s*msp_by_branch = compute_msp_for_branches\(', build_full_asm_report_mod, content)

# Now, modify the end of build_full_asm_report to include savings metrics
summary_mod = """
    total_transfers = len(shuffle_result["transfers"])
    total_units_moving = sum(t["quantity"] for t in shuffle_result["transfers"])
    
    savings_from_shuffle = float(total_units_moving * item_price)
    otb_savings = float(shuffle_result["summary"]["total_coverable_by_shuffle"] * item_price)

    otb_summary = {
        "total_raw_otb": shuffle_result["summary"]["total_shortage_before"],
        "total_shuffle_reduction": shuffle_result["summary"]["total_coverable_by_shuffle"],
        "total_effective_otb": shuffle_result["summary"]["total_effective_otb"],
        "branches_needing_po": branches_needing_po,
        "po_to_manufacturer": shuffle_result["summary"]["total_effective_otb"],
        "money_saved_from_shuffle": savings_from_shuffle,
        "otb_value_saved": otb_savings,
    }
"""

content = re.sub(r'\s*otb_summary = \{\n\s*"total_raw_otb"(.|\n)*?\}\n', summary_mod, content)

# Fix aggregate_reports to aggregate the savings
agg_mod = """        "otb_summary": {
            "total_raw_otb": 0, "total_shuffle_reduction": 0, "total_effective_otb": 0,
            "branches_needing_po": [], "po_to_manufacturer": 0, "money_saved_from_shuffle": 0.0, "otb_value_saved": 0.0
        }"""
content = re.sub(r'\s*"otb_summary": \{\n\s*"total_raw_otb"(.|\n)*?\}\n', agg_mod + '\n', content)

agg_loop_mod = """        agg["otb_summary"]["money_saved_from_shuffle"] += r["otb_summary"].get("money_saved_from_shuffle", 0.0)
        agg["otb_summary"]["otb_value_saved"] += r["otb_summary"].get("otb_value_saved", 0.0)
        
        for p in r["positions"]:"""
content = re.sub(r'\s*for p in r\["positions"\]:', '\n' + agg_loop_mod, content)

with open("backend/fix_shuffle.py", "w") as f:
    f.write(content)
