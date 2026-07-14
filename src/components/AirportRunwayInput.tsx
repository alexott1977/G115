import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useFlightPlan } from "../app/FlightPlanContext";
import {
  calculateWindComponents,
  getOpenAipAirport,
  getOpenMeteoWeather,
  searchOpenAipAirports,
  type Airport,
  type RunwayDirection,
  type WeatherForecast,
} from "../flight-data";

export type AirportRunwayValues = {
  elevationFt?: number;
  qnhHpa?: number;
  oatC?: number;
  windKt?: number;
};
type WeatherRunwayValues = Required<Omit<AirportRunwayValues, "elevationFt">>;

type AirportRunwayOperation = "departure" | "arrival";

function formatDirection(value: number) {
  return Math.round(value).toString().padStart(3, "0");
}

export function utcDateTimeValue(value?: string) {
  return (value ? new Date(value) : new Date()).toISOString().slice(0, 16);
}

export function utcDateTimeIso(value: string) {
  return new Date(`${value}:00Z`).toISOString();
}

function AirportPreviewValue({ label, value, unit, status }: Readonly<{ label: string; value: string | number; unit?: string; status?: "good" | "warn" }>) {
  const valueClass = status ? `airport-preview-value ${status}` : "airport-preview-value";
  return (
    <div className="airport-preview-item">
      <span className="airport-preview-label">{label}</span>
      <strong className={valueClass}>
        {value}{unit ? <span className="airport-preview-unit">{unit}</span> : null}
      </strong>
    </div>
  );
}

function RunwayHeadingPreview({ runway }: Readonly<{ runway: RunwayDirection }>) {
  return (
    <div className="airport-preview-item airport-heading-combined">
      <div className="airport-heading-pair">
        <span>
          <span className="airport-preview-label">RWY TRUE</span>
          <strong className="airport-preview-value">{formatDirection(runway.trueHeadingDeg)}°</strong>
        </span>
        <span>
          <span className="airport-preview-label">MAG</span>
          <strong className="airport-preview-value">{formatDirection(runway.magneticHeadingDeg)}°</strong>
        </span>
      </div>
    </div>
  );
}

function LoadingIndicator({ active, label }: Readonly<{ active: boolean; label: string }>) {
  return (
    <span className={`airport-loading-indicator${active ? "" : " idle"}`} aria-hidden={!active} aria-label={active ? label : undefined}>
      <RefreshCw aria-hidden="true" />
    </span>
  );
}

function runwayLabel(runway: RunwayDirection) {
  return `RWY ${runway.designator} · ${runway.lengthM} m · ${runway.surface}`;
}

