# Project Context: MSP Analytics Dashboard

This document provides a comprehensive overview of the "MSP Analytics Dashboard" project. It is designed to be fed into an LLM to provide full context on the architecture, stack, features, and codebase structure.

## 1. Project Overview

The project is a full-stack web application designed for predicting daily sales of mobile phones across various branches, brands, models, and price ranges. It allows users to filter historical data, run multiple statistical forecasting models, compare their outputs, evaluate their accuracy against actual historical/future data, and analyze branch-level affinities for specific brands and price tiers.

### Key Dates & Data Handling
- **Training Window**: September 1, 2025 – December 31, 2025 (Fixed window).
- **Prediction Window**: January 1, 2026 onwards.
- **Historical Data**: Loaded from `backend/Sales_Combined.xlsx` (or `.csv`).
- **Actuals (Ground Truth)**: Loaded from `backend/feb_sales.xlsx` for dates >= Jan 1, 2026 to overlay actual sales against predictions.

## 2. Tech Stack

- **Backend**: Python 3.10+, FastAPI, Pandas, NumPy, Statsmodels, Uvicorn.
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS (for styling), Recharts (for data visualization), Lucide React (for icons).

## 3. Key Features & Tabs

1. **Prediction Tab**: 
   - Displays historical sales (Sep-Dec 2025) and predicted sales for future dates (Jan 2026+).
   - Allows applying a specific model (e.g., MSP Baseline, Holt-Winters, Ensemble).
   - Overlays actual sales (if available) on the prediction chart.
   - Includes KPIs (Avg Daily Sales, Training Days, Forecast Total, Festival Boost).

2. **Model Comparison Tab**:
   - Runs 12 different statistical models simultaneously on the selected data slice.
   - Displays a massive overlay chart of all models.
   - Features real-time **percentage of correctness** (`100% - MAPE`) printed directly on model toggle buttons when future actuals are available.
   - Provides a summary table with stats (total predicted, avg per day, spread) for each model.
   - Allows users to select a model from the table to use in the Prediction tab.

3. **MSP Accuracy Tab**:
   - Focuses on 3 core "MSP" (Market Sales Prediction) models: MSP Baseline (Median + DOW), WMA-7, and SMA-3.
   - Performs Walk-Forward Evaluation over the training window using a 14-day rolling window (predicting each day based only on the 14 days prior).
   - Calculates error metrics: MAE (Mean Absolute Error), MAPE (Mean Absolute Percentage Error), and RMSE.
   - Displays festival markers (`FestivalBadge`) directly on the overlay charts.

4. **Curated MSP Accuracy Tab**:
   - Uses a highly customizable, weighted moving average model (WMA 7, 28, 60 days) to simulate walk-forward forecasting over the entire historical window and projects 3 months into the future.
   - Includes dynamic sliders to adjust algorithm weights (`W1`, `W2`, `W3`) in real-time.
   - Toggles to apply dynamic multipliers for **Brand Affinity**, **Price Affinity**, **Day of Week (DOW)**, and **Festivals** to the baseline prediction.
   - Features an adjustable aggregation window slider (1-30 days) to smooth out the charts (e.g., viewing weekly or monthly data instead of daily).

5. **Brand Affinity Tab**:
   - Computes how strongly a specific branch leans toward a brand relative to the entire network average.
   - Visualizes data via an **Affinity Heatmap**, **Store Profile**, and **Brand Leaderboard**.
   - Metric calculation: `Affinity = (Store Share / Network Share) * 50`.

6. **Price Affinity Tab**:
   - Similar to Brand Affinity, but evaluates sales strength across specific price tiers (e.g., `Under ₹10k`, `₹10k - ₹20k`, `Above ₹50k`) for each branch.

## 4. Backend Architecture

The backend is structured into modular Python files inside the `backend/` directory:

- **`main.py`**: The FastAPI application entry point. Configures CORS and mounts the API router.
- **`api_routes.py`**: Defines all REST endpoints (`/api/brands`, `/api/branches`, `/api/predict`, `/api/compare`, `/api/curated-msp`, `/api/brand-affinity`, etc.).
- **`data_processing.py`**: Handles loading data from Excel/CSV using Pandas.
  - Dynamically merges `MOP` values from `Brand Item-Model MOP.xlsx` to compute a `price` column, enabling filtering by price ranges.
