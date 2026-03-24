from typing import Optional
"""
api_routes.py — all FastAPI endpoints
"""

from fastapi import APIRouter, HTTPException, Query,Request
from pydantic import BaseModel, Field

from data_processing import get_branches, get_brands, get_models, get_price_ranges
from prediction_service import run_prediction, run_comparison, run_msp_accuracy
from curated_msp import run_curated_msp_window
from brand_affinity import compute_brand_affinity
from model_affinity import compute_model_affinity
from price_affinity import compute_price_affinity
from festival_calendar import festival_calendar_dict
from price_range_accuracy import get_accuracy_for_price_ranges
from asm_service import get_asm_data
from shuffle_service import (
    recommend_asm_shuffle,
    recommend_hub_shuffle,
    detect_cross_asm_xmc,
    get_branch_shuffle_summary,
    compute_store_positions,
    load_closing_stock as load_closing_stock_shuffle,
    load_asm_mapping as load_asm_mapping_shuffle
)
from otb_service import (
    build_otb_table, load_closing_stock, load_asm_mapping,
    rank_stores_for_allocation, build_staggered_schedule
)
from data_processing import load_clean_data

router = APIRouter()


# ── Schemas ────────────────────────────────────────────────────────────────

class PredictionRequest(BaseModel):
    branch:              Optional[str] = None
    brand:               Optional[str] = None
    model:               Optional[str] = None
    price_range:         Optional[str] = None
    days:                int        = Field(7,   ge=1,  le=120)
    festival_multiplier: float      = Field(1.0, ge=1.0, le=2.0)
    model_name:          str        = "median_dow"

class CompareRequest(BaseModel):
    branch:              Optional[str] = None
    brand:               Optional[str] = None
    model:               Optional[str] = None
    price_range:         Optional[str] = None
    days:                int        = Field(7,   ge=1, le=120)
    festival_multiplier: float      = Field(1.0, ge=1.0, le=2.0)

class MspAccuracyRequest(BaseModel):
    branch:              Optional[str] = None
    brand:               Optional[str] = None
    model:               Optional[str] = None
    price_range:         Optional[str] = None
    festival_multiplier: float      = Field(1.0, ge=1.0, le=2.0)
    enable_dow:          bool       = False
    enable_festival:     bool       = False
    enable_price_affinity: bool     = False
    enable_brand_affinity: bool     = False
    w1:                  float      = 0.5
    w2:                  float      = 0.3
    w3:                  float      = 0.2


# ── Filter endpoints ───────────────────────────────────────────────────────

@router.get("/branches")
def list_branches() -> list[str]:
    return get_branches()

@router.get("/brands")
def list_brands() -> list[str]:
    return get_brands()

@router.get("/models")
def list_models(brand: Optional[str] = Query(None), price_range: Optional[str] = Query(None)) -> list[str]:
    return get_models(brand=brand, price_range=price_range)

@router.get("/price-ranges")
def list_price_ranges(brand: Optional[str] = Query(None)) -> list[str]:
    return get_price_ranges(brand=brand)

@router.get("/brand-affinity")
def brand_affinity(branch: Optional[str] = Query(None),
                   brand: Optional[str] = Query(None),
                   model: Optional[str] = Query(None),
                   price_range: Optional[str] = Query(None)):
    """
    Returns brand affinity scores filtered by standard dimensions.
    """
    try:
        return compute_brand_affinity(branch=branch, brand=brand, model=model, price_range=price_range)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/model-affinity")
def model_affinity(branch: Optional[str] = Query(None),
                   brand: Optional[str] = Query(None),
                   price_range: Optional[str] = Query(None)):
    """
    Returns model affinity scores and quarter information.
    """
    try:
        return compute_model_affinity(branch=branch, brand=brand, price_range=price_range)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/price-affinity")
def price_affinity(branch: Optional[str] = Query(None),
                   brand: Optional[str] = Query(None),
                   model: Optional[str] = Query(None)):
    """
    Returns price band affinity scores filtered by standard dimensions.
    """
    try:
        return compute_price_affinity(branch=branch, brand=brand, model=model)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/festivals")
def list_festivals():
    """Returns the full Tamil Nadu festival calendar with tier info."""
    return festival_calendar_dict()

@router.get("/geocoded-stores")
def get_geocoded_stores():
    import pandas as pd
    path = os.path.join(os.path.dirname(__file__), 'data', 'geocoded_stores.csv')
    if not os.path.exists(path):
        path = os.path.join(os.path.dirname(__file__), 'geocoded_stores.csv')
    df = pd.read_csv(path)
    return df[['branch_name', 'latitude', 'longitude']].to_dict(orient='records')

@router.get("/shuffling/asms")
def shuffling_asms():
    try:
        asm_mapping_df = load_asm_mapping_shuffle()
        return sorted(asm_mapping_df["asm_name"].dropna().unique().tolist())
    except Exception as e:
        raise HTTPException(500, str(e))

