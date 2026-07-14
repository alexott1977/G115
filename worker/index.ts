import { normalizeOpenAipAirport, type OpenAipAirport, type OpenAipAirportList } from "../src/flight-data/openAip";
import {
  normalizeOpenMeteoCurrent,
  normalizeOpenMeteoForecast,
  type OpenMeteoCurrentResponse,
  type OpenMeteoHourlyResponse,
} from "../src/flight-data/openMeteo";
import {
  findTafPeriod,
  mergeBaseWithTaf,
  normalizeAwcMetar,
  type AwcMetar,
  type AwcTaf,
} from "../src/flight-data/aviationWeather";

type Env = {
  ASSETS: { fetch(request: Request): Promise<Response> };
  OPENAIP_API_KEY?: string;
};

type WorkerContext = {
  waitUntil(promise: Promise<unknown>): void;
};

const OPENAIP_BASE_URL = "https://api.core.openaip.net/api";
const OPEN_METEO_ICON_URL = "https://api.open-meteo.com/v1/dwd-icon";
const OPEN_METEO_ECMWF_URL = "https://api.open-meteo.com/v1/ecmwf";
const AWC_BASE_URL = "https://aviationweather.gov/api/data";
const CACHE_CONTROL = "public, max-age=300, s-maxage=3600";

function json(payload: unknown, status = 200, headers: HeadersInit = {}) {
  return Response.json(payload, {
    status,
    headers: {
      "Cache-Control": status === 200 ? CACHE_CONTROL : "no-store",
      ...headers,
    },
  });
}

async function cached(request: Request, context: WorkerContext, load: () => Promise<Response>) {
  const cache = typeof caches === "undefined" ? undefined : (caches as CacheStorage & { default?: Cache }).default;
  const cachedResponse = await cache?.match(request);
  if (cachedResponse) return cachedResponse;
  const response = await load();
  if (response.ok && cache) context.waitUntil(cache.put(request, response.clone()));
  return response;
}

async function openAip(path: string, apiKey: string) {
  return fetch(`${OPENAIP_BASE_URL}${path}`, {
    headers: {
      Accept: "application/json",
      "x-openaip-api-key": apiKey,
    },
  });
}

async function upstreamJson<T>(response: Response): Promise<T> {
  if (response.ok) return response.json() as Promise<T>;
  if (response.status === 401 || response.status === 403) throw new Error("Der OpenAIP API-Key fehlt oder ist ungültig.");
  if (response.status === 429) throw new Error("OpenAIP hat das Anfrage-Limit erreicht. Bitte später erneut versuchen.");
  throw new Error(`OpenAIP ist derzeit nicht erreichbar (${response.status}).`);
}

async function openMeteoJson<T>(response: Response): Promise<T> {
  if (response.ok) return response.json() as Promise<T>;
  if (response.status === 429) throw new Error("Open-Meteo hat das Anfrage-Limit erreicht. Bitte später erneut versuchen.");
  throw new Error(`Open-Meteo ist derzeit nicht erreichbar (${response.status}).`);
}

async function awcJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (response.ok) return response.json() as Promise<T>;
  throw new Error(`Aviation Weather Center: HTTP ${response.status}`);
}

async function fetchIconD2(
  baseParams: URLSearchParams,
  weatherVars: string,
  forecastHour: string | null,
  airportId: string | undefined,
) {
  try {
    const params = new URLSearchParams(baseParams);
    params.set("models", "icon_d2");
    if (forecastHour === null) {
      params.set("current", weatherVars);
    } else {
      params.set("hourly", weatherVars);
      params.set("start_hour", forecastHour);
      params.set("end_hour", forecastHour);
    }
    const data = await openMeteoJson<OpenMeteoHourlyResponse & OpenMeteoCurrentResponse>(
      await fetch(`${OPEN_METEO_ICON_URL}?${params}`, { headers: { Accept: "application/json" } }),
    );
    return forecastHour === null ? normalizeOpenMeteoCurrent(data, airportId) : normalizeOpenMeteoForecast(data, airportId);
  } catch {
    return null;
  }
}

