from typing import Optional
"""
api_routes.py — all FastAPI endpoints
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from data_processing import get_branches, get_brands, get_models, get_price_ranges
from prediction_service import run_prediction, run_comparison, run_msp_accuracy
from curated_msp import run_curated_msp_window
from brand_affinity import compute_brand_affinity
from model_affinity import compute_model_affinity
from price_affinity import compute_price_affinity
from festival_calendar import festival_calendar_dict
from price_range_accuracy import get_accuracy_for_price_ranges

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
