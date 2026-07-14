import { Eye, EyeOff, FileText, Gauge, KeyRound, Laptop, Moon, Settings, Sun } from "lucide-react";
import { useState } from "react";
import { buildInfo, formatBuildVersion } from "../app/buildInfo";
import type { SpeedUnitPreference } from "../app/AircraftContext";
import type { ThemePreference } from "../app/theme";
import { getOpenAipApiKey, setOpenAipApiKey } from "../flight-data/openAipKey";

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

  const [apiKeyValue, setApiKeyValue] = useState<string>(() => getOpenAipApiKey() ?? "");
  const [apiKeyStored, setApiKeyStored] = useState<boolean>(() => Boolean(getOpenAipApiKey()));
  const [apiKeyVisible, setApiKeyVisible] = useState(false);

  const saveApiKey = () => {
    const trimmed = apiKeyValue.trim();
    setOpenAipApiKey(trimmed || null);
    setApiKeyStored(Boolean(trimmed));
    if (!trimmed) setApiKeyValue("");
  };

  const clearApiKey = () => {
    setOpenAipApiKey(null);
    setApiKeyValue("");
    setApiKeyStored(false);
  };

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
        <div className="settings-page-row settings-info-row">
          <KeyRound aria-hidden="true" />
          <span>
            <strong>OpenAIP API-Schlüssel</strong>
            <small>
              Nur nötig ohne Cloudflare-Worker (z. B. GitHub Pages). Schlüssel unter{" "}
              <a href="https://www.openaip.net/users/clients" target="_blank" rel="noopener noreferrer">openaip.net</a>{" "}
              erstellen. Wird nur lokal im Browser gespeichert.
            </small>
          </span>
          <div className="settings-meta-actions" style={{ flexDirection: "column", alignItems: "stretch", gap: "0.5rem" }}>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <input
                aria-label="OpenAIP API-Schlüssel"
                autoComplete="off"
                onChange={(event) => setApiKeyValue(event.target.value)}
                placeholder={apiKeyStored ? "Gespeichert - zum Ändern neuen Schlüssel eingeben" : "OpenAIP API-Schlüssel"}
                spellCheck={false}
                style={{ flex: 1, minWidth: 0, fontFamily: "monospace" }}
                type={apiKeyVisible ? "text" : "password"}
                value={apiKeyValue}
              />
              <button
                aria-label={apiKeyVisible ? "Schlüssel verbergen" : "Schlüssel anzeigen"}
                onClick={() => setApiKeyVisible((visible) => !visible)}
                type="button"
              >
                {apiKeyVisible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
              </button>
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button onClick={saveApiKey} type="button">Speichern</button>
              <button disabled={!apiKeyStored && !apiKeyValue} onClick={clearApiKey} type="button">Löschen</button>
              <small style={{ alignSelf: "center", opacity: 0.7 }}>
                {apiKeyStored ? "Aktiv - Flugplatzsuche geht direkt an OpenAIP." : "Nicht gesetzt - Flugplatzsuche nutzt den Worker."}
              </small>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
