import {
  OtbTableResponse,
  OtbModelInput,
  StockItem,
  AllocationRankedStore,
  StaggeredDay,
} from "../types/otb_types";

const BASE_URL = (import.meta as any).env?.VITE_API_URL ?? "http://localhost:8000/api";

export const fetchOtbTable = async (
  branch: string,
  mspByModel: OtbModelInput[]
): Promise<OtbTableResponse> => {
  const response = await fetch(`${BASE_URL}/otb/calculate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      branch,
      msp_by_model: mspByModel,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to fetch OTB table: ${err}`);
  }

  return response.json();
};

export const fetchStockSnapshot = async (
  branch: string
): Promise<{ branch: string; items: StockItem[] }> => {
  const response = await fetch(`${BASE_URL}/otb/stock-snapshot?branch=${encodeURIComponent(branch)}`);

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to fetch stock snapshot: ${err}`);
  }

  return response.json();
};

export const fetchAllocationRank = async (
  modelName: string,
  brand: string
): Promise<{ model_name: string; brand: string; ranked_stores: AllocationRankedStore[] }> => {
  const response = await fetch(
    `${BASE_URL}/otb/allocation-rank?model_name=${encodeURIComponent(modelName)}&brand=${encodeURIComponent(brand)}`
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to fetch allocation rank: ${err}`);
  }

  return response.json();
};

export const fetchStaggerSchedule = async (
  totalUnits: number,
  budgetCrore: number,
  staggerDays: number
): Promise<{ schedule: StaggeredDay[] }> => {
  const response = await fetch(`${BASE_URL}/otb/stagger-schedule`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      total_units: totalUnits,
      total_budget_crore: budgetCrore,
      stagger_days: staggerDays,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to fetch stagger schedule: ${err}`);
  }

  return response.json();
};
