export type Warning = {
  text: string;
  danger: boolean;
};

export type Atmosphere = {
  densityAltitudeFt: number;
  isaDeviationC: number;
  isaTemperatureC: number;
};

export type LookupTable2D = {
  rowBreakpoints: readonly number[];
  columnBreakpoints: readonly number[];
  values: readonly (readonly number[])[];
};

export type MassMomentPoint = {
  massKg: number;
  momentKgM: number;
};