function waitForRetry(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function weatherValuesForRunway(weather: WeatherForecast, runway: RunwayDirection): WeatherRunwayValues {
  const wind = calculateWindComponents(weather.windDirectionTrueDeg, weather.windSpeedKt, runway.trueHeadingDeg);
  return {
    qnhHpa: Math.round(weather.qnhHpa),
    oatC: Math.round(weather.temperatureC),
    windKt: Math.round(wind.headwindKt),
  };
}

function buildWeatherTitle(weather: WeatherForecast | null, weatherNow: boolean, weatherLoading: boolean): string {
  if (!weather) return weatherLoading ? "Wetterdaten werden geladen…" : "Keine Wetterdaten verfügbar";
  const modeLabel = weatherNow ? `Aktuelle ${weather.source.model}-Werte` : `${weather.source.model}-Prognose`;
  const timeStr = new Date(weather.validAt).toLocaleString("de-DE", { timeZone: "UTC", dateStyle: "short", timeStyle: "short" });
  return `${modeLabel} · ${timeStr} UTC`;
}

function windStatus(good: boolean | null): "good" | "warn" | undefined {
  if (good === null) return undefined;
  return good ? "good" : "warn";
}

export function AirportRunwayInput({
  operation,
  enabled,
  weatherNow,
  onEnabledChange,
  onWeatherNowChange,
  onApply,
  onAirportChange,
  onRunwayChange,
  onWeatherValuesChange,
}: Readonly<{
  operation: AirportRunwayOperation;
  enabled: boolean;
  weatherNow: boolean;
  onEnabledChange: (enabled: boolean) => void;
  onWeatherNowChange: (enabled: boolean) => void;
  onApply: (values: AirportRunwayValues) => void;
  onAirportChange?: (airport?: Airport) => void;
  onRunwayChange?: (runway?: RunwayDirection) => void;
  onWeatherValuesChange?: (values?: WeatherRunwayValues) => void;
}>) {
  const { flightPlan, updateArrival, updateDeparture } = useFlightPlan();
  const savedSelection = operation === "departure" ? flightPlan.departure : flightPlan.arrival;
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Airport[]>([]);
  const [airport, setAirport] = useState<Airport | null>(null);
  const [runwayId, setRunwayId] = useState(savedSelection?.runwayId ?? "");
  const [plannedAt, setPlannedAt] = useState(utcDateTimeValue(savedSelection?.plannedAt));
  const [loading, setLoading] = useState(Boolean(savedSelection?.airportId));
  const [error, setError] = useState("");
  const [weather, setWeather] = useState<WeatherForecast | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState("");
  const [weatherReloadKey, setWeatherReloadKey] = useState(0);
  const weatherRequestId = useRef(0);
  const autoImportSuppressedKey = useRef<string | null>(null);
  const autoImportRequested = useRef(false);

  useEffect(() => {
    if (!savedSelection?.airportId) return;
    const controller = new AbortController();
    getOpenAipAirport(savedSelection.airportId, controller.signal)
      .then((loadedAirport) => {
        setAirport(loadedAirport);
        setResults([loadedAirport]);
        setRunwayId(loadedAirport.runways.some((runway) => runway.id === savedSelection.runwayId)
          ? savedSelection.runwayId
          : loadedAirport.runways[0]?.id ?? "");
      })
      .catch((loadError) => {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        setError(loadError instanceof Error ? loadError.message : "Gespeicherter Flugplatz konnte nicht geladen werden.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [savedSelection?.airportId, savedSelection?.runwayId]);

  const runway = airport?.runways?.find((candidate) => candidate.id === runwayId) ?? airport?.runways?.[0];
  const windComponents = weather && runway
    ? calculateWindComponents(weather.windDirectionTrueDeg, weather.windSpeedKt, runway.trueHeadingDeg)
    : null;
  const weatherValues = useMemo(
    () => weather && runway ? weatherValuesForRunway(weather, runway) : null,
    [runway?.id, weather?.id],
  );
  const weatherTitle = buildWeatherTitle(weather, weatherNow, weatherLoading);
  const headwindStatus = windStatus(windComponents ? windComponents.headwindKt >= 0 : null);
  const crosswindStatus = windStatus(windComponents ? Math.abs(windComponents.crosswindKt) < 10 : null);
  const headwindCode = windComponents && windComponents.headwindKt < 0 ? "TW" : "HW";
  const autoImportKey = airport && runway && plannedAt && weatherValues && weather
    ? `${airport.id}|${runway.id}|${plannedAt}|${weather.id}`
    : null;

  const saveSelection = (selectedAirport: Airport, selectedRunway: RunwayDirection, selectedPlannedAt: string) => {
    const selection = {
      airportId: selectedAirport.id,
      runwayId: selectedRunway.id,
      plannedAt: utcDateTimeIso(selectedPlannedAt),
    };
    if (operation === "departure") updateDeparture(selection);
    else updateArrival(selection);
  };

  useEffect(() => {
    if (!enabled || !airport || !runway || !plannedAt) return;
    onApply({ elevationFt: airport.elevationFt });
    saveSelection(airport, runway, plannedAt);
  }, [airport?.id, enabled, plannedAt, runway?.id]);

  useEffect(() => {
    onAirportChange?.(airport ?? undefined);
    onRunwayChange?.(runway);
    onWeatherValuesChange?.(weatherValues ?? undefined);
  }, [airport, onAirportChange, onRunwayChange, onWeatherValuesChange, runway, weatherValues]);

  useEffect(() => {
    if (!autoImportKey || enabled || autoImportSuppressedKey.current === autoImportKey || !autoImportRequested.current) return;
    autoImportRequested.current = false;
    onEnabledChange(true);
  }, [autoImportKey, enabled, onEnabledChange]);

  useEffect(() => {
    if (!enabled || !weatherValues) return;
    onApply(weatherValues);
    if (airport && runway && plannedAt) saveSelection(airport, runway, plannedAt);
  }, [weather?.id, enabled, runway?.id]);

  useEffect(() => {
    if (!airport || !plannedAt) {
      weatherRequestId.current += 1;
      setWeather(null);
      setWeatherLoading(false);
      return;
    }
    const controller = new AbortController();
    const requestId = weatherRequestId.current + 1;
    weatherRequestId.current = requestId;
    setWeatherLoading(true);
    setWeatherError("");
    const loadWeather = async () => {
      let lastError: unknown;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const loadedWeather = await getOpenMeteoWeather(
            airport.coordinates.latitude,
            airport.coordinates.longitude,
            airport.elevationFt,
            utcDateTimeIso(plannedAt),
            weatherNow,
            { airportId: airport.id, icaoCode: airport.icaoCode, signal: controller.signal },
          );
          if (weatherRequestId.current !== requestId) return;
          setWeather(loadedWeather);
          setWeatherLoading(false);
          return;
        } catch (loadError) {
          if (weatherRequestId.current !== requestId) return;
          if (loadError instanceof DOMException && loadError.name === "AbortError") return;
          if (controller.signal.aborted) return;
          lastError = loadError;
          if (attempt === 0) await waitForRetry(700);
        }
      }
      if (weatherRequestId.current !== requestId) return;
      setWeather(null);
      setWeatherError(lastError instanceof Error ? lastError.message : "Wetterdaten konnten nicht geladen werden.");
      setWeatherLoading(false);
    };
    void loadWeather();
    return () => controller.abort();
  }, [airport?.id, plannedAt, weatherNow, weatherReloadKey]);

  const submitSearch = async (event: { preventDefault(): void }) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await searchOpenAipAirports(search);
      setResults(response.items);
      const selected = response.items[0] ?? null;
      setWeather(null);
      setAirport(selected);
      setRunwayId(selected?.runways[0]?.id ?? "");
      if (selected) {
        autoImportRequested.current = true;
        autoImportSuppressedKey.current = null;
        setWeatherReloadKey((current) => current + 1);
      }
      if (selected) setSearch("");
      else setError("Kein passender Flugplatz gefunden.");
    } catch (searchError) {
      setResults([]);
      setAirport(null);
      setRunwayId("");
      setError(searchError instanceof Error ? searchError.message : "Flugplatzsuche fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  };

  const selectAirport = (airportId: string) => {
    const selected = results.find((candidate) => candidate.id === airportId) ?? null;
    setWeather(null);
    setAirport(selected);
    setRunwayId(selected?.runways[0]?.id ?? "");
    autoImportRequested.current = Boolean(selected);
    autoImportSuppressedKey.current = null;
    setWeatherReloadKey((current) => current + 1);
  };

  const updateRunwayId = (nextRunwayId: string) => {
    setRunwayId(nextRunwayId);
    autoImportRequested.current = true;
    autoImportSuppressedKey.current = null;
  };

  const updatePlannedAt = (nextPlannedAt: string) => {
    setPlannedAt(nextPlannedAt);
    autoImportRequested.current = true;
    autoImportSuppressedKey.current = null;
  };

  const toggleImport = (nextEnabled: boolean) => {
    if (!nextEnabled) autoImportSuppressedKey.current = autoImportKey;
    else autoImportSuppressedKey.current = null;
    onEnabledChange(nextEnabled);
    if (nextEnabled) {
      if (airport && runway && plannedAt) {
        onApply({ elevationFt: airport.elevationFt });
        saveSelection(airport, runway, plannedAt);
      }
      if (weatherValues) onApply(weatherValues);
    }
  };

  return (
    <div className="airport-input">
      <form className="airport-search" onSubmit={submitSearch}>
        <label className="airport-field">
          <span>Flugplatzsuche</span>
          <input
            type="search"
            value={search}
            minLength={2}
            required
            autoCapitalize="characters"
            placeholder="ICAO oder Name"
            onChange={(event) => setSearch(event.target.value.toLocaleUpperCase("de-DE"))}
          />
        </label>
        <button type="submit" disabled={loading}>
          <span>Suchen</span>
        </button>
        <span className={`airport-search-status${loading ? " active" : ""}`} aria-live="polite">
          <LoadingIndicator active={loading} label="Flugplatzsuche läuft" />
          <span>Flugplatzdaten werden geladen…</span>
        </span>
      </form>
      {error ? <div className="airport-status error">{error}</div> : null}
      {!airport ? (
        <div className="airport-empty-state">
          <label className="airport-field">
            <span>Flugplatz</span>
            <input type="text" value="Noch kein Flugplatz ausgewählt" disabled readOnly />
          </label>
          <label className="airport-field">
            <span>{operation === "departure" ? "Startbahn" : "Landebahn"}</span>
            <input type="text" value="Keine Bahn ausgewählt" disabled readOnly />
          </label>
          <div className="airport-time">
            <div className="airport-field-label">Geplante {operation === "departure" ? "Startzeit" : "Landezeit"} · UTC · 24 h</div>
            <div className="airport-time-row">
              <span className="airport-datetime-control">
                <input type="date" lang="de-DE" value={plannedAt.slice(0, 10)} disabled={weatherNow} readOnly />
                <input type="time" lang="de-DE" value={plannedAt.slice(11)} disabled={weatherNow} readOnly />
              </span>
              <label className="import-toggle airport-now-toggle">
                <input type="checkbox" checked={weatherNow} onChange={(event) => onWeatherNowChange(event.target.checked)} />
                <span>Jetzt</span>
              </label>
            </div>
          </div>
          <div className="airport-preview">
            <AirportPreviewValue label="Elevation" value="–" />
            <div className="airport-preview-item airport-heading-combined">
              <div className="airport-heading-pair">
                <span>
                  <span className="airport-preview-label">RWY TRUE</span>
                  <strong className="airport-preview-value">–</strong>
                </span>
                <span>
                  <span className="airport-preview-label">MAG</span>
                  <strong className="airport-preview-value">–</strong>
                </span>
              </div>
            </div>
            <AirportPreviewValue label="Bahnlänge" value="–" />
          </div>
          <div className="airport-declared-distances" aria-label="Verfügbare Pistenstrecken">
            <div className="airport-preview-item airport-declared-combined">
              <div>
                <span className="airport-preview-label">TORA</span>
                <strong className="airport-preview-value">–</strong>
              </div>
              <div>
                <span className="airport-preview-label">TODA</span>
                <strong className="airport-preview-value">–</strong>
              </div>
            </div>
            <AirportPreviewValue label="LDA" value="–" />
          </div>
          <div className="airport-weather airport-weather--loading">
            <div className="airport-weather-title">
              <LoadingIndicator active={false} label="Wetterdaten werden geladen" />
              <span>Wetterdaten nach Flugplatzauswahl</span>
            </div>
            <div className="airport-weather-basics">
              <AirportPreviewValue label="QNH" value="–" />
              <AirportPreviewValue label="OAT" value="–" />
            </div>
            <div className="airport-wind-compact">
              <div className="airport-wind-main">
                <span className="airport-preview-label">Wind true</span>
                <strong className="airport-preview-value">–</strong>
              </div>
              <div className="airport-wind-components">
                <div>
                  <span className="airport-preview-label">HW</span>
                  <strong className="airport-preview-value">–</strong>
                </div>
                <div>
                  <span className="airport-preview-label">XW</span>
                  <strong className="airport-preview-value">–</strong>
                </div>
              </div>
            </div>
          </div>
          <div className="airport-sources airport-sources--placeholder">
            OpenAIP und Wetterdaten werden nach Flugplatzauswahl angezeigt.
          </div>
          <div className="airport-imports">
            <label className="import-toggle airport-import-toggle">
              <input type="checkbox" checked={false} disabled onChange={() => undefined} />
              <span>Werte übernehmen</span>
            </label>
          </div>
        </div>
      ) : null}
      {airport ? (
        <>
          <label className="airport-field">
            <span>Flugplatz</span>
            <select value={airport.id} onChange={(event) => selectAirport(event.target.value)}>
              {results.map((candidate) => <option value={candidate.id} key={candidate.id}>{candidate.icaoCode ? `${candidate.icaoCode} · ` : ""}{candidate.name}</option>)}
            </select>
          </label>
          <label className="airport-field">
            <span>{operation === "departure" ? "Startbahn" : "Landebahn"}</span>
            <select value={runway?.id ?? ""} disabled={!airport.runways.length} onChange={(event) => updateRunwayId(event.target.value)}>
              {airport.runways.map((candidate) => <option value={candidate.id} key={candidate.id}>{runwayLabel(candidate)}</option>)}
            </select>
          </label>
          <div className="airport-time">
            <div className="airport-field-label">Geplante {operation === "departure" ? "Startzeit" : "Landezeit"} · UTC · 24 h</div>
            <div className="airport-time-row">
              <span className="airport-datetime-control">
                <input
                  type="date"
                  lang="de-DE"
                  value={plannedAt.slice(0, 10)}
                  required
                  disabled={weatherNow}
                  onChange={(event) => updatePlannedAt(`${event.target.value}T${plannedAt.slice(11)}`)}
                />
                <input
                  type="time"
                  lang="de-DE"
                  value={plannedAt.slice(11)}
                  required
                  disabled={weatherNow}
                  onChange={(event) => updatePlannedAt(`${plannedAt.slice(0, 10)}T${event.target.value}`)}
                />
              </span>
              <label className="import-toggle airport-now-toggle">
                <input type="checkbox" checked={weatherNow} onChange={(event) => onWeatherNowChange(event.target.checked)} />
                <span>Jetzt</span>
              </label>
            </div>
          </div>
          {runway ? (
            <>
              <div className="airport-preview">
                <AirportPreviewValue label="Elevation" value={airport.elevationFt} unit="ft" />
                <RunwayHeadingPreview runway={runway} />
                <AirportPreviewValue label="Bahnlänge" value={runway.lengthM} unit="m" />
              </div>
              <div className="airport-declared-distances" aria-label="Verfügbare Pistenstrecken">
                <div className="airport-preview-item airport-declared-combined">
                  <div>
                    <span className="airport-preview-label">TORA</span>
                    <strong className="airport-preview-value">
                      {runway.toraM ?? "–"}{runway.toraM != null ? <span className="airport-preview-unit">m</span> : null}
                    </strong>
                  </div>
                  <div>
                    <span className="airport-preview-label">TODA</span>
                    <strong className="airport-preview-value">
                      {runway.todaM ?? "–"}{runway.todaM != null ? <span className="airport-preview-unit">m</span> : null}
                    </strong>
                  </div>
                </div>
                <AirportPreviewValue label="LDA" value={runway.ldaM ?? "–"} unit={runway.ldaM != null ? "m" : undefined} />
              </div>
              {weatherError && !weather ? <div className="airport-status error">{weatherError}</div> : null}
              <div className={`airport-weather${!weather || weatherLoading ? " airport-weather--loading" : ""}`}>
                <div className="airport-weather-title">
                  <LoadingIndicator active={weatherLoading} label="Wetterdaten werden geladen" />
                  <span>{weatherTitle}</span>
                </div>
                <div className="airport-weather-basics">
                  <AirportPreviewValue label="QNH" value={weather ? Math.round(weather.qnhHpa) : "–"} unit={weather ? "hPa" : undefined} />
                  <AirportPreviewValue label="OAT" value={weather ? Math.round(weather.temperatureC) : "–"} unit={weather ? "°C" : undefined} />
                </div>
                <div className="airport-wind-compact">
                  <div className="airport-wind-main">
                    <span className="airport-preview-label">Wind true</span>
                    <strong className="airport-preview-value">
                      {weather
                        ? `${formatDirection(weather.windDirectionTrueDeg)}° / ${Math.round(weather.windSpeedKt)}${weather.windGustKt != null ? ` G ${Math.round(weather.windGustKt)}` : ""}`
                        : "–"}
                      {weather ? <span className="airport-preview-unit">kt</span> : null}
                    </strong>
                  </div>
                  <div className="airport-wind-components">
                    <div>
                      <span className="airport-preview-label">{headwindCode}</span>
                      <strong className={`airport-preview-value${headwindStatus ? ` ${headwindStatus}` : ""}`}>
                        {windComponents ? Math.round(Math.abs(windComponents.headwindKt)) : "–"}
                        {windComponents ? <span className="airport-preview-unit">kt</span> : null}
                      </strong>
                    </div>
                    <div>
                      <span className="airport-preview-label">XW</span>
                      <strong className={`airport-preview-value${crosswindStatus ? ` ${crosswindStatus}` : ""}`}>
                        {windComponents ? Math.round(Math.abs(windComponents.crosswindKt)) : "–"}
                        {windComponents ? <span className="airport-preview-unit">kt</span> : null}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : <div className="airport-status error">OpenAIP liefert für diesen Flugplatz keine aktive Bahn.</div>}
          <div className="airport-sources">
            OpenAIP · Stand {new Date(airport.source.updatedAt).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}
            {weather ? (
              <>
                <br />
                {weather.source.provider === "Aviation Weather Center"
                  ? <a href="https://aviationweather.gov/" target="_blank" rel="noreferrer">Aviation Weather Center</a>
                  : <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a>
                }
                {" · "}{weather.source.model} · {weatherNow ? "aktuell für" : "Prognose für"} {new Date(weather.validAt).toLocaleString("de-DE", { timeZone: "UTC", dateStyle: "short", timeStyle: "short" })} UTC
              </>
            ) : null}
          </div>
          <div className="airport-imports">
            <label className="import-toggle airport-import-toggle">
              <input type="checkbox" checked={enabled} disabled={!runway || !plannedAt} onChange={(event) => toggleImport(event.target.checked)} />
              <span>{enabled ? "Werte übernommen" : "Werte übernehmen"}</span>
            </label>
          </div>
        </>
      ) : null}
    </div>
  );
}
