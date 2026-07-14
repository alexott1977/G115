export type AircraftCapability =
  | "weightBalance"
  | "takeoff"
  | "climb"
  | "cruise"
  | "landing"
  | "stall"
  | "climbRate";

export type SpeedUnit = "kt" | "kmh";

export type AircraftDefinition = {
  id: string;
  manufacturer: string;
  model: string;
  shortName: string;
  registrations: string[];
  preferredSpeedUnit?: SpeedUnit;
  capabilities: AircraftCapability[];
};

export const aircraftRegistry: AircraftDefinition[] = [
  {
    id: "grob-g115b",
    manufacturer: "Grob",
    model: "G115B",
    shortName: "Grob 115B",
    registrations: ["D-EBFT", "D-ELWF", "D-ENZM"],
    preferredSpeedUnit: "kt",
    capabilities: [
      "weightBalance",
      "takeoff",
      "climb",
      "cruise",
      "landing",
      "stall",
      "climbRate",
    ],
  },
  {
    id: "robin-dr400-180",
    manufacturer: "Robin",
    model: "DR400/180",
    shortName: "Robin DR400/180",
    registrations: ["D-EDNE"],
    preferredSpeedUnit: "kmh",
    capabilities: [
      "weightBalance",
      "takeoff",
      "climb",
      "cruise",
      "landing",
      "stall",
      "climbRate",
    ],
  },
];

export const defaultAircraft = aircraftRegistry[0];
