# Project Context: MSP Analytics Dashboard

This document provides a comprehensive overview of the "MSP Analytics Dashboard" project. It is designed to be fed into an LLM to provide full context on the architecture, stack, features, and codebase structure.

## 1. Project Overview

The project is a full-stack web application designed for predicting daily sales of mobile phones across various branches, brands, and models. It allows users to filter historical data, run multiple statistical forecasting models, compare their outputs, and evaluate their accuracy against actual historical/future data.

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

## 4. Backend Architecture

The backend is structured into modular Python files inside the `backend/` directory:

- **`main.py`**: The FastAPI application entry point. Configures CORS and mounts the API router.
- **`api_routes.py`**: Defines all REST endpoints (`/api/brands`, `/api/branches`, `/api/models`, `/api/predict`, `/api/compare`, `/api/msp-accuracy`).
- **`data_processing.py`**: Handles loading data from Excel/CSV using Pandas.
  - Functions: `load_clean_data()`, `filter_data()`, `load_actual_feb_data()`, `filter_actual_data()`, `build_daily_series()`, `get_price_ranges()`.
  - Normalizes column names (`Branch`, `Item/Model`, `Date`, `Qty`) and extracts brands/models.
  - Dynamically merges `MOP` values from `Brand Item-Model MOP.xlsx` to compute a `price` column, allowing filtering by dynamic price ranges (`Under ₹10k`, `₹10k – ₹20k`, etc.).
- **`festival_calendar.py`**: The authoritative source of truth for Tamil Nadu festivals. Contains a tiered structure (`TIER1`, `TIER2`, etc.) applying multipliers up to 4.8×, along with `lead_mult`, `trail_mult`, and even `trail2_mult` (for multi-day effects like Pongal).
- **`statistical_model.py`**: Contains the math and logic for all 12 forecasting models.
  - Every model follows the signature: `fn(daily, dow_series, future_dates, festival_multiplier) -> ModelResult`.
  - Core logic includes Day-of-Week (DOW) multipliers and dynamically applies highest active multiplier (either from `festival_calendar.py` or the manual slider).
  - Also contains a rolling-window `walk_forward_predict()` and `compute_error_metrics()`.
- **`prediction_service.py`**: The orchestration layer. Functions (`run_prediction`, `run_comparison`, `run_msp_accuracy`) call the data processing functions (passing down `price_range` filters), run the requested models, fetch actuals, and construct the final JSON responses.

### The Models
1. `msp_curated` (Auto-Tuned Model): A meta-model that dynamically selects the historically best-performing algorithm (e.g., WMA, Median DOW, or SMA) and its optimal parameters for a specific Branch+Brand combination using `store_profiles.json`. If no profile is found, it safely falls back to a 7-day SMA.
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
- **`src/types/index.ts`**: Contains all TypeScript interfaces matching backend JSON responses (`PredictionResponse`, `CompareResponse`, `MspAccuracyResponse`, `Filters`, etc.).
- **`src/services/api.ts`**: Axios/Fetch wrappers for calling the backend endpoints.
- **`src/pages/Dashboard.tsx`**: The main view. Manages state for filters (branch, brand, model, days, festival multiplier) and active tabs. Fetches data for `/predict` and `/compare` endpoints.
- **`src/pages/MspAccuracy.tsx`**: A standalone view rendered when the "MSP Accuracy" tab is active. It has its own sidebar and fetches data from `/msp-accuracy`.

### Key Components (`src/components/`)
- **`FiltersPanel.tsx`**: The sidebar UI containing dropdowns for Branch, Brand, Price Range, and Model.
- **`FestivalBadge.tsx`**: UI primitives for displaying festival pills in tooltips and a dedicated sidebar list for upcoming calendar events.
- **`PredictionControls.tsx`**: The sidebar UI for Days to Predict slider and Festival Multiplier slider.
- **`PredictionChart.tsx`**: A Recharts `ComposedChart` showing predicted sales (Area) and actual sales (Line) overlaid.
- **`SalesChart.tsx`**: A Line chart showing historical sales.
- **`ModelComparisonChart.tsx`**: A complex Recharts LineChart showing all 12 models. Includes interactive features to isolate models on double-click.
- **`ModelSummaryTable.tsx`**: A tabular view of model stats in the comparison tab.
- **`DailyBarChart.tsx` / `PredictionTable.tsx`**: Detailed breakdowns of predictions.

## 6. How Data Flows

1. User changes a filter (e.g., selects "Apple" brand) in `FiltersPanel.tsx`.
2. `Dashboard.tsx` state updates, triggering a debounced call to `fetchPred` and/or `fetchCmp`.
3. `api.ts` makes a POST request to `/api/predict` (or `/compare`) with the filter parameters (including `price_range`).
4. FastAPI (`api_routes.py`) receives the request and passes it to `prediction_service.py`.
5. `data_processing.py` filters the cached Pandas DataFrame (`Sales_Combined.xlsx`) to only "Apple".
6. It aggregates the data into a daily time series.
7. `statistical_model.py` runs the selected mathematical model (e.g., `median_dow`) on the time series, applying DOW logic and generating predictions for the requested future dates starting Jan 1, 2026.
8. `prediction_service.py` fetches actual sales for Jan 1+ from `feb_sales.xlsx` using `filter_actual_data()`.
9. The backend returns a sanitized JSON payload.
10. `Dashboard.tsx` saves the result to state, and passes the data down to components like `PredictionChart` to render the interactive graphs.

## 7. Known Quirks / Specifics
- Day of Week (DOW) calculations are central to this project. Multipliers are calculated for Mon-Sun to adjust baseline predictions.
- `NaN` and `Infinity` values produced by Pandas/Numpy are explicitly cleaned to `0.0` before returning JSON responses to avoid frontend parsing crashes.
- The `alpha` value in the `ets` model is set to `0.6` and `holt_winters` to `0.45` to prioritize recent trends.
- **Festivals:** Hardcoded festival logic (`festival_calendar.py`) takes precedence via `max(hardcoded_mult, manual_slider_mult)` when generating day-level predictions.
- The UI uses a dark mode aesthetic (`bg-zinc-950`) with specific accent colors for different data points (e.g., Emerald for predictions, Sky for historical, Amber for baseline).