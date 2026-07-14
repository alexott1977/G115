import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

const FLIGHT_PLAN_STORAGE_KEY = "performance-calculators-flight-plan";
const FLIGHT_PLAN_STORAGE_VERSION = 2;

export type WeightBalancePlan = {
  registration: string;
  pilotMassKg: number;
  copilotMassKg: number;
  passengerLeftMassKg?: number;
  passengerRightMassKg?: number;
  baggageMassKg: number;
  startFuelLiters: number;
  mainFuelLiters?: number;
  wingFuelLiters?: number;
  plannedFuelBurnLiters: number;
  plannedMainFuelBurnLiters?: number;
  plannedWingFuelBurnLiters?: number;
};

export type FlightPlanMasses = {
  startMassKg: number;
  landingMassKg: number;
  startFuelLiters: number;
  landingFuelLiters: number;
  updatedAt: string;
};

export type FlightPlanTakeoffStart = {
  pressureAltitudeFt: number;
  densityAltitudeFt: number;
  oatC: number;
  elevationFt?: number;
  qnhHpa?: number;
  airportLabel?: string;
  runwayLabel?: string;
  updatedAt: string;
};

export type FlightPlanAtmosphereMode = "airport" | "qnh" | "direct";
export type FlightPlanAltitudeMode = "alt" | "fl" | "da";

export type FlightPlanAltitude = {
  mode: FlightPlanAltitudeMode;
  altitudeFt: number;
  flightLevel: number;
  densityAltitudeFt: number;
  oatC: number;
  qnhHpa: number;
};

export type FlightPlanTakeoffCalculator = {
  pressureAltitudeMode: FlightPlanAtmosphereMode;
  elevationFt: number;
  qnhHpa: number;
  directPressureAltitudeFt: number;
  oatC: number;
  massKg: number;
  slopePercent: number;
  windKt: number;
  safetyMarginPercent: number;
  updatedAt: string;
};

export type FlightPlanLandingCalculator = {
  pressureAltitudeMode: FlightPlanAtmosphereMode;
  elevationFt: number;
  qnhHpa: number;
  directPressureAltitudeFt: number;
  oatC: number;
  massKg: number;
  windKt: number;
  safetyMarginPercent: number;
  updatedAt: string;
};

export type FlightPlanClimbCalculator = {
  from: FlightPlanAltitude;
  to: FlightPlanAltitude;
  updatedAt: string;
};

export type FlightPlanCruiseCalculator = {
  mode: FlightPlanAltitudeMode;
  altitudeFt: number;
  flightLevel: number;
  directDensityAltitudeFt: number;
  qnhHpa: number;
  oatC: number;
  powerPercent: number;
  updatedAt: string;
};

export type FlightPlanClimbRateCalculator = {
  altitude: FlightPlanAltitude;
  massKg: number;
  updatedAt: string;
};

export type FlightPlanStallCalculator = {
  massKg: number;
  powerMode: "leerlauf" | "vollast";
  flapsDegrees: 0 | 12 | 40;
  updatedAt: string;
};

export type FlightPlanAirportSelection = {
  airportId: string;
  runwayId: string;
  plannedAt: string;
  updatedAt: string;
};

export type FlightPlanImports = {
  departureImport: boolean;
  arrivalImport: boolean;
  departureWeatherNow: boolean;
  arrivalWeatherNow: boolean;
  takeoffMass: boolean;
  landingMass: boolean;
  climbStartFromTakeoff: boolean;
};

export type FlightPlan = {
  weightBalance: WeightBalancePlan;
  imports: FlightPlanImports;
  masses?: FlightPlanMasses;
  takeoffStart?: FlightPlanTakeoffStart;
  takeoffCalculator?: FlightPlanTakeoffCalculator;
  landingCalculator?: FlightPlanLandingCalculator;
  climbCalculator?: FlightPlanClimbCalculator;
  cruiseCalculator?: FlightPlanCruiseCalculator;
  climbRateCalculator?: FlightPlanClimbRateCalculator;
  stallCalculator?: FlightPlanStallCalculator;
  departure?: FlightPlanAirportSelection;
  arrival?: FlightPlanAirportSelection;
};

type StoredFlightPlan = {
  version: number;
  flightPlan: Partial<FlightPlan>;
} & Partial<FlightPlan>;