async function fetchEcmwf(
  baseParams: URLSearchParams,
  weatherVars: string,
  ecmwfHour: string,
  airportId: string | undefined,
) {
  try {
    const params = new URLSearchParams(baseParams);
    params.set("hourly", weatherVars);
    params.set("start_hour", ecmwfHour);
    params.set("end_hour", ecmwfHour);
    const data = await openMeteoJson<OpenMeteoHourlyResponse>(
      await fetch(`${OPEN_METEO_ECMWF_URL}?${params}`, { headers: { Accept: "application/json" } }),
    );
    return normalizeOpenMeteoForecast(data, airportId, undefined, "ECMWF");
  } catch {
    return null;
  }
}

export function nearestForecastHour(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  date.setUTCMinutes(date.getUTCMinutes() >= 30 ? 60 : 0, 0, 0);
  return date.toISOString().slice(0, 13) + ":00";
}

export function openAipSearchVariants(search: string) {
  const variants = [
    search,
    search.normalize("NFD").replace(/\p{Diacritic}/gu, ""),
    search.replace(/ä/gi, (value) => value === "Ä" ? "Ae" : "ae")
      .replace(/ö/gi, (value) => value === "Ö" ? "Oe" : "oe")
      .replace(/ü/gi, (value) => value === "Ü" ? "Ue" : "ue")
      .replace(/ß/g, "ss"),
  ];
  return [...new Set(variants.map((value) => value.trim()).filter(Boolean))];
}

