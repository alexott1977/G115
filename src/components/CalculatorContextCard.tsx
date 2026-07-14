import type { Atmosphere, Warning } from "../domain";
import { formatSigned } from "../domain";
import { CalculatorCard } from "./CalculatorCard";

type CalculatorContextCardProps = {
  title?: string;
  atmosphere?: Atmosphere;
  atmosphereWarningThresholdFt?: number;
  conditions: string[];
  warnings?: Warning[];
  warningTitle?: string;
};

export function CalculatorContextCard({
  title = "Kontext",
  atmosphere,
  atmosphereWarningThresholdFt = 5000,
  conditions,
  warnings,
  warningTitle = "Warnungen",
}: CalculatorContextCardProps) {
  const isaClass = atmosphere
    ? Math.abs(atmosphere.isaDeviationC) < 0.1
      ? ""
      : atmosphere.isaDeviationC > 0
        ? " warn"
        : " good"
    : "";

  return (
    <CalculatorCard title={title}>
      <div className="context-card-body">
        {atmosphere ? (
          <div className="context-card-block">
            <div className="context-divider">Atmosphäre</div>
            <div className="atmos-grid">
              <div className="atmos-item">
                <div className="atmos-item-label">Density Altitude</div>
                <div className={`atmos-item-value${atmosphere.densityAltitudeFt > atmosphereWarningThresholdFt ? " warn" : ""}`}>
                  {atmosphere.densityAltitudeFt.toLocaleString("de-DE")} <span>ft</span>
                </div>
              </div>
              <div className="atmos-item">
                <div className="atmos-item-label">ISA-Abweichung</div>
                <div className={`atmos-item-value${isaClass}`}>
                  {formatSigned(atmosphere.isaDeviationC, 1)} <span>°C</span>
                </div>
              </div>
            </div>
          </div>
        ) : null}
        {warnings !== undefined ? (
          <div className="context-card-block context-warning-block">
            <div className="context-divider">{warningTitle}</div>
            <div className="context-warning-slot">
              {warnings.length ? (
                <div className="warnings">
                  {warnings.map((warning) => (
                    <div className={`warn-item${warning.danger ? " danger" : ""}`} key={warning.text}>
                      {warning.text}
                    </div>
                  ))}
                </div>
              ) : <div className="context-warning-empty">Keine Warnungen.</div>}
            </div>
          </div>
        ) : null}
        <div className="context-card-block">
          <div className="context-divider">Bedingungen</div>
          <div className="conditions-grid">
            {conditions.map((condition) => <span key={condition}>{condition}</span>)}
          </div>
        </div>
      </div>
    </CalculatorCard>
  );
}
