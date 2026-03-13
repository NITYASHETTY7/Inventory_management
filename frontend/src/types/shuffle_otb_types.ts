export interface AsmGroup {
  asm_name: string;
  branches: string[];
  hub_name: string;
}

export interface ModelOption {
  im_code: string;
  item_model: string;
  brand: string;
  display_label: string;
}

export interface BranchPosition {
  branch: string;
  closing_stock: number;
  msp_20d: number;
  position: number;
  excess: number;
  shortage: number;
  status: "EXCESS" | "SHORTAGE" | "BALANCED";
}

export interface ShuffleTransfer {
  from_branch: string;
  to_branch: string;
  quantity: number;
  distance_km: number;
  drive_minutes: number;
  urgency: "CRITICAL" | "HIGH" | "NORMAL";
}

export interface PostShufflePosition {
  branch: string;
  closing_stock: number;
  msp_20d: number;
  original_shortage: number;
  shuffle_in: number;
  shuffle_out: number;
  effective_shortage: number;
  effective_otb: number;
  needs_purchase: boolean;
}

export interface ShuffleEdgeCases {
  all_shortage: boolean;
  all_excess: boolean;
  no_shuffle_possible: boolean;
  warning_message: string;
}

export interface ShuffleSummary {
  total_shortage_before: number;
  total_coverable_by_shuffle: number;
  total_effective_otb: number;
  total_transfers: number;
  total_units_moving: number;
}

export interface ShuffleRunResult {
  asm_name: string;
  brand: string;
  im_code: string;
  item_model: string;
  prediction_date: string;
  closing_stock_date_used: string;
  branches_in_asm: string[];
  msp_by_branch: Record<string, number>;
  closing_stocks: Record<string, number>;
  positions: BranchPosition[];
  shuffle_result: {
    transfers: ShuffleTransfer[];
    post_shuffle_positions: PostShufflePosition[];
    edge_cases: ShuffleEdgeCases;
    summary: ShuffleSummary;
  };
  otb_summary: {
    total_raw_otb: number;
    total_shuffle_reduction: number;
    total_effective_otb: number;
    branches_needing_po: Array<{ branch: string; effective_otb: number }>;
    po_to_manufacturer: number;
  };
}

export interface OtbRunResult {
  asm_name: string;
  brand: string;
  im_code: string;
  prediction_date: string;
  closing_stock_date_used: string;
  otb_table: PostShufflePosition[];
  otb_summary: ShuffleRunResult["otb_summary"];
  transfers: ShuffleTransfer[];
}

export interface AllocationRankedStore {
  branch: string;
  total_sold: number;
  avg_daily: number;
  rank: number;
  sell_through_rank?: number;
}

export interface MspWeights {
  w1: number;
  w2: number;
  w3: number;
  apply_brand_affinity: boolean;
  apply_price_affinity: boolean;
  apply_dow: boolean;
  apply_festival: boolean;
}
