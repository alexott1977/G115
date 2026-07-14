import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { PlaneLanding, PlaneTakeoff } from "lucide-react";
import { calculateClimb as calculateG115BClimb } from "../aircraft/g115b/calculators";
import { g115bData } from "../aircraft/g115b/data";
import { useAircraft } from "../app/AircraftContext";
import { performanceForAircraft } from "../app/aircraftPerformance";
import { useFlightPlan, type FlightPlanTakeoffStart } from "../app/FlightPlanContext";
import { interpolate1D } from "../domain";
import { AltitudeInput, type AltitudeInputValue, resolveAltitudeInput } from "../components/AltitudeInput";
import { CalculatorCard, MetricItem } from "../components/CalculatorCard";
import { CalculatorInputSection } from "../components/CalculatorInputSection";
import { createPdfBlobFromCanvas, openExportBlob, openExportTab, warmPdfExportModule } from "../export/pdf";

type ClimbResult = ReturnType<typeof calculateG115BClimb>;
type LegState = AltitudeInputValue;
type ChartPoint = readonly [number, number];

const CHART = { width: 929, height: 1400, left: 170, top: 337, bottom: 879, fuelY: 824, maxDa: 20000 };
const START_COLOR = "#e15a18";
const DESTINATION_COLOR = "#008fc7";
const CHART_SOURCE = `${import.meta.env.BASE_URL}assets/grob115b-climb-chart.png`;

function describeLeg(leg: LegState) {
  if (leg.mode === "da") return `Dichtehöhe ${leg.densityAltitudeFt.toLocaleString("de-DE")} ft`;
  if (leg.mode === "fl") return `FL ${leg.flightLevel} · OAT ${leg.oatC} °C`;
  return `Höhe ${leg.altitudeFt.toLocaleString("de-DE")} ft · QNH ${leg.qnhHpa} hPa · OAT ${leg.oatC} °C`;
}

function LegFields({ defaultOpen = true, icon, title, leg, onChange }: { defaultOpen?: boolean; icon: ReactNode; title: string; leg: LegState; onChange: (leg: LegState) => void }) {
  return (
    <CalculatorInputSection
      defaultOpen={defaultOpen}
      description="Höhe, QNH und Temperatur"
      icon={icon}
      summary={describeLeg(leg)}
      title={title}
    >
      <AltitudeInput value={leg} onChange={onChange} />
    </CalculatorInputSection>
  );
}

function takeoffStartToLeg(takeoffStart: FlightPlanTakeoffStart): LegState {
  return {
    mode: "da",
    altitudeFt: takeoffStart.elevationFt ?? 0,
    flightLevel: 0,
    densityAltitudeFt: takeoffStart.densityAltitudeFt,
    oatC: takeoffStart.oatC,
    qnhHpa: takeoffStart.qnhHpa ?? 1013,
  };
}

function formatTakeoffSource(takeoffStart: FlightPlanTakeoffStart) {
  const source = [takeoffStart.airportLabel, takeoffStart.runwayLabel].filter(Boolean).join(" · ");
  return source || "Takeoff-Rechner";
}

function TakeoffStartImport({
  enabled,
  onEnabledChange,
  takeoffStart,
}: {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  takeoffStart?: FlightPlanTakeoffStart;
}) {
  if (!takeoffStart) {
    return (
      <div className="flight-plan-import empty">
        <div className="flight-plan-import-label">Start aus Takeoff übernehmen</div>
        <div className="flight-plan-import-copy">Noch keine Takeoff-Daten verfügbar.</div>
      </div>
    );
  }

  return (
    <div className="flight-plan-import">
      <div>
        <div className="flight-plan-import-label">Start aus Takeoff übernehmen</div>
        <div className="flight-plan-import-value">{takeoffStart.densityAltitudeFt.toLocaleString("de-DE")} ft DA</div>
        <div className="flight-plan-import-copy">
          {formatTakeoffSource(takeoffStart)} · PA {takeoffStart.pressureAltitudeFt.toLocaleString("de-DE")} ft · OAT {takeoffStart.oatC} °C · Takeoff {new Date(takeoffStart.updatedAt).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}
        </div>
      </div>
      <label className="import-toggle">
        <input type="checkbox" checked={enabled} onChange={(event) => onEnabledChange(event.target.checked)} />
        <span>{enabled ? "Start übernommen" : "Start übernehmen"}</span>
      </label>
    </div>
  );
}