@router.get("/shuffling/deficit-surplus")
def shuffling_deficit_surplus(asm_name: str, week_date: str):
    try:
        from main import DATA
        from closing_stock_loader import get_most_recent_sheet
        from datetime import datetime
        sheets = DATA.get("closing_stock_sheets", {})
        
        # Parse date — format is DD.MM.YYYY from old dashboard
        try:
            dt = datetime.strptime(week_date, "%d.%m.%Y").date()
        except:
            dt = datetime.fromisoformat(week_date).date()

        #_, closing_df = get_sheet_for_date(sheets, dt) if hasattr(__import__('closing_stock_loader'), 'get_sheet_for_date') else (None, get_most_recent_sheet(sheets, dt)[1])
        _, closing_df = get_most_recent_sheet(sheets, dt)

        asm_mapping_df = load_asm_mapping_shuffle()
        sales_df = load_clean_data()
        
        # Get branches for this ASM
        mask = asm_mapping_df["asm_name"].astype(str).str.strip().str.lower() == asm_name.strip().lower()
        branches = asm_mapping_df[mask]["branch"].tolist()
        
        if not branches or closing_df is None or closing_df.empty:
            return []

        qty_col = "Qty"
        im_code_col = "Model"

        results = []
        # Get all models for these branches
        branch_stock = closing_df[closing_df["branch"].isin(branches)]
        
        for _, row in branch_stock.iterrows():
            branch = row["branch"]
            im_code = str(row.get("im_code", ""))
            brand = str(row.get("brand", ""))
            itemmodel = str(row.get("item_model", ""))
            qty = float(row.get("quantity", 0))
            
            # Compute MSP (20-day avg sales)
            clean_itemmodel = itemmodel.rsplit("-", 1)[0].strip().lower()
            s_mask = (
                (sales_df["Branch"].str.lower() == branch.lower()) &
                (sales_df["Model"].astype(str).str.lower() ==  clean_itemmodel)
            )
            recent_sales = sales_df[s_mask]
            if not recent_sales.empty:
                avg_daily = float(recent_sales[qty_col].sum()) / 20
            else:
                avg_daily = 0.0
            msp = round(avg_daily * 20, 3)
            
            position = qty - msp
            deficit = max(0, -position)
            surplus = max(0, position)
            
            results.append({
                "branch": branch,
                "itemmodel": itemmodel,
                "im_code": im_code,
                "brand": brand,
                "qty": qty,
                "msp": round(msp, 3),
                "position": round(position, 3),
                "deficit": round(deficit, 3),
                "surplus": round(surplus, 3),
            })
        
        return results
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"deficit-surplus error: {e}")
        raise HTTPException(500, str(e))

@router.get("/shuffling/classifications")
def shuffling_classifications(week_date: str, asm_name: str = None):
    try:
        sales_df = load_clean_data()
        im_code_col = "im_code" if "im_code" in sales_df.columns else "I/M Code"
        qty_col = "Qty." if "Qty." in sales_df.columns else "Qty"
        
        if im_code_col not in sales_df.columns:
            return []

        # Aggregate total sales per model
        model_sales = (
            sales_df.groupby(im_code_col)[qty_col]
            .sum()
            .reset_index()
            .rename(columns={im_code_col: "im_code", qty_col: "total_qty"})
            .sort_values("total_qty", ascending=False)
        )
        
        total = model_sales["total_qty"].sum()
        if total == 0:
            return []
            
        model_sales["cumulative_pct"] = model_sales["total_qty"].cumsum() / total * 100
        
        # Get brand map
        brand_map = {}
        try:
            from pathlib import Path
            import pandas as pd
            bp = Path(__file__).parent / "data" / "Brand Item-Model MOP.xlsx"
            if not bp.exists():
                bp = Path(__file__).parent / "Brand Item-Model MOP.xlsx"
            bdf = pd.read_excel(bp)
            brand_map = dict(zip(bdf["Code"].astype(str).str.strip().str.lower(), bdf["Brand"].astype(str).str.strip()))
        except:
            pass

        results = []
        for _, row in model_sales.iterrows():
            cls = "XMC" if row["cumulative_pct"] <= 80 else "YMC"
            results.append({
                "itemmodel": str(row["im_code"]),
                "im_code": str(row["im_code"]),
                "brand": brand_map.get(str(row["im_code"]).lower(), ""),
                "total_qty": int(row["total_qty"]),
                "classification": cls,
            })
        
        return results
    except Exception as e:
        raise HTTPException(500, str(e))



# ── Prediction endpoints ───────────────────────────────────────────────────

@router.post("/predict")
def predict(req: PredictionRequest) -> dict:
    try:
        return run_prediction(
            branch=req.branch or None, brand=req.brand or None,
            model=req.model or None,   days=req.days,
            festival_multiplier=req.festival_multiplier,
            model_name=req.model_name,
            price_range=req.price_range or None,
        )
    except Exception as e:
        raise HTTPException(500, str(e))

@router.post("/compare")
def compare(req: CompareRequest) -> dict:
    try:
        return run_comparison(
            branch=req.branch or None, brand=req.brand or None,
            model=req.model or None,   days=req.days,
            festival_multiplier=req.festival_multiplier,
            price_range=req.price_range or None,
        )
    except Exception as e:
        raise HTTPException(500, str(e))