- **`festival_calendar.py`**: The authoritative source of truth for Tamil Nadu festivals. Contains a tiered structure (`TIER1`, `TIER2`, etc.) applying multipliers up to 4.8×, along with leading/trailing multipliers for multi-day effects.
- **`brand_affinity.py` & `price_affinity.py`**: Calculates the branch-level affinity scores compared to the network averages, used both in their respective frontend tabs and as dynamic multipliers in the curated MSP model.
- **`curated_msp.py`**: Houses the logic for the dynamic weighted moving average prediction, executing walk-forward loops and applying the user-selected affinity and festival multipliers.
- **`statistical_model.py`**: Contains the math and logic for all 12 core forecasting models. Every model follows the signature: `fn(daily, dow_series, future_dates, festival_multiplier) -> ModelResult`.
- **`prediction_service.py`**: The orchestration layer calling data processing functions, running models, and constructing the final JSON responses.
- **`tune_stores.py` & `build_store_profiles.py` & `create_msp_table.py`**: Offline/utility scripts that determine the historically best-performing baseline model (e.g., `sma`, `wma`) for each `Branch|Brand|Model` combination, saving results to `store_profiles.json` and static MSP targets to `curated_stores_msp_lookup.json`.

### The Models
1. `msp_curated` (Auto-Tuned Model): A meta-model in `statistical_model.py` that selects the pre-computed best algorithm from `store_profiles.json` for a specific Branch+Brand+Model.
2. `median_dow` (MSP Baseline)
3. `wma` (Weighted Moving Average 7-day)
4. `sma` (Simple Moving Average 3-day)
5. `ets` (Exponential Smoothing)
6. `holts` (Holt's Linear Trend)
7. `holt_winters` (Holt-Winters with Seasonality)
8. `trimmed_mean` (Excluding top/bottom 10%)
9. `iqr` (Interquartile Range Mean)
10. `same_weekday` (Averages specific to each weekday)
11. `seasonal_naive` (Repeats last week's pattern)
12. `stl` (Seasonal and Trend decomposition using Loess)
13. `ensemble` (Median of all models per day)

## 5. Frontend Architecture

The frontend is a Vite + React SPA located in the `frontend/` directory.

### Key Directories and Files
- **`src/types/index.ts`**: Contains all TypeScript interfaces matching backend JSON responses.
- **`src/services/api.ts`**: Axios/Fetch wrappers for calling the backend endpoints.
- **`src/pages/`**:
  - `Dashboard.tsx`: Main view for standard Predictions and Model Comparison.
  - `MspAccuracy.tsx`: Walk-Forward evaluation view for core MSP models.
  - `CuratedMspAccuracy.tsx`: The interactive weighted moving average model UI with dynamic multiplier toggles and variable aggregation window.
  - `BrandAffinity.tsx` & `PriceAffinity.tsx`: Detailed analytics dashboards for store-level affinities.

### Key Components (`src/components/`)
- **`FiltersPanel.tsx`**: Sidebar UI containing dropdowns for Branch, Brand, Price Range, and Model.
- **`FestivalBadge.tsx`**: UI primitives for displaying festival pills.
- **`ModelComparisonChart.tsx`**: A Recharts LineChart showing all 12 models simultaneously, with interactive features.
- **`SalesChart.tsx`** & **`PredictionChart.tsx`**: Data visualization for historical and future predicted timelines.

## 6. How Data Flows

1. User interacts with UI filters or adjusts parameters (like algorithm weights or multiplier toggles).
2. React state updates, triggering a debounced API call via `api.ts`.
3. FastAPI (`api_routes.py`) routes the request to the relevant service (`prediction_service.py`, `curated_msp.py`, or `brand_affinity.py`).
4. `data_processing.py` retrieves and filters the cached Pandas DataFrame.
5. The chosen mathematical model processes the time-series array, dynamically applying logic for DOW, Festivals, and Affinities as requested.
6. The backend formats and sanitizes the output (ensuring no `NaN` or `Infinity`) and returns JSON.
7. Frontend state ingests the data, recalculating derived values like total accuracy, and renders the updated Recharts visualizations.

## 7. Known Quirks / Specifics
- **Day of Week (DOW)** calculations are central to this project. Multipliers are calculated for Mon-Sun to adjust baseline predictions.
- **Affinities** (`brand_affinity.py` / `price_affinity.py`): Scaled such that an affinity score directly correlates to a multiplier logic (`0.5 + (affinity_score / 100.0)`) in `curated_msp.py`.
- **Festivals**: Hardcoded festival logic (`festival_calendar.py`) strictly overrides standard prediction multipliers via `max(hardcoded_mult, manual_slider_mult)` in core models, but can be interactively toggled in the Curated MSP context.
- `NaN` and `Infinity` values from Pandas/Numpy calculations are explicitly sanitized to `0.0` or `'N/A'` before JSON serialization to avoid React crashes.
- The UI leverages a dark mode aesthetic (`bg-zinc-950`) with specific accent colors to maintain visual consistency (e.g., Emerald for predictions/success, Sky for historical/actuals, Amber for baseline/warnings, Red for errors).