function chartY(densityAltitudeFt: number) {
  const axis = g115bData.climb.chartAxes.densityAltitudeFt;
  return interpolate1D(axis.values, axis.pixels, Math.min(CHART.maxDa, Math.max(0, densityAltitudeFt)));
}

function ClimbOverlay({ inputs, result }: { inputs: { departureDensityAltitudeFt: number; destinationDensityAltitudeFt: number }; result: ClimbResult }) {
  if (result.error) return <svg className="climb-chart-overlay" viewBox={`0 0 ${CHART.width} ${CHART.height}`} />;
  const traces = [
    { da: inputs.departureDensityAltitudeFt, values: result.departureCumulative, color: START_COLOR },
    { da: inputs.destinationDensityAltitudeFt, values: result.destinationCumulative, color: DESTINATION_COLOR },
  ];
  return (
    <svg className="climb-chart-overlay" viewBox={`0 0 ${CHART.width} ${CHART.height}`} role="img" aria-label="Grafischer Rechenweg für Steigzeit, Kraftstoffverbrauch und Steigflugstrecke">
      {traces.map((trace) => {
        const y = chartY(trace.da);
        const x = trace.values.chartPixelX;
        const markers: ChartPoint[] = [[x, CHART.top], [x, CHART.fuelY], [x, CHART.bottom], [x, y], [CHART.left, y]];
        return (
          <g key={trace.color}>
            <polyline className="climb-chart-path" points={`${CHART.left},${y} ${x},${y} ${x},${CHART.bottom} ${x},${CHART.top}`} stroke={trace.color} fill="none" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            {markers.map(([markerX, markerY], index) => <circle cx={markerX} cy={markerY} r="5" fill={trace.color} key={index} />)}
          </g>
        );
      })}
    </svg>
  );
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("PNG konnte nicht erzeugt werden.")), "image/png"));
}

function drawText(context: CanvasRenderingContext2D, text: string, x: number, y: number, options: { color?: string; weight?: number; size?: number } = {}) {
  context.fillStyle = options.color || "#152235";
  context.font = `${options.weight || 600} ${options.size || 24}px "Segoe UI", Arial, sans-serif`;
  context.fillText(text, x, y);
}

function drawField(context: CanvasRenderingContext2D, label: string, value: string, x: number, y: number, width: number) {
  context.fillStyle = "#f4f8fb";
  context.strokeStyle = "#d8e3eb";
  context.lineWidth = 1;
  context.beginPath();
  context.roundRect(x, y, width, 72, 10);
  context.fill();
  context.stroke();
  drawText(context, label.toUpperCase(), x + 14, y + 24, { size: 13, weight: 700, color: "#607487" });
  drawText(context, value, x + 14, y + 54, { size: 19, weight: 700 });
}

function timestamp(date: Date) {
  return date.toISOString().replace("T", " ").replace(/:/g, "-").slice(0, 19);
}

function exportTimestamp(date: Date) {
  const value = date.toISOString();
  return `${value.slice(8, 10)}.${value.slice(5, 7)}.${value.slice(0, 4)} ${value.slice(11, 19)}Z`;
}

function drawOverlay(context: CanvasRenderingContext2D, inputs: { departureDensityAltitudeFt: number; destinationDensityAltitudeFt: number }, result: ClimbResult) {
  const traces = [
    { da: inputs.departureDensityAltitudeFt, values: result.departureCumulative, color: START_COLOR },
    { da: inputs.destinationDensityAltitudeFt, values: result.destinationCumulative, color: DESTINATION_COLOR },
  ];
  traces.forEach((trace) => {
    const x = trace.values.chartPixelX;
    const y = chartY(trace.da);
    context.strokeStyle = trace.color;
    context.fillStyle = trace.color;
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(CHART.left, y);
    context.lineTo(x, y);
    context.lineTo(x, CHART.bottom);
    context.lineTo(x, CHART.top);
    context.stroke();
    [[x, CHART.top], [x, CHART.fuelY], [x, CHART.bottom], [x, y], [CHART.left, y]].forEach(([markerX, markerY]) => {
      context.beginPath();
      context.arc(markerX, markerY, 5, 0, Math.PI * 2);
      context.fill();
    });
  });
}

async function exportChart(from: LegState, to: LegState, inputs: { departureDensityAltitudeFt: number; destinationDensityAltitudeFt: number }, result: ClimbResult) {
  const exportCanvas = await createClimbExportCanvas(from, to, inputs, result);
  if (!exportCanvas) return;
  const { canvas, exportDate } = exportCanvas;
  const blob = await canvasToBlob(canvas);
  await saveExportBlob(blob, `${timestamp(exportDate)}Z Grob G115B Steigflugberechnung.png`, "image/png");
}

