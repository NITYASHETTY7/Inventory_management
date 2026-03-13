import {
  AsmShuffleResult,
  HubShuffleTransfer,
  CrossAsmOpportunity,
  BranchShuffleSummary,
  AsmGroup,
  StorePosition,
} from "../types/shuffle_types";

const BASE_URL = (import.meta as any).env?.VITE_API_URL ?? "http://localhost:8000/api";

export const fetchAsmShuffle = async (
  requestingBranch: string,
  imCode: string,
  brand: string,
  mspPredictions: Record<string, Record<string, number>>
): Promise<AsmShuffleResult> => {
  const response = await fetch(`${BASE_URL}/shuffle/asm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requesting_branch: requestingBranch,
      im_code: imCode,
      brand,
      msp_predictions: mspPredictions,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to fetch ASM shuffle: ${err}`);
  }

  return response.json();
};

export const fetchHubShuffle = async (
  imCode: string,
  brand: string,
  mspPredictions: Record<string, Record<string, number>>
): Promise<{ recommendations: HubShuffleTransfer[]; total_transfers: number }> => {
  const response = await fetch(`${BASE_URL}/shuffle/hub`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      im_code: imCode,
      brand,
      msp_predictions: mspPredictions,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to fetch Hub shuffle: ${err}`);
  }

  return response.json();
};

export const fetchCrossAsmXmc = async (
  lookbackDays: number = 30
): Promise<{ opportunities: CrossAsmOpportunity[]; count: number }> => {
  const response = await fetch(`${BASE_URL}/shuffle/cross-asm-xmc?lookback_days=${lookbackDays}`);

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to fetch Cross-ASM XMC: ${err}`);
  }

  return response.json();
};

export const fetchBranchShuffleSummary = async (
  branch: string,
  lookbackDays: number = 30
): Promise<BranchShuffleSummary> => {
  const response = await fetch(
    `${BASE_URL}/shuffle/branch-summary?branch=${encodeURIComponent(branch)}&lookback_days=${lookbackDays}`
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to fetch Branch Shuffle Summary: ${err}`);
  }

  return response.json();
};

export const fetchAsmMap = async (): Promise<{ asms: AsmGroup[] }> => {
  const response = await fetch(`${BASE_URL}/shuffle/asm-map`);

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to fetch ASM Map: ${err}`);
  }

  return response.json();
};

export const fetchStorePositions = async (
  branches: string[],
  imCode: string,
  brand: string,
  mspPredictions: Record<string, Record<string, number>>
): Promise<{ positions: StorePosition[] }> => {
  const response = await fetch(`${BASE_URL}/shuffle/positions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      branches,
      im_code: imCode,
      brand,
      msp_predictions: mspPredictions,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to fetch Store Positions: ${err}`);
  }

  return response.json();
};
