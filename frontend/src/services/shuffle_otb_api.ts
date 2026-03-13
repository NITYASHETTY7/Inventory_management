import {
  AsmGroup,
  ModelOption,
  ShuffleRunResult,
  OtbRunResult,
  AllocationRankedStore,
} from "../types/shuffle_otb_types";

const BASE_URL = (import.meta as any).env?.VITE_API_URL ?? "http://localhost:8000/api";

export const fetchAsmList = async (): Promise<AsmGroup[]> => {
  const res = await fetch(`${BASE_URL}/shuffle/asm-list`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const fetchStockDates = async (): Promise<{ dates: string[] }> => {
  const res = await fetch(`${BASE_URL}/shuffle/stock-dates`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const fetchModelsForAsm = async (
  asmName: string,
  predictionDate: string
): Promise<ModelOption[]> => {
  const res = await fetch(
    `${BASE_URL}/shuffle/models?asm_name=${encodeURIComponent(asmName)}&prediction_date=${encodeURIComponent(predictionDate)}`
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export interface RunShuffleParams {
  asm_name: string;
  brand: string;
  im_code: string;
  prediction_date: string;
  w1: number;
  w2: number;
  w3: number;
  apply_brand_affinity: boolean;
  apply_price_affinity: boolean;
  apply_dow: boolean;
  apply_festival: boolean;
}

export const runShuffle = async (params: RunShuffleParams): Promise<ShuffleRunResult> => {
  const res = await fetch(`${BASE_URL}/shuffle/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const runOtb = async (params: RunShuffleParams): Promise<OtbRunResult> => {
  const res = await fetch(`${BASE_URL}/otb/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

// Also reuse allocation rank if needed here or keep it from otb_api
export const fetchAllocationRank = async (
  modelName: string,
  brand: string
): Promise<{ ranked_stores: AllocationRankedStore[] }> => {
  const res = await fetch(
    `${BASE_URL}/otb/allocation-rank?model_name=${encodeURIComponent(modelName)}&brand=${encodeURIComponent(brand)}`
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};