async function exportChartPdf(from: LegState, to: LegState, inputs: { departureDensityAltitudeFt: number; destinationDensityAltitudeFt: number }, result: ClimbResult, options: { openWindow?: Window | null } = {}) {
  const exportCanvas = await createClimbExportCanvas(from, to, inputs, result);
  if (!exportCanvas) return;
  const { canvas, exportDate } = exportCanvas;
  const blob = await createPdfBlobFromCanvas(canvas);
  if (options.openWindow) {
    openExportBlob(blob, options.openWindow);
    return;
  }
  await saveExportBlob(blob, `${timestamp(exportDate)}Z Grob G115B Steigflugberechnung.pdf`, "application/pdf");
}

async function createClimbExportCanvas(from: LegState, to: LegState, inputs: { departureDensityAltitudeFt: number; destinationDensityAltitudeFt: number }, result: ClimbResult) {
  if (result.error || result.climbTimeMinutes === null || result.climbFuelLiters === null || result.climbDistanceKm === null || result.climbDistanceNm === null) return;
  const exportDate = new Date();
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 2280;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas wird von diesem Browser nicht unterstützt.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  drawText(context, `${exportTimestamp(exportDate)} – Grob G115B Steigflugberechnung`, 40, 52, { size: 27, weight: 700 });
  drawText(context, "Eingangswerte", 40, 94, { size: 18, weight: 700, color: "#006f9f" });
  drawField(context, "Start", describeLeg(from), 40, 110, 550);
  drawField(context, "Ziel", describeLeg(to), 610, 110, 550);
  drawField(context, "Start-Dichtehöhe", `${inputs.departureDensityAltitudeFt.toLocaleString("de-DE")} ft`, 40, 198, 550);
  drawField(context, "Ziel-Dichtehöhe", `${inputs.destinationDensityAltitudeFt.toLocaleString("de-DE")} ft`, 610, 198, 550);
  drawText(context, "Ergebnis", 40, 310, { size: 18, weight: 700, color: "#006f9f" });
  drawField(context, "Steigzeit", `${result.climbTimeMinutes.toFixed(1)} min`, 40, 326, 360);
  drawField(context, "Kraftstoff", `${result.climbFuelLiters.toFixed(1)} l`, 420, 326, 360);
  drawField(context, "Strecke", `${result.climbDistanceKm.toFixed(1)} km / ${result.climbDistanceNm.toFixed(1)} nm`, 800, 326, 360);
  drawText(context, result.warnings.length ? `Warnungen: ${result.warnings.map((warning) => warning.text).join(" · ")}` : "Warnungen: keine", 40, 438, { size: 16, color: result.warnings.length ? "#9a5200" : "#526274" });
  context.drawImage(await loadImage(CHART_SOURCE), 0, 472, 1200, 1808);
  context.save();
  context.translate(0, 472);
  context.scale(1200 / CHART.width, 1808 / CHART.height);
  drawOverlay(context, inputs, result);
  context.restore();

  return { canvas, exportDate };
}

async function saveExportBlob(blob: Blob, fileName: string, type: string) {
  const file = new File([blob], fileName, { type });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file] });
    return;
  }
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function ContextCard({ inputs, result }: { inputs: { departureDensityAltitudeFt: number; destinationDensityAltitudeFt: number }; result: ClimbResult }) {
  return (
    <CalculatorCard title="Rahmenbedingungen">
      <div className="context-card-body">
        <div className="context-card-block">
          <div className="climb-cols">
            <div className="atmos-item"><div className="atmos-item-label">Start DA</div><div className="atmos-item-value">{inputs.departureDensityAltitudeFt.toLocaleString("de-DE")} <span>ft</span></div><div className="step-detail">Zeit kum.: {result.departureCumulative.timeMinutes.toFixed(1)} min · Kraft.: {result.departureCumulative.fuelLiters.toFixed(1)} l · Str.: {result.departureCumulative.distanceKm.toFixed(1)} km</div></div>
            <div className="climb-arrow">→</div>
            <div className="atmos-item"><div className="atmos-item-label">Ziel DA</div><div className="atmos-item-value">{inputs.destinationDensityAltitudeFt.toLocaleString("de-DE")} <span>ft</span></div><div className="step-detail">Zeit kum.: {result.destinationCumulative.timeMinutes.toFixed(1)} min · Kraft.: {result.destinationCumulative.fuelLiters.toFixed(1)} l · Str.: {result.destinationCumulative.distanceKm.toFixed(1)} km</div></div>
          </div>
        </div>
        <div className="context-card-block"><div className="context-divider">Bedingungen</div><div className="conditions-grid">{result.conditions.map((condition) => <span key={condition}>{condition}</span>)}</div></div>
        <div className="context-card-block context-warning-block"><div className="context-divider">Eingabeprüfung</div><div className="context-warning-slot">{result.error ? <div className="warnings"><div className="warn-item danger">{result.error.text}</div></div> : <div className="context-warning-empty">Start- und Ziel-Dichtehöhe sind gültig.</div>}</div></div>
      </div>
    </CalculatorCard>
  );
}

