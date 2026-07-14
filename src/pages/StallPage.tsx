import { useEffect, useMemo, useState } from "react";
import { Gauge, Plane, Settings } from "lucide-react";
import { calculateStall as calculateG115BStall } from "../aircraft/g115b/calculators";
import { g115bData } from "../aircraft/g115b/data";
import type { StallInputs } from "../aircraft/g115b/types";
import { useAircraft } from "../app/AircraftContext";
import { performanceForAircraft } from "../app/aircraftPerformance";
import { useFlightPlan } from "../app/FlightPlanContext";
import { interpolate1D } from "../domain";
import { CalculatorCard, MetricItem, SpeedSymbol } from "../components/CalculatorCard";
import { CalculatorInputSection } from "../components/CalculatorInputSection";
import { SliderField } from "../components/SliderField";
import { createPdfBlobFromCanvas, openExportBlob, openExportTab, warmPdfExportModule } from "../export/pdf";
import { speedText, speedUnitLabel, speedValue } from "../app/speed";

type StallResult = ReturnType<typeof calculateG115BStall>;
type ChartPoint = readonly [number, number];

const CHART_SOURCE = `${import.meta.env.BASE_URL}assets/grob115b-stall-chart.png`;
const TRACE_COLOR = "#e90000";

function chartPoint(inputs: StallInputs) {
  const chart = g115bData.stall.chart[inputs.powerMode === "vollast" ? "fullPower" : "idle"];
  const flapKey = `flaps${inputs.flapsDegrees}` as "flaps0" | "flaps12" | "flaps40";
  return {
    x: interpolate1D(g115bData.stall.chart.massValues, chart.massPixels, inputs.massKg),
    y: interpolate1D(g115bData.stall.massBreakpoints, chart.linePixels[flapKey], inputs.massKg),
    left: chart.massPixels[0],
    bottom: chart.speedPixels[0],
  };
}

