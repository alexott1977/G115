import { useEffect, useMemo, useState } from "react";
import { Gauge, Mountain, Plane } from "lucide-react";
import { useAircraft } from "../app/AircraftContext";
import { performanceForAircraft } from "../app/aircraftPerformance";
import { useFlightPlan } from "../app/FlightPlanContext";
import { AltitudeInput, type AltitudeInputValue, resolveAltitudeInput } from "../components/AltitudeInput";
import { CalculatorCard, MetricItem, SpeedSymbol } from "../components/CalculatorCard";
import { CalculatorContextCard } from "../components/CalculatorContextCard";
import { CalculatorInputSection } from "../components/CalculatorInputSection";
import { SliderField } from "../components/SliderField";
import { speedUnitLabel, speedValue } from "../app/speed";

function describeAltitude(altitude: AltitudeInputValue, densityAltitudeFt: number) {
  if (altitude.mode === "da") return `DA ${densityAltitudeFt.toLocaleString("de-DE")} ft`;
  if (altitude.mode === "fl") return `FL ${altitude.flightLevel} · OAT ${altitude.oatC} °C · DA ${densityAltitudeFt.toLocaleString("de-DE")} ft`;
  return `${altitude.altitudeFt.toLocaleString("de-DE")} ft · QNH ${altitude.qnhHpa} hPa · DA ${densityAltitudeFt.toLocaleString("de-DE")} ft`;
}

export function ClimbRatePage() {
  const { aircraft, resolvedSpeedUnit } = useAircraft();
  const performance = performanceForAircraft(aircraft);
  const { calculateClimbRate } = performance.calculators;
  const { flightPlan, updateClimbRateCalculator } = useFlightPlan();
  const savedCalculator = flightPlan.climbRateCalculator;
  const [altitude, setAltitude] = useState<AltitudeInputValue>(savedCalculator?.altitude ?? {
    mode: "alt",
    altitudeFt: 4500,
    flightLevel: 45,
    densityAltitudeFt: 4500,
    qnhHpa: 1013,
    oatC: 6,
  });
  const [massKg, setMassKg] = useState(savedCalculator?.massKg ?? performance.limits.climbRateMassMaxKg);
  const resolvedAltitude = useMemo(() => resolveAltitudeInput(altitude), [altitude]);
  const { atmosphere, densityAltitudeFt, pressureAltitudeFt: referencePressureAltitudeFt } = resolvedAltitude;
  const result = useMemo(
    () => calculateClimbRate({ massKg, densityAltitudeFt, referencePressureAltitudeFt }),
    [massKg, densityAltitudeFt, referencePressureAltitudeFt],
  );
  useEffect(() => {
    document.body.classList.add("climb-rate-calculator");
    return () => document.body.classList.remove("climb-rate-calculator");
  }, []);
  useEffect(() => {
    updateClimbRateCalculator({ altitude, massKg });
  }, [altitude, massKg, updateClimbRateCalculator]);

  return (
    <div className="page-layout compact-calculator-layout">
      <aside className="sidebar compact-input-panel">
        <CalculatorInputSection
          icon={<Mountain aria-hidden="true" />}
          title="Höhe"
          description="Höhe, QNH und Temperatur"
          summary={describeAltitude(altitude, densityAltitudeFt)}
        >
          <AltitudeInput value={altitude} onChange={setAltitude} />
        </CalculatorInputSection>
        <CalculatorInputSection
          defaultOpen={false}
          icon={<Plane aria-hidden="true" />}
          title="Flugzeug"
          description="Flugmasse"
          summary={`${massKg} kg`}
        >
          <SliderField label="Masse" unit="kg" value={massKg} min={performance.limits.climbRateMassMinKg} max={performance.limits.climbRateMassMaxKg} inputMax={performance.limits.climbRateMassMaxKg} onChange={setMassKg} />
        </CalculatorInputSection>
      </aside>
      <main className="results">
        {result.warnings.length ? <div className="warnings">{result.warnings.map((warning) => <div className={`warn-item${warning.danger ? " danger" : ""}`} key={warning.text}>{warning.text}</div>)}</div> : null}
        <CalculatorContextCard
          title={atmosphere ? "Kontext" : "Bedingungen"}
          atmosphere={atmosphere ?? undefined}
          atmosphereWarningThresholdFt={10000}
          conditions={result.conditions}
        />
        <CalculatorCard title="Steigleistung" className="climb-rate-primary-results">
          <div className="takeoff-summary-heading">
            <Gauge aria-hidden="true" />
            <span>{massKg} kg · DA {densityAltitudeFt.toLocaleString("de-DE")} ft</span>
          </div>
          <div className="result-grid climb-rate-result-grid">
            <MetricItem label="Steigrate · Rate of Climb" value={String(Math.round(result.climbRateFpm))} unit="ft/min" subtext={`${result.climbRateMs.toFixed(1)} m/s`} />
            <MetricItem label={<span><SpeedSymbol index="Y" /> · Climb Speed</span>} value={speedValue(result.climbSpeedKmh, resolvedSpeedUnit)} unit={speedUnitLabel(resolvedSpeedUnit)} speedType="IAS" />
          </div>
        </CalculatorCard>
      </main>
    </div>
  );
}