@router.post("/msp-accuracy")
def msp_accuracy(req: MspAccuracyRequest) -> dict:
    """
    Run 3 MSP models with walk-forward evaluation on Sep–Dec 2025 data.
    Returns per-day actual vs predicted + MAE/MAPE/RMSE per model.
    """
    try:
        return run_msp_accuracy(
            branch=req.branch or None, brand=req.brand or None,
            model=req.model or None,
            festival_multiplier=req.festival_multiplier,
            price_range=req.price_range or None,
        )
    except Exception as e:
        raise HTTPException(500, str(e))

@router.post("/curated-msp")
def curated_msp(req: MspAccuracyRequest) -> dict:
    try:
        return run_curated_msp_window(
            branch=req.branch or None,
            brand=req.brand or None,
            model=req.model or None,
            price_range=req.price_range or None,
            enable_dow=req.enable_dow,
            enable_festival=req.enable_festival,
            enable_price_affinity=req.enable_price_affinity,
            enable_brand_affinity=req.enable_brand_affinity,
            w1=req.w1,
            w2=req.w2,
            w3=req.w3
        )
    except Exception as e:
        raise HTTPException(500, str(e))

@router.get("/price-range-accuracy")
def price_range_accuracy(branch: str = None, brand: str = None):
    try:
        return get_accuracy_for_price_ranges(branch=branch, brand=brand)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/asm")
def asm_list():
    try:
        return get_asm_data()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Advanced Shuffle & OTB Endpoints ────────────────────────────────────────

from datetime import date
from shuffle_otb_service import build_full_asm_report
from closing_stock_loader import get_available_stock_dates, get_model_list_for_asm

class ShuffleRunRequest(BaseModel):
    asm_name: str
    brand: str
    im_code: str
    prediction_date: str
    w1: float = 0.5
    w2: float = 0.3
    w3: float = 0.2
    apply_brand_affinity: bool = False
    apply_price_affinity: bool = False
    apply_dow: bool = False
    apply_festival: bool = False

@router.get("/shuffle/asm-list")
def api_shuffle_asm_list() -> list[dict]:
    try:
        asm_mapping_df = load_asm_mapping_shuffle()
        if asm_mapping_df.empty:
            return []
            
        asms = []
        grouped = asm_mapping_df.groupby("asm_name")
        for asm_name, group in grouped:
            if str(asm_name).strip() in ["", "nan", "None"]:
                continue
            hub_name = str(group["hub_name"].iloc[0]) if "hub_name" in group.columns else ""
            branches = group["branch"].dropna().unique().tolist()
            asms.append({
                "asm_name": str(asm_name),
                "hub_name": hub_name,
                "branches": branches
            })
        return asms
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Error in /shuffle/asm-list: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/shuffle/stock-dates")
def api_shuffle_stock_dates() -> dict:
    try:
        from main import DATA
        sheets = DATA.get("closing_stock_sheets", {})
        dates = get_available_stock_dates(sheets)
        return {"dates": dates}
    except Exception as e:
        return {"dates": []}

@router.get("/shuffle/models")
def api_shuffle_models(asm_name: str, prediction_date: str) -> list[dict]:
    try:
        from main import DATA
        sheets = DATA.get("closing_stock_sheets", {})
        asm_mapping_df = load_asm_mapping_shuffle()
        mask = asm_mapping_df["asm_name"].astype(str).str.strip().str.lower() == asm_name.lower()
        branches = asm_mapping_df[mask]["branch"].tolist()
        dt = date.fromisoformat(prediction_date)

        # Get models from closing stock (has im_code)
        models = get_model_list_for_asm(sheets, branches, dt)
        existing_item_models = {m["item_model"].strip().lower() for m in models}

        # Load MOP file to get im_code for sales-only models
        from pathlib import Path
        import pandas as pd
        mop_path = Path(__file__).parent / "Brand Item-Model MOP.xlsx"
        mop_map = {}
        if mop_path.exists():
            mop_df = pd.read_excel(mop_path)
            if "Item/Model" in mop_df.columns and "Code" in mop_df.columns:
                for _, row in mop_df.iterrows():
                    key = str(row["Item/Model"]).strip().lower()
                    mop_map[key] = {
                        "im_code": str(row["Code"]).strip(),
                        "brand": str(row.get("Brand", "")).strip()
                    }

        # Load raw Excel to get I/M Code for branches
        from data_processing import _find_data_file, _normalise_columns
        raw_path = _find_data_file()
        raw_df = pd.read_excel(raw_path, header=2) if raw_path.suffix.lower() in (".xlsx", ".xls") else pd.read_csv(raw_path)
        raw_df = _normalise_columns(raw_df)
        raw_df["Branch"] = raw_df["Branch"].ffill()

        if "I/M Code" in raw_df.columns and "Item/Model" in raw_df.columns:
            branches_lower = [b.strip().lower() for b in branches]
            raw_mask = raw_df["Branch"].str.strip().str.lower().isin(branches_lower)
            raw_filtered = raw_df[raw_mask][["I/M Code", "Item/Model", "Brand"]].drop_duplicates()
            for _, row in raw_filtered.iterrows():
                item_model = str(row["Item/Model"]).strip()
                im_code = str(row["I/M Code"]).strip()
                brand = str(row.get("Brand", "")).strip()
                if item_model.lower() not in existing_item_models and im_code:
                    models.append({
                        "im_code": im_code,
                        "item_model": item_model,
                        "brand": brand
                    })
                    existing_item_models.add(item_model.lower())

        for m in models:
            m["display_label"] = f"{m['item_model']} — {m['brand']}"

        models.sort(key=lambda x: (x["brand"], x["item_model"]))
        return models
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Error in /shuffle/models: {e}")
        return []

