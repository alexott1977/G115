import type { Airport } from "./types";

type AirportSearchResponse = {
  items: Airport[];
  totalCount: number;
};

async function gatewayRequest<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { headers: { Accept: "application/json" }, signal });
  const payload = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) throw new Error(payload?.error ?? `Flugplatzdaten konnten nicht geladen werden (${response.status}).`);
  if (!payload) throw new Error("Das Flight-Data-Gateway lieferte keine gültige Antwort. Für lokale API-Tests bitte den Cloudflare-Worker starten.");
  return payload as T;
}

export function searchOpenAipAirports(query: string, signal?: AbortSignal) {
  return gatewayRequest<AirportSearchResponse>(`/api/airports?search=${encodeURIComponent(query)}`, signal);
}

export function getOpenAipAirport(id: string, signal?: AbortSignal) {
  return gatewayRequest<Airport>(`/api/airports/${encodeURIComponent(id)}`, signal);
}