type FlightPlanContextValue = {
  flightPlan: FlightPlan;
  updateWeightBalance: (change: Partial<WeightBalancePlan>) => void;
  publishMasses: (masses: Omit<FlightPlanMasses, "updatedAt">) => void;
  publishTakeoffStart: (takeoffStart: Omit<FlightPlanTakeoffStart, "updatedAt">) => void;
  updateDeparture: (departure: Omit<FlightPlanAirportSelection, "updatedAt">) => void;
  updateArrival: (arrival: Omit<FlightPlanAirportSelection, "updatedAt">) => void;
  updateTakeoffCalculator: (takeoffCalculator: Omit<FlightPlanTakeoffCalculator, "updatedAt">) => void;
  updateLandingCalculator: (landingCalculator: Omit<FlightPlanLandingCalculator, "updatedAt">) => void;
  updateClimbCalculator: (climbCalculator: Omit<FlightPlanClimbCalculator, "updatedAt">) => void;
  updateCruiseCalculator: (cruiseCalculator: Omit<FlightPlanCruiseCalculator, "updatedAt">) => void;
  updateClimbRateCalculator: (climbRateCalculator: Omit<FlightPlanClimbRateCalculator, "updatedAt">) => void;
  updateStallCalculator: (stallCalculator: Omit<FlightPlanStallCalculator, "updatedAt">) => void;
  updateImports: (change: Partial<FlightPlanImports>) => void;
  resetFlightPlan: () => void;
};

const defaultFlightPlan: FlightPlan = {
  weightBalance: {
    registration: "D-EBFT",
    pilotMassKg: 85,
    copilotMassKg: 0,
    baggageMassKg: 0,
    startFuelLiters: 107,
    plannedFuelBurnLiters: 0,
  },
  imports: {
    departureImport: false,
    arrivalImport: false,
    departureWeatherNow: true,
    arrivalWeatherNow: true,
    takeoffMass: true,
    landingMass: false,
    climbStartFromTakeoff: false,
  },
};

const FlightPlanContext = createContext<FlightPlanContextValue | null>(null);

function mergeFlightPlan(storedFlightPlan: Partial<FlightPlan>): FlightPlan {
  return {
    ...defaultFlightPlan,
    ...storedFlightPlan,
    weightBalance: { ...defaultFlightPlan.weightBalance, ...storedFlightPlan.weightBalance },
    imports: { ...defaultFlightPlan.imports, ...storedFlightPlan.imports },
  };
}

function withTakeoffMassDefault(storedFlightPlan: Partial<FlightPlan>): Partial<FlightPlan> {
  return {
    ...storedFlightPlan,
    imports: { ...defaultFlightPlan.imports, ...storedFlightPlan.imports, takeoffMass: true },
  };
}

function migrateStoredFlightPlan(parsed: unknown): FlightPlan {
  if (!parsed || typeof parsed !== "object") return defaultFlightPlan;
  const candidate = parsed as Partial<StoredFlightPlan> & Partial<FlightPlan>;
  if ("version" in candidate || "flightPlan" in candidate) {
    if (!candidate.flightPlan) return defaultFlightPlan;
    if (candidate.version === 1) {
      return mergeFlightPlan(withTakeoffMassDefault(candidate.flightPlan));
    }
    if (candidate.version !== FLIGHT_PLAN_STORAGE_VERSION) return defaultFlightPlan;
    return mergeFlightPlan(candidate.flightPlan);
  }
  return mergeFlightPlan(withTakeoffMassDefault(candidate));
}

function loadFlightPlan(): FlightPlan {
  if (typeof window === "undefined") return defaultFlightPlan;
  try {
    const stored = window.localStorage.getItem(FLIGHT_PLAN_STORAGE_KEY);
    if (!stored) return defaultFlightPlan;
    return migrateStoredFlightPlan(JSON.parse(stored));
  } catch {
    return defaultFlightPlan;
  }
}