@router.post("/shuffle/run")
def api_shuffle_run(req: ShuffleRunRequest) -> dict:
    try:
        from main import DATA
        sheets = DATA.get("closing_stock_sheets", {})
        sales_df = load_clean_data()
        asm_mapping_df = load_asm_mapping_shuffle()
        
        dt = date.fromisoformat(req.prediction_date)
        
        mask = asm_mapping_df["asm_name"].astype(str).str.strip().str.lower() == req.asm_name.lower()
        branches = asm_mapping_df[mask]["branch"].tolist()
        
        item_model = "Unknown Model"
        if req.im_code.strip().lower() != "all":
            models = get_model_list_for_asm(sheets, branches, dt)
            for m in models:
                if m["im_code"] == req.im_code:
                    item_model = m["item_model"]
                    break
                    
            report = build_full_asm_report(
                asm_name=req.asm_name,
                brand=req.brand,
                im_code=req.im_code,
                item_model=item_model,
                prediction_date=dt,
                sales_df=sales_df,
                closing_stock_sheets=sheets,
                asm_mapping_df=asm_mapping_df,
                distance_matrix={},
                msp_weights={"w1": req.w1, "w2": req.w2, "w3": req.w3},
                multiplier_flags={
                    "apply_brand_affinity": req.apply_brand_affinity,
                    "apply_price_affinity": req.apply_price_affinity,
                    "apply_dow": req.apply_dow,
                    "apply_festival": req.apply_festival
                }
            )
            # Tag transfers with item_model for frontend display
            for t in report["shuffle_result"]["transfers"]:
                t["item_model"] = item_model
                 # Apply Cross-ASM reduction
            try:
                from main import DATA
                from closing_stock_loader import get_most_recent_sheet
                from datetime import date as dt_date
                sheets = DATA.get("closing_stock_sheets", {})
                if sheets:
                    _, cs_df = get_most_recent_sheet(sheets, dt_date.today())
                    if cs_df is not None and not cs_df.empty:
                        cs_df.columns = [c.lower().strip() for c in cs_df.columns]
                        brand_cs = cs_df[cs_df["brand"].str.lower() == req.brand.lower()]
                        cross_opps = detect_cross_asm_xmc(
                            sales_df=load_clean_data(),
                            closing_stock_df=brand_cs,
                            asm_mapping_df=load_asm_mapping_shuffle(),
                            lookback_days=30
                        )
                        asm_branches = [p["branch"] for p in report["shuffle_result"]["post_shuffle_positions"]]
                        cross_reduction = {}
                        for opp in cross_opps:
                            if opp["xmc_branch"] in asm_branches:
                                br = opp["xmc_branch"]
                                cross_reduction[br] = cross_reduction.get(br, 0) + opp["recommended_transfer"]
                        for row in report["shuffle_result"]["post_shuffle_positions"]:
                            br = row["branch"]
                            cr = cross_reduction.get(br, 0)
                            row["cross_asm_in"] = cr
                            row["effective_otb"] = max(0, row["effective_otb"] - cr)
                            row["needs_purchase"] = row["effective_otb"] > 0
                        total_cross = sum(cross_reduction.values())
                        report["otb_summary"]["total_cross_asm_reduction"] = total_cross
                        report["otb_summary"]["total_effective_otb"] = max(0, report["otb_summary"]["total_effective_otb"] - total_cross)
                        report["otb_summary"]["po_to_manufacturer"] = report["otb_summary"]["total_effective_otb"]
            except Exception as cross_err:
                logger.warning(f"Cross-ASM reduction failed: {cross_err}")

            return report
        else:
            models = get_model_list_for_asm(sheets, branches, dt)
            brand_models = [m for m in models if m["brand"].strip().lower() == req.brand.strip().lower()]
            
            from shuffle_otb_service import aggregate_reports
            reports = []
            for m in brand_models:
                sub_report = build_full_asm_report(
                    asm_name=req.asm_name,
                    brand=req.brand,
                    im_code=m["im_code"],
                    item_model=m["item_model"],
                    prediction_date=dt,
                    sales_df=sales_df,
                    closing_stock_sheets=sheets,
                    asm_mapping_df=asm_mapping_df,
                    distance_matrix={},
                    msp_weights={"w1": req.w1, "w2": req.w2, "w3": req.w3},
                    multiplier_flags={
                        "apply_brand_affinity": req.apply_brand_affinity,
                        "apply_price_affinity": req.apply_price_affinity,
                        "apply_dow": req.apply_dow,
                        "apply_festival": req.apply_festival
                    }
                )
                for t in sub_report["shuffle_result"]["transfers"]:
                    t["item_model"] = m["item_model"]
                reports.append(sub_report)
                
            if not reports:
                return {} # Fallback
            return aggregate_reports(reports)
            
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Error in /shuffle/run: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/otb/run")
def api_otb_run(req: ShuffleRunRequest) -> dict:
    # Under the hood, it's the exact same engine
    try:
        from main import DATA
        from closing_stock_loader import get_most_recent_sheet
        from datetime import date

        res = api_shuffle_run(req)

        # Get Cross-ASM transfers to reduce effective OTB
        sheets = DATA.get("closing_stock_sheets", {})
        cross_asm_reduction = {}

        if sheets:
            _, closing_stock_df = get_most_recent_sheet(sheets, date.today())
            if closing_stock_df is not None and not closing_stock_df.empty:
                closing_stock_df.columns = [c.lower().strip() for c in closing_stock_df.columns]

                # Filter by brand
                brand_filtered = closing_stock_df[
                    closing_stock_df["brand"].str.lower() == req.brand.lower()
                ]

                cross_opps = detect_cross_asm_xmc(
                    sales_df=load_clean_data(),
                    closing_stock_df=brand_filtered,
                    asm_mapping_df=load_asm_mapping_shuffle(),
                    lookback_days=30
                )

                # Only keep cross-ASM transfers where xmc_branch is in this ASM
                asm_branches = [p["branch"] for p in res["shuffle_result"]["post_shuffle_positions"]]
                for opp in cross_opps:
                    if opp["xmc_branch"] in asm_branches:
                        br = opp["xmc_branch"]
                        cross_asm_reduction[br] = cross_asm_reduction.get(br, 0) + opp["recommended_transfer"]

        # Apply Cross-ASM reduction to post_shuffle_positions
        otb_table = res["shuffle_result"]["post_shuffle_positions"]
        for row in otb_table:
            br = row["branch"]
            cross_reduction = cross_asm_reduction.get(br, 0)
            if cross_reduction > 0:
                row["cross_asm_in"] = cross_reduction
                row["effective_otb"] = max(0, row["effective_otb"] - cross_reduction)
                row["needs_purchase"] = row["effective_otb"] > 0
            else:
                row["cross_asm_in"] = 0

        # Recalculate OTB summary
        total_cross_asm = sum(cross_asm_reduction.values())
        otb_summary = res["otb_summary"]
        otb_summary["total_cross_asm_reduction"] = total_cross_asm
        otb_summary["total_effective_otb"] = max(0, otb_summary["total_effective_otb"] - total_cross_asm)
        otb_summary["po_to_manufacturer"] = otb_summary["total_effective_otb"]

        return {
            "asm_name": res["asm_name"],
            "brand": res["brand"],
            "im_code": res["im_code"],
            "prediction_date": res["prediction_date"],
            "closing_stock_date_used": res["closing_stock_date_used"],
            "otb_table": otb_table,
            "otb_summary": otb_summary,
            "transfers": res["shuffle_result"]["transfers"],
            "cross_asm_opportunities": [
                o for o in cross_opps
                if o["xmc_branch"] in asm_branches
            ] if sheets else []
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Old Shuffle Endpoints ───────────────────────────────────────────────────────

class AsmShuffleRequest(BaseModel):
    requesting_branch: str
    im_code: str
    brand: str
    msp_predictions: dict

class HubShuffleRequest(BaseModel):
    im_code: str
    brand: str
    msp_predictions: dict

class PositionsRequest(BaseModel):
    branches: list[str]
    im_code: str
    brand: str
    msp_predictions: dict

@router.post("/shuffle/asm")
def api_shuffle_asm(req: AsmShuffleRequest) -> dict:
    try:
        sales_df = load_clean_data()
        closing_stock_df = load_closing_stock_shuffle()
        asm_mapping_df = load_asm_mapping_shuffle()
        return recommend_asm_shuffle(
            requesting_branch=req.requesting_branch,
            im_code=req.im_code,
            brand=req.brand,
            msp_predictions=req.msp_predictions,
            closing_stock_df=closing_stock_df,
            asm_mapping_df=asm_mapping_df,
            sales_df=sales_df
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/shuffle/hub")
def api_shuffle_hub(req: HubShuffleRequest) -> dict:
    try:
        sales_df = load_clean_data()
        closing_stock_df = load_closing_stock_shuffle()
        asm_mapping_df = load_asm_mapping_shuffle()
        recommendations = recommend_hub_shuffle(
            im_code=req.im_code,
            brand=req.brand,
            msp_predictions=req.msp_predictions,
            closing_stock_df=closing_stock_df,
            asm_mapping_df=asm_mapping_df,
            sales_df=sales_df
        )
        return {
            "recommendations": recommendations,
            "total_transfers": len(recommendations)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/lookalike/store-suggest")
async def api_store_suggest(req: Request):
    try:
        import pandas as pd
        from pathlib import Path
        from lookalike_service import find_store_lookalikes
        body = await req.json()
        new_lat = float(body.get("new_branch_lat", 0))
        new_lon = float(body.get("new_branch_lon", 0))
        top_n = int(body.get("top_n", 3))
        max_radius_km = float(body.get("max_radius_km", 200.0))

        csv_path = Path(__file__).parent / "geocoded_stores.csv"
        if not csv_path.exists():
            return []

        stores_df = pd.read_csv(csv_path)
        stores_df.columns = [c.strip().lower() for c in stores_df.columns]

        # Rename to expected columns
        if "branch_name" in stores_df.columns:
            stores_df = stores_df.rename(columns={"branch_name": "branch", "latitude": "lat", "longitude": "lon"})

        results = find_store_lookalikes(new_lat, new_lon, stores_df, top_n=top_n, max_radius_km=max_radius_km)
        print(f">>> store-suggest: lat={new_lat} lon={new_lon} radius={max_radius_km} results={len(results)} first={results[0] if results else 'EMPTY'}")
        return results

    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"store-suggest error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/shuffle/cross-asm-xmc")
def api_cross_asm_xmc(lookback_days: int = 30, brand: str = None, asm_name: str = None, im_code: str = None) -> dict:
    try:
        from main import DATA
        from closing_stock_loader import get_most_recent_sheet
        from datetime import date

        sales_df = load_clean_data()
        asm_mapping_df = load_asm_mapping_shuffle()
        sheets = DATA.get("closing_stock_sheets", {})

        if not sheets:
            return {"opportunities": [], "count": 0}

        _, closing_stock_df = get_most_recent_sheet(sheets, date.today())
        if closing_stock_df is None or closing_stock_df.empty:
            return {"opportunities": [], "count": 0}

        closing_stock_df.columns = [c.lower().strip() for c in closing_stock_df.columns]

        if brand:
            closing_stock_df = closing_stock_df[
                closing_stock_df["brand"].str.lower() == brand.lower()
            ]

        if im_code and im_code != "ALL":
            closing_stock_df = closing_stock_df[
                closing_stock_df["im_code"].str.lower() == im_code.lower()
            ]

        opportunities = detect_cross_asm_xmc(
            sales_df=sales_df,
            closing_stock_df=closing_stock_df,
            asm_mapping_df=asm_mapping_df,
            lookback_days=lookback_days
        )

        if asm_name:
            opportunities = [
                o for o in opportunities
                if o["ymc_asm"] == asm_name or o["xmc_asm"] == asm_name
            ]

        return {"opportunities": opportunities, "count": len(opportunities)}
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"cross-asm error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/shuffle/branch-summary")
def api_branch_shuffle_summary(branch: str, lookback_days: int = 30) -> dict:
    try:
        sales_df = load_clean_data()
        closing_stock_df = load_closing_stock_shuffle()
        asm_mapping_df = load_asm_mapping_shuffle()
        return get_branch_shuffle_summary(
            branch=branch,
            sales_df=sales_df,
            closing_stock_df=closing_stock_df,
            asm_mapping_df=asm_mapping_df,
            msp_predictions={}, # Note: to provide real msp_predictions, they should probably be fetched or computed
            lookback_days=lookback_days
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/shuffle/asm-map")
def api_shuffle_asm_map() -> dict:
    try:
        asm_mapping_df = load_asm_mapping_shuffle()
        if asm_mapping_df.empty:
            return {"asms": []}
            
        asms = []
        grouped = asm_mapping_df.groupby("asm_name")
        for asm_name, group in grouped:
            hub_name = str(group["hub_name"].iloc[0]) if "hub_name" in group.columns else ""
            branches = group["branch"].tolist()
            asms.append({
                "asm_name": str(asm_name),
                "hub_name": hub_name,
                "branches": branches
            })
        return {"asms": asms}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/shuffle/positions")
def api_shuffle_positions(req: PositionsRequest) -> dict:
    try:
        sales_df = load_clean_data()
        closing_stock_df = load_closing_stock_shuffle()
        positions = compute_store_positions(
            branches=req.branches,
            im_code=req.im_code,
            brand=req.brand,
            msp_predictions=req.msp_predictions,
            closing_stock_df=closing_stock_df,
            sales_df=sales_df,
            lookback_days=30
        )
        return {"positions": positions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── OTB Endpoints ──────────────────────────────────────────────────────────

class OtbModelInput(BaseModel):
    brand: str
    im_code: str
    item_model: str
    msp_20d: float

class OtbCalculateRequest(BaseModel):
    branch: str
    msp_by_model: list[OtbModelInput]

class StaggerScheduleRequest(BaseModel):
    total_units: int
    total_budget_crore: float
    stagger_days: int

@router.post("/otb/calculate")
def api_otb_calculate(req: OtbCalculateRequest) -> dict:
    try:
        closing_stock_df = load_closing_stock()
        asm_df = load_asm_mapping()
        
        msp_by_model = [m.model_dump() for m in req.msp_by_model]
        otb_table = build_otb_table(req.branch, msp_by_model, closing_stock_df, asm_df)
        
        summary = {
            "total_models": len(otb_table),
            "models_needing_po": sum(1 for r in otb_table if r["needs_purchase"]),
            "total_raw_otb": sum(r["raw_otb"] for r in otb_table),
            "total_shuffle_reduction": sum(r["shuffle_reduction"] for r in otb_table),
            "total_effective_otb": sum(r["effective_otb"] for r in otb_table),
        }
        
        return {
            "branch": req.branch,
            "otb_table": otb_table,
            "summary": summary
        }
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"OTB Calculate Error: {e}")
        return {"branch": req.branch, "otb_table": [], "summary": {
            "total_models": 0, "models_needing_po": 0, "total_raw_otb": 0, "total_shuffle_reduction": 0, "total_effective_otb": 0
        }}

@router.get("/otb/stock-snapshot")
def api_otb_stock_snapshot(branch: str) -> dict:
    try:
        closing_stock_df = load_closing_stock()
        if closing_stock_df.empty:
            return {"branch": branch, "items": []}
            
        branch_mask = closing_stock_df["branch"].str.lower() == branch.lower()
        branch_stock = closing_stock_df[branch_mask]
        
        items = []
        for _, row in branch_stock.iterrows():
            items.append({
                "im_code": str(row.get("im_code", "")),
                "brand": str(row.get("brand", "")),
                "item_model": str(row.get("item_model", "")),
                "quantity": float(row.get("quantity", 0))
            })
            
        return {"branch": branch, "items": items}
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"OTB Stock Snapshot Error: {e}")
        return {"branch": branch, "items": []}

@router.get("/otb/allocation-rank")
def api_otb_allocation_rank(brand: str, model_name: str = "") -> dict:
    try:
        sales_df = load_clean_data()
        closing_stock_df = load_closing_stock()
        
        # Candidate branches are all branches that have the brand/model in stock or sales
        candidate_branches = set()
        
        # From sales
        brand_sales_mask = (sales_df["Brand"].str.lower() == brand.lower())
        sales_mask = brand_sales_mask
        if model_name and "Model" in sales_df.columns:
            sales_mask = brand_sales_mask & (sales_df["Model"].str.lower() == model_name.lower())
        
        if not sales_df[sales_mask].empty:
            candidate_branches.update(sales_df[sales_mask]["Branch"].unique().tolist())
            
        # From stock
        if not closing_stock_df.empty:
            brand_stock_mask = (closing_stock_df["brand"].str.lower() == brand.lower())
            stock_mask = brand_stock_mask
            if model_name and "item_model" in closing_stock_df.columns:
                stock_mask = brand_stock_mask & (closing_stock_df["item_model"].str.lower() == model_name.lower())
            if not closing_stock_df[stock_mask].empty:
                candidate_branches.update(closing_stock_df[stock_mask]["branch"].unique().tolist())

        # Fallback to Brand level candidates if model has no history/stock
        if not candidate_branches and model_name:
            if not sales_df[brand_sales_mask].empty:
                candidate_branches.update(sales_df[brand_sales_mask]["Branch"].unique().tolist())
            if not closing_stock_df.empty and not closing_stock_df[brand_stock_mask].empty:
                candidate_branches.update(closing_stock_df[brand_stock_mask]["branch"].unique().tolist())
                
                
        ranked_stores = rank_stores_for_allocation(sales_df, model_name, brand, list(candidate_branches))
        return {
            "model_name": model_name,
            "brand": brand,
            "ranked_stores": ranked_stores
        }
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"OTB Allocation Rank Error: {e}")
        return {"model_name": model_name, "brand": brand, "ranked_stores": []}

