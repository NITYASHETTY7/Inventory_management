import pandas as pd
import numpy as np
import logging
from datetime import date, datetime
from pathlib import Path

logger = logging.getLogger(__name__)

_CACHED_SHEETS = None

def load_all_closing_stock_sheets(filepath: str) -> dict[str, pd.DataFrame]:
    """
    Read all 10 sheets from CLOSING STOCK FINAL.xlsx.
    Key = parsed date string (YYYY-MM-DD), Value = normalized DataFrame.
    """
    global _CACHED_SHEETS
    if _CACHED_SHEETS is not None:
        return _CACHED_SHEETS
    path = Path(filepath)
    if not path.exists():
        logger.warning(f"{filepath} missing, returning empty dict.")
        return {}

    sheets_dict = {}
    try:
        # Load all sheets
        xls = pd.ExcelFile(path)
        for sheet_name in xls.sheet_names:
            try:
                # Parse sheet name "DD-MM-YYYY" or "DD.MM.YYYY" to datetime.date
                clean_name = sheet_name.strip().replace(".", "-")
                dt = datetime.strptime(clean_name, "%d-%m-%Y").date()
                dt_str = dt.isoformat()
                
                df = pd.read_excel(xls, sheet_name=sheet_name)
                
                # Normalize columns
                df.columns = df.columns.str.strip().str.lower()
                rename_map = {}
                for col in df.columns:
                    if col in ["i/m code", "i/m (item/model) code", "im code", "im_code", "item/model code"]:
                        rename_map[col] = "im_code"
                    elif col in ["item model", "item/model", "item_model"]:
                        rename_map[col] = "item_model"
                    elif col in ["qty", "quantity", "total", "sum of qty"]:
                        rename_map[col] = "quantity"
                df.rename(columns=rename_map, inplace=True)
                
                # Extract brand from item_model if not present
                if "brand" not in df.columns and "item_model" in df.columns:
                    df["brand"] = df["item_model"].astype(str).apply(lambda x: x.rsplit("-", 1)[-1].strip() if "-" in x else "Unknown")
                
                # Ensure missing columns are filled
                for req in ["branch", "brand", "im_code", "item_model", "quantity"]:
                    if req not in df.columns:
                        logger.warning(f"Missing column '{req}' in sheet '{sheet_name}'. Filling with NaN.")
                        df[req] = np.nan
                
                sheets_dict[dt_str] = df
            except Exception as e:
                logger.warning(f"Failed to parse sheet '{sheet_name}': {e}")
                
    except Exception as e:
        logger.error(f"Error loading {filepath}: {e}")
        
    # Sort dict by date ascending
    sorted_dict = {k: sheets_dict[k] for k in sorted(sheets_dict.keys())}
    _CACHED_SHEETS = sorted_dict
    return sorted_dict

def get_most_recent_sheet(
    sheets: dict[str, pd.DataFrame],
    as_of_date: date,
) -> tuple[date, pd.DataFrame]:
    if not sheets:
        return as_of_date, pd.DataFrame(columns=["branch", "brand", "im_code", "item_model", "quantity"])
        
    sorted_dates = sorted(sheets.keys())
    as_of_str = as_of_date.isoformat()
    
    best_date_str = None
    for d_str in reversed(sorted_dates):
        if d_str <= as_of_str:
            best_date_str = d_str
            break
            
    if best_date_str is None:
        best_date_str = sorted_dates[0]
        logger.warning(f"as_of_date {as_of_str} is older than all sheets. Using earliest: {best_date_str}")
        
    return datetime.strptime(best_date_str, "%Y-%m-%d").date(), sheets[best_date_str]

def get_closing_stock(
    sheets: dict[str, pd.DataFrame],
    branch: str,
    im_code: str,
    brand: str,
    as_of_date: date,
) -> float:
    _, df = get_most_recent_sheet(sheets, as_of_date)
    if df.empty:
        return 0.0
        
    mask = (
        (df["branch"].astype(str).str.strip().str.lower() == branch.strip().lower()) &
        (df["brand"].astype(str).str.strip().str.lower() == brand.strip().lower()) &
        (df["im_code"].astype(str).str.strip().str.lower() == im_code.strip().lower())
    )
    res = df[mask]
    if res.empty:
        return 0.0
    return float(res["quantity"].sum())

def get_all_stocks_for_asm(
    sheets: dict[str, pd.DataFrame],
    branches: list[str],
    im_code: str,
    brand: str,
    as_of_date: date,
) -> dict[str, float]:
    _, df = get_most_recent_sheet(sheets, as_of_date)
    res = {}
    for branch in branches:
        if df.empty:
            res[branch] = 0.0
            continue
        if im_code.strip().lower() == "all" or im_code == "":
            mask = (
                (df["branch"].astype(str).str.strip().str.lower() == branch.strip().lower()) &
                (df["brand"].astype(str).str.strip().str.lower() == brand.strip().lower())
            )
        else:
            mask = (
                (df["branch"].astype(str).str.strip().str.lower() == branch.strip().lower()) &
                (df["brand"].astype(str).str.strip().str.lower() == brand.strip().lower()) &
                (df["im_code"].astype(str).str.strip().str.lower() == im_code.strip().lower())
            )
        filtered = df[mask]
        res[branch] = float(filtered["quantity"].sum()) if not filtered.empty else 0.0
    return res

def get_available_stock_dates(sheets: dict[str, pd.DataFrame]) -> list[str]:
    return sorted(sheets.keys())

def get_model_list_for_asm(
    sheets: dict[str, pd.DataFrame],
    branches: list[str],
    as_of_date: date,
) -> list[dict]:
    _, df = get_most_recent_sheet(sheets, as_of_date)
    if df.empty:
        return []
        
    branches_lower = [b.strip().lower() for b in branches]
    mask = df["branch"].astype(str).str.strip().str.lower().isin(branches_lower)
    filtered = df[mask].dropna(subset=["im_code", "item_model", "brand"])
    
    unique_models = filtered[["im_code", "item_model", "brand"]].drop_duplicates()
    
    res = []
    for _, row in unique_models.iterrows():
        res.append({
            "im_code": str(row["im_code"]).strip(),
            "item_model": str(row["item_model"]).strip(),
            "brand": str(row["brand"]).strip()
        })
    return res
