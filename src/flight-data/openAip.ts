import { magneticHeading } from "./calculations";
import type { Airport, RunwayDirection, RunwaySurface } from "./types";

type OpenAipValue = { value?: number };
type OpenAipRunway = {
  _id?: string;
  designator?: string;
  trueHeading?: number;
  operations?: number;
  surface?: { mainComposite?: number };
  dimension?: { length?: OpenAipValue; width?: OpenAipValue };
  declaredDistance?: {
    tora?: OpenAipValue;
    toda?: OpenAipValue;
    asda?: OpenAipValue;
    lda?: OpenAipValue;
  };
  thresholdLocation?: { elevation?: OpenAipValue };
};

export type OpenAipAirport = {
  _id?: string;
  name?: string;
  icaoCode?: string;
  country?: string;
  geometry?: { coordinates?: number[] };
  elevation?: OpenAipValue;
  magneticDeclination?: number;
  runways?: OpenAipRunway[];
  updatedAt?: string;
};

export type OpenAipAirportList = {
  totalCount?: number;
  items?: OpenAipAirport[];
};

function metersToFeet(value: number) {
  return Math.round(value / 0.3048);
}

function surface(mainComposite?: number): RunwaySurface {
  if (mainComposite === 0 || mainComposite === 5) return "asphalt";
  if (mainComposite === 1) return "concrete";
  if (mainComposite === 2) return "grass";
  if (mainComposite === 12) return "gravel";
  return "other";
}

function normalizeRunway(runway: OpenAipRunway, declinationDeg: number): RunwayDirection | null {
  const lengthM = runway.dimension?.length?.value;
  const widthM = runway.dimension?.width?.value;
  const trueHeadingDeg = runway.trueHeading;
  if (!runway._id || !runway.designator || !Number.isFinite(lengthM) || !Number.isFinite(widthM) || !Number.isFinite(trueHeadingDeg)) return null;
  const thresholdElevationM = runway.thresholdLocation?.elevation?.value;
  const thresholdElevationFt = Number.isFinite(thresholdElevationM) ? metersToFeet(thresholdElevationM!) : undefined;

  return {
    id: runway._id,
    designator: runway.designator,
    trueHeadingDeg: trueHeadingDeg!,
    magneticHeadingDeg: magneticHeading(trueHeadingDeg!, declinationDeg),
    lengthM: lengthM!,
    widthM: widthM!,
    toraM: runway.declaredDistance?.tora?.value,
    todaM: runway.declaredDistance?.toda?.value,
    asdaM: runway.declaredDistance?.asda?.value,
    ldaM: runway.declaredDistance?.lda?.value,
    surface: surface(runway.surface?.mainComposite),
    thresholdElevationFt,
  };
}

export function normalizeOpenAipAirport(raw: OpenAipAirport): Airport | null {
  const longitude = raw.geometry?.coordinates?.[0];
  const latitude = raw.geometry?.coordinates?.[1];
  const elevationM = raw.elevation?.value;
  if (!raw._id || !raw.name || !raw.country || !Number.isFinite(longitude) || !Number.isFinite(latitude) || !Number.isFinite(elevationM)) return null;
  const magneticDeclinationDeg = Number.isFinite(raw.magneticDeclination) ? raw.magneticDeclination! : 0;
  const rawRunways = raw.runways ?? [];

  return {
    id: raw._id,
    name: raw.name,
    icaoCode: raw.icaoCode,
    country: raw.country,
    coordinates: { latitude: latitude!, longitude: longitude! },
    elevationFt: metersToFeet(elevationM!),
    magneticDeclinationDeg,
    runways: rawRunways
      .filter((runway) => runway.operations === undefined || runway.operations === 0)
      .map((runway) => normalizeRunway(runway, magneticDeclinationDeg))
      .filter((runway): runway is RunwayDirection => runway !== null),
    source: {
      provider: "OpenAIP",
      updatedAt: raw.updatedAt ?? new Date().toISOString(),
    },
  };
}