@router.post("/otb/stagger-schedule")
def api_otb_stagger_schedule(req: StaggerScheduleRequest) -> dict:
    try:
        schedule = build_staggered_schedule(req.total_units, req.total_budget_crore, req.stagger_days)
        return {"schedule": schedule}
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"OTB Stagger Schedule Error: {e}")
        return {"schedule": []}

import os
import pandas as pd

@router.get("/store-coordinates")
def get_store_coordinates():
    try:
        csv_path = os.path.join(os.path.dirname(__file__), "geocoded_stores.csv")
        if not os.path.exists(csv_path):
            return {}
        df = pd.read_csv(csv_path)
        df = df.dropna(subset=['latitude', 'longitude', 'branch_name'])
        
        result = {}
        for _, row in df.iterrows():
            result[row['branch_name']] = {
                "lat": float(row['latitude']),
                "lng": float(row['longitude'])
            }
        return result
    except Exception as e:
        import logging
        logging.error(f"Error fetching store coordinates: {e}")
        return {}

# ── LOOKALIKE ENDPOINTS ────────────────────────────────────────────────────
from lookalike_service import (
    get_model_catalog, auto_suggest_lookalikes, find_store_lookalikes,
    compute_lookalike_msp_full, find_price_brand_lookalikes
)
from pydantic import BaseModel
from typing import List, Optional
from datetime import date

