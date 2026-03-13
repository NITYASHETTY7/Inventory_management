"""
data_processing.py
------------------
Loads any .xlsx or .csv file placed in the backend/ folder.

DROP YOUR FILE HERE → backend/sales_data.xlsx  (or .csv)

Column requirements (exact names, case-insensitive after strip):
    Branch | I/M Code | Item/Model | Date | Qty  (or Qty.)

Date format: DD/MM/YYYY

Brand is extracted from the trailing "-Brand" suffix in Item/Model.
    Example: "Vivo V60 5G 12GB 256GB Moonlight Blue-Vivo"  → Brand = "Vivo"

Training window (fixed): 01 Sep 2025 – 31 Dec 2025
Prediction window:       01 Jan 2026 onwards
"""

import pandas as pd
import numpy as np
from pathlib import Path
from functools import lru_cache
from datetime import datetime
import json
import re

# ── Fixed training window ──────────────────────────────────────────────────
TRAIN_START = datetime(2025, 9,  1)
TRAIN_END   = datetime(2025, 12, 31)

# ── File discovery priority ────────────────────────────────────────────────
def _find_data_file() -> Path:
    p = Path(__file__).parent / "Sales_Combined.xlsx"
    if not p.exists():
        raise FileNotFoundError(
            "The required data file 'Sales_Combined.xlsx' was not found in the backend/ folder."
        )
    return p


# ── Column normalisation ───────────────────────────────────────────────────