function ChartCard({ from, to, inputs, result }: { from: LegState; to: LegState; inputs: { departureDensityAltitudeFt: number; destinationDensityAltitudeFt: number }; result: ClimbResult }) {
  const [exporting, setExporting] = useState<"png" | "pdf" | "pdf-open" | null>(null);
  const valid = !result.error && result.climbTimeMinutes !== null && result.climbFuelLiters !== null && result.climbDistanceKm !== null && result.climbDistanceNm !== null;
  const saveImage = async () => {
    setExporting("png");
    try { await exportChart(from, to, inputs, result); } finally { setExporting(null); }
  };
  const savePdf = async () => {
    setExporting("pdf");
    try { await exportChartPdf(from, to, inputs, result); } finally { setExporting(null); }
  };
  const openPdf = async () => {
    setExporting("pdf-open");
    let exportWindow: Window | null = null;
    try {
      exportWindow = openExportTab();
      await exportChartPdf(from, to, inputs, result, { openWindow: exportWindow });
    } catch (error) {
      exportWindow?.close();
      console.error(error);
    } finally {
      setExporting(null);
    }
  };
  return (
    <section className="card takeoff-chart-card climb-chart-card traceability-card">
      <div className="traceability-header">
        <div>
          <div className="card-title">Nachvollziehbarkeit</div>
          <div className="traceability-description">Rechenweg im originalen Flughandbuchdiagramm</div>
        </div>
      </div>
      <div className="traceability-toolbar">
        <div className="takeoff-chart-actions">
          <button className="takeoff-chart-download" type="button" disabled={!valid || exporting !== null} onClick={saveImage}>
            {exporting === "png" ? "Erzeuge PNG…" : "PNG speichern"}
          </button>
          <button className="takeoff-chart-download" type="button" disabled={!valid || exporting !== null} onFocus={warmPdfExportModule} onPointerEnter={warmPdfExportModule} onClick={savePdf}>
            {exporting === "pdf" ? "PDF vorbereiten…" : "PDF speichern"}
          </button>
          <button className="takeoff-chart-download" type="button" disabled={!valid || exporting !== null} onFocus={warmPdfExportModule} onPointerEnter={warmPdfExportModule} onClick={openPdf}>
            {exporting === "pdf-open" ? "PDF öffnen…" : "PDF öffnen"}
          </button>
        </div>
      </div>
      <div className="climb-chart-scroll"><div className="climb-chart-stage"><img className="climb-chart-image" src={CHART_SOURCE} alt="Originales Flughandbuchdiagramm Bild 5.3.9 Steigflug" width={CHART.width} height={CHART.height} /><ClimbOverlay inputs={inputs} result={result} /></div></div>
      <div className="climb-chart-results">
        <div className="climb-chart-result start"><strong>Start · kumulativ</strong><span>{result.departureCumulative.timeMinutes.toFixed(1)} min · {result.departureCumulative.fuelLiters.toFixed(1)} l · {result.departureCumulative.distanceKm.toFixed(1)} km</span></div>
        <div className="climb-chart-result delta"><strong>Steigflug · Differenz</strong><span>{valid ? `${result.climbTimeMinutes!.toFixed(1)} min · ${result.climbFuelLiters!.toFixed(1)} l · ${result.climbDistanceKm!.toFixed(1)} km · ${result.climbDistanceNm!.toFixed(1)} nm` : "—"}</span></div>
        <div className="climb-chart-result destination"><strong>Ziel · kumulativ</strong><span>{result.destinationCumulative.timeMinutes.toFixed(1)} min · {result.destinationCumulative.fuelLiters.toFixed(1)} l · {result.destinationCumulative.distanceKm.toFixed(1)} km</span></div>
      </div>
    </section>
  );
}

