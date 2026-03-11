"""
from typing import Optional
prediction_service.py
----------------------
Orchestration layer. Three public functions:
    run_prediction()    → /predict
    run_comparison()    → /compare
    run_msp_accuracy()  → /msp-accuracy
"""

from __future__ import annotations

from datetime import date
import numpy as np
import pandas as pd

from data_processing import filter_data, get_historical_summary, build_daily_series
from statistical_model import (
    MSP_MODELS,
    model_msp_curated,
    model_median_dow, model_wma, model_sma,
    model_ets, model_holts, model_holt_winters,
    model_trimmed_mean, model_iqr, model_same_weekday,
    model_seasonal_naive, model_stl, model_ensemble,
    wma_affinity,
    run_all_models,
    walk_forward_predict, compute_error_metrics,
    learn_festival_multipliers,
)
from data_processing import get_segment_profile

_PREDICTION_START = date(2026, 1, 1)
_WD = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]

MODEL_MAP = {
    "msp_curated":    model_msp_curated,
    "median_dow":     model_median_dow,
    "wma":            model_wma,
    "sma":            model_sma,
    "ets":            model_ets,
    "holts":          model_holts,
    "holt_winters":   model_holt_winters,
    "trimmed_mean":   model_trimmed_mean,
    "iqr":            model_iqr,
    "same_weekday":   model_same_weekday,
    "seasonal_naive": model_seasonal_naive,
    "stl":            model_stl,
    "ensemble":       model_ensemble,
    "wma_affinity":   wma_affinity,
}


def _future_dates(days: int) -> list[date]:
    # Always start prediction from Jan 1, 2026 to ensure consistent indexing
    start = _PREDICTION_START
    return [start + pd.Timedelta(days=i) for i in range(days)]


def _prep(branch, brand, model, price_range):
    from data_processing import TRAIN_START, TRAIN_END
    df = filter_data(branch=branch, brand=brand, model=model, price_range=price_range)
    
    # Filter for training data
    train_df = df[(df["Date"] >= TRAIN_START) & (df["Date"] <= TRAIN_END)].copy()
    
    daily, dow_series = build_daily_series(train_df)
    historical = get_historical_summary(train_df)
    return train_df, daily, dow_series, historical


# ─────────────────────────────────────────────────────────────────────────────
# /predict — single model
# ─────────────────────────────────────────────────────────────────────────────

def run_prediction(branch, brand, model, days, festival_multiplier,
                   model_name: str = "median_dow", price_range: str = None) -> dict:
    _, daily, dow_series, historical = _prep(branch, brand, model, price_range)
    future_dates = _future_dates(days)
    
    is_sparse = float(daily.mean()) < 3.0 if not daily.empty else False
    learned_festival_mults = learn_festival_multipliers(daily)
    
    fn = MODEL_MAP.get(model_name, model_median_dow)
    if fn.__name__ == "wma_affinity":
        segment_profile = get_segment_profile(branch, brand, model)
        from statistical_model import _dow_mults
        fallback_mults = _dow_mults(daily, dow_series)
        result = fn(daily, fallback_mults, future_dates, festival_multiplier, segment_profile=segment_profile)
    elif fn.__name__ == "model_msp_curated":
        result = fn(daily, dow_series, future_dates, festival_multiplier, is_sparse=is_sparse, learned_festival_mults=learned_festival_mults, branch=branch, brand=brand, model_name=model)
    else:
        result = fn(daily, dow_series, future_dates, festival_multiplier, is_sparse=is_sparse, learned_festival_mults=learned_festival_mults)

    predicted_sales = []
    prediction_table = []
    mults = result.model_meta.get("dow_multipliers", {})

    for i, fd in enumerate(future_dates):
        dow = fd.weekday()
        qty = result.predicted_values[i]
        predicted_sales.append({
            "date": fd.isoformat(), "weekday_name": _WD[dow], "dow": dow,
            "dow_multiplier": mults.get(str(dow), 1.0),
            "festival_multiplier": festival_multiplier, "predicted_qty": qty,
        })
        prediction_table.append({
            "date": fd.isoformat(), "weekday": _WD[dow],
            "predicted_qty": qty, "dow_multiplier": mults.get(str(dow), 1.0),
        })

    # Fetch actual sales from Jan 1 onwards if available
    from data_processing import filter_actual_data, get_historical_summary
    df_actual = filter_actual_data(branch, brand, model, price_range)
    actual_future_sales = get_historical_summary(df_actual)

    # Sanitize payload to replace NaN/Infinity with 0 or null
    import math
    def clean(obj):
        if isinstance(obj, float):
            if math.isnan(obj) or math.isinf(obj):
                return 0.0
            return obj
        if isinstance(obj, list):
            return [clean(x) for x in obj]
        if isinstance(obj, dict):
            return {k: clean(v) for k, v in obj.items()}
        return obj

    return clean({
        "historical_sales": historical,
        "actual_future_sales": actual_future_sales,
        "predicted_sales":  predicted_sales,
        "prediction_table": prediction_table,
        "model_stats": {
            "baseline": result.baseline,
            "overall_avg": result.baseline,
            "dow_multipliers": mults,
            "model_name":  result.name,
            "model_label": result.label,
        },
    })


# ─────────────────────────────────────────────────────────────────────────────
# /compare — all 12 models
# ─────────────────────────────────────────────────────────────────────────────

