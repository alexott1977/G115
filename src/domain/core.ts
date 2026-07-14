import type { Atmosphere, LookupTable2D } from "./types";

export const KMH_PER_KT = 1.852;
export const KT_PER_KMH = 0.539957;
export const FEET_PER_FLIGHT_LEVEL = 100;
export const PRESSURE_ALTITUDE_FEET_PER_HPA = 27;

export function round(value: number): number {
  return Math.round(value);
}

export function formatSigned(value: number, digits: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
}

export function interpolate1D(
  breakpoints: readonly number[],
  values: readonly number[],
  input: number,
): number {
  if (input <= breakpoints[0]) return values[0];
  const lastIndex = breakpoints.length - 1;
  if (input >= breakpoints[lastIndex]) return values[lastIndex];

  for (let index = 0; index < lastIndex; index += 1) {
    const leftBreakpoint = breakpoints[index];
    const rightBreakpoint = breakpoints[index + 1];
    if (input >= leftBreakpoint && input <= rightBreakpoint) {
      const ratio = (input - leftBreakpoint) / (rightBreakpoint - leftBreakpoint);
      return values[index] + ratio * (values[index + 1] - values[index]);
    }
  }

  return values[lastIndex];
}

export function findBracket(
  breakpoints: readonly number[],
  input: number,
): { start: number; end: number } {
  const lastIndex = breakpoints.length - 1;
  if (input <= breakpoints[0]) return { start: 0, end: 0 };
  if (input >= breakpoints[lastIndex]) return { start: lastIndex, end: lastIndex };

  for (let index = 0; index < lastIndex; index += 1) {
    if (input >= breakpoints[index] && input <= breakpoints[index + 1]) {
      return { start: index, end: index + 1 };
    }
  }

  return { start: lastIndex, end: lastIndex };
}

export function lookup2D(
  table: LookupTable2D,
  rowInput: number,
  columnInput: number,
): number {
  const rowIndexPair = findBracket(table.rowBreakpoints, rowInput);
  const columnIndexPair = findBracket(table.columnBreakpoints, columnInput);

  const rowInterpolation =
    rowIndexPair.start === rowIndexPair.end
      ? 0
      : (rowInput - table.rowBreakpoints[rowIndexPair.start]) /
        (table.rowBreakpoints[rowIndexPair.end] -
          table.rowBreakpoints[rowIndexPair.start]);

  const columnInterpolation =
    columnIndexPair.start === columnIndexPair.end
      ? 0
      : (columnInput - table.columnBreakpoints[columnIndexPair.start]) /
        (table.columnBreakpoints[columnIndexPair.end] -
          table.columnBreakpoints[columnIndexPair.start]);

  const lowerRowValue =
    table.values[rowIndexPair.start][columnIndexPair.start] +
    columnInterpolation *
      (table.values[rowIndexPair.start][columnIndexPair.end] -
        table.values[rowIndexPair.start][columnIndexPair.start]);

  const upperRowValue =
    table.values[rowIndexPair.end][columnIndexPair.start] +
    columnInterpolation *
      (table.values[rowIndexPair.end][columnIndexPair.end] -
        table.values[rowIndexPair.end][columnIndexPair.start]);

  return lowerRowValue + rowInterpolation * (upperRowValue - lowerRowValue);
}

export function pressureAltitudeFromQnh(
  fieldElevationFt: number,
  qnhHpa: number,
): number {
  return Math.round(
    fieldElevationFt + (1013.25 - qnhHpa) * PRESSURE_ALTITUDE_FEET_PER_HPA,
  );
}

export function densityAltitude(
  pressureAltitudeFt: number,
  oatCelsius: number,
): Atmosphere {
  const isaTemperatureC = 15 - 1.98 * (pressureAltitudeFt / 1000);
  const isaDeviationC = oatCelsius - isaTemperatureC;
  return {
    densityAltitudeFt: Math.round(pressureAltitudeFt + 120 * isaDeviationC),
    isaDeviationC,
    isaTemperatureC,
  };
}

export function kilometersPerHourToKnots(speedKmh: number): number {
  return speedKmh * KT_PER_KMH;
}

export function knotsToKilometersPerHour(speedKt: number): number {
  return speedKt * KMH_PER_KT;
}

export function flightLevelToFeet(flightLevel: number): number {
  return flightLevel * FEET_PER_FLIGHT_LEVEL;
}

