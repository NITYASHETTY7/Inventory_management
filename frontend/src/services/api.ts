// services/api.ts — typed API client

import type {
  PredictionRequest, PredictionResponse,
  CompareRequest,    CompareResponse,
  MspAccuracyRequest, MspAccuracyResponse,
  CuratedMspResponse,
  FestivalEntry, BrandAffinityResponse
} from '../types';

const BASE = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:8000/api';

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`);
  if (!r.ok) throw new Error(`GET ${path} → ${r.status}`);
  return r.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`POST ${path} → ${r.status}: ${err}`);
  }
  return r.json();
}

export const api = {
  getBranches: ():                          Promise<string[]>           => get('/branches'),
  getBrands:   ():                          Promise<string[]>           => get('/brands'),
  getModels:   (brand?: string, priceRange?: string): Promise<string[]> => {
    const p = new URLSearchParams();
    if (brand) p.set('brand', brand);
    if (priceRange) p.set('price_range', priceRange);
    return get(`/models${p.toString() ? `?${p.toString()}` : ''}`);
  },
  getPriceRanges: (brand?: string):         Promise<string[]>           =>
    get(`/price-ranges${brand ? `?brand=${encodeURIComponent(brand)}` : ''}`),
  predict:     (req: PredictionRequest):    Promise<PredictionResponse> => post('/predict', req),
  compare:     (req: CompareRequest):       Promise<CompareResponse>    => post('/compare', req),
  mspAccuracy: (req: MspAccuracyRequest):   Promise<MspAccuracyResponse>=> post('/msp-accuracy', req),
  curatedMsp:  (req: MspAccuracyRequest):   Promise<CuratedMspResponse> => post('/curated-msp', req),
  getPriceRangeAccuracy: (branch: string, brand: string): Promise<Record<string, number | string>> => {
    const p = new URLSearchParams();
    p.set('branch', branch);
    p.set('brand', brand);
    return get(`/price-range-accuracy?${p.toString()}`);
  },
  getFestivals: ():                         Promise<FestivalEntry[]>    => get('/festivals'),
  getBrandAffinity: (req?: Partial<MspAccuracyRequest>): Promise<BrandAffinityResponse> => {
    const p = new URLSearchParams();
    if (req?.branch) p.set('branch', req.branch);
    if (req?.brand) p.set('brand', req.brand);
    if (req?.model) p.set('model', req.model);
    if (req?.price_range) p.set('price_range', req.price_range);
    return get(`/brand-affinity${p.toString() ? `?${p.toString()}` : ''}`);
  },
  getModelAffinity: (req?: Partial<MspAccuracyRequest>): Promise<any> => {
    const p = new URLSearchParams();
    if (req?.branch) p.set('branch', req.branch);
    if (req?.brand) p.set('brand', req.brand);
    if (req?.price_range) p.set('price_range', req.price_range);
    return get(`/model-affinity${p.toString() ? `?${p.toString()}` : ''}`);
  },
  getPriceAffinity: (req?: Partial<MspAccuracyRequest>): Promise<any> => {
    const p = new URLSearchParams();
    if (req?.branch) p.set('branch', req.branch);
    if (req?.brand) p.set('brand', req.brand);
    if (req?.model) p.set('model', req.model);
    return get(`/price-affinity${p.toString() ? `?${p.toString()}` : ''}`);
  },
  getAsmData: (): Promise<any[]> => get('/asm'),
};