export function ClimbPage() {
  const { aircraft } = useAircraft();
  const performance = performanceForAircraft(aircraft);
  const { calculateClimb } = performance.calculators;
  const { flightPlan, updateClimbCalculator, updateImports } = useFlightPlan();
  const savedCalculator = flightPlan.climbCalculator;
  const [from, setFrom] = useState<LegState>(savedCalculator?.from ?? { mode: "alt", altitudeFt: 0, flightLevel: 0, densityAltitudeFt: 0, oatC: 15, qnhHpa: 1013 });
  const [to, setTo] = useState<LegState>(savedCalculator?.to ?? { mode: "alt", altitudeFt: 4500, flightLevel: 45, densityAltitudeFt: 4500, oatC: 6, qnhHpa: 1013 });
  const takeoffStart = flightPlan.takeoffStart;
  const takeoffStartLeg = useMemo(() => takeoffStart ? takeoffStartToLeg(takeoffStart) : undefined, [takeoffStart]);
  const activeFrom = flightPlan.imports.climbStartFromTakeoff && takeoffStartLeg ? takeoffStartLeg : from;
  const usesTakeoffStart = activeFrom === takeoffStartLeg;
  const inputs = useMemo(() => ({
    departureDensityAltitudeFt: resolveAltitudeInput(activeFrom).densityAltitudeFt,
    destinationDensityAltitudeFt: resolveAltitudeInput(to).densityAltitudeFt,
  }), [activeFrom, to]);
  const result = useMemo(() => calculateClimb(inputs), [inputs]);
  const valid = !result.error;

  useEffect(() => {
    document.body.classList.add("runway-calculator", "climb-calculator");
    return () => document.body.classList.remove("runway-calculator", "climb-calculator");
  }, []);
  useEffect(() => {
    updateClimbCalculator({ from, to });
  }, [from, to, updateClimbCalculator]);

  return (
    <div className="page-layout compact-calculator-layout">
      <aside className="sidebar compact-input-panel">
        <CalculatorInputSection
          icon={<PlaneTakeoff aria-hidden="true" />}
          title="Abflug"
          description="Startwert für den Steigflug"
          summary={describeLeg(activeFrom)}
        >
          <TakeoffStartImport
            enabled={flightPlan.imports.climbStartFromTakeoff}
            onEnabledChange={(enabled) => updateImports({ climbStartFromTakeoff: enabled })}
            takeoffStart={takeoffStart}
          />
          {usesTakeoffStart ? (
            <div className="derived-box">
              <div className="derived-label">Übernommene Start-Dichtehöhe</div>
              <div className="derived-value">{activeFrom.densityAltitudeFt.toLocaleString("de-DE")} ft</div>
            </div>
          ) : <AltitudeInput value={from} onChange={setFrom} />}
        </CalculatorInputSection>
        <LegFields defaultOpen={false} icon={<PlaneLanding aria-hidden="true" />} title="Ziel" leg={to} onChange={setTo} />
      </aside>
      <main className="results">
        {result.warnings.length ? <div className="warnings">{result.warnings.map((warning) => <div className={`warn-item${warning.danger ? " danger" : ""}`} key={warning.text}>{warning.text}</div>)}</div> : null}
        <ContextCard inputs={inputs} result={result} />
        <CalculatorCard title={valid ? `Ergebnis - ${inputs.departureDensityAltitudeFt.toLocaleString("de-DE")} → ${inputs.destinationDensityAltitudeFt.toLocaleString("de-DE")} ft DA` : "Ergebnis - Eingabe prüfen"} className="climb-primary-results">
          <div className="result-grid climb-result-grid">
            <MetricItem label="Steigzeit · Climb Time" value={valid ? result.climbTimeMinutes!.toFixed(1) : "—"} unit={valid ? "min" : ""} />
            <MetricItem label="Kraftstoff · Fuel" value={valid ? result.climbFuelLiters!.toFixed(1) : "—"} unit={valid ? "l" : ""} />
            <MetricItem label="Strecke · Distance" value={valid ? result.climbDistanceNm!.toFixed(1) : "—"} unit={valid ? "nm" : ""} subtext={valid ? `${result.climbDistanceKm!.toFixed(1)} km` : undefined} />
          </div>
        </CalculatorCard>
        {performance.hasChartOverlays ? (
          <ChartCard from={activeFrom} to={to} inputs={inputs} result={result} />
        ) : (
          <CalculatorCard title="Nachvollziehbarkeit">
            <div className="conditions-grid">
              {result.conditions.map((condition) => <span key={condition}>{condition}</span>)}
              <span>Start und Ziel aus DR400-Steigflug-Tabelle interpoliert</span>
            </div>
          </CalculatorCard>
        )}
      </main>
    </div>
  );
}
