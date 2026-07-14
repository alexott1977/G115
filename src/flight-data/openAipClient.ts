import { normalizeOpenAipAirport, type OpenAipAirport, type OpenAipAirportList } from "./openAip";
import { getOpenAipApiKey } from "./openAipKey";
import { openAipSearchVariants } from "./openAipSearch";
import type { Airport } from "./types";

type AirportSearchResponse = {
  items: Airport[];
  totalCount: number;
};

const OPENAIP_BASE_URL = "https://api.core.openaip.net/api";

async function gatewayRequest<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { headers: { Accept: "application/json" }, signal });
  const payload = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) throw new Error(payload?.error ?? `Flugplatzdaten konnten nicht geladen werden (${response.status}).`);
  if (!payload) throw new Error("Das Flight-Data-Gateway lieferte keine gültige Antwort. Für lokale API-Tests bitte den Cloudflare-Worker starten.");
  return payload as T;
}

async function openAipDirect<T>(path: string, apiKey: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${OPENAIP_BASE_URL}${path}`, {
    headers: { Accept: "application/json", "x-openaip-api-key": apiKey },
    signal,
  });
  if (response.ok) return response.json() as Promise<T>;
  if (response.status === 401 || response.status === 403) throw new Error("Der OpenAIP API-Key fehlt oder ist ungültig.");
  if (response.status === 429) throw new Error("OpenAIP hat das Anfrage-Limit erreicht. Bitte später erneut versuchen.");
  throw new Error(`OpenAIP ist derzeit nicht erreichbar (${response.status}).`);
}

async function searchDirect(apiKey: string, query: string, signal?: AbortSignal): Promise<AirportSearchResponse> {
  const results = await Promise.all(openAipSearchVariants(query).map(async (variant) => {
    const params = new URLSearchParams({ search: variant, searchOptLwc: "true", limit: "15" });
    return openAipDirect<OpenAipAirportList>(`/airports?${params}`, apiKey, signal);
  }));
  const airports = results.flatMap((result) => result.items ?? []);
  const uniqueAirports = [...new Map(airports.filter((airport) => airport._id).map((airport) => [airport._id!, airport])).values()];
  const items = uniqueAirports.map(normalizeOpenAipAirport).filter((airport): airport is Airport => airport !== null).slice(0, 15);
  return { items, totalCount: items.length };
}

export function searchOpenAipAirports(query: string, signal?: AbortSignal) {
  const apiKey = getOpenAipApiKey();
  if (apiKey) return searchDirect(apiKey, query, signal);
  return gatewayRequest<AirportSearchResponse>(`/api/airports?search=${encodeURIComponent(query)}`, signal);
}

export async function getOpenAipAirport(id: string, signal?: AbortSignal) {
  const apiKey = getOpenAipApiKey();
  if (apiKey) {
    const airport = normalizeOpenAipAirport(await openAipDirect<OpenAipAirport>(`/airports/${encodeURIComponent(id)}`, apiKey, signal));
    if (!airport) throw new Error("OpenAIP lieferte unvollständige Flugplatzdaten.");
    return airport;
  }
  return gatewayRequest<Airport>(`/api/airports/${encodeURIComponent(id)}`, signal);
}
