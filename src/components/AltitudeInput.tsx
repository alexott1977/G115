import { densityAltitude, flightLevelToFeet, pressureAltitudeFromQnh } from "../domain";
import { NumberField } from "./NumberField";
import { SliderField } from "./SliderField";

export type AltitudeMode = "alt" | "fl" | "da";

export type AltitudeInputValue = {
  mode: AltitudeMode;
  altitudeFt: number;
  flightLevel: number;
  densityAltitudeFt: number;
  oatC: number;
  qnhHpa: number;
};

export function resolveAltitudeInput(value: AltitudeInputValue) {
  if (value.mode === "da") {
    return {
      densityAltitudeFt: value.densityAltitudeFt,
      pressureAltitudeFt: value.densityAltitudeFt,
      atmosphere: null,
    };
  }
  const pressureAltitudeFt = value.mode === "alt"
    ? pressureAltitudeFromQnh(value.altitudeFt, value.qnhHpa)
    : flightLevelToFeet(value.flightLevel);
  const atmosphere = densityAltitude(pressureAltitudeFt, value.oatC);
  return { densityAltitudeFt: atmosphere.densityAltitudeFt, pressureAltitudeFt, atmosphere };
}

export function AltitudeInput({
  value,
  onChange,
}: {
  value: AltitudeInputValue;
  onChange: (value: AltitudeInputValue) => void;
}) {
  const set = (change: Partial<AltitudeInputValue>) => onChange({ ...value, ...change });
  const resolved = resolveAltitudeInput(value);

  return (
    <>
      <div className="mode-toggle" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
        {([["alt", "Altitude"], ["fl", "Flight Level"], ["da", "Density Alt."]] as const).map(([mode, label]) => (
          <button className={`mode-btn${value.mode === mode ? " active" : ""}`} type="button" onClick={() => set({ mode })} key={mode}>{label}</button>
        ))}
      </div>
      {value.mode === "alt" ? <div className="pa-mode"><NumberField label="Höhe" unit="ft" value={value.altitudeFt} step={100} onChange={(altitudeFt) => set({ altitudeFt })} /><SliderField label="QNH" unit="hPa" value={value.qnhHpa} min={950} max={1050} onChange={(qnhHpa) => set({ qnhHpa })} /></div> : null}
      {value.mode === "fl" ? <div className="pa-mode"><NumberField label="Flight Level" unit="FL" value={value.flightLevel} step={5} onChange={(flightLevel) => set({ flightLevel })} /></div> : null}
      {value.mode === "da" ? <div className="pa-mode"><NumberField label="Density Altitude" unit="ft" value={value.densityAltitudeFt} step={100} onChange={(densityAltitudeFt) => set({ densityAltitudeFt })} /></div> : null}
      {value.mode !== "da" ? <div style={{ marginTop: "1.25rem" }}><SliderField label="OAT" unit="°C" value={value.oatC} min={-40} max={50} onChange={(oatC) => set({ oatC })} /></div> : null}
      {value.mode !== "da" ? <div className="derived-box"><div className="derived-label">Density Altitude</div><div className="derived-value">{resolved.densityAltitudeFt.toLocaleString("de-DE")} ft</div></div> : null}
    </>
  );
}