export async function handleApiRequest(request: Request, env: Env, context: WorkerContext) {
  const url = new URL(request.url);

  try {
    if (url.pathname === "/api/weather") {
      const latitude = Number(url.searchParams.get("latitude"));
      const longitude = Number(url.searchParams.get("longitude"));
      const elevationFt = Number(url.searchParams.get("elevationFt"));
      const plannedAt = url.searchParams.get("plannedAt") ?? "";
      const current = url.searchParams.get("current") === "true";
      const airportId = url.searchParams.get("airportId")?.slice(0, 64);
      const rawIcao = (url.searchParams.get("icaoCode") ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
      const icaoCode = rawIcao.length >= 3 ? rawIcao : undefined;
      const forecastHour = current ? null : nearestForecastHour(plannedAt);
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
        return json({ error: "Ungültige Koordinaten für die Wetterabfrage." }, 400);
      }
      if (!Number.isFinite(elevationFt) || elevationFt < -1500 || elevationFt > 30000) {
        return json({ error: "Ungültige Flugplatzhöhe für die Wetterabfrage." }, 400);
      }
      if (!current && !forecastHour) return json({ error: "Ungültige geplante Zeit für die Wetterabfrage." }, 400);
      return cached(request, context, async () => {
        const WEATHER_VARIABLES = "temperature_2m,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m";
        const SHORT_CACHE = { "Cache-Control": "public, max-age=60, s-maxage=300" };
        const baseParams = new URLSearchParams({
          latitude: String(latitude),
          longitude: String(longitude),
          elevation: String(Math.round(elevationFt * 0.3048)),
          wind_speed_unit: "kn",
          timezone: "GMT",
        });

        // 1. METAR — current conditions for airports with ICAO code
        if (current && icaoCode) {
          try {
            const metarData = await awcJson<AwcMetar[]>(`${AWC_BASE_URL}/metar?ids=${encodeURIComponent(icaoCode)}&format=json&hours=2`);
            const metar = normalizeAwcMetar(metarData, airportId);
            if (metar) return json(metar, 200, SHORT_CACHE);
          } catch { /* fall through */ }
        }

        // 2. TAF + base — forecast when planned time is within TAF validity
        // TAF provides wind; METAR (preferred) or model provides temperature and QNH
        if (!current && icaoCode && forecastHour) {
          try {
            const [tafSettled, metarSettled] = await Promise.allSettled([
              awcJson<AwcTaf[]>(`${AWC_BASE_URL}/taf?ids=${encodeURIComponent(icaoCode)}&format=json`),
              awcJson<AwcMetar[]>(`${AWC_BASE_URL}/metar?ids=${encodeURIComponent(icaoCode)}&format=json&hours=2`),
            ]);
            const taf = tafSettled.status === "fulfilled" ? findTafPeriod(tafSettled.value, plannedAt) : null;
            if (taf) {
              const metarBase = metarSettled.status === "fulfilled" ? normalizeAwcMetar(metarSettled.value, airportId) : null;
              const base = metarBase
                ?? await fetchIconD2(baseParams, WEATHER_VARIABLES, forecastHour, airportId)
                ?? await fetchEcmwf(baseParams, WEATHER_VARIABLES, forecastHour, airportId);
              if (base) return json(mergeBaseWithTaf(base, taf.period, taf.taf), 200, {});
            }
          } catch { /* fall through */ }
        }

        // 3. ICON-D2
        const iconForecast = await fetchIconD2(baseParams, WEATHER_VARIABLES, forecastHour, airportId);
        if (iconForecast) return json(iconForecast, 200, current ? SHORT_CACHE : {});

        // 4. ECMWF (global coverage, no current mode)
        const ecmwfHour = forecastHour ?? nearestForecastHour(new Date().toISOString());
        if (!ecmwfHour) return json({ error: "Keine Wetterdaten für die gewählte Zeit und Position verfügbar." }, 404);
        const ecmwfForecast = await fetchEcmwf(baseParams, WEATHER_VARIABLES, ecmwfHour, airportId);
        if (ecmwfForecast) return json(ecmwfForecast, 200, current ? SHORT_CACHE : {});

        return json({ error: "Keine Wetterdaten für die gewählte Zeit und Position verfügbar." }, 404);
      });
    }

    if (url.pathname === "/api/airports") {
      if (!env.OPENAIP_API_KEY) return json({ error: "OpenAIP ist noch nicht konfiguriert. Das Worker-Secret OPENAIP_API_KEY fehlt." }, 503);
      const search = url.searchParams.get("search")?.trim() ?? "";
      if (search.length < 2) return json({ error: "Bitte mindestens zwei Zeichen für die Flugplatzsuche eingeben." }, 400);
      if (search.length > 80) return json({ error: "Die Flugplatzsuche ist zu lang." }, 400);
      return cached(request, context, async () => {
        const results = await Promise.all(openAipSearchVariants(search).map(async (variant) => {
          const params = new URLSearchParams({ search: variant, searchOptLwc: "true", limit: "15" });
          return upstreamJson<OpenAipAirportList>(await openAip(`/airports?${params}`, env.OPENAIP_API_KEY!));
        }));
        const airports = results.flatMap((result) => result.items ?? []);
        const uniqueAirports = [...new Map(airports.filter((airport) => airport._id).map((airport) => [airport._id!, airport])).values()];
        const items = uniqueAirports.map(normalizeOpenAipAirport).filter((airport) => airport !== null).slice(0, 15);
        return json({ items, totalCount: items.length });
      });
    }

    const match = url.pathname.match(/^\/api\/airports\/([^/]+)$/);
    if (match) {
      if (!env.OPENAIP_API_KEY) return json({ error: "OpenAIP ist noch nicht konfiguriert. Das Worker-Secret OPENAIP_API_KEY fehlt." }, 503);
      if (!/^[a-zA-Z0-9_-]{1,64}$/.test(match[1])) return json({ error: "Ungültige Flugplatz-ID." }, 400);
      return cached(request, context, async () => {
        const airport = normalizeOpenAipAirport(await upstreamJson<OpenAipAirport>(await openAip(`/airports/${encodeURIComponent(match[1])}`, env.OPENAIP_API_KEY!)));
        return airport ? json(airport) : json({ error: "OpenAIP lieferte unvollständige Flugplatzdaten." }, 502);
      });
    }

    return json({ error: "API-Endpunkt nicht gefunden." }, 404);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Flugplatzdaten konnten nicht geladen werden." }, 502);
  }
}

export default {
  async fetch(request: Request, env: Env, context: WorkerContext) {
    if (new URL(request.url).pathname.startsWith("/api/")) return handleApiRequest(request, env, context);
    return env.ASSETS.fetch(request);
  },
};