class LookalikeSuggestRequest(BaseModel):
    target_im_code: str
    target_brand: str
    target_mop: float
    top_n: int = 3
    scenario: str = "new_model"
    price_band_tolerance: float = 5000.0

class StoreSuggestRequest(BaseModel):
    new_branch_lat: float
    new_branch_lon: float
    top_n: int = 3
    max_radius_km: float = 15.0

class ComputeMspRequest(BaseModel):
    scenario: str
    target_branch: str
    target_im_code: str
    target_brand: str
    target_mop: float
    days_since_launch: int
    is_direct_successor: bool
    lookalike_im_codes: List[str]
    lookalike_weights: List[float]
    prediction_date: str
    hype_duration_days: int
    peak_multiplier: float
    w1: float
    w2: float
    w3: float
    apply_brand_affinity: bool
    apply_price_affinity: bool
    apply_dow: bool
    apply_festival: bool

@router.get("/lookalike/model-catalog")
def api_get_model_catalog():
    from main import DATA
    from data_processing import load_clean_data
    sales_df = load_clean_data()
    mop_path = os.path.join(os.path.dirname(__file__), "Brand Item-Model MOP.xlsx")
    mop_df = pd.read_excel(mop_path) if os.path.exists(mop_path) else pd.DataFrame()
    cat = get_model_catalog(sales_df, mop_df)
    return cat

