## Haftungsausschluss / Disclaimer

### Deutsch

Die bereitgestellten Daten und Informationen dienen ausschließlich zu Demonstrations-, Lern- und/oder Entwicklungszwecken. Sie sind **nicht** für die Verwendung in der realen Flugnavigation, Flugvorbereitung oder Leistungsberechnung von Luftfahrzeugen bestimmt.

Es wird keinerlei Gewähr für die Richtigkeit, Vollständigkeit oder Aktualität der Daten übernommen. Die Nutzung der Daten für operationelle oder sicherheitsrelevante Entscheidungen erfolgt ausschließlich auf eigenes Risiko.

**Für reale Flugbetriebe sind ausschließlich offiziell veröffentlichte und zugelassene Quellen (z. B. AIP, Flughandbücher, zugelassene Performance-Daten) zu verwenden.**

---

### English

The provided data and information are intended for demonstration, educational, and/or development purposes only. They are **not** intended for use in real-world flight navigation, flight planning, or aircraft performance calculations.

No warranty is given regarding the accuracy, completeness, or currency of the data. Any use of this information for operational or safety-critical decisions is entirely at the user's own risk.

**For actual flight operations, only officially published and approved sources (e.g., AIP, aircraft flight manuals, certified performance data) must be used.**

---

## PWA / Homescreen Installation

Die Seiten sind als Progressive Web App (PWA) vorbereitet und können auf iOS und Android zum Homescreen hinzugefügt werden.

Wichtig: Die Installation funktioniert nur über `http://localhost` oder über HTTPS, nicht beim direkten Öffnen der HTML-Dateien via `file://`.

Zum lokalen Testen reicht ein einfacher statischer Webserver im Repository-Ordner, zum Beispiel:

```powershell
python -m http.server 8080
```

Danach die App unter `http://localhost:8080` im Browser öffnen und von dort installieren.

---

## Deployment auf Cloudflare Workers

Die Anwendung wird mit Vite gebaut. Der Build erzeugt die React-App und kopiert die statischen Diagramme, Icons sowie PWA-Ressourcen nach `dist`:

```powershell
npm run build
```

Cloudflare verwendet für neue Git-Deployments den gemeinsamen Workers-Dialog. Die statische Website wird dabei über Workers Static Assets ausgeliefert. `wrangler.jsonc` startet das Flight-Data-Gateway aus `worker/index.ts` zuerst; alle Nicht-API-Anfragen werden von dort an die statischen Assets in `dist` weitergereicht.

Für das über GitHub verbundene Cloudflare-Projekt werden folgende Einstellungen verwendet:

| Einstellung | Wert |
| --- | --- |
| Project name | `performance-calculators` |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Non-production branch deploy command | `npx wrangler versions upload` |
| Path | `/` |

`main` wird als Production Branch gewählt. Builds für Non-production Branches können aktiviert bleiben.

Für die OpenAIP-Anbindung muss das API-Key-Secret einmal pro Cloudflare-Worker gesetzt werden:

```powershell
npx wrangler secret put OPENAIP_API_KEY
```

Für die lokale Entwicklung mit `npx wrangler dev` kann der Schlüssel in einer nicht eingecheckten Datei `.dev.vars` stehen:

```text
OPENAIP_API_KEY=...
```

Die Datei `_headers` ergänzt Sicherheits-Header für statische Antworten und verhindert langlebiges Browser-Caching von Service Worker und Web App Manifest. API-Antworten werden nicht durch den Service Worker gespeichert; das Gateway cached erfolgreiche OpenAIP-Antworten stattdessen für bis zu eine Stunde am Cloudflare-Edge.

---

## React-Anwendung

Die Startseite, gemeinsame App-Grundlage und alle Rechner verwenden React, TypeScript und Vite. Die bisherigen Rechner-URLs bleiben durch das SPA-Routing erhalten.

- `src/app/`
  Enthält zentrale Definitionen wie Aircraft Registry, Flugzeug-Kontext, Flight-Plan-Kontext, Calculator Registry und Theme-Verhalten. Der Flugzeug-Kontext verwaltet die zentrale Typauswahl und filtert die verfügbaren Rechner anhand der Fähigkeiten des gewählten Flugzeugs.
- `src/components/`
  Enthält gemeinsame React-Komponenten der App-Shell.
- `src/pages/`
  Enthält die React-Seiten der Rechner.
- `scripts/copy-static.cjs`
  Kopiert Diagramme, Icons und PWA-Ressourcen nach dem Vite-Build in `dist`.

Lokale Entwicklung:

```powershell
npm run dev
```

TypeScript-Prüfung:

```powershell
npm run typecheck
```

Der Vite-Build liest den aktuellen Git-Commit ein und zeigt ihn im Hinweisfenster
als Versionsstand im Format `VERSION: a4f4540` an. Vollständiger Commit,
Build-Zeitpunkt und lokaler Änderungsstatus stehen im Tooltip.

