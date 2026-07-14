import type { WeatherForecast } from "./types";

export type OpenMeteoHourlyResponse = {
  hourly?: {
    time?: string[];
    temperature_2m?: Array<number | null>;
    pressure_msl?: Array<number | null>;
    wind_speed_10m?: Array<number | null>;
    wind_direction_10m?: Array<number | null>;
    wind_gusts_10m?: Array<number | null>;
  };
};

export type OpenMeteoCurrentResponse = {
  current?: {
    time?: string;
    temperature_2m?: number | null;
    pressure_msl?: number | null;
    wind_speed_10m?: number | null;
    wind_direction_10m?: number | null;
    wind_gusts_10m?: number | null;
  };
};

function weatherForecast(
  values: {
    time?: string;
    temperatureC?: number | null;
    qnhHpa?: number | null;
    windSpeedKt?: number | null;
    windDirectionTrueDeg?: number | null;
    windGustKt?: number | null;
  },
  model: string,
  airportId?: string,
  updatedAt = new Date().toISOString(),
) {
  const { time, temperatureC, qnhHpa, windSpeedKt, windDirectionTrueDeg, windGustKt } = values;
  if (!time || temperatureC == null || qnhHpa == null || windSpeedKt == null || windDirectionTrueDeg == null) return null;
  return {
    id: `${model.toLowerCase().replace(/[\s.]+/g, "-")}-${time}Z`,
    airportId,
    validAt: `${time}Z`,
    temperatureC,
    qnhHpa,
    windDirectionTrueDeg,
    windSpeedKt,
    ...(windGustKt == null ? {} : { windGustKt }),
    source: {
      provider: "Open-Meteo" as const,
      model,
      updatedAt,
    },
  };
}

export function normalizeOpenMeteoForecast(
  response: OpenMeteoHourlyResponse,
  airportId?: string,
  updatedAt = new Date().toISOString(),
  model = "ICON-D2",
): WeatherForecast | null {
  return weatherForecast({
    time: response.hourly?.time?.[0],
    temperatureC: response.hourly?.temperature_2m?.[0],
    qnhHpa: response.hourly?.pressure_msl?.[0],
    windSpeedKt: response.hourly?.wind_speed_10m?.[0],
    windDirectionTrueDeg: response.hourly?.wind_direction_10m?.[0],
    windGustKt: response.hourly?.wind_gusts_10m?.[0],
  }, model, airportId, updatedAt);
}

export function normalizeOpenMeteoCurrent(
  response: OpenMeteoCurrentResponse,
  airportId?: string,
  updatedAt = new Date().toISOString(),
  model = "ICON-D2",
): WeatherForecast | null {
  return weatherForecast({
    time: response.current?.time,
    temperatureC: response.current?.temperature_2m,
    qnhHpa: response.current?.pressure_msl,
    windSpeedKt: response.current?.wind_speed_10m,
    windDirectionTrueDeg: response.current?.wind_direction_10m,
    windGustKt: response.current?.wind_gusts_10m,
  }, model, airportId, updatedAt);
}
