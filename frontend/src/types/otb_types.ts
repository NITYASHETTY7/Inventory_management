export interface OtbRow {
  branch: string;
  brand: string;
  im_code: string;
  item_model: string;
  msp_20d: number;
  current_stock: number;
  raw_otb: number;
  shuffle_reduction: number;
  effective_otb: number;
  needs_purchase: boolean;
  donor_detail: Array<{
    branch: string;
    excess: number;
    suggested_transfer: number;
  }>;
}

export interface OtbSummary {
  total_models: number;
  models_needing_po: number;
  total_raw_otb: number;
  total_shuffle_reduction: number;
  total_effective_otb: number;
}

export interface OtbTableResponse {
  branch: string;
  otb_table: OtbRow[];
  summary: OtbSummary;
}

export interface AllocationRankedStore {
  branch: string;
  total_sold: number;
  avg_daily: number;
  sell_through_rank: number;
}

export interface StaggeredDay {
  day: number;
  units_to_order: number;
  budget_crore: number;
  cumulative_units: number;
}

export interface OtbModelInput {
  brand: string;
  im_code: string;
  item_model: string;
  msp_20d: number;
}

export interface StockItem {
  im_code: string;
  brand: string;
  item_model: string;
  quantity: number;
}