export function FlightPlanProvider({ children }: { children: ReactNode }) {
  const [flightPlan, setFlightPlan] = useState(loadFlightPlan);
  const updateWeightBalance = useCallback((change: Partial<WeightBalancePlan>) => setFlightPlan((current) => ({
    ...current,
    weightBalance: { ...current.weightBalance, ...change },
  })), []);
  const publishMasses = useCallback((masses: Omit<FlightPlanMasses, "updatedAt">) => setFlightPlan((current) => ({
    ...current,
    masses: { ...masses, updatedAt: new Date().toISOString() },
  })), []);
  const publishTakeoffStart = useCallback((takeoffStart: Omit<FlightPlanTakeoffStart, "updatedAt">) => setFlightPlan((current) => ({
    ...current,
    takeoffStart: { ...takeoffStart, updatedAt: new Date().toISOString() },
  })), []);
  const updateDeparture = useCallback((departure: Omit<FlightPlanAirportSelection, "updatedAt">) => setFlightPlan((current) => ({
    ...current,
    departure: { ...departure, updatedAt: new Date().toISOString() },
  })), []);
  const updateArrival = useCallback((arrival: Omit<FlightPlanAirportSelection, "updatedAt">) => setFlightPlan((current) => ({
    ...current,
    arrival: { ...arrival, updatedAt: new Date().toISOString() },
  })), []);
  const updateTakeoffCalculator = useCallback((takeoffCalculator: Omit<FlightPlanTakeoffCalculator, "updatedAt">) => setFlightPlan((current) => ({
    ...current,
    takeoffCalculator: { ...takeoffCalculator, updatedAt: new Date().toISOString() },
  })), []);
  const updateLandingCalculator = useCallback((landingCalculator: Omit<FlightPlanLandingCalculator, "updatedAt">) => setFlightPlan((current) => ({
    ...current,
    landingCalculator: { ...landingCalculator, updatedAt: new Date().toISOString() },
  })), []);
  const updateClimbCalculator = useCallback((climbCalculator: Omit<FlightPlanClimbCalculator, "updatedAt">) => setFlightPlan((current) => ({
    ...current,
    climbCalculator: { ...climbCalculator, updatedAt: new Date().toISOString() },
  })), []);
  const updateCruiseCalculator = useCallback((cruiseCalculator: Omit<FlightPlanCruiseCalculator, "updatedAt">) => setFlightPlan((current) => ({
    ...current,
    cruiseCalculator: { ...cruiseCalculator, updatedAt: new Date().toISOString() },
  })), []);
  const updateClimbRateCalculator = useCallback((climbRateCalculator: Omit<FlightPlanClimbRateCalculator, "updatedAt">) => setFlightPlan((current) => ({
    ...current,
    climbRateCalculator: { ...climbRateCalculator, updatedAt: new Date().toISOString() },
  })), []);
  const updateStallCalculator = useCallback((stallCalculator: Omit<FlightPlanStallCalculator, "updatedAt">) => setFlightPlan((current) => ({
    ...current,
    stallCalculator: { ...stallCalculator, updatedAt: new Date().toISOString() },
  })), []);
  const updateImports = useCallback((change: Partial<FlightPlanImports>) => setFlightPlan((current) => ({
    ...current,
    imports: { ...current.imports, ...change },
  })), []);
  const resetFlightPlan = useCallback(() => setFlightPlan(defaultFlightPlan), []);

  useEffect(() => {
    try {
      window.localStorage.setItem(FLIGHT_PLAN_STORAGE_KEY, JSON.stringify({
        version: FLIGHT_PLAN_STORAGE_VERSION,
        flightPlan,
        ...flightPlan,
      } satisfies StoredFlightPlan));
    } catch {
      // Storage is optional; the flight plan still remains active for this session.
    }
  }, [flightPlan]);

  const value = useMemo<FlightPlanContextValue>(() => ({
    flightPlan,
    updateWeightBalance,
    publishMasses,
    publishTakeoffStart,
    updateDeparture,
    updateArrival,
    updateTakeoffCalculator,
    updateLandingCalculator,
    updateClimbCalculator,
    updateCruiseCalculator,
    updateClimbRateCalculator,
    updateStallCalculator,
    updateImports,
    resetFlightPlan,
  }), [flightPlan, publishMasses, publishTakeoffStart, resetFlightPlan, updateArrival, updateClimbCalculator, updateClimbRateCalculator, updateCruiseCalculator, updateDeparture, updateImports, updateLandingCalculator, updateStallCalculator, updateTakeoffCalculator, updateWeightBalance]);

  return <FlightPlanContext.Provider value={value}>{children}</FlightPlanContext.Provider>;
}

export function useFlightPlan() {
  const context = useContext(FlightPlanContext);
  if (!context) throw new Error("useFlightPlan must be used within FlightPlanProvider.");
  return context;
}