function StallOverlay({ inputs }: { inputs: StallInputs }) {
  const point = chartPoint(inputs);
  const markers: ChartPoint[] = [[point.left, point.y], [point.x, point.y], [point.x, point.bottom]];
  return (
    <svg className="stall-chart-overlay" viewBox={`0 0 ${g115bData.stall.chart.width} ${g115bData.stall.chart.height}`} aria-label="Grafischer Rechenweg im originalen Überziehgeschwindigkeitsdiagramm">
      <polyline className="stall-chart-path" points={`${point.left},${point.y} ${point.x},${point.y} ${point.x},${point.bottom}`} fill="none" stroke={TRACE_COLOR} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      {markers.map(([x, y], index) => <circle cx={x} cy={y} r="5" fill={TRACE_COLOR} key={`${index}-${x}-${y}`} />)}
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
  drawText(context, value, x + 14, y + 54, { size: 20, weight: 700 });
}

function timestamp(date: Date) {
  return date.toISOString().replace("T", " ").replace(/:/g, "-").slice(0, 19);
}

function exportTimestamp(date: Date) {
  const value = date.toISOString();
  return `${value.slice(8, 10)}.${value.slice(5, 7)}.${value.slice(0, 4)} ${value.slice(11, 19)}Z`;
}

async function exportChart(inputs: StallInputs, result: StallResult) {
  const { canvas, exportDate } = await createStallExportCanvas(inputs, result);
  const blob = await canvasToBlob(canvas);
  await saveExportBlob(blob, `${timestamp(exportDate)}Z Grob G115B Überziehgeschwindigkeit.png`, "image/png");
}

async function exportChartPdf(inputs: StallInputs, result: StallResult, options: { openWindow?: Window | null } = {}) {
  const { canvas, exportDate } = await createStallExportCanvas(inputs, result);
  const blob = await createPdfBlobFromCanvas(canvas);
  if (options.openWindow) {
    openExportBlob(blob, options.openWindow);
    return;
  }
  await saveExportBlob(blob, `${timestamp(exportDate)}Z Grob G115B Überziehgeschwindigkeit.pdf`, "application/pdf");
}

async function createStallExportCanvas(inputs: StallInputs, result: StallResult) {
  const exportDate = new Date();
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 2190;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas wird von diesem Browser nicht unterstützt.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  drawText(context, `${exportTimestamp(exportDate)} – Grob G115B Überziehgeschwindigkeit`, 40, 54, { size: 28, weight: 700 });
  drawText(context, "Eingangswerte", 40, 98, { size: 18, weight: 700, color: "#006f9f" });
  drawField(context, "Flugmasse", `${inputs.massKg} kg`, 40, 114, 350);
  drawField(context, "Leistungsstellung", inputs.powerMode === "leerlauf" ? "Leerlauf" : "Vollast", 410, 114, 350);
  drawField(context, "Klappenstellung", `${inputs.flapsDegrees}°`, 780, 114, 380);
  drawText(context, "Ergebnis", 40, 226, { size: 18, weight: 700, color: "#006f9f" });
  drawField(context, `Überziehgeschwindigkeit · ${result.stallLabel} · IAS`, `${result.stallSpeedKt.toFixed(1)} kt / ${result.stallSpeedKmh.toFixed(1)} km/h`, 40, 242, 1120);
  context.drawImage(await loadImage(CHART_SOURCE), 0, 350, 1200, 1751);
  const point = chartPoint(inputs);
  context.save();
  context.translate(0, 350);
  context.scale(1200 / g115bData.stall.chart.width, 1751 / g115bData.stall.chart.height);
  context.strokeStyle = TRACE_COLOR;
  context.fillStyle = TRACE_COLOR;
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(point.left, point.y);
  context.lineTo(point.x, point.y);
  context.lineTo(point.x, point.bottom);
  context.stroke();
  [[point.left, point.y], [point.x, point.y], [point.x, point.bottom]].forEach(([x, y]) => {
    context.beginPath();
    context.arc(x, y, 5, 0, Math.PI * 2);
    context.fill();
  });
  context.restore();
  drawText(context, `Quelle: ${g115bData.stall.source} · Originaldiagramm mit grafischem Rechenweg`, 40, 2150, { size: 14, color: "#687b8d" });

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

function ChartCard({ inputs, result }: { inputs: StallInputs; result: StallResult }) {
  const [exporting, setExporting] = useState<"png" | "pdf" | "pdf-open" | null>(null);
  const saveImage = async () => {
    setExporting("png");
    try { await exportChart(inputs, result); } finally { setExporting(null); }
  };
  const savePdf = async () => {
    setExporting("pdf");
    try { await exportChartPdf(inputs, result); } finally { setExporting(null); }
  };
  const openPdf = async () => {
    setExporting("pdf-open");
    let exportWindow: Window | null = null;
    try {
      exportWindow = openExportTab();
      await exportChartPdf(inputs, result, { openWindow: exportWindow });
    } catch (error) {
      exportWindow?.close();
      console.error(error);
    } finally {
      setExporting(null);
    }
  };
  return (
    <section className="card takeoff-chart-card stall-chart-card traceability-card">
      <div className="traceability-header">
        <div>
          <div className="card-title">Nachvollziehbarkeit</div>
          <div className="traceability-description">Rechenweg im originalen Flughandbuchdiagramm</div>
        </div>
      </div>
      <div className="traceability-toolbar">
        <div className="takeoff-chart-actions">
          <button className="takeoff-chart-download" type="button" disabled={exporting !== null} onClick={saveImage}>
            {exporting === "png" ? "Erzeuge PNG…" : "PNG speichern"}
          </button>
          <button className="takeoff-chart-download" type="button" disabled={exporting !== null} onFocus={warmPdfExportModule} onPointerEnter={warmPdfExportModule} onClick={savePdf}>
            {exporting === "pdf" ? "PDF vorbereiten…" : "PDF speichern"}
          </button>
          <button className="takeoff-chart-download" type="button" disabled={exporting !== null} onFocus={warmPdfExportModule} onPointerEnter={warmPdfExportModule} onClick={openPdf}>
            {exporting === "pdf-open" ? "PDF öffnen…" : "PDF öffnen"}
          </button>
        </div>
      </div>
      <div className="stall-chart-scroll"><div className="stall-chart-stage"><img className="stall-chart-image" src={CHART_SOURCE} alt="Originales Flughandbuchdiagramm Bild 5.3.4 Überziehgeschwindigkeiten" width={g115bData.stall.chart.width} height={g115bData.stall.chart.height} /><StallOverlay inputs={inputs} /></div></div>
      <div className="takeoff-chart-legend"><span>{inputs.powerMode === "leerlauf" ? "Leerlauf" : "Vollast"} · Klappen {inputs.flapsDegrees}°</span><span>{inputs.massKg} kg</span><span>IAS · {result.stallSpeedKt.toFixed(1)} kt · {result.stallSpeedKmh.toFixed(1)} km/h</span></div>
    </section>
  );
}

export function StallPage() {
  const { aircraft, resolvedSpeedUnit } = useAircraft();
  const performance = performanceForAircraft(aircraft);
  const { calculateStall } = performance.calculators;
  const { flightPlan, updateStallCalculator } = useFlightPlan();
  const savedCalculator = flightPlan.stallCalculator;
  const [massKg, setMassKg] = useState(savedCalculator?.massKg ?? performance.limits.stallMassMaxKg);
  const [powerMode, setPowerMode] = useState<StallInputs["powerMode"]>(savedCalculator?.powerMode ?? "leerlauf");
  const [flapsDegrees, setFlapsDegrees] = useState<StallInputs["flapsDegrees"]>(savedCalculator?.flapsDegrees ?? 40);
  const inputs = useMemo<StallInputs>(() => ({ massKg, powerMode, flapsDegrees }), [massKg, powerMode, flapsDegrees]);
  const result = useMemo(() => calculateStall(inputs), [inputs]);

  useEffect(() => {
    document.body.classList.add("runway-calculator", "stall-calculator");
    return () => document.body.classList.remove("runway-calculator", "stall-calculator");
  }, []);
  useEffect(() => {
    updateStallCalculator({ massKg, powerMode, flapsDegrees });
  }, [flapsDegrees, massKg, powerMode, updateStallCalculator]);

  return (
    <div className="page-layout compact-calculator-layout">
      <aside className="sidebar compact-input-panel">
        <CalculatorInputSection
          icon={<Plane aria-hidden="true" />}
          title="Flugzeug"
          description="Flugmasse"
          summary={`${massKg} kg`}
        >
          <SliderField label="Flugmasse" unit="kg" value={massKg} min={performance.limits.stallMassMinKg} max={performance.limits.stallMassMaxKg} hint={`MTOW ${performance.limits.stallMassMaxKg} kg`} onChange={setMassKg} />
        </CalculatorInputSection>
        <CalculatorInputSection
          defaultOpen={false}
          icon={<Settings aria-hidden="true" />}
          title="Konfiguration"
          description="Leistung und Klappenstellung"
          summary={`${powerMode === "leerlauf" ? "Leerlauf" : "Vollast"} · Klappen ${flapsDegrees}°`}
        >
          <div className="field">
            <div className="field-label">Leistungsstellung</div>
            <div className="mode-toggle" style={{ gridTemplateColumns: "1fr 1fr" }}>
              {(["leerlauf", "vollast"] as const).map((mode) => (
                <button className={`mode-btn${powerMode === mode ? " active" : ""}`} type="button" onClick={() => setPowerMode(mode)} key={mode}>{mode === "leerlauf" ? "Leerlauf" : "Vollast"}</button>
              ))}
            </div>
            <div className="hint">Leerlauf = kritischer Fall für Landung<br />Vollast = Durchstartbedingung</div>
          </div>
          <div className="field">
            <div className="field-label">Klappenstellung</div>
            <div className="mode-toggle" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
              {([0, 12, 40] as const).map((flaps) => (
                <button className={`mode-btn${flapsDegrees === flaps ? " active" : ""}`} type="button" onClick={() => setFlapsDegrees(flaps)} key={flaps}>{flaps}°</button>
              ))}
            </div>
            <div className="hint">40° = Landung (VSO) · 0° = Reiseflug (VS1)</div>
          </div>
        </CalculatorInputSection>
      </aside>
      <main className="results">
        <CalculatorCard title="Bedingungen"><div className="conditions-grid">{result.conditions.map((condition) => <span key={condition}>{condition}</span>)}</div></CalculatorCard>
        <CalculatorCard title="Überziehgeschwindigkeit" className="stall-primary-results">
          <div className="takeoff-summary-heading">
            <Gauge aria-hidden="true" />
            <span>{massKg} kg · {powerMode === "leerlauf" ? "Leerlauf" : "Vollast"} · Klappen {flapsDegrees}°</span>
          </div>
          <div className="result-grid stall-result-grid" style={{ gridTemplateColumns: "1fr" }}><MetricItem label={<span>Überziehgeschwindigkeit · <SpeedSymbol index={result.stallLabel.slice(1)} /></span>} value={speedValue(result.stallSpeedKmh, resolvedSpeedUnit)} unit={speedUnitLabel(resolvedSpeedUnit)} speedType="IAS" /></div>
        </CalculatorCard>
        {performance.hasChartOverlays ? (
          <ChartCard inputs={inputs} result={result} />
        ) : (
          <CalculatorCard title="Nachvollziehbarkeit">
            <div className="conditions-grid">
              {result.conditions.map((condition) => <span key={condition}>{condition}</span>)}
              <span>IAS · {speedText(result.stallSpeedKmh, resolvedSpeedUnit)}</span>
            </div>
          </CalculatorCard>
        )}
      </main>
    </div>
  );
}
