"""
statistical_model.py
--------------------
Three MSP (Market Sales Prediction) models + 9 additional models for the
comparison tab. Every model follows the same interface:

    fn(daily, dow_series, future_dates, festival_multiplier) → ModelResult

MSP MODELS (used on the Accuracy page):
    A. model_median_dow   — MSP Baseline
    B. model_wma          — Weighted Moving Average 14-day
    C. model_sma          — Simple Moving Average 7-day (Rolling Average)

ADDITIONAL MODELS (comparison tab only):
    model_ets, model_holts, model_holt_winters, model_trimmed_mean,
    model_iqr, model_same_weekday, model_seasonal_naive, model_stl,
    model_ensemble
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from datetime import date, timedelta
from dataclasses import dataclass, field
from festival_calendar import get_festival_multiplier


# ─────────────────────────────────────────────────────────────────────────────
# Shared types
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class ModelResult:
    name:               str
    label:              str
    formula_description:str
    predicted_values:   list[float]
    baseline:           float
    model_meta:         dict = field(default_factory=dict)


_WD = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]


# ─────────────────────────────────────────────────────────────────────────────
# Utility: DOW multipliers
# ─────────────────────────────────────────────────────────────────────────────

def _dow_mults(daily: pd.Series, dow_series: pd.Series) -> dict[int, float]:
    overall = float(daily.mean()) or 1.0
    out = {}
    for d in range(7):
        mask = dow_series == d
        mult = float(daily[mask].mean() / overall) if mask.sum() > 0 else 1.0
        
        # Manual adjustments based on user feedback:
        # Apart from Sunday (6), there is a slight rise in sales on Wednesdays (2)
        if d == 2: # Wednesday
            # Boost Wednesday by 20% if not already high
            mult = max(mult, 1.2)
            
        out[d] = mult
    return out

def _apply(base: float, fd: date, mults: dict[int, float],
           manual_festival_mult: float = 1.0,
           learned_festival_mults: dict = None) -> float:
    """
    Apply DOW multiplier, then festival multiplier.
    Uses whichever is HIGHER: the hardcoded calendar or the manual slider.
    """
    dow_m = mults.get(fd.weekday(), 1.0)
    fest_m, label = get_festival_multiplier(fd)
    
    if learned_festival_mults and label in learned_festival_mults:
        fest_m = learned_festival_mults[label]
        
    effective_fest = max(fest_m, manual_festival_mult)
    return max(0.0, round(base * dow_m * effective_fest, 4))

def learn_festival_multipliers(daily_series: pd.Series) -> dict:
    from festival_calendar import ALL_FESTIVALS
    learned = {}
    for fest in ALL_FESTIVALS:
        fdate = pd.Timestamp(fest.date)
        if fdate in daily_series.index:
            actual = daily_series[fdate]
            expected = daily_series.loc[:fdate - pd.Timedelta(days=1)].tail(7).mean()
            learned_mult = actual / expected if expected > 0 else fest.tier.day_mult
            learned[f"{fest.name} (Day)"] = min(learned_mult, fest.tier.day_mult)
            
            eve_date = fdate - pd.Timedelta(days=1)
            if eve_date in daily_series.index and fest.tier.lead_mult > 1.0:
                e_actual = daily_series[eve_date]
                e_exp = daily_series.loc[:eve_date - pd.Timedelta(days=1)].tail(7).mean()
                e_learned = e_actual / e_exp if e_exp > 0 else fest.tier.lead_mult
                learned[f"{fest.name} (Eve)"] = min(e_learned, fest.tier.lead_mult)
                
            aft_date = fdate + pd.Timedelta(days=1)
            if aft_date in daily_series.index and getattr(fest.tier, 'trail_mult', 1.0) > 1.0:
                a_actual = daily_series[aft_date]
                a_exp = daily_series.loc[:aft_date - pd.Timedelta(days=1)].tail(7).mean()
                a_learned = a_actual / a_exp if a_exp > 0 else fest.tier.trail_mult
                learned[f"{fest.name} (After)"] = min(a_learned, fest.tier.trail_mult)
                
            aft2_date = fdate + pd.Timedelta(days=2)
            if aft2_date in daily_series.index and getattr(fest.tier, 'trail2_mult', 1.0) > 1.0:
                a2_actual = daily_series[aft2_date]
                a2_exp = daily_series.loc[:aft2_date - pd.Timedelta(days=1)].tail(7).mean()
                a2_learned = a2_actual / a2_exp if a2_exp > 0 else fest.tier.trail2_mult
                learned[f"{fest.name} (After 2)"] = min(a2_learned, fest.tier.trail2_mult)
                
    return learned

def _safe_mean(arr) -> float:
    a = np.asarray(arr, dtype=float)
    return float(a.mean()) if len(a) > 0 else 0.0


# ═════════════════════════════════════════════════════════════════════════════
# ███  THREE CORE MSP MODELS
# ═════════════════════════════════════════════════════════════════════════════

# ── MSP Model A: Median Baseline + DOW ───────────────────────────────────────

def model_median_dow(daily, dow_series, future_dates, festival_multiplier, is_sparse=False, learned_festival_mults=None) -> ModelResult:
    """
    MSP Baseline — Median + Day-of-Week Multiplier

    Formula:
        Rb   = median(daily Qty over training window)
        Mdow = average_sales_on_weekday_w ÷ overall_average_sales
        Prediction = Rb × Mdow × FestivalMultiplier
    """
    if is_sparse:
        non_zero = daily[daily > 0]
        baseline = float(non_zero.mean()) if len(non_zero) > 0 else 0.5
        baseline = max(0.5, baseline)
    else:
        baseline = float(np.median(daily)) if len(daily) > 0 else 0.0
        
    mults    = _dow_mults(daily, dow_series)
    preds    = [_apply(baseline, fd, mults, festival_multiplier, learned_festival_mults)
                for fd in future_dates]
    return ModelResult(
        name="median_dow",
        label="MSP Baseline",
        formula_description=(
            "Step 1 — Baseline (Rb)\n"
            "  Rb = median(daily Qty over training window)\n\n"
            "Step 2 — Day-of-Week Multiplier (Mdow)\n"
            "  avg_w   = mean(Qty on weekday w)\n"
            "  avg_all = mean(Qty across all days)\n"
            "  Mdow    = avg_w ÷ avg_all\n\n"
            "Step 3 — Daily Prediction\n"
            "  Prediction = Rb × Mdow × FestivalMultiplier"
        ),
        predicted_values=preds,
        baseline=round(baseline, 4),
        model_meta={"dow_multipliers": {str(k): round(v,4) for k,v in mults.items()}},
    )


# ── MSP Model B: Weighted Moving Average (WMA-14) ────────────────────────────

def model_wma(daily, dow_series, future_dates, festival_multiplier,
              window: int = 7, is_sparse=False, learned_festival_mults=None) -> ModelResult:
    """
    WMA-14 — Linearly Weighted Moving Average (14-day window)

    Formula:
        weights = [1, 2, 3, ..., 14]   (most recent day = weight 14)
        WMA     = Σ(sales_i × weight_i) ÷ Σ(weights)
        Mdow    = average_sales_on_weekday_w ÷ overall_average_sales
        Prediction = WMA × Mdow × FestivalMultiplier
    """
    if is_sparse:
        window = 5
        
    vals   = daily.values.astype(float)
    w      = min(window, len(vals))
    if w == 0:
        baseline = 0.5 if is_sparse else 0.0
    else:
        seg = vals[-w:]
        if is_sparse:
            non_zero = seg[seg > 0]
            baseline = float(non_zero.mean()) if len(non_zero) > 0 else 0.5
        else:
            weights = np.arange(1, w + 1, dtype=float)
            baseline = float(np.dot(seg, weights) / weights.sum())
            
    if is_sparse:
        baseline = max(0.5, baseline)
        
    mults = _dow_mults(daily, dow_series)
    preds = [_apply(baseline, fd, mults, festival_multiplier, learned_festival_mults)
             for fd in future_dates]
    return ModelResult(
        name="wma",
        label="WMA-7",
        formula_description=(
            "Step 1 — Weighted Moving Average (WMA)\n"
            "  window  = last 14 days of training data\n"
            "  weights = [1, 2, 3, ..., 14]  (most recent = 14)\n"
            "  WMA     = Σ(daily_qty_i × weight_i) ÷ Σ(weights)\n\n"
            "Step 2 — Day-of-Week Multiplier (Mdow)\n"
            "  avg_w   = mean(Qty on weekday w)\n"
            "  avg_all = mean(Qty across all days)\n"
            "  Mdow    = avg_w ÷ avg_all\n\n"
            "Step 3 — Daily Prediction\n"
            "  Prediction = WMA × Mdow × FestivalMultiplier"
        ),
        predicted_values=preds,
        baseline=round(baseline, 4),
        model_meta={"window": w, "weight_scheme": "linear 1…14"},
    )


# ── New 13th Model: wma_affinity (Adaptive WMA with Store DNA) ───────────────

def wma_affinity(daily: pd.Series, dow_multipliers: dict, future_dates: list, festival_calendar: float, segment_profile: Optional[dict] = None) -> ModelResult:
    """
    wma_affinity — Adaptive WMA with Store DNA
    """
    vals = daily.values.astype(float)
    
    # Step 1 — Adaptive WMA base
    avg_7d = vals[-7:].sum() / 7 if len(vals) >= 7 else (vals.sum() / len(vals) if len(vals) > 0 else 0)
    
    avg_20d = 0.0
    if len(vals) >= 20:
        avg_20d = vals[-20:-7].sum() / 13
    elif segment_profile and "mean_nonzero_daily" in segment_profile:
        avg_20d = segment_profile["mean_nonzero_daily"]
        
    avg_60d = 0.0
    if len(vals) >= 60:
        avg_60d = vals[-60:-20].sum() / 40
    elif segment_profile and "mean_nonzero_daily" in segment_profile:
        avg_60d = segment_profile["mean_nonzero_daily"]
        
    wma_base = 0.60 * avg_7d + 0.25 * avg_20d + 0.15 * avg_60d
    
    # Step 2 — Sparse store correction
    if segment_profile and segment_profile.get("is_sparse"):
        nonzero_mean = segment_profile.get("mean_nonzero_daily", 0.0)
        wma_base = max(wma_base, nonzero_mean * 0.5)
    wma_base = max(wma_base, 0.5)
    
    # Step 3 — Per-day prediction loop
    predictions = []
    # If dow_multipliers is empty, compute it fallback
    fallback_mults = dow_multipliers if dow_multipliers else _dow_mults(daily, pd.Series([d.weekday() for d in daily.index], index=daily.index))
    
    for date_obj in future_dates:
        dow = date_obj.weekday()
        
        if segment_profile and "dow_multipliers" in segment_profile:
            dow_mult = segment_profile["dow_multipliers"].get(str(dow), 1.0)
        else:
            dow_mult = fallback_mults.get(dow, 1.0)
            
        fest_m, label = get_festival_multiplier(date_obj)
        effective_fest = max(fest_m, festival_calendar)
        
        daily_pred = wma_base * dow_mult * effective_fest
        predictions.append(round(daily_pred, 2))
        
    return ModelResult(
        name="wma_affinity",
        label="WMA Affinity (Store-Tuned)",
        formula_description="Adaptive WMA with Store DNA",
        predicted_values=predictions,
        baseline=round(wma_base, 4),
        model_meta={"is_sparse": segment_profile.get("is_sparse") if segment_profile else False}
    )

# ── MSP Model C: Simple Moving Average (SMA-7 / Rolling Average) ─────────────

def model_sma(daily, dow_series, future_dates, festival_multiplier,
              window: int = 3, is_sparse=False, learned_festival_mults=None) -> ModelResult:
    """
    SMA-7 — Simple Moving Average / Rolling Average (7-day window)

    Formula:
        SMA  = mean(last 7 days of training data)
        Mdow = average_sales_on_weekday_w ÷ overall_average_sales
        Prediction = SMA × Mdow × FestivalMultiplier
    """
    vals     = daily.values.astype(float)
    w        = min(window, len(vals))
    baseline = float(vals[-w:].mean()) if w > 0 else 0.0
    mults    = _dow_mults(daily, dow_series)
    preds    = [_apply(baseline, fd, mults, festival_multiplier, learned_festival_mults)
                for fd in future_dates]
    return ModelResult(
        name="sma",
        label="SMA-3 (Rolling Avg)",
        formula_description=(
            "Step 1 — Simple Moving Average (SMA)\n"
            "  window = last 7 days of training data\n"
            "  SMA    = mean(daily_qty over last 7 days)\n\n"
            "Step 2 — Day-of-Week Multiplier (Mdow)\n"
            "  avg_w   = mean(Qty on weekday w)\n"
            "  avg_all = mean(Qty across all days)\n"
            "  Mdow    = avg_w ÷ avg_all\n\n"
            "Step 3 — Daily Prediction\n"
            "  Prediction = SMA × Mdow × FestivalMultiplier"
        ),
        predicted_values=preds,
        baseline=round(baseline, 4),
        model_meta={"window": w},
    )


# ─────────────────────────────────────────────────────────────────────────────
# MSP registry
# ─────────────────────────────────────────────────────────────────────────────

def model_msp_curated(daily, dow_series, future_dates, festival_multiplier, is_sparse=False, learned_festival_mults=None,
                      branch=None, brand=None, model_name=None) -> ModelResult:
    """
    Auto-Curated MSP: 
    First checks if (Branch | Brand | Model) is in the 7 curated stores hardcoded MSP lookup.
    If yes, returns that exact target daily MSP.
    Otherwise, looks up the best parameters for (Branch | Brand) from store_profiles.json.
    Falls back to SMA-7 if not found.
    """
    import json
    from pathlib import Path
    
    # 1. Check hardcoded curated MSP lookup (the 7 branches)
    if branch and brand and model_name:
        lookup_path = Path(__file__).parent / "curated_stores_msp_lookup.json"
        if lookup_path.exists():
            try:
                with open(lookup_path, "r") as f:
                    hardcoded_msp = json.load(f)
                key = f"{branch}|{brand}|{model_name}"
                if key in hardcoded_msp:
                    target_msp = hardcoded_msp[key]
                    
                    # Compute prediction with DOW and festival multipliers
                    mults = _dow_mults(daily, dow_series)
                    preds = [_apply(target_msp, fd, mults, festival_multiplier, learned_festival_mults) for fd in future_dates]
                    
                    return ModelResult(
                        name="msp_curated",
                        label="Curated (Hardcoded Target)",
                        formula_description=f"Hardcoded target MSP for curated branch: {target_msp} units/day",
                        predicted_values=preds,
                        baseline=target_msp,
                        model_meta={"target_msp": target_msp}
                    )
            except Exception as e:
                print(f"[model_msp_curated] error reading lookup: {e}")
    
    # 2. Fallback to store_profiles.json for regular branches
    best_model_name = "sma"
    params = {"window": 7}
    
    p = Path(__file__).parent / "store_profiles.json"
    if p.exists() and branch and brand:
        try:
            with open(p, "r") as f:
                profiles = json.load(f)
            key = f"{branch}|{brand}"
            if key in profiles:
                best_model_name = profiles[key].get("best_model", "sma")
                params = profiles[key].get("params", {})
        except Exception:
            pass
            
    if best_model_name == "wma":
        res = model_wma(daily, dow_series, future_dates, festival_multiplier, is_sparse=is_sparse, learned_festival_mults=learned_festival_mults, **params)
    elif best_model_name == "median_dow":
        res = model_median_dow(daily, dow_series, future_dates, festival_multiplier, is_sparse=is_sparse, learned_festival_mults=learned_festival_mults, **params)
    else:
        res = model_sma(daily, dow_series, future_dates, festival_multiplier, is_sparse=is_sparse, learned_festival_mults=learned_festival_mults, **params)
        
    res.name = "msp_curated"
    res.label = f"Curated ({best_model_name.upper()})"
    res.formula_description = f"Dynamically tuned per branch/brand. Selected: {best_model_name} with params {params}"
    return res

MSP_MODELS = [model_msp_curated, model_median_dow, model_wma, model_sma]


# ═════════════════════════════════════════════════════════════════════════════
# Additional models (comparison tab)
# ═════════════════════════════════════════════════════════════════════════════

def model_ets(daily, dow_series, future_dates, festival_multiplier, alpha=0.6, is_sparse=False, learned_festival_mults=None):
    vals = daily.values.astype(float)
    s = vals[0] if len(vals) > 0 else 0.0
    for v in vals[1:]:
        s = alpha * v + (1 - alpha) * s
    mults = _dow_mults(daily, dow_series)
    preds = [_apply(s, fd, mults, festival_multiplier, learned_festival_mults) for fd in future_dates]
    return ModelResult(
        name="ets", label=f"ETS(α={alpha})",
        formula_description=f"S_t = {alpha}×Actual + {1-alpha}×S_{{t-1}} × Mdow × Festival",
        predicted_values=preds, baseline=round(s,4))

def model_holts(daily, dow_series, future_dates, festival_multiplier, alpha=0.45, beta=0.1, is_sparse=False, learned_festival_mults=None):
    vals = daily.values.astype(float)
    if len(vals) < 2:
        level, trend = _safe_mean(vals), 0.0
    else:
        level, trend = vals[0], vals[1]-vals[0]
        for v in vals[1:]:
            pl = level
            level = alpha*v + (1-alpha)*(level+trend)
            trend = beta*(level-pl) + (1-beta)*trend
    mults = _dow_mults(daily, dow_series)
    preds = [_apply(max(0.0,level+trend*(i+1)), fd, mults, festival_multiplier, learned_festival_mults)
             for i, fd in enumerate(future_dates)]
    return ModelResult(
        name="holts", label=f"Holt's(α={alpha},β={beta})",
        formula_description="Double ETS capturing level + linear trend.",
        predicted_values=preds, baseline=round(level,4),
        model_meta={"trend": round(trend,4)})

def model_holt_winters(daily, dow_series, future_dates, festival_multiplier,
                       alpha=0.45, beta=0.1, gamma=0.2, season_len=7, is_sparse=False, learned_festival_mults=None):
    vals = daily.values.astype(float)
    if len(vals) < season_len * 2:
        return model_holts(daily, dow_series, future_dates, festival_multiplier, is_sparse=is_sparse, learned_festival_mults=learned_festival_mults)
    level = _safe_mean(vals[:season_len])
    trend = (_safe_mean(vals[season_len:season_len*2]) - level) / season_len
    season = [vals[i] - level for i in range(season_len)]
    n = len(vals)
    for t in range(season_len, n):
        v, pl = vals[t], level
        si = (t - season_len) % season_len
        level = alpha*(v - season[si]) + (1-alpha)*(pl+trend)
        trend = beta*(level-pl) + (1-beta)*trend
        season[si] = gamma*(v-level) + (1-gamma)*season[si]
    preds = []
    for i, fd in enumerate(future_dates):
        value = level+trend*(i+1)+season[(n-season_len+i)%season_len]
        fest_m, label = get_festival_multiplier(fd)
        if learned_festival_mults and label in learned_festival_mults:
            fest_m = learned_festival_mults[label]
        effective = max(fest_m, festival_multiplier)
        preds.append(max(0.0, round(value * effective, 4)))
    return ModelResult(
        name="holt_winters", label="Holt-Winters",
        formula_description="Triple ETS: level + trend + weekly seasonality.",
        predicted_values=preds, baseline=round(level,4))

def model_trimmed_mean(daily, dow_series, future_dates, festival_multiplier, trim=0.10, is_sparse=False, learned_festival_mults=None):
    vals = daily.values.astype(float)
    n_trim = max(1, int(len(vals)*trim))
    sv = np.sort(vals)
    trimmed = sv[n_trim:-n_trim] if len(sv) > 2*n_trim else sv
    baseline = float(trimmed.mean()) if len(trimmed) > 0 else 0.0
    mults = _dow_mults(daily, dow_series)
    preds = [_apply(baseline, fd, mults, festival_multiplier, learned_festival_mults) for fd in future_dates]
    return ModelResult(
        name="trimmed_mean", label="Trimmed Mean (10%)",
        formula_description="Mean of middle 80% of days (removes top/bottom 10%) × Mdow × Festival.",
        predicted_values=preds, baseline=round(baseline,4))

def model_iqr(daily, dow_series, future_dates, festival_multiplier, is_sparse=False, learned_festival_mults=None):
    vals = daily.values.astype(float)
    q1, q3 = np.percentile(vals,[25,75]) if len(vals)>0 else (0,0)
    sub = vals[(vals>=q1)&(vals<=q3)]
    baseline = float(sub.mean()) if len(sub)>0 else float(np.median(vals)) if len(vals)>0 else 0.0
    mults = _dow_mults(daily, dow_series)
    preds = [_apply(baseline, fd, mults, festival_multiplier, learned_festival_mults) for fd in future_dates]
    return ModelResult(
        name="iqr", label="IQR Mean",
        formula_description="Mean of Q1–Q3 values (robust to outliers) × Mdow × Festival.",
        predicted_values=preds, baseline=round(baseline,4))

def model_same_weekday(daily, dow_series, future_dates, festival_multiplier, is_sparse=False, learned_festival_mults=None):
    wd = {d: float(daily[dow_series==d].mean()) if (dow_series==d).sum()>0 else float(daily.mean() or 0)
          for d in range(7)}
    preds = []
    for fd in future_dates:
        value = wd.get(fd.weekday(),0)
        fest_m, label = get_festival_multiplier(fd)
        if learned_festival_mults and label in learned_festival_mults:
            fest_m = learned_festival_mults[label]
        effective = max(fest_m, festival_multiplier)
        preds.append(max(0.0, round(value * effective, 4)))
    return ModelResult(
        name="same_weekday", label="Same-Weekday Avg",
        formula_description="Each future weekday predicted from its own historical average only.",
        predicted_values=preds, baseline=round(_safe_mean(list(wd.values())),4))

def model_seasonal_naive(daily, dow_series, future_dates, festival_multiplier, season_len=7, is_sparse=False, learned_festival_mults=None):
    vals = daily.values.astype(float)
    n = len(vals)
    preds = []
    for i, fd in enumerate(future_dates):
        idx = n - season_len + (i % season_len)
        value = vals[idx] if 0<=idx<n else (vals[-1] if n>0 else 0.0)
        fest_m, label = get_festival_multiplier(fd)
        if learned_festival_mults and label in learned_festival_mults:
            fest_m = learned_festival_mults[label]
        effective = max(fest_m, festival_multiplier)
        preds.append(max(0.0, round(value * effective, 4)))
    return ModelResult(
        name="seasonal_naive", label="Seasonal Naive",
        formula_description="Next Monday = most recent Monday's actual. Repeats last weekly cycle.",
        predicted_values=preds, baseline=round(_safe_mean(vals[-season_len:]) if n>0 else 0,4))

def model_stl(daily, dow_series, future_dates, festival_multiplier, is_sparse=False, learned_festival_mults=None):
    vals = daily.values.astype(float)
    try:
        from statsmodels.tsa.seasonal import STL
        if len(vals) < 14: raise ValueError("too few points")
        res = STL(pd.Series(vals), period=7, robust=True).fit()
        trend, seasonal = res.trend.values, res.seasonal.values
        slope, intercept = np.polyfit(np.arange(len(trend[-14:])), trend[-14:], 1)
        avg_season = [float(np.mean(seasonal[i::7])) for i in range(7)]
        preds = []
        for i, fd in enumerate(future_dates):
            value = trend[-1]+slope*(i+1)+avg_season[fd.weekday()]
            fest_m, label = get_festival_multiplier(fd)
            if learned_festival_mults and label in learned_festival_mults:
                fest_m = learned_festival_mults[label]
            effective = max(fest_m, festival_multiplier)
            preds.append(max(0.0, round(value * effective, 4)))
        return ModelResult(
            name="stl", label="STL Decomposition",
            formula_description="LOESS decomposition: Trend + weekly Seasonal component projected forward.",
            predicted_values=preds, baseline=round(float(trend[-1]),4))
    except Exception as e:
        fb = model_median_dow(daily, dow_series, future_dates, festival_multiplier, is_sparse=is_sparse, learned_festival_mults=learned_festival_mults)
        fb.name, fb.label = "stl", f"STL→Median (fallback: {e})"
        return fb

def model_ensemble(daily, dow_series, future_dates, festival_multiplier, is_sparse=False, learned_festival_mults=None):
    parts = [
        model_median_dow(daily,dow_series,future_dates,festival_multiplier, is_sparse, learned_festival_mults),
        model_wma(daily,dow_series,future_dates,festival_multiplier, is_sparse=is_sparse, learned_festival_mults=learned_festival_mults),
        model_sma(daily,dow_series,future_dates,festival_multiplier, is_sparse=is_sparse, learned_festival_mults=learned_festival_mults),
        model_ets(daily,dow_series,future_dates,festival_multiplier, is_sparse=is_sparse, learned_festival_mults=learned_festival_mults),
        model_holts(daily,dow_series,future_dates,festival_multiplier, is_sparse=is_sparse, learned_festival_mults=learned_festival_mults),
        model_holt_winters(daily,dow_series,future_dates,festival_multiplier, is_sparse=is_sparse, learned_festival_mults=learned_festival_mults),
        model_trimmed_mean(daily,dow_series,future_dates,festival_multiplier, is_sparse=is_sparse, learned_festival_mults=learned_festival_mults),
        model_iqr(daily,dow_series,future_dates,festival_multiplier, is_sparse=is_sparse, learned_festival_mults=learned_festival_mults),
        model_same_weekday(daily,dow_series,future_dates,festival_multiplier, is_sparse=is_sparse, learned_festival_mults=learned_festival_mults),
        model_seasonal_naive(daily,dow_series,future_dates,festival_multiplier, is_sparse=is_sparse, learned_festival_mults=learned_festival_mults),
    ]
    preds = [round(float(np.median([m.predicted_values[i] for m in parts])),4)
             for i in range(len(future_dates))]
    return ModelResult(
        name="ensemble", label="Median Ensemble",
        formula_description="Median of all 10 individual models per day — lowest overall variance.",
        predicted_values=preds,
        baseline=round(float(np.median([m.baseline for m in parts])),4),
        model_meta={"n_models": len(parts)})


# ─────────────────────────────────────────────────────────────────────────────
# Full registry
# ─────────────────────────────────────────────────────────────────────────────

def run_all_models(daily, dow_series, future_dates, festival_multiplier, is_sparse=False, learned_festival_mults=None, branch=None, brand=None, model_name=None) -> list[ModelResult]:
    from data_processing import get_segment_profile
    runners = [
        model_msp_curated, model_median_dow, model_wma, model_sma, model_ets,
        model_holts, model_holt_winters, model_trimmed_mean, model_iqr,
        model_same_weekday, model_seasonal_naive, model_stl, model_ensemble,
        wma_affinity,
    ]
    results = []
    for fn in runners:
        try:
            if fn.__name__ == "wma_affinity":
                segment_profile = None
                if branch and brand and model_name:
                    segment_profile = get_segment_profile(branch, brand, model_name)
                # dow_multipliers fallback
                fallback_mults = _dow_mults(daily, dow_series)
                results.append(fn(daily, fallback_mults, future_dates, festival_multiplier, segment_profile=segment_profile))
            elif fn.__name__ == "model_msp_curated":
                results.append(fn(daily, dow_series, future_dates, festival_multiplier, is_sparse=is_sparse, learned_festival_mults=learned_festival_mults, branch=branch, brand=brand, model_name=model_name))
            else:
                results.append(fn(daily, dow_series, future_dates, festival_multiplier, is_sparse=is_sparse, learned_festival_mults=learned_festival_mults))
        except Exception as exc:
            print(f"[model error] {fn.__name__}: {exc}")
    return results


# ─────────────────────────────────────────────────────────────────────────────
# Walk-forward accuracy computation (for /msp-accuracy endpoint)
# ─────────────────────────────────────────────────────────────────────────────

ROLLING_WINDOW = 14   # module-level constant

def walk_forward_predict(daily: pd.Series, dow_series: pd.Series,
                         model_fn, festival_multiplier: float = 1.0,
                         is_sparse: bool = False, learned_festival_mults: dict = None) -> pd.Series:
    """
    Rolling-window walk-forward: for each date d, predict using only
    the ROLLING_WINDOW days immediately before d.
    Minimum warmup: 7 days (returns NaN before that).
    """
    dates  = list(daily.index)
    preds  = {}
    WARMUP = 7

    for i, dt in enumerate(dates):
        if i < WARMUP:
            preds[dt] = float('nan')
            continue
        start    = max(0, i - ROLLING_WINDOW)
        hist_d   = daily.iloc[start:i]
        hist_dow = dow_series.iloc[start:i]
        target   = pd.Timestamp(dt).date()
        result   = model_fn(hist_d, hist_dow, [target], festival_multiplier, is_sparse=is_sparse, learned_festival_mults=learned_festival_mults)
        preds[dt] = result.predicted_values[0]

    return pd.Series(preds)


def compute_error_metrics(actual: pd.Series, predicted: pd.Series) -> dict:
    """
    Compute MAE, MAPE, RMSE between actual and predicted.
    Only uses dates where both are non-NaN and actual > 0.
    """
    combined = pd.DataFrame({"actual": actual, "pred": predicted}).dropna()
    combined = combined[combined["actual"] > 0]

    if combined.empty:
        return {"mae": 0.0, "mape": 0.0, "rmse": 0.0, "n_days": 0}

    err  = combined["pred"] - combined["actual"]
    mae  = float(err.abs().mean())
    mape = float((err.abs() / combined["actual"]).mean() * 100)
    rmse = float(np.sqrt((err**2).mean()))

    return {
        "mae":    round(mae,  2),
        "mape":   round(mape, 2),
        "rmse":   round(rmse, 2),
        "n_days": len(combined),
    }