def run_comparison(branch, brand, model, days, festival_multiplier, price_range: str = None) -> dict:
    _, daily, dow_series, historical = _prep(branch, brand, model, price_range)
    future_dates = _future_dates(days)
    
    is_sparse = float(daily.mean()) < 3.0 if not daily.empty else False
    learned_festival_mults = learn_festival_multipliers(daily)
    
    all_results  = run_all_models(daily, dow_series, future_dates, festival_multiplier, is_sparse=is_sparse, learned_festival_mults=learned_festival_mults, branch=branch, brand=brand, model_name=model)

    models_payload, summary = [], []
    for r in all_results:
        vals  = r.predicted_values
        total = round(sum(vals), 2)
        avg   = round(sum(vals)/len(vals), 4) if vals else 0
        models_payload.append({
            "name": r.name, "label": r.label, "description": r.formula_description,
            "baseline": r.baseline, "total_predicted": total,
            "daily_predictions": vals, "model_meta": r.model_meta,
        })
        summary.append({
            "model": r.label, "name": r.name, "baseline": r.baseline,
            "total": total, "avg_per_day": avg,
            "min_day": round(min(vals),4) if vals else 0,
            "max_day": round(max(vals),4) if vals else 0,
            "spread":  round(max(vals)-min(vals),4) if vals else 0,
        })

    # Fetch actual sales from Jan 1 onwards if available
    from data_processing import filter_actual_data, get_historical_summary
    df_actual = filter_actual_data(branch, brand, model, price_range)
    actual_future_sales = get_historical_summary(df_actual)

    # Calculate total actual sales
    total_actual = sum([item['qty'] for item in actual_future_sales])

    # Calculate error for each model and sort
    for item in summary:
        item['total_actual'] = total_actual
        item['diff'] = abs(item['total'] - total_actual)
        
    # Sort by diff (ascending) - closest to actual first
    summary.sort(key=lambda x: x['diff'])

    # Sanitize payload to replace NaN/Infinity with 0 or null
    import math
    def clean(obj):
        if isinstance(obj, float):
            if math.isnan(obj) or math.isinf(obj):
                return 0.0
            return obj
        if isinstance(obj, list):
            return [clean(x) for x in obj]
        if isinstance(obj, dict):
            return {k: clean(v) for k, v in obj.items()}
        return obj

    return clean({
        "historical_sales": historical,
        "actual_future_sales": actual_future_sales,
        "future_dates": [fd.isoformat() for fd in future_dates],
        "models": models_payload,
        "summary_table": summary,
    })


# ─────────────────────────────────────────────────────────────────────────────
# /msp-accuracy — three MSP models, walk-forward error
# ─────────────────────────────────────────────────────────────────────────────

def run_msp_accuracy(branch, brand, model, festival_multiplier, price_range: str = None) -> dict:
    """
    For each of the 3 MSP models:
      1. Walk-forward predict across the full training window (Sep–Dec 2025)
      2. Compare predictions vs actual daily sales
      3. Return per-day series + aggregate error metrics (MAE, MAPE, RMSE)
    """
    _, daily, dow_series, historical = _prep(branch, brand, model, price_range)
    
    is_sparse = float(daily.mean()) < 3.0 if not daily.empty else False
    learned_festival_mults = learn_festival_multipliers(daily)

    # Dummy future_dates (single day) just to get model metadata
    dummy_date = [_PREDICTION_START]

    msp_results = []
    for fn in MSP_MODELS:
        kwargs = {"is_sparse": is_sparse, "learned_festival_mults": learned_festival_mults}
        if fn.__name__ == "model_msp_curated":
            kwargs["branch"] = branch
            kwargs["brand"] = brand
            kwargs["model_name"] = model
            
        # Get model metadata (label, formula) via a quick single-day call
        meta = fn(daily, dow_series, dummy_date, festival_multiplier, **kwargs)

        # Walk-forward predictions aligned to training dates
        def wrapped_fn(d, ds, fd, fm, is_sparse=False, learned_festival_mults=None):
            return fn(d, ds, fd, fm, **kwargs)
            
        wf_pred = walk_forward_predict(daily, dow_series, wrapped_fn, festival_multiplier, is_sparse=is_sparse, learned_festival_mults=learned_festival_mults)

        # Align with actual
        aligned = pd.DataFrame({"actual": daily, "pred": wf_pred}).dropna()
        errors  = compute_error_metrics(aligned["actual"], aligned["pred"])

        # Per-day series for the chart
        per_day = []
        for dt in sorted(daily.index):
            ts = pd.Timestamp(dt)
            per_day.append({
                "date":          ts.strftime("%Y-%m-%d"),
                "actual_qty":    int(daily[dt]),
                "predicted_qty": round(float(wf_pred.get(dt, np.nan)), 2)
                                  if not np.isnan(wf_pred.get(dt, np.nan)) else None,
            })

        msp_results.append({
            "name":                meta.name,
            "label":               meta.label,
            "formula_description": meta.formula_description,
            "baseline":            meta.baseline,
            "per_day":             per_day,
            "error_metrics":       errors,
        })

    # Also return plain actual series for the combined chart
    actual_sales = [
        {"date": pd.Timestamp(dt).strftime("%Y-%m-%d"), "qty": int(v)}
        for dt, v in sorted(daily.items())
    ]

    return {
        "actual_sales": actual_sales,
        "models":       msp_results,
    }
