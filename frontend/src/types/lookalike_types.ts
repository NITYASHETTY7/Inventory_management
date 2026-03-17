export type LookalikScenario = "new_model" | "new_store" | "sparse_data";

export interface ModelCatalogItem {
  im_code: string;
  item_model: string;
  brand: string;
  mop: number;
  days_of_data: number;
  first_sale: string;
  last_sale: string;
  price_band: string;
}

export interface LookalikeSuggestion {
  im_code: string;
  item_model: string;
  brand: string;
  mop: number;
  price_band: string;
  lookalike_score: number;
  match_reason: string;
  days_of_data: number;
  is_direct_successor: boolean;
}

export interface StoreProximitySuggestion {
  branch: string;
  distance_km: number;
  weight: number;
}

export interface DailyBreakdown {
  date: string;
  base: number;
  brand_aff: number;
  price_aff: number;
  dow_mult: number;
  fest_mult: number;
  hype_mult: number;
  predicted: number;
  data_source: "actual" | "lookalike";
}

export interface LookalikeMspResult {
  scenario: LookalikScenario;
  target: {
    branch: string;
    im_code: string;
    item_model: string;
    brand: string;
    mop: number;
    price_band: string;
    days_since_launch: number;
    is_direct_successor: boolean;
  };
  lookalike_used: Array<{
    im_code: string;
    item_model: string;
    branch: string;
    lookalike_score: number;
    is_direct_successor: boolean;
    weight: number;
    distance_km: number;
  }>;
  multipliers_applied: {
    brand_affinity: number;
    price_affinity: number;
    w1: number; w2: number; w3: number;
  };
  daily_breakdown: DailyBreakdown[];
  base_msp_series: Array<{ date: string; predicted: number }>;
  affinity_msp_series: Array<{ date: string; predicted: number }>;
  final_msp_series: Array<{ date: string; predicted: number }>;
  msp_20d_total: number;
  base_msp_20d_total: number;
  affinity_msp_20d_total: number;
  hype_uplift: number;
  confidence: "HIGH" | "MEDIUM" | "LOW";
}

export interface LookalikeMspRequest {
  scenario: LookalikScenario;
  target_branch: string;
  target_im_code: string;
  target_brand: string;
  target_mop: number;
  days_since_launch: number;
  is_direct_successor: boolean;
  lookalike_im_codes: string[];
  lookalike_weights: number[];
  prediction_date: string;
  hype_duration_days: number;
  peak_multiplier: number;
  w1: number;
  w2: number;
  w3: number;
  apply_brand_affinity: boolean;
  apply_price_affinity: boolean;
  apply_dow: boolean;
  apply_festival: boolean;
}