@router.post("/lookalike/suggest")
def api_suggest_lookalikes(req: LookalikeSuggestRequest):
    from data_processing import load_clean_data
    sales_df = load_clean_data()
    mop_path = os.path.join(os.path.dirname(__file__), "Brand Item-Model MOP.xlsx")
    mop_df = pd.read_excel(mop_path) if os.path.exists(mop_path) else pd.DataFrame()
    cat = get_model_catalog(sales_df, mop_df)
    
    if req.scenario == "sparse_data":
        return find_price_brand_lookalikes(req.target_brand, req.target_mop, req.price_band_tolerance, sales_df, mop_df)
    
    return auto_suggest_lookalikes(req.target_im_code, req.target_brand, req.target_mop, cat, req.top_n)

@router.post("/lookalike/compute")
def api_compute_lookalike(req: ComputeMspRequest):
    from data_processing import load_clean_data
    sales_df = load_clean_data()
    mop_path = os.path.join(os.path.dirname(__file__), "Brand Item-Model MOP.xlsx")
    mop_df = pd.read_excel(mop_path) if os.path.exists(mop_path) else pd.DataFrame()
    
    pdate = date.fromisoformat(req.prediction_date)
    
    res = compute_lookalike_msp_full(
        scenario=req.scenario,
        target_branch=req.target_branch,
        target_im_code=req.target_im_code,
        target_brand=req.target_brand,
        target_mop=req.target_mop,
        days_since_launch=req.days_since_launch,
        is_direct_successor=req.is_direct_successor,
        lookalike_im_codes=req.lookalike_im_codes,
        lookalike_weights=req.lookalike_weights,
        prediction_date=pdate,
        sales_df=sales_df,
        mop_df=mop_df,
        hype_duration_days=req.hype_duration_days,
        peak_multiplier=req.peak_multiplier,
        w1=req.w1,
        w2=req.w2,
        w3=req.w3,
        apply_brand_affinity=req.apply_brand_affinity,
        apply_price_affinity=req.apply_price_affinity,
        apply_dow=req.apply_dow,
        apply_festival=req.apply_festival
    )
    return res

