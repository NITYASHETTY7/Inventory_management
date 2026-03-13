export interface AsmShuffleResult {
  requesting_branch: string;
  im_code: string;
  brand: string;
  shortage: number;
  asm_name: string;
  peer_positions: StorePosition[];
  recommendations: ShuffleDonor[];
  total_coverable: number;
  remaining_after_shuffle: number;
  coverage_pct: number;
  shuffle_level: "ASM";
}

export interface ShuffleDonor {
  donor_branch: string;
  donor_stock: number;
  donor_msp: number;
  donor_excess: number;
  suggested_transfer: number;
}

export interface HubShuffleTransfer {
  hub_name: string;
  from_branch: string;
  to_branch: string;
  im_code: string;
  brand: string;
  transfer_qty: number;
  from_stock: number;
  from_msp: number;
  from_excess: number;
  to_shortage: number;
  to_msp: number;
  shuffle_level: "HUB";
}

export interface CrossAsmOpportunity {
  ymc_branch: string;
  xmc_branch: string;
  im_code: string;
  brand: string;
  item_model: string;
  ymc_avg_daily: number;
  xmc_avg_daily: number;
  ymc_stock: number;
  ymc_asm: string;
  xmc_asm: string;
  is_cross_asm: boolean;
  priority_score: number;
  recommended_transfer: number;
  action_label: string;
}

export interface StorePosition {
  branch: string;
  msp_20d: number;
  current_stock: number;
  position: number;
  excess: number;
  shortage: number;
  velocity_class: "XMC" | "NORMAL" | "YMC";
  avg_daily: number;
}

export interface ModelPosition extends StorePosition {
  im_code: string;
  brand: string;
  item_model: string;
}

export interface BranchShuffleSummary {
  branch: string;
  asm_name: string;
  hub_name: string;
  total_models: number;
  models_with_excess: number;
  models_with_shortage: number;
  total_excess_units: number;
  total_shortage_units: number;
  model_positions: ModelPosition[];
  top_donations: ModelPosition[];
  top_needs: ModelPosition[];
}

export interface AsmGroup {
  asm_name: string;
  hub_name: string;
  branches: string[];
}
