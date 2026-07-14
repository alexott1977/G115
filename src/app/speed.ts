import type { SpeedUnit } from "./aircraft";
import { kilometersPerHourToKnots } from "../domain";

export function speedValue(speedKmh: number, unit: SpeedUnit): string {
  return unit === "kt"
    ? kilometersPerHourToKnots(speedKmh).toFixed(1)
    : speedKmh.toFixed(0);
}

export function speedUnitLabel(unit: SpeedUnit): string {
  return unit === "kt" ? "kt" : "km/h";
}

export function alternateSpeedSubtext(speedKmh: number, unit: SpeedUnit): string {
  return unit === "kt"
    ? `${speedKmh.toFixed(0)} km/h`
    : `${kilometersPerHourToKnots(speedKmh).toFixed(1)} kt`;
}

export function speedText(speedKmh: number, unit: SpeedUnit): string {
  return `${speedValue(speedKmh, unit)} ${speedUnitLabel(unit)}`;
}
