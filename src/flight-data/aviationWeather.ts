import type { WeatherForecast } from "./types";

export type AwcMetar = {
  icaoId: string;
  reportTime: string;
  obsTime?: number;
  temp: number | null;
  altim: number | null;
  wdir: number | "VRB" | null;
  wspd: number | null;
  wgst: number | null;
  rawOb?: string | null;
};

export type AwcTafPeriod = {
  timeFrom: string;
  timeTo: string;
  changeIndicator: string | null;
  wdir: number | "VRB" | null;
  wspd: number | null;
  wgst: number | null;
};

export type AwcTaf = {
  icaoId: string;
  issueTime: string;
  validTimeFrom: string;
  validTimeTo: string;
  fcsts: AwcTafPeriod[];
};

const INHG_TO_HPA = 33.8639;

// Parse QNH from raw METAR string: Q1017 → 1017 hPa, A2992 → 29.92 inHg → hPa
function parseQnhHpa(rawOb: string | null | undefined, altim: number | null): number | null {
  if (rawOb) {
    const q = /(?:^|\s)Q(\d{4})(?:\s|$)/.exec(rawOb);
    if (q) return Number.parseInt(q[1], 10);
    const a = /(?:^|\s)A(\d{4})(?:\s|$)/.exec(rawOb);
    if (a) return Math.round((Number.parseInt(a[1], 10) / 100) * INHG_TO_HPA);
  }
  // Fallback: altim field — AWC returns inHg for US, hPa for ICAO stations
  if (altim == null) return null;
  return altim > 100 ? altim : Math.round(altim * INHG_TO_HPA);
}

const SKIP_INDICATORS = new Set(["TEMPO", "INTER", "PROB30", "PROB40"]);

function parseAwcTime(value: string): string {
  return new Date(value.includes("T") ? value : value.replace(" ", "T") + "Z").toISOString();
}

export function normalizeAwcMetar(data: AwcMetar[], airportId?: string): WeatherForecast | null {
  const metar = data[0];
  if (!metar) return null;
  const { temp, altim, wdir, wspd, wgst, reportTime, icaoId, obsTime, rawOb } = metar;
  const qnhHpa = parseQnhHpa(rawOb, altim);
  if (temp == null || qnhHpa == null || wdir == null || typeof wdir !== "number" || wspd == null) return null;
  const validAt = parseAwcTime(reportTime);
  return {
    id: `metar-${icaoId.toLowerCase()}-${obsTime ?? new Date(validAt).getTime()}`,
    airportId,
    validAt,
    temperatureC: Math.round(temp * 10) / 10,
    qnhHpa,
    windDirectionTrueDeg: wdir,
    windSpeedKt: wspd,
    ...(wgst != null ? { windGustKt: wgst } : {}),
    source: {
      provider: "Aviation Weather Center",
      model: "METAR",
      updatedAt: validAt,
    },
  };
}

export function findTafPeriod(
  data: AwcTaf[],
  plannedAt: string,
): { period: AwcTafPeriod; taf: AwcTaf } | null {
  const taf = data[0];
  if (!taf) return null;
  const target = new Date(plannedAt).getTime();
  if (target < new Date(taf.validTimeFrom).getTime() || target > new Date(taf.validTimeTo).getTime()) return null;
  const basePeriods = taf.fcsts.filter((f) => !SKIP_INDICATORS.has(f.changeIndicator ?? ""));
  const period = [...basePeriods].reverse().find((f) => new Date(f.timeFrom).getTime() <= target);
  if (!period || period.wdir == null || typeof period.wdir !== "number" || period.wspd == null) return null;
  return { period, taf };
}

export function mergeBaseWithTaf(
  base: WeatherForecast,
  period: AwcTafPeriod,
  taf: AwcTaf,
): WeatherForecast {
  return {
    ...base,
    id: `taf-${taf.icaoId.toLowerCase()}-${period.timeFrom}`,
    validAt: parseAwcTime(period.timeFrom),
    windDirectionTrueDeg: typeof period.wdir === "number" ? period.wdir : base.windDirectionTrueDeg,
    windSpeedKt: period.wspd ?? base.windSpeedKt,
    windGustKt: period.wgst ?? undefined,
    source: {
      provider: "Aviation Weather Center",
      model: `TAF · ${base.source.model}`,
      updatedAt: parseAwcTime(taf.issueTime),
    },
  };
}
