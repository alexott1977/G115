import * as dr400 from "../aircraft/dr400/calculators";
import * as g115b from "../aircraft/g115b/calculators";
import { dr400Data } from "../aircraft/dr400/calculators";
import { g115bData } from "../aircraft/g115b/data";
import type { RunwaySurface } from "../flight-data";
import type { AircraftDefinition } from "./aircraft";

export type RunwaySurfaceClass = "hard" | "grass" | "other";

export type SafetyMarginDefaults = {
  fallback: number;
  hard: number;
  grass: number;
  other: number;
};

export function runwaySurfaceClass(surface?: RunwaySurface): RunwaySurfaceClass {
  if (surface === "grass") return "grass";
  if (surface === "asphalt" || surface === "concrete") return "hard";
  return "other";
}

export function safetyMarginForSurface(defaults: SafetyMarginDefaults, surface?: RunwaySurface) {
  return defaults[runwaySurfaceClass(surface)];
}

export function performanceForAircraft(aircraft: AircraftDefinition) {
  if (aircraft.id === "robin-dr400-180") {
    return {
      id: aircraft.id,
      label: aircraft.shortName,
      hasChartOverlays: false,
      supportsSlope: false,
      safetyMargins: {
        takeoff: { fallback: 15, hard: 0, grass: 15, other: 15 },
        landing: { fallback: 15, hard: 0, grass: 15, other: 15 },
      },
      overviewSpeedsKmh: {
        takeoff: 100,
        obstacle: 130,
        approach: 125,
        landingTouchdown: 95,
        climbVy: 170,
        glide: 150,
      },
      operatingSpeedsKmh: [
        { label: "VY Startklappen", value: 150 },
        { label: "VY clean", value: 170 },
        { label: "VX Startklappen", value: 130 },
        { label: "VX clean", value: 140 },
        { label: "Final Approach", value: 125 },
        { label: "Touchdown", value: 95 },
      ],
      speedLimitsKmh: [
        { label: "VNE", value: 308, detail: "Never exceed" },
        { label: "VNO", value: 260, detail: "Max. cruise / turbulence" },
        { label: "VA", value: 215, detail: "Max. manoeuvre" },
        { label: "VFE", value: 170, detail: "Flaps extended" },
      ],
      speedMarkingsKmh: [
        { label: "White arc", from: 95, to: 170 },
        { label: "Green arc", from: 105, to: 260 },
        { label: "Yellow arc", from: 260, to: 308 },
        { label: "Red line", value: 308 },
      ],
      loadFactors: [
        { label: "Cat N 1100 kg clean", value: "+3.8 / -1.9 g" },
        { label: "Cat N flaps down", value: "+2.0 g" },
        { label: "Cat U 950 kg clean", value: "+4.4 / -2.2 g" },
        { label: "Cat U flaps down", value: "+2.0 g" },
      ],
      limits: {
        takeoffMassMinKg: 900,
        takeoffMassMaxKg: 1100,
        landingMassMinKg: 845,
        landingMassMaxKg: 1045,
        stallMassMinKg: 750,
        stallMassMaxKg: 1100,
        climbRateMassMinKg: 900,
        climbRateMassMaxKg: 1100,
        fuelMaxLiters: 189,
      },
      data: dr400Data,
      calculators: dr400,
    };
  }

  return {
    id: "grob-g115b",
    label: "Grob G115B",
    hasChartOverlays: true,
    supportsSlope: true,
    safetyMargins: {
      takeoff: { fallback: 15, hard: 0, grass: 15, other: 15 },
      landing: { fallback: 40, hard: 0, grass: 40, other: 40 },
    },
    overviewSpeedsKmh: {
      takeoff: 111,
      obstacle: 139,
      approach: 120,
      landingTouchdown: 102,
      climbVy: 145,
      glide: 157,
    },
    operatingSpeedsKmh: [
      { label: "VR", value: 111 },
      { label: "15 m", value: 139 },
      { label: "VY", value: 145 },
      { label: "VAPP", value: 120 },
      { label: "Manöver", value: 193 },
      { label: "Einleiten", value: 95 },
    ],
    speedLimitsKmh: [
      { label: "VNE", value: 295, detail: "Höchstzulässig" },
      { label: "VNO", value: 240, detail: "Nur bei ruhiger Luft" },
      { label: "VA Normal", value: 186, detail: "Manövergeschwindigkeit" },
      { label: "VA Utility", value: 192, detail: "Manövergeschwindigkeit" },
      { label: "VFE", value: 175, detail: "Klappen ausgefahren" },
    ],
    speedMarkingsKmh: [
      { label: "White arc", from: 90, to: 175 },
      { label: "Green arc", from: 97, to: 240 },
      { label: "Yellow arc", from: 240, to: 295 },
      { label: "Red line", value: 295 },
      { label: "Blue line", value: 145 },
    ],
    loadFactors: [
      { label: "Normal 920 kg clean", value: "+3.8 / -1.52 g" },
      { label: "Normal flaps down", value: "+3.8 g" },
      { label: "Utility 850 kg clean", value: "+4.4 / -1.76 g" },
      { label: "Utility flaps down", value: "+4.4 g" },
    ],
    limits: {
      takeoffMassMinKg: 750,
      takeoffMassMaxKg: 920,
      landingMassMinKg: 700,
      landingMassMaxKg: 920,
      stallMassMinKg: 750,
      stallMassMaxKg: 920,
      climbRateMassMinKg: 750,
      climbRateMassMaxKg: 920,
      fuelMaxLiters: 107,
    },
    data: g115bData,
    calculators: g115b,
  };
}
