export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type DataSource = {
  provider: "OpenAIP" | "Open-Meteo" | "Aviation Weather Center";
  updatedAt: string;
  model?: string;
};

export type RunwaySurface = "asphalt" | "concrete" | "grass" | "gravel" | "other";

export type RunwayDirection = {
  id: string;
  designator: string;
  trueHeadingDeg: number;
  magneticHeadingDeg: number;
  lengthM: number;
  widthM: number;
  toraM?: number;
  todaM?: number;
  asdaM?: number;
  ldaM?: number;
  surface: RunwaySurface;
  thresholdElevationFt?: number;
};

export type Airport = {
  id: string;
  name: string;
  icaoCode?: string;
  country: string;
  coordinates: Coordinates;
  elevationFt: number;
  magneticDeclinationDeg: number;
  runways: RunwayDirection[];
  source: DataSource;
};

export type WeatherForecast = {
  id: string;
  airportId?: string;
  validAt: string;
  temperatureC: number;
  qnhHpa: number;
  windDirectionTrueDeg: number;
  windSpeedKt: number;
  windGustKt?: number;
  source: DataSource;
};

export type WindComponents = {
  headwindKt: number;
  crosswindKt: number;
};
