import {
  LookalikeMspRequest,
  LookalikeMspResult,
  LookalikeSuggestion,
  ModelCatalogItem,
  StoreProximitySuggestion
} from '../types/lookalike_types';

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

export const fetchModelCatalog = async (): Promise<ModelCatalogItem[]> => {
  const res = await fetch(`${BASE_URL}/lookalike/model-catalog`);
  if (!res.ok) throw new Error("Failed to fetch model catalog");
  return res.json();
};

export const suggestLookalikes = async (params: {
  target_im_code: string;
  target_brand: string;
  target_mop: number;
  top_n?: number;
  scenario?: string;
  price_band_tolerance?: number;
}): Promise<LookalikeSuggestion[]> => {
  const res = await fetch(`${BASE_URL}/lookalike/suggest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error("Failed to get suggestions");
  return res.json();
};

export const suggestStoreProximity = async (params: {
  new_branch_lat: number;
  new_branch_lon: number;
  top_n?: number;
  max_radius_km?: number;
}): Promise<StoreProximitySuggestion[]> => {
  const res = await fetch(`${BASE_URL}/lookalike/store-suggest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error("Failed to get store suggestions");
  return res.json();
};


export const computeLookalikeMsp = async (
  request: LookalikeMspRequest
): Promise<LookalikeMspResult> => {
  const res = await fetch(`${BASE_URL}/lookalike/compute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error("Failed to compute lookalike MSP");
  return res.json();
};

export const sendToOtb = async (params: {
  lookalike_result: LookalikeMspResult;
  asm_name: string;
  prediction_date?: string;  // ← ADD THIS
}): Promise<any> => {
  const res = await fetch(`${BASE_URL}/lookalike/send-to-otb`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error("Failed to send to OTB engine");
  return res.json();
};
