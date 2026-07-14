import type { WeatherForecast } from "./types";

async function weatherGatewayRequest(path: string, signal?: AbortSignal): Promise<WeatherForecast> {
  const response = await fetch(path, { headers: { Accept: "application/json" }, signal });
  const payload = await response.json().catch(() => null) as WeatherForecast | { error?: string } | null;
  if (!response.ok) throw new Error(payload && "error" in payload ? payload.error : `Wetterdaten konnten nicht geladen werden (${response.status}).`);
  if (!payload || !("validAt" in payload)) throw new Error("Das Flight-Data-Gateway lieferte keine gültigen Wetterdaten.");
  return payload;
}

export function getOpenMeteoWeather(
  latitude: number,
  longitude: number,
  elevationFt: number,
  plannedAt: string,
  current: boolean,
  options?: { airportId?: string; icaoCode?: string; signal?: AbortSignal },
) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    elevationFt: String(elevationFt),
    plannedAt,
    current: String(current),
  });
  if (options?.airportId) params.set("airportId", options.airportId);
  if (options?.icaoCode) params.set("icaoCode", options.icaoCode);
  return weatherGatewayRequest(`/api/weather?${params}`, options?.signal);
}
