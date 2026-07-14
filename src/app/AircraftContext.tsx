import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { aircraftRegistry, defaultAircraft, type AircraftDefinition, type SpeedUnit } from "./aircraft";

const AIRCRAFT_STORAGE_KEY = "performance-calculators-aircraft";
const SPEED_UNIT_STORAGE_KEY = "performance-calculators-speed-unit";

export type SpeedUnitPreference = "auto" | SpeedUnit;

type AircraftContextValue = {
  aircraft: AircraftDefinition;
  availableAircraft: AircraftDefinition[];
  resolvedSpeedUnit: SpeedUnit;
  selectAircraft: (aircraftId: string) => void;
  selectSpeedUnitPreference: (preference: SpeedUnitPreference) => void;
  speedUnitPreference: SpeedUnitPreference;
};

const AircraftContext = createContext<AircraftContextValue | null>(null);
type SpeedUnitPreferenceMap = Record<string, SpeedUnitPreference>;

function storedAircraftId() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(AIRCRAFT_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storedSpeedUnitPreferences(fallbackAircraftId: string): SpeedUnitPreferenceMap {
  if (typeof window === "undefined") return {};
  try {
    const stored = window.localStorage.getItem(SPEED_UNIT_STORAGE_KEY);
    if (stored === "kt" || stored === "kmh" || stored === "auto") return { [fallbackAircraftId]: stored };
    if (!stored) return {};
    const parsed = JSON.parse(stored) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => value === "kt" || value === "kmh" || value === "auto"),
    ) as SpeedUnitPreferenceMap;
  } catch {
    return {};
  }
}

export function AircraftProvider({
  children,
  availableAircraft = aircraftRegistry,
}: {
  children: ReactNode;
  availableAircraft?: AircraftDefinition[];
}) {
  const fallbackAircraft = availableAircraft[0] ?? defaultAircraft;
  const [selectedAircraftId, setSelectedAircraftId] = useState(() => storedAircraftId() ?? fallbackAircraft.id);
  const [speedUnitPreferences, setSpeedUnitPreferences] = useState(() => storedSpeedUnitPreferences(fallbackAircraft.id));
  const aircraft = availableAircraft.find(({ id }) => id === selectedAircraftId) ?? fallbackAircraft;
  const speedUnitPreference = speedUnitPreferences[aircraft.id] ?? "auto";
  const resolvedSpeedUnit = speedUnitPreference === "auto" ? (aircraft.preferredSpeedUnit ?? "kt") : speedUnitPreference;

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(AIRCRAFT_STORAGE_KEY, aircraft.id);
    } catch {
      // Storage is optional; the selected aircraft still remains active for this session.
    }
  }, [aircraft.id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(SPEED_UNIT_STORAGE_KEY, JSON.stringify(speedUnitPreferences));
    } catch {
      // Storage is optional; the selected unit still remains active for this session.
    }
  }, [speedUnitPreferences]);

  const selectSpeedUnitPreference = (preference: SpeedUnitPreference) => {
    setSpeedUnitPreferences((current) => ({ ...current, [aircraft.id]: preference }));
  };

  const value = useMemo<AircraftContextValue>(() => ({
    aircraft,
    availableAircraft,
    resolvedSpeedUnit,
    selectAircraft: setSelectedAircraftId,
    selectSpeedUnitPreference,
    speedUnitPreference,
  }), [aircraft, availableAircraft, resolvedSpeedUnit, speedUnitPreference]);

  return <AircraftContext.Provider value={value}>{children}</AircraftContext.Provider>;
}

export function useAircraft() {
  const context = useContext(AircraftContext);
  if (!context) {
    return {
      aircraft: defaultAircraft,
      availableAircraft: aircraftRegistry,
      resolvedSpeedUnit: defaultAircraft.preferredSpeedUnit ?? "kt",
      selectAircraft: () => undefined,
      selectSpeedUnitPreference: () => undefined,
      speedUnitPreference: "auto" as const,
    };
  }
  return context;
}
