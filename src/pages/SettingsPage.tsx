import { FileText, Gauge, Laptop, Moon, Settings, Sun } from "lucide-react";
import { buildInfo, formatBuildVersion } from "../app/buildInfo";
import type { SpeedUnitPreference } from "../app/AircraftContext";
import type { ThemePreference } from "../app/theme";

export function SettingsPage({
  preference,
  speedUnitPreference,
  onOpenUsageNotice,
  onSelectSpeedUnit,
  onSelectTheme,
}: {
  preference: ThemePreference;
  speedUnitPreference?: SpeedUnitPreference;
  onOpenUsageNotice: () => void;
  onSelectSpeedUnit?: (preference: SpeedUnitPreference) => void;
  onSelectTheme: (preference: ThemePreference) => void;
}) {
  const themeOptions = [
    { value: "auto", label: "Automatisch", Icon: Laptop },
    { value: "light", label: "Hell", Icon: Sun },
    { value: "dark", label: "Dunkel", Icon: Moon },
  ] as const;
  const speedUnitOptions = [
    { value: "auto", label: "Automatisch" },
    { value: "kt", label: "kt" },
    { value: "kmh", label: "km/h" },
  ] as const;

  return (
    <main className="settings-page">
      <section className="settings-page-card settings-page-intro">
        <Settings aria-hidden="true" />
        <div>
          <h1>Einstellungen</h1>
          <p>Darstellung und zentrale Funktionen der Anwendung.</p>
        </div>
      </section>
      <section className="settings-page-card">
        <div className="settings-page-row settings-theme-row">
          <Moon aria-hidden="true" />
          <span><strong>Darstellung</strong><small>Farbschema der Anwendung</small></span>
          <div className="settings-theme-options" role="group" aria-label="Farbschema">
            {themeOptions.map(({ value, label, Icon }) => (
              <button
                className={preference === value ? "active" : ""}
                type="button"
                aria-pressed={preference === value}
                onClick={() => onSelectTheme(value)}
                key={value}
              >
                <Icon aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="settings-page-row settings-info-row">
          <FileText aria-hidden="true" />
          <span><strong>Disclaimer</strong><small>Hinweis zur Nutzung und Version</small></span>
          <div className="settings-meta-actions">
            <b title={`Commit ${buildInfo.fullCommit}${buildInfo.dirty ? " · lokal verändert" : ""} · Build ${buildInfo.builtAt}`}>
              {formatBuildVersion()}
            </b>
            <button type="button" onClick={onOpenUsageNotice}>Disclaimer anzeigen</button>
          </div>
        </div>
        {onSelectSpeedUnit ? <div className="settings-page-row settings-theme-row">
          <Gauge aria-hidden="true" />
          <span><strong>Geschwindigkeit</strong><small>Anzeige für das aktuell gewählte Flugzeug</small></span>
          <div className="settings-theme-options" role="group" aria-label="Geschwindigkeitseinheit">
            {speedUnitOptions.map(({ value, label }) => (
              <button
                className={(speedUnitPreference ?? "auto") === value ? "active" : ""}
                type="button"
                aria-pressed={(speedUnitPreference ?? "auto") === value}
                onClick={() => onSelectSpeedUnit?.(value)}
                key={value}
              >
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div> : null}
      </section>
    </main>
  );
}
