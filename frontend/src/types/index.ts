// types/index.ts — all shared TypeScript interfaces

// ── Core sales types ────────────────────────────────────────────────────────

export interface HistoricalSale {
  date: string;
  qty:  number;
}

export interface DayPrediction {
  date:                string;
  weekday_name:        string;
  dow:                 number;
  dow_multiplier:      number;
  festival_multiplier: number;
  predicted_qty:       number;
}

export interface PredictionTableRow {
  date:           string;
  weekday:        string;
  predicted_qty:  number;
  dow_multiplier: number;
}

export interface ModelStats {
  baseline:         number;
  overall_avg:      number;
  dow_multipliers:  Record<string, number>;
  model_name?:      string;
  model_label?:     string;
}

// ── /predict ────────────────────────────────────────────────────────────────

export interface PredictionRequest {
  branch:              string | null;
  brand:               string | null;
  model:               string | null;
  price_range:         string | null;
  days:                number;
  festival_multiplier: number;
  model_name?:         string;
}

export interface PredictionResponse {
  historical_sales:    HistoricalSale[];
  actual_future_sales?: HistoricalSale[];
  predicted_sales:     DayPrediction[];
  prediction_table:    PredictionTableRow[];
  model_stats:         ModelStats;
}

// ── /compare ────────────────────────────────────────────────────────────────

export interface ModelPrediction {
  name:               string;
  label:              string;
  description:        string;
  baseline:           number;
  total_predicted:    number;
  daily_predictions:  number[];
  model_meta:         Record<string, unknown>;
}

export interface ModelSummaryRow {
  model:       string;
  name:        string;
  baseline:    number;
  total:       number;
  avg_per_day: number;
  min_day:     number;
  max_day:     number;
  spread:      number;
  diff?:       number;
  total_actual?: number;
}

export interface CompareRequest {
  branch:              string | null;
  brand:               string | null;
  model:               string | null;
  price_range:         string | null;
  days:                number;
  festival_multiplier: number;
}

export interface CompareResponse {
  historical_sales:    HistoricalSale[];
  actual_future_sales?: HistoricalSale[];
  future_dates:        string[];
  models:              ModelPrediction[];
  summary_table:       ModelSummaryRow[];
}

// ── /msp-accuracy ───────────────────────────────────────────────────────────

export interface PerDayRow {
  date:          string;
  actual_qty:    number;
  predicted_qty: number | null;
}

export interface ErrorMetrics {
  mae:    number;
  mape:   number;
  rmse:   number;
  n_days: number;
}

export interface MspModelResult {
  name:                string;
  label:               string;
  formula_description: string;
  baseline:            number;
  per_day:             PerDayRow[];
  error_metrics:       ErrorMetrics;
}

export interface MspAccuracyRequest {
  branch:              string | null;
  brand:               string | null;
  model:               string | null;
  price_range:         string | null;
  festival_multiplier: number;
  enable_dow?:         boolean;
  enable_festival?:    boolean;
  enable_price_affinity?: boolean;
  enable_brand_affinity?: boolean;
  w1?:                 number;
  w2?:                 number;
  w3?:                 number;
}

export interface MspAccuracyResponse {
  actual_sales: HistoricalSale[];
  models:       MspModelResult[];
}

export interface CuratedMspDaily {
  date: string;
  actual: number;
  predicted: number;
  avg7: number;
  avg28: number;
  avg60: number;
  affinity: number;
}

export interface CuratedMspResponse {
  start_date: string;
  end_date: string;
  daily_data: CuratedMspDaily[];
  future_daily_data?: CuratedMspDaily[];
}

// ── Shared filter state ──────────────────────────────────────────────────────

export interface Filters {
  branch:            string;
  brand:             string;
  model:             string;
  priceRange:        string;
  days:              number;
  festivalMultiplier:number;
  enableDow?:        boolean;
  enableFestival?:   boolean;
  enablePriceAffinity?: boolean;
  enableBrandAffinity?: boolean;
  w1?:               number;
  w2?:               number;
  w3?:               number;
}

// ── Manual cross-check ──────────────────────────────────────────────────────

export interface CrossCheckEntry {
  date:        string;
  actualQty:   number;
  predictions: Record<string, number>; // modelName → predicted_qty for that date
}

export interface FestivalEntry {
  name:       string;
  date:       string;       // ISO "YYYY-MM-DD"
  tier:       1 | 2 | 3;
  tier_name:  string;
  notes:      string;
  day_mult:   number;
  lead_date:  string;
  lead_mult:  number;
  trail_date:  string | null;
  trail_mult:  number | null;
  trail2_date: string | null;
  trail2_mult: number | null;
}

export interface AffinityCell {
  store:               string;
  brand:               string;
  raw_units:           number;
  share_pct:           number;
  affinity_score:      number;
  rank_in_network:     number;
  dominant_brand_flag: boolean;
}

export interface StoreProfileEntry {
  brand:          string;
  units:          number;
  share_pct:      number;
  affinity_score: number;
  rank:           number;
  dominant:       boolean;
}

export interface BrandLeaderboardEntry {
  store:          string;
  units:          number;
  share_pct:      number;
  affinity_score: number;
  rank:           number;
}

export interface BrandAffinityResponse {
  stores:             string[];
  brands:             string[];
  network_totals:     Record<string, number>;
  network_shares:     Record<string, number>;
  store_totals:       Record<string, number>;
  cells:              AffinityCell[];
  store_profiles:     Record<string, StoreProfileEntry[]>;
  brand_leaderboard:  Record<string, BrandLeaderboardEntry[]>;
  top_brand_per_store:Record<string, string>;
}