class SendToOtbRequest(BaseModel):
    lookalike_result: dict
    asm_name: str

@router.post("/lookalike/send-to-otb")
def api_send_to_otb(req: SendToOtbRequest):
    try:
        from main import DATA
        from datetime import date

        res = req.lookalike_result
        branch = res["target"]["branch"]
        brand = res["target"]["brand"]
        item_model = res["target"]["item_model"]
        im_code = res["target"].get("im_code", "")

        # ✅ Always load these unconditionally
        sheets = DATA.get("closing_stock_sheets", {})
        sales_df = load_clean_data()
        asm_mapping_df = load_asm_mapping_shuffle()

        # ✅ Get lookalike values first
        lookalike_used = res.get("lookalike_used", [])
        if lookalike_used:
            lookalike_im_code = lookalike_used[0].get("im_code", im_code)
            lookalike_item_model = lookalike_used[0].get("item_model", item_model)
            lookalike_brand = lookalike_used[0].get("brand", brand)
            print(f">>> lookalike_used[0] full: {lookalike_used[0]}")
            print(f">>> Using lookalike for OTB: im_code={lookalike_im_code}, item_model={lookalike_item_model}")
        else:
            lookalike_im_code = im_code
            lookalike_item_model = item_model
            lookalike_brand = brand

        # ✅ If target values are Unknown/empty, fall back to lookalike values
        if not brand or brand.strip().lower() in ("unknown", ""):
            brand = lookalike_brand

        if not im_code or im_code.strip().lower() in ("unknown", ""):
            im_code = lookalike_im_code

        if not item_model or item_model.strip().lower() in ("unknown", ""):
            item_model = lookalike_item_model

        asm_name = req.asm_name

        from closing_stock_loader import get_available_stock_dates
        dates = get_available_stock_dates(sheets)
        if dates:
            try:
                dt = date.fromisoformat(dates[-1])
            except Exception:
                dt = date.today()
        else:
            dt = date.today()


        report = build_full_asm_report(
            asm_name=asm_name,
            brand=brand,
            im_code=lookalike_im_code,        # ✅ lookalike's im_code (has stock + sales history)
            item_model=lookalike_item_model,  # ✅ lookalike's item_model (has sales history)
            prediction_date=dt,
            sales_df=sales_df,
            closing_stock_sheets=sheets,
            asm_mapping_df=asm_mapping_df,
            distance_matrix={},
            msp_weights={"w1": 0.5, "w2": 0.3, "w3": 0.2},
            multiplier_flags={
                "apply_brand_affinity": True,
                "apply_price_affinity": True,
                "apply_dow": True,
                "apply_festival": True
            }
        )

        # ✅ Stamp original new model info back for display purposes
        report["im_code"] = im_code
        report["item_model"] = item_model
        report["lookalike_im_code_used"] = lookalike_im_code
        report["lookalike_item_model_used"] = lookalike_item_model

        return report

    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"send-to-otb error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

