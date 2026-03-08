/**
 * Centralized API client for AI World War server.
 * Uses /api/ routes (v18 compatibility layer on the server).
 */

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || '';

export function getServerUrl(): string {
  return SERVER_URL;
}

export function isServerAvailable(): boolean {
  return SERVER_URL.length > 0;
}

interface FetchOptions extends RequestInit {
  token?: string;
}

/**
 * Fetch wrapper that prepends SERVER_URL and handles JSON.
 * Returns null on network/server errors (graceful degradation).
 */
export async function apiFetch<T>(path: string, opts: FetchOptions = {}): Promise<T | null> {
  const { token, ...fetchOpts } = opts;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${SERVER_URL}${path}`, { ...fetchOpts, headers });
    if (!res.ok) return null;
    return await res.json() as T;
  } catch {
    return null;
  }
}

// ── Domain-specific fetchers ──

export interface FactionSummary {
  id: string;
  name: string;
  tag: string;
  color: string;
  banner_url: string;
  leader_id: string;
  prestige: number;
  member_count: number;
  territory_count?: number;
  total_gdp?: number;
}

export async function fetchFactions(): Promise<FactionSummary[]> {
  const data = await apiFetch<{ factions: FactionSummary[] }>('/api/factions');
  return data?.factions ?? [];
}

export async function fetchFaction(id: string): Promise<FactionSummary | null> {
  return apiFetch<FactionSummary>(`/api/factions/${id}`);
}

export interface HofCategory {
  key: string;
  label: string;
}

export interface HofRecord {
  category: string;
  holder: string;
  faction: string;
  value: number;
  season: number;
}

export interface HofSeason {
  number: number;
  name: string;
  start: string;
  end: string;
  winner: string;
}

export async function fetchHofCategories(): Promise<HofCategory[]> {
  const data = await apiFetch<{ categories: HofCategory[] }>('/api/hall-of-fame/categories');
  return data?.categories ?? [];
}

export async function fetchHofRecords(season?: number): Promise<HofRecord[]> {
  const q = season != null ? `?season=${season}` : '';
  const data = await apiFetch<{ records: HofRecord[] }>(`/api/hall-of-fame${q}`);
  return data?.records ?? [];
}

export async function fetchHofSeasons(): Promise<HofSeason[]> {
  const data = await apiFetch<{ seasons: HofSeason[] }>('/api/hall-of-fame/seasons');
  return data?.seasons ?? [];
}

export interface CountryEconomy {
  iso3: string;
  gdp: number;
  sovereign_faction?: string;
  sovereignty_level: number;
}

export async function fetchCountries(): Promise<CountryEconomy[]> {
  const data = await apiFetch<{ countries: CountryEconomy[] }>('/api/countries');
  return data?.countries ?? [];
}