def _normalise_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Strip whitespace and unify Qty. / qty / Quantity → Qty."""
    df.columns = df.columns.str.strip()
    rename = {}
    for col in df.columns:
        low = col.lower().replace(".", "").replace(" ", "")
        if low in ("qty", "quantity", "sales", "units", "sumofqty"):
            rename[col] = "Qty"
        elif low == "itemmodel":
            rename[col] = "Item/Model"
        elif low == "branch":
            rename[col] = "Branch"
        elif low in ("date", "docdate"):
            rename[col] = "Date"
    df.rename(columns=rename, inplace=True)
    return df


# ── Brand / Model helpers ──────────────────────────────────────────────────

_MODEL_FAMILY_MAP = None

def _load_model_family_map():
    global _MODEL_FAMILY_MAP
    if _MODEL_FAMILY_MAP is not None:
        return _MODEL_FAMILY_MAP
    
    _MODEL_FAMILY_MAP = []
    checkpoint_path = Path(__file__).parent / "Model_Launch_Groups.xlsx"
    if checkpoint_path.exists():
        try:
            df_families = pd.read_excel(checkpoint_path)
            if "Model Family" in df_families.columns:
                # Remove extra spaces and sort by length descending for greedy match
                families = df_families["Model Family"].dropna().astype(str).str.strip().unique().tolist()
                families = [f for f in families if f]
                families.sort(key=len, reverse=True)
                _MODEL_FAMILY_MAP = families
        except Exception as e:
            print(f"[data] Error loading model families: {e}")
    
    if not _MODEL_FAMILY_MAP:
        _MODEL_FAMILY_MAP = []
    return _MODEL_FAMILY_MAP

def _extract_brand(item_model: str) -> str:
    parts = str(item_model).rsplit("-", 1)
    return parts[-1].strip() if len(parts) == 2 else "Unknown"

def _extract_model(item_model: str) -> str:
    raw_model = str(item_model).rsplit("-", 1)[0].strip()
    
    families = _load_model_family_map()
    lower_raw = raw_model.lower()
    
    for f in families:
        if f.lower() in lower_raw:
            return f
            
    # Fallback: if not mapped in Model_Launch_Groups.xlsx, strip specifications (like 6GB, 128GB) and color
    # to club the same models together (e.g. "Realme C85 5G 6GB 128GB Peacock Green" -> "Realme C85 5G")
    match = re.search(r'\b\d+(?:GB|TB|MB)\b', raw_model, flags=re.IGNORECASE)
    if match:
        return raw_model[:match.start()].strip()
        
    return raw_model


# ── Main loader ────────────────────────────────────────────────────────────

_DATA_CACHE = None

def load_clean_data() -> pd.DataFrame:
    """
    Load, normalise, and return the full training-window DataFrame.
    """
    global _DATA_CACHE
    if _DATA_CACHE is not None:
        return _DATA_CACHE

    path = _find_data_file()
    print(f"[data] Loading: {path.name}")

    if path.suffix.lower() in (".xlsx", ".xls"):
        df = pd.read_excel(path, header=2)
    else:
        df = pd.read_csv(path)

    print("Columns before normalisation:", df.columns)
    df = _normalise_columns(df)
    print("Columns after normalisation:", df.columns)

    # Validate required columns
    required = {"Branch", "Item/Model", "Date", "Qty"}
    missing  = required - set(df.columns)
    if missing:
        raise ValueError(
            f"Missing columns in data file: {missing}\n"
            f"Found: {list(df.columns)}\n"
            f"Required: Branch | I/M Code | Item/Model | Date | Qty"
        )

    # Forward fill Branch as it might be a grouped report
    if "Branch" in df.columns:
        df["Branch"] = df["Branch"].ffill()

    # Forward fill Brand and Item/Model BEFORE dropping rows with missing dates (which are header/parent rows)
    if "Brand" in df.columns:
        df["Brand"] = df["Brand"].replace("Unknown", np.nan).ffill()
    
    if "Item/Model" in df.columns:
        df["Item/Model"] = df["Item/Model"].ffill()

    # Parse dates (DD/MM/YYYY primary, fallback to pandas inference)
    df["Date"] = pd.to_datetime(df["Date"], dayfirst=True, errors="coerce")
    df.dropna(subset=["Date"], inplace=True)

    # Extract Brand / Model
    if "Brand" not in df.columns:
        df["Brand"] = df["Item/Model"].apply(_extract_brand)
    else:
        df["Brand"] = df["Brand"].fillna("Unknown").astype(str).str.strip()
        # If date is valid, it should be a valid sales row.
    
    # Filter out Unknown brands if they are truly invalid?
    # No, Unknown might be valid.
    
    df["Model"] = df["Item/Model"].apply(_extract_model)

    # Day-of-week
    df["DOW"] = df["Date"].dt.dayofweek   # 0=Mon … 6=Sun

    # Map MOP (price)
    mop_path = Path(__file__).parent / "Brand Item-Model MOP.xlsx"
    if mop_path.exists():
        try:
            mop_df = pd.read_excel(mop_path)
            if "Item/Model" in mop_df.columns and "MOP" in mop_df.columns:
                price_map = dict(zip(mop_df["Item/Model"], mop_df["MOP"]))
                df["price"] = df["Item/Model"].map(price_map).fillna(0)
        except Exception as e:
            print(f"[data] Error loading MOP file: {e}")

    # ── Apply fixed training window ────────────────────────────────────────
    # Do not filter by date here, so that actuals can be loaded.
    # Filtering will be done by the callers.

    cols_to_keep = ["Date","Branch","Brand","Model","Qty","DOW"]
    if "price" in df.columns:
        cols_to_keep.append("price")
    df = df[cols_to_keep].reset_index(drop=True)
    print(f"[data] {len(df):,} rows loaded ({df['Date'].min().date()} – {df['Date'].max().date()})")
    
    _DATA_CACHE = df
    return df


# ── Store Profiles ─────────────────────────────────────────────────────────

_PROFILES_CACHE = None

def load_store_profiles() -> dict:
    global _PROFILES_CACHE
    if _PROFILES_CACHE is not None:
        return _PROFILES_CACHE
    
    path = Path(__file__).parent / "store_profiles.json"
    if not path.exists():
        _PROFILES_CACHE = {}
        return _PROFILES_CACHE
        
    try:
        with open(path, "r") as f:
            _PROFILES_CACHE = json.load(f)
    except Exception as e:
        print(f"Error loading store_profiles.json: {e}")
        _PROFILES_CACHE = {}
        
    return _PROFILES_CACHE

from typing import Optional

def get_segment_profile(branch: str, brand: str, model_name: str) -> Optional[dict]:
    profiles = load_store_profiles()
    return profiles.get(branch, {}).get(brand, {}).get(model_name)


# ── Filter helpers ─────────────────────────────────────────────────────────

PRICE_BINS = [
    (0, 10000, "Under ₹10k"),
    (10000, 20000, "₹10k – ₹20k"),
    (20000, 30000, "₹20k – ₹30k"),
    (30000, 50000, "₹30k – ₹50k"),
    (50000, 80000, "₹50k – ₹80k"),
    (80000, 120000, "₹80k – ₹120k"),
    (120000, float('inf'), "Above ₹120k")
]

def get_price_ranges(brand: str = None) -> list[str]:
    df = load_clean_data()
    if brand:
        df = df[df["Brand"] == brand]
    if "price" not in df.columns:
        return []
    valid = []
    for min_v, max_v, label in PRICE_BINS:
        if ((df["price"] >= min_v) & (df["price"] < max_v)).any():
            valid.append(label)
    return valid

def get_branches() -> list[str]:
    return sorted(load_clean_data()["Branch"].unique().tolist())

def get_brands() -> list[str]:
    return sorted(load_clean_data()["Brand"].unique().tolist())

def get_models(brand: str = None, price_range: str = None) -> list[str]:
    df = load_clean_data()
    if brand:
        df = df[df["Brand"] == brand]
    if price_range and "price" in df.columns:
        for min_v, max_v, label in PRICE_BINS:
            if price_range == label:
                df = df[(df["price"] >= min_v) & (df["price"] < max_v)]
                break
    return sorted(df["Model"].unique().tolist())

def filter_data(branch: str = None,
                brand:  str = None,
                model:  str = None,
                price_range: str = None) -> pd.DataFrame:
    df = load_clean_data()
    if branch: df = df[df["Branch"] == branch]
    if brand:  df = df[df["Brand"]  == brand]
    if model:  df = df[df["Model"]  == model]
    if price_range and "price" in df.columns:
        for min_v, max_v, label in PRICE_BINS:
            if price_range == label:
                df = df[(df["price"] >= min_v) & (df["price"] < max_v)]
                break
    return df


# ── Daily aggregation helper ───────────────────────────────────────────────

def build_daily_series(df: pd.DataFrame):
    """Return (qty_series, dow_series) both sorted by date."""
    if df.empty:
        return pd.Series(dtype=float), pd.Series(dtype=int)
    agg = (df.groupby("Date")
             .agg(Qty=("Qty","sum"), DOW=("DOW","first"))
             .reset_index()
             .sort_values("Date"))
    return (
        pd.Series(agg["Qty"].values,  index=agg["Date"].values),
        pd.Series(agg["DOW"].values,  index=agg["Date"].values),
    )

def get_historical_summary(df: pd.DataFrame) -> list[dict]:
    if df.empty:
        return []
    qty, _ = build_daily_series(df)
    return [{"date": pd.Timestamp(d).strftime("%Y-%m-%d"), "qty": int(v)}
            for d, v in qty.items()]

@lru_cache(maxsize=1)
def load_actual_feb_data() -> pd.DataFrame:
    """Load actuals from feb_sales.xlsx for comparison."""
    p = Path(__file__).parent / "feb_sales.xlsx"
    if not p.exists():
        return pd.DataFrame(columns=["Date", "Branch", "Brand", "Model", "Qty", "DOW"])

    df = pd.read_excel(p)
    df = _normalise_columns(df)
    
    if "Brand" not in df.columns:
        if "Item/Model" in df.columns:
            df["Brand"] = df["Item/Model"].apply(_extract_brand)
        else:
            df["Brand"] = "Unknown"
    else:
        df["Brand"] = df["Brand"].fillna("Unknown").astype(str).str.strip()

    if "Item/Model" in df.columns:
         df["Model"] = df["Item/Model"].apply(_extract_model)
    else:
         df["Model"] = "Unknown"

    df["Date"] = pd.to_datetime(df["Date"], dayfirst=True, errors="coerce")
    df.dropna(subset=["Date"], inplace=True)
    
    df["DOW"] = df["Date"].dt.dayofweek

    # Map MOP (price)
    mop_path = Path(__file__).parent / "Brand Item-Model MOP.xlsx"
    if mop_path.exists() and "Item/Model" in df.columns:
        try:
            mop_df = pd.read_excel(mop_path)
            if "Item/Model" in mop_df.columns and "MOP" in mop_df.columns:
                price_map = dict(zip(mop_df["Item/Model"], mop_df["MOP"]))
                df["price"] = df["Item/Model"].map(price_map).fillna(0)
        except Exception as e:
            pass
    
    df = df[df["Date"] >= datetime(2026, 1, 1)].copy()
    
    cols = ["Date", "Branch", "Brand", "Model", "Qty", "DOW"]
    if "price" in df.columns:
        cols.append("price")
    for c in cols:
        if c not in df.columns:
            df[c] = 0 if c in ("Qty", "price") else "Unknown"
            
    return df[cols].reset_index(drop=True)

def filter_actual_data(branch: str = None, brand: str = None, model: str = None, price_range: str = None) -> pd.DataFrame:
    df = load_actual_feb_data()
    if branch: df = df[df["Branch"] == branch]
    if brand:  df = df[df["Brand"] == brand]
    if model:  df = df[df["Model"] == model]
    if price_range and "price" in df.columns:
        for min_v, max_v, label in PRICE_BINS:
            if price_range == label:
                df = df[(df["price"] >= min_v) & (df["price"] < max_v)]
                break
    return df

# Pre-load data cache on module import to prevent concurrent loading by multiple API requests
try:
    load_clean_data()
    load_actual_feb_data()
except Exception as e:
    print(f"Warning: Initial data load failed: {e}")

