import { useEffect } from "react";
import { Link } from "react-router-dom";

export function FlightPlanMassImport({
  label,
  massKg,
  fuelLiters,
  updatedAt,
  enabled,
  onEnabledChange,
  onImport,
}: {
  label: string;
  massKg?: number;
  fuelLiters?: number;
  updatedAt?: string;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  onImport: (massKg: number) => void;
}) {
  const available = massKg !== undefined && fuelLiters !== undefined && updatedAt !== undefined;
  const importedMassKg = available ? Math.ceil(massKg) : undefined;

  useEffect(() => {
    if (enabled && importedMassKg !== undefined) onImport(importedMassKg);
  }, [enabled, importedMassKg, onImport]);

  if (!available) {
    return (
      <div className="flight-plan-import empty">
        <div className="flight-plan-import-label">{label}</div>
        <div className="flight-plan-import-copy">Noch keine Masse aus Weight & Balance verfügbar.</div>
        <Link to="/weight_balance.html">Weight & Balance öffnen</Link>
      </div>
    );
  }

  return (
    <div className="flight-plan-import">
      <div>
        <div className="flight-plan-import-label">{label}</div>
        <div className="flight-plan-import-value">{massKg.toFixed(1)} kg</div>
        <div className="flight-plan-import-copy">
          Übernahme konservativ als {importedMassKg} kg · {fuelLiters.toFixed(1)} l Kraftstoff · W&B {new Date(updatedAt).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}
        </div>
      </div>
      <label className="import-toggle">
        <input type="checkbox" checked={enabled} onChange={(event) => onEnabledChange(event.target.checked)} />
        <span>{enabled ? "Masse übernommen" : "Masse übernehmen"}</span>
      </label>
    </div>
  );
}
