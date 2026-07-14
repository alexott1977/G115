import type { Atmosphere, Warning } from "../../domain";

export type TakeoffInputs = {
  pressureAltitudeFt: number;
  oatC: number;
  massKg: number;
  slopePercent: number;
  windKt: number;
  safetyMarginPercent: number;
};

export type LandingInputs = {
  pressureAltitudeFt: number;
  oatC: number;
  massKg: number;
  windKt: number;
  safetyMarginPercent: number;
};

export type CruiseInputs = {
  powerPercent: number;
  densityAltitudeFt: number;
};

export type ClimbRateInputs = {
  massKg: number;
  referencePressureAltitudeFt: number;
  densityAltitudeFt: number;
};

export type ClimbInputs = {
  departureDensityAltitudeFt: number;
  destinationDensityAltitudeFt: number;
};

export type StallInputs = {
  massKg: number;
  powerMode: "leerlauf" | "vollast";
  flapsDegrees: 0 | 12 | 40;
};

export type WeightBalanceInputs = {
  aircraftName: string;
  pilotMassKg: number;
  copilotMassKg: number;
  passengerLeftMassKg?: number;
  passengerRightMassKg?: number;
  baggageMassKg: number;
  fuelLiters: number;
  mainFuelLiters?: number;
  wingFuelLiters?: number;
};

export type ClimbProfilePoint = {
  chartPixelX: number;
  timeMinutes: number;
  fuelLiters: number;
  distanceKm: number;
};

export type CalculatorContext = {
  warnings: Warning[];
  atmosphere?: Atmosphere;
  conditions: string[];
};