---

## Code-Struktur

Die Rechenlogik ist jetzt bewusst von der HTML-Oberfläche getrennt:

- `src/domain/`
  Enthält flugzeugunabhängige Rechenhilfen, Atmosphärenlogik, Geometrie und gemeinsame Typen.
- `src/aircraft/g115b/`
  Enthält die typisierten G115B-Performance-Daten und Calculator-Funktionen.
- `css/theme.css`
  Enthält die zentralen Theme-Variablen sowie die gemeinsamen App-/Navigations-Styles.
- `css/calculator.css`
  Enthält die gemeinsame Oberfläche aller Rechnerseiten.
- `css/index.css`
  Enthält die spezifischen Styles der Übersichtsseite.

Damit sind die fachlichen Daten und die eigentliche Berechnung deutlich einfacher zu prüfen als in den vorherigen großen Inline-Skripten der HTML-Dateien.
Die Berechnungen bleiben browserunabhängig, während React die Benutzeroberfläche verwaltet.

## Tests

Die Rechenlogik wird mit Vitest direkt gegen den TypeScript-Domain-Layer geprüft:

```powershell
npm test
```

Die Tests verwenden feste Referenzfälle gegen die pure Calculator-Logik in `src/aircraft/g115b/calculators.ts`, Rendering-Tests für alle Rechnerseiten sowie jsdom-Interaktionstests für wichtige UI-Abläufe.

Weight & Balance ist die führende Quelle für Beladung, Startkraftstoff, geplanten Verbrauch sowie daraus berechnete Start- und Landemasse. Takeoff und Landing können die jeweils passende Masse explizit aus dem persistenten Flugplan übernehmen. Anschließende lokale Änderungen in diesen Rechnern werden nicht in den Flugplan zurückgeschrieben.

W&B zeigt die berechneten Massen mit einer Nachkommastelle. Bei der Übernahme in einen Performance-Rechner wird die Masse konservativ auf das nächste volle Kilogramm aufgerundet; lokale Massefelder arbeiten in Schritten von 1 kg.

## Flugplatz- und Wetterdaten

Die Takeoff- und Landing-Rechner besitzen einen `Airport`-Modus mit echten OpenAIP-Daten. Start- und Zielplatz werden mit gewählter Bahn und geplanter Zeit getrennt in der zentralen Flugplanung gespeichert.

- `/api/airports?search=...`: Same-Origin-Gateway für die OpenAIP-Flugplatzsuche.
- `/api/weather?...`: Same-Origin-Gateway für die Open-Meteo-Prognose aus dem DWD-Modell ICON-D2.
- `/api/airports/{id}`: Same-Origin-Gateway für einen gespeicherten Flugplatz.
- OpenAIP liefert Position, Elevation, magnetische Deklination sowie richtungsbezogene Bahndaten mit True Heading, Oberfläche, Abmessungen, erklärten Distanzen und Schwellenhöhe.

Der OpenAIP-API-Key bleibt ausschließlich als Worker-Secret auf Cloudflare und wird nicht an den Browser ausgeliefert. Das Gateway normalisiert die Anbieterantworten in das interne Flight-Data-Modell. OpenAIP-Bahnneigungen werden nicht verwendet, da die bereitgestellten Werte nicht zuverlässig nutzbar sind.

Die Übernahme von Flugplatz-, Wetter- und Massenwerten wird in Takeoff und Landing jeweils über getrennte persistente Schalter gesteuert. Aktiv übernommene Werte sind gegen manuelle Bearbeitung gesperrt; nach dem Ausschalten bleibt ihr aktueller Wert erhalten. Für die gewählte UTC-Zeit wird der nächstgelegene stündliche ICON-D2-Prognosepunkt genutzt. Alternativ können über `Jetzt` die aktuellen, auf 15-minütigen Modelldaten basierenden ICON-D2-Bedingungen gewählt werden. Die OpenAIP-Flugplatzhöhe wird für die räumliche Herunterskalierung an Open-Meteo übergeben. QNH, OAT und die Windkomponente entlang der gewählten Bahn werden auf die vom Rechner unterstützte Granularität gerundet. Die Bahnneigung wird im Takeoff-Rechner immer manuell gesetzt.

Geplante Start- und Landezeiten werden explizit in UTC und im 24-Stunden-Format erfasst. Die OpenAIP-Suche fragt zusätzlich diakritikfreie und deutsch transliterierte Varianten ab, sodass beispielsweise `Günzburg` auch `Guenzburg-Donauried` findet.

Offizielle Dokumentation:

- [OpenAIP API](https://docs.openaip.net/) und [Airport-Antwortschema](https://api.core.openaip.net/api/schemas/response/airport/airport-schema.json) – die Core API verlangt eine API-Key- oder Bearer-Authentifizierung.
- [Open-Meteo DWD ICON API](https://open-meteo.com/en/docs/dwd-api)
