# PhoneRetail Analytics — Sales Prediction Dashboard

Production-quality analytics dashboard for phone retail.  A platform that predicts Minimum Stock Position(MSP) required for 179 stores, Open-to-Buy(OTB) alocation, look-alike new models MSP prediction.
Training window: **Sep 1 – Dec 31 2025** → Predictions: **Jan 1 2026 onwards**

---

## Quick Start (2 terminals)

### Terminal 1 — Backend
```bash
cd MSP-Visualizer/backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Terminal 2 — Frontend
```bash
cd MSP-Visualizer/frontend
npm install
npm run dev
# → open http://localhost:5173
```

---

## Using Your Own Sales Data

1. Drop your file into `backend/` as **`sales_data.xlsx`** (or `.csv`)
2. Restart the backend — it auto-detects the file

**Required columns** (exact names):

| Column | Example |
|--------|---------|
| `Branch` | `Adambakkam - 2 - (Jayalakshmi Theatre)` |
| `I/M Code` | `Vivo V60 12 256 MB` |
| `Item/Model` | `Vivo V60 5G 12GB 256GB Moonlight Blue-Vivo` |
| `Date` | `01/10/2025` (DD/MM/YYYY) |
| `Qty.` | `1` (also accepts `Qty`, `Quantity`, `Sales`) |

**Brand extraction:** parsed from the trailing `-Brand` suffix in Item/Model.  
**Training window:** only Sep 1 – Dec 31 2025 data is used. Rows outside this range are ignored.

---

## Three Dashboard Tabs

### 📈 Prediction
- Historical sales chart (Sep–Dec 2025 training data)
- Predicted sales trend for Jan 2026+
- Daily breakdown bar chart (weekday vs weekend colour-coded)
- Prediction table with totals
- Choose any of 12 statistical models from the sidebar

### ⚖️ Model Comparison
- All 12 models plotted on a single overlay chart
- Toggle individual models on/off; double-click to isolate
- Average daily forecast bar chart with min–max error bars
- Summary table (sortable by any column)
- Click any row to switch that model into the Prediction tab

### 🎯 MSP Accuracy
- **Walk-forward evaluation** of 3 core MSP models against Sep–Dec 2025 actuals
- Individual chart per model: actual (solid sky blue) vs predicted (dashed, model colour)
- **ℹ button** on each card shows the exact formula used
- Error metrics: **MAE**, **MAPE** (colour-coded green/amber/red), **RMSE**
- Combined overlay chart — all models + actual on one canvas
- Accuracy summary table with ⭐ best model highlight
- **Manual Cross-Check panel** — enter Jan 2026+ actual sales, see instant error % vs each model, export to CSV

---

## MSP Models (Accuracy Tab)

| Model | Formula |
|-------|---------|
| **MSP Baseline** | `median(daily Qty) × Mdow × Festival` |
| **WMA-14** | `Σ(qty_i × weight_i) / Σ(weights)` — weights 1…14, most recent=14 |
| **SMA-7** | `mean(last 7 days) × Mdow × Festival` |

**DOW Multiplier:** `Mdow = avg_sales_on_weekday_w / overall_avg_sales`  
**Walk-forward:** trained on expanding window, predicts one day ahead — no data leakage

---

## All 12 Models (Comparison Tab)

| Model | Description |
|-------|-------------|
| **Median+DOW** | Uses the median daily quantity multiplied by day-of-week and festival factors. Robust to outliers. |
| **SMA-14** | Simple 14-day Moving Average. Smooths out short-term fluctuations. |
| **WMA-14** | Weighted 14-day Moving Average. Gives more importance to recent data points. |
| **ETS** | Exponential Smoothing. Uses an exponentially decreasing weight for older observations. |
| **Holt's Linear** | Extended exponential smoothing that captures trends in the data. |
| **Holt-Winters** | Advanced exponential smoothing that captures both trend and seasonality. |
| **Trimmed Mean** | Calculates the average after removing the top and bottom 10% of data points to reduce outlier impact. |
| **IQR Mean** | Calculates the average of data points falling within the Interquartile Range (25th to 75th percentile). |
| **Same-Weekday Avg** | Predicts based on the average sales for that specific day of the week in history. |
| **Seasonal Naive** | Simple baseline that predicts the value from the same day in the previous week/season. |
| **STL Decomposition** | Season-Trend decomposition using LOESS. Separates data into trend, seasonal, and residual components. |
| **Median Ensemble** | Combines multiple models by taking their median prediction for improved stability. |

## Model Formulas

### Core MSP Models

*   **MSP Baseline (Median+DOW)**
    *   `Rb = median(daily Qty over training window)`
    *   `Mdow = average_sales_on_weekday_w ÷ overall_average_sales`
    *   `Prediction = Rb × Mdow × FestivalMultiplier`
*   **WMA-14**
    *   `weights = [1, 2, 3, ..., 14] (most recent day = weight 14)`
    *   `WMA = Σ(sales_i × weight_i) ÷ Σ(weights)`
    *   `Mdow = average_sales_on_weekday_w ÷ overall_average_sales`
    *   `Prediction = WMA × Mdow × FestivalMultiplier`
*   **SMA-7 (Rolling Avg)**
    *   `SMA = mean(last 7 days of training data)`
    *   `Mdow = average_sales_on_weekday_w ÷ overall_average_sales`
    *   `Prediction = SMA × Mdow × FestivalMultiplier`

### Additional Models

*   **ETS (Exponential Smoothing)**
    *   `S_t = α×Actual + (1-α)×S_{t-1} × Mdow × Festival`
*   **Holt's Linear Trend**
    *   Double Exponential Smoothing that captures level and linear trend.
*   **Holt-Winters**
    *   Triple Exponential Smoothing: captures level, trend, and weekly seasonality.
*   **Trimmed Mean (10%)**
    *   `Mean of middle 80% of days (removes top/bottom 10%) × Mdow × Festival.`
*   **IQR Mean**
    *   `Mean of Q1–Q3 values (robust to outliers) × Mdow × Festival.`
*   **Same-Weekday Avg**
    *   Each future weekday is predicted from its own historical average only.
*   **Seasonal Naive**
    *   Next Monday = most recent Monday's actual. Repeats the last weekly cycle.
*   **STL Decomposition**
    *   LOESS decomposition: Trend + weekly Seasonal component projected forward.
*   **Median Ensemble**
    *   Median of all 10 individual models per day — lowest overall variance.

## Error Metrics

| Metric | Full Name | Description |
|--------|-----------|-------------|
| **MAE** | Mean Absolute Error | Average of the absolute differences between predicted and actual values. Shows the average magnitude of errors in units sold. |
| **MAPE** | Mean Absolute Percentage Error | Average of the absolute percentage differences between predictions and actuals. Expresses error as a percentage of the actual volume (lower is better). |
| **RMSE** | Root Mean Square Error | Square root of the average of squared differences. Penalizes larger errors more heavily than MAE. |

---

## Architecture


                         ┌──────────────────────────────┐
                         │        Sales Data            │
                         │      Excel / CSV Files       │
                         └──────────────┬───────────────┘
                                        │
                                        ▼
                         ┌──────────────────────────────┐
                         │     Data Processing Layer    │
                         │     Python + Pandas + NumPy  │
                         │                              │
                         │ • Data cleaning              │
                         │ • Date normalization         │
                         │ • Daily sales aggregation    │
                         │ • Store / Brand / Model      │
                         │   filtering                  │
                         └──────────────┬───────────────┘
                                        │
                                        ▼
                    ┌────────────────────────────────────────┐
                    │       Forecasting & MSP Engine          │
                    │                                        │
                    │  Statistical Models                    │
                    │  • Median + DOW                        │
                    │  • SMA / WMA                           │
                    │  • ETS / Holt / Holt-Winters           │
                    │  • Seasonal Naive                      │
                    │  •Same-Weekday Avg                     │
                    │                                        │
                    │                                        │
                    │  Curated MSP                           │
                    │  • Avg 7 / 7–28 / 30–60 days           │
                    │  • Brand Affinity                      │
                    │  • Price Affinity                      │
                    │  • DOW & Festival Multipliers          │
                    └───────────────────┬────────────────────┘
                                        │
                                        ▼
                         ┌──────────────────────────────┐
                         │     Evaluation Layer         │
                         │                              │                            
                         │ • MAE                        │
                         │ • MAPE                       │
                         │ • RMSE                       │
                         │ • Model comparison           │
                         └──────────────┬───────────────┘
                                        │
                                        ▼
                         ┌──────────────────────────────┐
                         │       FastAPI Backend        │
                         │                              │
                         │ REST APIs                    │
                         │ • /api/predict               │
                         │ • /api/compare               │
                         │ • /api/msp-accuracy         │
                         │ • /api/branches             │
                         │ • /api/brands                │
                         │ • /api/models               │
                         └──────────────┬───────────────┘
                                        │
                                  JSON / REST
                                        │
                                        ▼
                 ┌────────────────────────────────────────────┐
                 │          React + Vite Frontend              │
                 │                                            │
                 │  ┌────────────┐ ┌────────────┐             │
                 │  │ Prediction │ │    Model   │             │
                 │  │ Dashboard  │ │ Comparison │             │
                 │  └────────────┘ └────────────┘             │
                 │                                            │
                 │  ┌──────────────────────────────────────┐  │
                 │  │          MSP Accuracy Dashboard       │  │
                 │  │  Actual vs Predicted • Error Metrics │  │
                 │  └──────────────────────────────────────┘  │
                 │                                            │
                 │              Chart.js Visualization         │
                 └────────────────────────────────────────────┘

## File Priority

The backend searches for a data file in this order:
1. `sales_data.xlsx` ← **drop your file here**
2. `sales_data.csv`
3. `sample_data.xlsx`
4. `sample_data.csv` ← fallback generated demo data
5. Any other `.xlsx` or `.csv` in the backend/ folder

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/branches` | Branch list |
| GET | `/api/brands` | Brand list |
| GET | `/api/models?brand=X` | Model list |
| POST | `/api/predict` | Single-model prediction |
| POST | `/api/compare` | All 12 models comparison |
| POST | `/api/msp-accuracy` | Walk-forward accuracy evaluation |
| GET | `/health` | Health check |
| GET | `/docs` | Interactive API docs |
