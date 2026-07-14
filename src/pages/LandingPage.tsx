import { useEffect, useMemo, useState } from "react";
import { CloudSun, Gauge, Plane, Road } from "lucide-react";
import { landingTrace as calculateDr400LandingTrace } from "../aircraft/dr400/calculators";
import { calculateLanding as calculateG115BLanding } from "../aircraft/g115b/calculators";
import { g115bData } from "../aircraft/g115b/data";
import type { LandingInputs } from "../aircraft/g115b/types";
import { performanceForAircraft, safetyMarginForSurface } from "../app/aircraftPerformance";
import { useAircraft } from "../app/AircraftContext";
import { useFlightPlan } from "../app/FlightPlanContext";
import {
  formatSigned,
  interpolate1D,
  knotsToKilometersPerHour,
  lookup2D,
  pressureAltitudeFromQnh,
  round,
} from "../domain";
import { CalculatorCard, MetricItem, SpeedSymbol } from "../components/CalculatorCard";
import { AirportRunwayInput } from "../components/AirportRunwayInput";
import { CalculatorContextCard } from "../components/CalculatorContextCard";
import { CalculatorInputSection } from "../components/CalculatorInputSection";
import { FlightPlanMassImport } from "../components/FlightPlanMassImport";
import { NumberField } from "../components/NumberField";
import { SliderField } from "../components/SliderField";
import { createPdfBlobFromCanvas, openExportBlob, openExportTab, warmPdfExportModule } from "../export/pdf";
import { landingRunwayWarnings, type RunwayDirection } from "../flight-data";
import type { Airport } from "../flight-data";
import { speedUnitLabel, speedValue } from "../app/speed";

type LandingResult = ReturnType<typeof calculateG115BLanding>;
type PressureAltitudeMode = "airport" | "qnh" | "direct";
type ExportContext = {
  pressureAltitudeMode: PressureAltitudeMode;
  elevationFt: number;
  qnhHpa: number;
};
type ChartPoint = readonly [number, number];

const CHART_SOURCE = `${import.meta.env.BASE_URL}assets/grob115b-landing-chart.png`;

function formatWindLabel(windKt: number) {
  if (windKt === 0) return "Kein Wind";
  return `${Math.abs(windKt)} kt ${windKt > 0 ? "HW" : "TW"}`;
}

function formatAtmosphereSummary({
  airport,
  elevationFt,
  mode,
  oatC,
  pressureAltitudeFt,
  qnhHpa,
  runway,
  weatherValues,
}: {
  airport?: Airport;
  elevationFt: number;
  mode: PressureAltitudeMode;
  oatC: number;
  pressureAltitudeFt: number;
  qnhHpa: number;
  runway?: RunwayDirection;
  weatherValues?: { qnhHpa?: number; oatC?: number };
}) {
  if (mode === "airport") {
    const airportLabel = airport ? `${airport.icaoCode ? `${airport.icaoCode} · ` : ""}${airport.name}` : "Noch kein Flugplatz";
    const runwayLabelText = runway ? ` · RWY ${runway.designator}` : "";
    const displayElevationFt = airport?.elevationFt ?? elevationFt;
    const displayQnhHpa = weatherValues?.qnhHpa ?? qnhHpa;
    const displayOatC = weatherValues?.oatC ?? oatC;
    return `${airportLabel}${runwayLabelText} · Elev ${displayElevationFt.toLocaleString("de-DE")} ft · QNH ${displayQnhHpa} hPa · OAT ${displayOatC} °C`;
  }
  if (mode === "qnh") return `Elevation ${elevationFt.toLocaleString("de-DE")} ft · QNH ${qnhHpa} hPa · PA ${pressureAltitudeFt.toLocaleString("de-DE")} ft · OAT ${oatC} °C`;
  return `PA ${pressureAltitudeFt.toLocaleString("de-DE")} ft · OAT ${oatC} °C`;
}

function chartAxisPosition(value: number, values: readonly number[], pixels: readonly number[]) {
  return interpolate1D(values, pixels, Math.min(values[values.length - 1], Math.max(values[0], value)));
}

function chartTemperatureX(value: number) {
  return chartAxisPosition(value, [-20, -10, 0, 10, 20, 30, 40], [212.5, 259.5, 304.5, 347.5, 391.5, 436.5, 480.5]);
}

function chartMassX(value: number) {
  return chartAxisPosition(value, [700, 750, 800, 850, 920], [729.5, 684, 638, 592, 528]);
}

function chartWindX(value: number) {
  const maximumWindKmh = value < 0 ? 20 : 40;
  return chartAxisPosition(Math.min(maximumWindKmh, Math.abs(value)), [0, 10, 20, 30, 40], [776, 821, 866, 911, 956]);
}

function chartRollY(value: number) {
  return chartAxisPosition(value, [0, 100, 200, 300, 400], [849, 752, 655, 560, 466]);
}

function chartWindPoint(windKmh: number, incomingRollMeters: number, correctedRollMeters: number): ChartPoint {
  if (windKmh > 0 && correctedRollMeters <= 0 && incomingRollMeters > 0) {
    const rawCorrectionAtMaximumHeadwind = lookup2D(
      g115bData.landing.landingRollFromHeadwind,
      incomingRollMeters,
      40,
    );
    const zeroCrossingKmh = 40 * incomingRollMeters / (incomingRollMeters - rawCorrectionAtMaximumHeadwind);
    return [chartWindX(Math.min(windKmh, zeroCrossingKmh)), chartRollY(0)];
  }
  return [chartWindX(windKmh), chartRollY(correctedRollMeters)];
}

function chartDistanceY(value: number) {
  return interpolate1D(
    [0, 100, 200, 300, 400, 500, 600, 700, 800],
    [895, 800, 704, 609, 514, 418, 322, 227, 132],
    value,
  );
}

function chartObstaclePoints(landingRollMeters: number, landingDistanceMeters: number): ChartPoint[] {
  const rawEntryRollMeters = interpolate1D(
    g115bData.landing.landingDistanceOver15m.landingDistanceMeters,
    g115bData.landing.landingDistanceOver15m.landingRollBreakpoints,
    landingDistanceMeters,
  );
  if (rawEntryRollMeters < 0) {
    const entryX = interpolate1D([rawEntryRollMeters, landingDistanceMeters], [1000, 1178], 0);
    return [[entryX, chartRollY(0)], [1178, chartDistanceY(landingDistanceMeters)]];
  }
  return [[1000, chartRollY(landingRollMeters)], [1178, chartDistanceY(landingDistanceMeters)]];
}

function createChartPoints(inputs: LandingInputs, result: LandingResult): ChartPoint[] {
  const windKmh = knotsToKilometersPerHour(inputs.windKt);
  return [
    [chartTemperatureX(inputs.oatC), 849],
    [chartTemperatureX(inputs.oatC), chartRollY(result.landingRollByAtmosphereChartMeters)],
    [528, chartRollY(result.landingRollByAtmosphereChartMeters)],
    [chartMassX(inputs.massKg), chartRollY(result.landingRollByMassChartMeters)],
    [776, chartRollY(result.landingRollByMassChartMeters)],
    chartWindPoint(windKmh, result.landingRollByMassChartMeters, result.landingRollByWindChartMeters),
    [1000, chartRollY(result.landingRollByWindChartMeters)],
    ...chartObstaclePoints(result.landingRollByWindChartMeters, result.landingDistanceWithoutMarginMeters),
  ];
}

function CalculationPath({ inputs, result }: { inputs: LandingInputs; result: LandingResult }) {
  const steps = [
    { name: "Schritt 1 - Atmosphäre", detail: `PA ${inputs.pressureAltitudeFt.toLocaleString("de-DE")} ft · OAT ${inputs.oatC} °C`, value: `${round(result.landingRollByAtmosphereMeters)} m` },
    { name: "Schritt 2 - Masse", detail: `${round(result.landingRollByAtmosphereMeters)} m · ${inputs.massKg} kg`, value: `${round(result.landingRollByMassMeters)} m` },
    { name: "Schritt 3 - Wind", detail: `${round(result.landingRollByMassMeters)} m · ${formatWindLabel(inputs.windKt)}`, value: `${round(result.landingRollByWindMeters)} m` },
    { name: "Schritt 4 - Hindernis 15 m", detail: `${round(result.landingRollByWindMeters)} m → über 15 m`, value: `${round(result.landingDistanceWithoutMarginMeters)} m` },
    { name: `Zuschlag ${inputs.safetyMarginPercent}% auf Rollstrecke`, detail: `+${round(result.landingRollMarginMeters)} m auf Roll- und Landestrecke`, value: `${result.landingRollMeters} m / ${result.landingDistanceMeters} m` },
  ];
  return (
    <div className="calculation-path-grid">
      {steps.map((step, index) => (
        <div className="calculation-path-row" key={step.name}>
          <span className="calculation-path-index">{index + 1}</span>
          <div>
            <div className="step-name">{step.name}</div>
            <div className="step-detail">{step.detail}</div>
          </div>
          <div className="step-val">{step.value}</div>
        </div>
      ))}
    </div>
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
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("PNG konnte nicht erzeugt werden.")), "image/png");
  });
}

function drawText(context: CanvasRenderingContext2D, text: string, x: number, y: number, options: { color?: string; weight?: number; size?: number }) {
  context.fillStyle = options.color || "#152235";
  context.font = `${options.weight || 600} ${options.size || 24}px "Segoe UI", Arial, sans-serif`;
  context.fillText(text, x, y);
}

function drawField(context: CanvasRenderingContext2D, label: string, value: string, x: number, y: number, width: number, disabled = false) {
  context.fillStyle = disabled ? "#edf0f2" : "#f4f8fb";
  context.strokeStyle = disabled ? "#c6cdd3" : "#d8e3eb";
  context.lineWidth = 1;
  context.setLineDash(disabled ? [6, 4] : []);
  context.beginPath();
  context.roundRect(x, y, width, 68, 10);
  context.fill();
  context.stroke();
  context.setLineDash([]);
  drawText(context, label.toUpperCase(), x + 14, y + 23, { size: 13, weight: 700, color: disabled ? "#7d878f" : "#607487" });
  drawText(context, value, x + 14, y + 52, { size: disabled ? 17 : 20, weight: 700, color: disabled ? "#7d878f" : "#152235" });
}

function drawLegend(context: CanvasRenderingContext2D, x: number, y: number) {
  context.strokeStyle = "#e90000";
  context.lineWidth = 5;
  context.beginPath();
  context.moveTo(x, y);
  context.lineTo(x + 42, y);
  context.stroke();
  context.beginPath();
  context.fillStyle = "#e90000";
  context.arc(x + 21, y, 6, 0, Math.PI * 2);
  context.fill();
  drawText(context, "Rechenweg ohne Zuschlag", x + 56, y + 7, { size: 17 });
  context.beginPath();
  context.fillStyle = "#00b3ff";
  context.strokeStyle = "#111111";
  context.lineWidth = 3;
  context.arc(x + 650, y, 7, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  drawText(context, "Landestrecke über 15 m inkl. Zuschlag", x + 670, y + 7, { size: 17 });
}

function timestamp(date: Date) {
  return date.toISOString().replace("T", " ").replace(/:/g, "-").slice(0, 19);
}

function filenameSafeLabel(label: string) {
  return label.replace(/[<>:"/\\|?*]+/g, "-").replace(/\s+/g, " ").trim();
}

function exportTimestamp(date: Date) {
  const value = date.toISOString();
  return `${value.slice(8, 10)}.${value.slice(5, 7)}.${value.slice(0, 4)} ${value.slice(11, 19)}Z`;
}

async function exportChartImage(inputs: LandingInputs, result: LandingResult, exportContext: ExportContext) {
  const { canvas, exportDate } = await createLandingExportCanvas(inputs, result, exportContext);
  const blob = await canvasToBlob(canvas);
  await saveExportBlob(blob, `${timestamp(exportDate)}Z Grob G115B Landestreckenberechnung.png`, "image/png");
}

async function exportChartPdf(inputs: LandingInputs, result: LandingResult, exportContext: ExportContext, options: { openWindow?: Window | null } = {}) {
  const { canvas, exportDate } = await createLandingExportCanvas(inputs, result, exportContext);
  const blob = await createPdfBlobFromCanvas(canvas);
  if (options.openWindow) {
    openExportBlob(blob, options.openWindow);
    return;
  }
  await saveExportBlob(blob, `${timestamp(exportDate)}Z Grob G115B Landestreckenberechnung.pdf`, "application/pdf");
}

function drawWrappedText(context: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, options: { color?: string; weight?: number; size?: number; lineHeight?: number } = {}) {
  const lineHeight = options.lineHeight ?? 24;
  let lineY = y;
  context.fillStyle = options.color || "#152235";
  context.font = `${options.weight || 500} ${options.size || 18}px "Segoe UI", Arial, sans-serif`;
  text.split("\n").forEach((paragraph) => {
    const words = paragraph.split(" ");
    let line = "";
    words.forEach((word, index) => {
      const testLine = line ? `${line} ${word}` : word;
      if (context.measureText(testLine).width > width && line) {
        context.fillText(line, x, lineY);
        line = word;
        lineY += lineHeight;
      } else {
        line = testLine;
      }
      if (index === words.length - 1 && line) context.fillText(line, x, lineY);
    });
    lineY += lineHeight;
  });
  return lineY;
}

function atmosphereExportLines(inputs: LandingInputs, result: LandingResult, exportContext: ExportContext) {
  const pressureAltitudeText = exportContext.pressureAltitudeMode === "direct"
    ? `Pressure Altitude = direkt eingegebene Druckhöhe = ${inputs.pressureAltitudeFt} ft.`
    : `Pressure Altitude = Elevation + (1013.25 - QNH) x 27 = ${exportContext.elevationFt} + (1013.25 - ${exportContext.qnhHpa}) x 27 = ${inputs.pressureAltitudeFt} ft.`;
  return [
    pressureAltitudeText,
    `ISA-Temperatur = 15 - 1.98 x PA / 1000 = 15 - 1.98 x ${inputs.pressureAltitudeFt} / 1000 = ${result.atmosphere.isaTemperatureC.toFixed(1)} °C.`,
    `ISA-Abweichung = OAT - ISA = ${inputs.oatC} - ${result.atmosphere.isaTemperatureC.toFixed(1)} = ${formatSigned(result.atmosphere.isaDeviationC, 1)} °C.`,
    `Density Altitude = PA + 120 x ISA-Abweichung = ${inputs.pressureAltitudeFt} + 120 x ${result.atmosphere.isaDeviationC.toFixed(1)} = ${result.atmosphere.densityAltitudeFt} ft.`,
  ];
}

async function createLandingPathExportCanvas(inputs: LandingInputs, result: LandingResult, exportContext: ExportContext, aircraftLabel: string) {
  const exportDate = new Date();
  const trace = calculateDr400LandingTrace(inputs);
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 1240;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas wird von diesem Browser nicht unterstützt.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  drawText(context, `${exportTimestamp(exportDate)} – ${aircraftLabel} Landestreckenberechnung`, 48, 58, { size: 28, weight: 700 });
  drawText(context, "Eingangswerte", 48, 104, { size: 19, weight: 700, color: "#006f9f" });
  drawField(context, "Elevation", exportContext.pressureAltitudeMode !== "direct" ? `${exportContext.elevationFt} ft` : "Direkte Druckhöhe", 48, 122, 256, exportContext.pressureAltitudeMode === "direct");
  drawField(context, "QNH", exportContext.pressureAltitudeMode !== "direct" ? `${exportContext.qnhHpa} hPa` : "Direkte Druckhöhe", 320, 122, 256, exportContext.pressureAltitudeMode === "direct");
  drawField(context, "Pressure Alt.", `${inputs.pressureAltitudeFt} ft`, 592, 122, 256);
  drawField(context, "OAT", `${inputs.oatC} °C`, 864, 122, 256);
  drawField(context, "Masse", `${inputs.massKg} kg`, 48, 206, 256);
  drawField(context, "Wind", formatWindLabel(inputs.windKt), 320, 206, 256);
  drawField(context, "Zuschlag", `${inputs.safetyMarginPercent}%`, 592, 206, 256);

  drawText(context, "Atmosphäre", 48, 330, { size: 19, weight: 700, color: "#006f9f" });
  const textY = drawWrappedText(context, atmosphereExportLines(inputs, result, exportContext).join("\n"), 48, 362, 1070, { size: 17, lineHeight: 23 });

  drawText(context, "Tabellen- und Korrekturschritte", 48, textY + 36, { size: 19, weight: 700, color: "#006f9f" });
  const steps = [
    ["1", `Landerollstrecke aus POH-Tabelle.\n${trace.roll845.compact}\n${trace.roll1045.compact}`, `${round(result.landingRollByAtmosphereMeters)} m bei 1045 kg`],
    ["2", `15-m-Strecke aus POH-Tabelle.\n${trace.obstacle845.compact}\n${trace.obstacle1045.compact}`, `${round(trace.obstacle1045.result)} m bei 1045 kg`],
    ["3", `Masseninterpolation zwischen den POH-Gewichten.\n${trace.massCompact}`, `${round(trace.rollByMassMeters)} m / ${round(trace.obstacleByMassMeters)} m vor Wind`],
    ["4", trace.windText, `${round(result.landingRollByWindMeters)} m / ${round(result.landingDistanceWithoutMarginMeters)} m`],
    ["5", trace.marginText, `${result.landingRollMeters} m / ${result.landingDistanceMeters} m`],
  ];
  let rowY = textY + 72;
  steps.forEach(([index, detail, value]) => {
    context.fillStyle = "#f4f8fb";
    context.strokeStyle = "#d8e3eb";
    context.lineWidth = 1;
    context.beginPath();
    context.roundRect(48, rowY, 1072, 112, 10);
    context.fill();
    context.stroke();
    drawText(context, index, 70, rowY + 66, { size: 24, weight: 800, color: "#006f9f" });
    drawWrappedText(context, detail, 112, rowY + 20, 735, { size: 12, lineHeight: 14 });
    drawWrappedText(context, value, 870, rowY + 54, 220, { size: 17, weight: 700, lineHeight: 21 });
    rowY += 124;
  });
  drawWrappedText(context, result.warnings.length ? `Warnungen: ${result.warnings.map((warning) => warning.text).join(" · ")}` : "Warnungen: keine.", 48, rowY + 14, 1070, { color: result.warnings.length ? "#9a5200" : "#526274" });
  return { canvas, exportDate };
}

async function exportPathImage(inputs: LandingInputs, result: LandingResult, exportContext: ExportContext, aircraftLabel: string) {
  const { canvas, exportDate } = await createLandingPathExportCanvas(inputs, result, exportContext, aircraftLabel);
  const blob = await canvasToBlob(canvas);
  await saveExportBlob(blob, `${timestamp(exportDate)}Z ${filenameSafeLabel(aircraftLabel)} Landestreckenberechnung.png`, "image/png");
}

async function exportPathPdf(inputs: LandingInputs, result: LandingResult, exportContext: ExportContext, aircraftLabel: string, options: { openWindow?: Window | null } = {}) {
  const { canvas, exportDate } = await createLandingPathExportCanvas(inputs, result, exportContext, aircraftLabel);
  const blob = await createPdfBlobFromCanvas(canvas);
  if (options.openWindow) {
    openExportBlob(blob, options.openWindow);
    return;
  }
  await saveExportBlob(blob, `${timestamp(exportDate)}Z ${filenameSafeLabel(aircraftLabel)} Landestreckenberechnung.pdf`, "application/pdf");
}

async function createLandingExportCanvas(inputs: LandingInputs, result: LandingResult, exportContext: ExportContext) {
  const exportDate = new Date();
  const headerHeight = 745;
  const canvas = document.createElement("canvas");
  canvas.width = 1505;
  canvas.height = headerHeight + 1045;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas wird von diesem Browser nicht unterstützt.");
  const image = await loadImage(CHART_SOURCE);
  const points = createChartPoints(inputs, result);
  const finalDistancePoint: ChartPoint = [1178, chartDistanceY(result.landingDistanceMeters)];

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  drawText(context, `${exportTimestamp(exportDate)} – Grob G115B Landestreckenberechnung`, 48, 54, { size: 30, weight: 700 });
  drawText(context, "Eingangswerte", 48, 96, { size: 19, weight: 700, color: "#006f9f" });
  drawField(context, "Elevation", exportContext.pressureAltitudeMode !== "direct" ? `${exportContext.elevationFt} ft` : "Nicht bereitgestellt", 48, 112, 338, exportContext.pressureAltitudeMode === "direct");
  drawField(context, "QNH", exportContext.pressureAltitudeMode !== "direct" ? `${exportContext.qnhHpa} hPa` : "Nicht bereitgestellt", 402, 112, 338, exportContext.pressureAltitudeMode === "direct");
  drawField(context, "Druckhöhe", `${inputs.pressureAltitudeFt} ft`, 756, 112, 338);
  drawField(context, "OAT", `${inputs.oatC} °C`, 1110, 112, 302);
  drawField(context, "Masse", `${inputs.massKg} kg`, 48, 192, 338);
  drawField(context, "Wind", formatWindLabel(inputs.windKt), 402, 192, 338);
  drawField(context, "Zuschlag", `${inputs.safetyMarginPercent}%`, 756, 192, 338);
  drawText(context, "Atmosphäre", 48, 300, { size: 19, weight: 700, color: "#006f9f" });
  drawWrappedText(context, atmosphereExportLines(inputs, result, exportContext).join("\n"), 48, 328, 1364, { size: 16, lineHeight: 22 });
  drawText(context, "Ergebnis", 48, 424, { size: 19, weight: 700, color: "#006f9f" });
  drawField(context, "Rollstrecke ohne Zuschlag", `${round(result.landingRollByWindMeters)} m`, 48, 440, 664);
  drawField(context, "Zuschlag", `${round(result.landingRollMarginMeters)} m`, 728, 440, 684);
  drawField(context, "Rollstrecke inkl. Zuschlag", `${result.landingRollMeters} m`, 48, 520, 664);
  drawField(context, "Landestrecke über 15 m inkl. Zuschlag", `${result.landingDistanceMeters} m`, 728, 520, 684);
  drawText(context, result.warnings.length ? `Warnungen: ${result.warnings.map((warning) => warning.text).join(" · ")}` : "Warnungen: keine", 48, 638, { size: 18, color: result.warnings.length ? "#9a5200" : "#526274" });
  drawLegend(context, 48, 685);
  context.drawImage(image, 0, headerHeight, 1505, 1045);
  context.save();
  context.translate(0, headerHeight);
  context.strokeStyle = "#e90000";
  context.lineWidth = 5;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  points.forEach(([x, y], index) => index === 0 ? context.moveTo(x, y) : context.lineTo(x, y));
  context.stroke();
  points.slice(1).forEach(([x, y]) => {
    context.beginPath();
    context.fillStyle = "#e90000";
    context.arc(x, y, 6, 0, Math.PI * 2);
    context.fill();
  });
  context.beginPath();
  context.fillStyle = "#00b3ff";
  context.strokeStyle = "#111111";
  context.lineWidth = 3;
  context.arc(finalDistancePoint[0], finalDistancePoint[1], 6, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.restore();

  return { canvas, exportDate };
}

async function saveExportBlob(blob: Blob, fileName: string, type: string, options: { share?: boolean } = {}) {
  const file = new File([blob], fileName, { type });
  if ((options.share ?? true) && navigator.share && navigator.canShare?.({ files: [file] })) {
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

function TraceabilityCard({ inputs, result, exportContext }: { inputs: LandingInputs; result: LandingResult; exportContext: ExportContext }) {
  const [view, setView] = useState<"chart" | "path">("chart");
  const [exporting, setExporting] = useState<"png" | "pdf" | "pdf-open" | null>(null);
  const points = createChartPoints(inputs, result);
  const finalDistancePoint: ChartPoint = [1178, chartDistanceY(result.landingDistanceMeters)];

  const exportImage = async () => {
    setExporting("png");
    try {
      await exportChartImage(inputs, result, exportContext);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) console.error(error);
    } finally {
      setExporting(null);
    }
  };

  const exportPdf = async () => {
    setExporting("pdf");
    try {
      await exportChartPdf(inputs, result, exportContext);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) console.error(error);
    } finally {
      setExporting(null);
    }
  };
  const openPdf = async () => {
    setExporting("pdf-open");
    let exportWindow: Window | null = null;
    try {
      exportWindow = openExportTab();
      await exportChartPdf(inputs, result, exportContext, { openWindow: exportWindow });
    } catch (error) {
      exportWindow?.close();
      if (!(error instanceof DOMException && error.name === "AbortError")) console.error(error);
    } finally {
      setExporting(null);
    }
  };

  return (
    <section className="card takeoff-chart-card traceability-card">
      <div className="traceability-header">
        <div>
          <div className="card-title">Nachvollziehbarkeit</div>
          <div className="traceability-description">
            {view === "chart" ? "Rechenweg im originalen Flughandbuchdiagramm" : "Schrittweise Herleitung der berechneten Strecken"}
          </div>
        </div>
      </div>
      <div className="traceability-toolbar">
        <div className="traceability-tabs" role="tablist" aria-label="Nachvollziehbarkeit">
          <button className={view === "chart" ? "active" : ""} type="button" role="tab" aria-selected={view === "chart"} onClick={() => setView("chart")}>Diagramm</button>
          <button className={view === "path" ? "active" : ""} type="button" role="tab" aria-selected={view === "path"} onClick={() => setView("path")}>Rechenweg</button>
        </div>
        {view === "chart" ? (
          <div className="takeoff-chart-actions">
            <button className="takeoff-chart-download" type="button" disabled={exporting !== null} onClick={exportImage}>
              {exporting === "png" ? "Erzeuge PNG…" : "PNG speichern"}
            </button>
            <button className="takeoff-chart-download" type="button" disabled={exporting !== null} onFocus={warmPdfExportModule} onPointerEnter={warmPdfExportModule} onClick={exportPdf}>
              {exporting === "pdf" ? "PDF vorbereiten…" : "PDF speichern"}
            </button>
            <button className="takeoff-chart-download" type="button" disabled={exporting !== null} onFocus={warmPdfExportModule} onPointerEnter={warmPdfExportModule} onClick={openPdf}>
              {exporting === "pdf-open" ? "PDF öffnen…" : "PDF öffnen"}
            </button>
          </div>
        ) : null}
      </div>
      {view === "path" ? <CalculationPath inputs={inputs} result={result} /> : (
        <>
          <div className="takeoff-chart-scroll">
            <div className="takeoff-chart-stage">
              <img className="takeoff-chart-image" src={CHART_SOURCE} alt="Originales Flughandbuchdiagramm Bild 5.3.15 Landestrecke" width="1505" height="1045" />
              <svg className="takeoff-chart-overlay" viewBox="0 0 1505 1045" aria-label="Grafischer Rechenweg im originalen Landestreckendiagramm">
                <polyline className="takeoff-chart-path" points={points.map((point) => point.join(",")).join(" ")} />
                {points.slice(1).map(([x, y], index) => <circle className="takeoff-chart-point" cx={x} cy={y} r="5" key={`${index}-${x}-${y}`} />)}
                <circle className="takeoff-chart-final-point" cx={finalDistancePoint[0]} cy={finalDistancePoint[1]} r="5" />
              </svg>
            </div>
          </div>
          <div className="takeoff-chart-legend">
            <span className="takeoff-chart-key">Unbezuschlagter Weg im Originaldiagramm</span>
            <span>Rollstrecke: {round(result.landingRollByWindMeters)} m</span>
            <span>Landestrecke über 15 m: {round(result.landingDistanceWithoutMarginMeters)} m</span>
            <span>Zuschlag: +{round(result.landingRollMarginMeters)} m</span>
            <span className="takeoff-chart-margin-key">Landestrecke über 15 m inkl. Zuschlag: {result.landingDistanceMeters} m</span>
          </div>
        </>
      )}
    </section>
  );
}

function PathTraceabilityCard({ inputs, result, exportContext, aircraftLabel }: { inputs: LandingInputs; result: LandingResult; exportContext: ExportContext; aircraftLabel: string }) {
  const [exporting, setExporting] = useState<"png" | "pdf" | "pdf-open" | null>(null);
  const exportImage = async () => {
    setExporting("png");
    try {
      await exportPathImage(inputs, result, exportContext, aircraftLabel);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) console.error(error);
    } finally {
      setExporting(null);
    }
  };
  const exportPdf = async () => {
    setExporting("pdf");
    try {
      await exportPathPdf(inputs, result, exportContext, aircraftLabel);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) console.error(error);
    } finally {
      setExporting(null);
    }
  };
  const openPdf = async () => {
    setExporting("pdf-open");
    let exportWindow: Window | null = null;
    try {
      exportWindow = openExportTab();
      await exportPathPdf(inputs, result, exportContext, aircraftLabel, { openWindow: exportWindow });
    } catch (error) {
      exportWindow?.close();
      if (!(error instanceof DOMException && error.name === "AbortError")) console.error(error);
    } finally {
      setExporting(null);
    }
  };
  return (
    <section className="card traceability-card">
      <div className="traceability-header">
        <div>
          <div className="card-title">Nachvollziehbarkeit</div>
          <div className="traceability-description">Schrittweise Herleitung mit exportierbarem Rechenweg</div>
        </div>
      </div>
      <div className="traceability-toolbar">
        <div className="takeoff-chart-actions">
          <button className="takeoff-chart-download" type="button" disabled={exporting !== null} onClick={exportImage}>{exporting === "png" ? "Erzeuge PNG…" : "PNG speichern"}</button>
          <button className="takeoff-chart-download" type="button" disabled={exporting !== null} onFocus={warmPdfExportModule} onPointerEnter={warmPdfExportModule} onClick={exportPdf}>{exporting === "pdf" ? "PDF vorbereiten…" : "PDF speichern"}</button>
          <button className="takeoff-chart-download" type="button" disabled={exporting !== null} onFocus={warmPdfExportModule} onPointerEnter={warmPdfExportModule} onClick={openPdf}>{exporting === "pdf-open" ? "PDF öffnen…" : "PDF öffnen"}</button>
        </div>
      </div>
      <CalculationPath inputs={inputs} result={result} />
    </section>
  );
}

export function LandingPage() {
  const { aircraft, resolvedSpeedUnit } = useAircraft();
  const performance = performanceForAircraft(aircraft);
  const { calculateLanding } = performance.calculators;
  const { flightPlan, updateImports, updateLandingCalculator } = useFlightPlan();
  const savedCalculator = flightPlan.landingCalculator;
  const [pressureAltitudeMode, setPressureAltitudeMode] = useState<PressureAltitudeMode>(savedCalculator?.pressureAltitudeMode ?? "airport");
  const [elevationFt, setElevationFt] = useState(savedCalculator?.elevationFt ?? 0);
  const [qnhHpa, setQnhHpa] = useState(savedCalculator?.qnhHpa ?? 1013);
  const [directPressureAltitudeFt, setDirectPressureAltitudeFt] = useState(savedCalculator?.directPressureAltitudeFt ?? 0);
  const [oatC, setOatC] = useState(savedCalculator?.oatC ?? 15);
  const [massKg, setMassKg] = useState(savedCalculator?.massKg ?? performance.limits.landingMassMaxKg);
  const [windKt, setWindKt] = useState(savedCalculator?.windKt ?? 0);
  const [safetyMarginPercent, setSafetyMarginPercent] = useState(savedCalculator?.safetyMarginPercent ?? performance.safetyMargins.landing.fallback);
  const [selectedAirport, setSelectedAirport] = useState<Airport>();
  const [selectedRunway, setSelectedRunway] = useState<RunwayDirection>();
  const [selectedWeatherValues, setSelectedWeatherValues] = useState<{ qnhHpa?: number; oatC?: number }>();
  const pressureAltitudeFt = pressureAltitudeMode !== "direct" ? pressureAltitudeFromQnh(elevationFt, qnhHpa) : directPressureAltitudeFt;
  const inputs = useMemo<LandingInputs>(() => ({
    pressureAltitudeFt,
    oatC,
    massKg,
    windKt,
    safetyMarginPercent,
  }), [pressureAltitudeFt, oatC, massKg, windKt, safetyMarginPercent]);
  const result = useMemo(() => calculateLanding(inputs), [inputs]);
  const warnings = useMemo(
    () => [
      ...result.warnings,
      ...landingRunwayWarnings(pressureAltitudeMode === "airport" ? selectedRunway : undefined, result.landingRollMeters, result.landingDistanceMeters),
    ],
    [pressureAltitudeMode, result, selectedRunway],
  );
  const availableLdaM = pressureAltitudeMode === "airport" && selectedRunway
    ? selectedRunway.ldaM ?? selectedRunway.lengthM
    : undefined;
  const landingRollExceedsLda = availableLdaM != null && result.landingRollMeters > availableLdaM;
  const landingDistanceExceedsLda = availableLdaM != null && result.landingDistanceMeters > availableLdaM;

  useEffect(() => {
    document.body.classList.add("runway-calculator", "landing-calculator");
    return () => document.body.classList.remove("runway-calculator", "landing-calculator");
  }, []);
  useEffect(() => {
    updateLandingCalculator({
      pressureAltitudeMode,
      elevationFt,
      qnhHpa,
      directPressureAltitudeFt,
      oatC,
      massKg,
      windKt,
      safetyMarginPercent,
    });
  }, [directPressureAltitudeFt, elevationFt, massKg, oatC, pressureAltitudeMode, qnhHpa, safetyMarginPercent, updateLandingCalculator, windKt]);
  useEffect(() => {
    if (flightPlan.imports.arrivalImport) setPressureAltitudeMode("airport");
  }, [flightPlan.imports.arrivalImport]);
  useEffect(() => {
    if (pressureAltitudeMode !== "airport" || !selectedRunway) return;
    setSafetyMarginPercent(safetyMarginForSurface(performance.safetyMargins.landing, selectedRunway.surface));
  }, [aircraft.id, pressureAltitudeMode, selectedRunway?.id, selectedRunway?.surface]);

  return (
    <div className="page-layout compact-calculator-layout">
      <aside className="sidebar compact-input-panel">
        <CalculatorInputSection
          icon={<CloudSun aria-hidden="true" />}
          title="Atmosphäre"
          description="Flugplatz, Höhe und Wetter"
          summary={formatAtmosphereSummary({
            airport: selectedAirport,
            elevationFt,
            mode: pressureAltitudeMode,
            oatC,
            pressureAltitudeFt,
            qnhHpa,
            runway: selectedRunway,
            weatherValues: selectedWeatherValues,
          })}
        >
          <div className="mode-toggle" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
            <button className={`mode-btn${pressureAltitudeMode === "airport" ? " active" : ""}`} type="button" onClick={() => setPressureAltitudeMode("airport")}>Airport</button>
            <button className={`mode-btn${pressureAltitudeMode === "qnh" ? " active" : ""}`} type="button" disabled={flightPlan.imports.arrivalImport} onClick={() => setPressureAltitudeMode("qnh")}>Elevation</button>
            <button className={`mode-btn${pressureAltitudeMode === "direct" ? " active" : ""}`} type="button" disabled={flightPlan.imports.arrivalImport} onClick={() => setPressureAltitudeMode("direct")}>Pressure Alt.</button>
          </div>
          {pressureAltitudeMode === "airport" ? (
            <>
              <AirportRunwayInput
                operation="arrival"
                enabled={flightPlan.imports.arrivalImport}
                weatherNow={flightPlan.imports.arrivalWeatherNow}
                onEnabledChange={(value) => updateImports({ arrivalImport: value })}
                onWeatherNowChange={(enabled) => updateImports({ arrivalWeatherNow: enabled })}
                onAirportChange={setSelectedAirport}
                onRunwayChange={setSelectedRunway}
                onWeatherValuesChange={setSelectedWeatherValues}
                onApply={(values) => {
                  if (values.elevationFt != null) setElevationFt(values.elevationFt);
                  if (values.qnhHpa != null) setQnhHpa(values.qnhHpa);
                  if (values.oatC != null) setOatC(values.oatC);
                  if (values.windKt != null) setWindKt(values.windKt);
                }}
              />
              <div className="pa-mode airport-manual-weather">
                <SliderField label="QNH" unit="hPa" value={qnhHpa} min={950} max={1050} disabled={flightPlan.imports.arrivalImport} onChange={setQnhHpa} />
                <SliderField label="OAT" unit="°C" value={oatC} min={-20} max={40} disabled={flightPlan.imports.arrivalImport} onChange={setOatC} />
              </div>
            </>
          ) : pressureAltitudeMode === "qnh" ? (
            <div className="pa-mode">
              <NumberField label="Elevation" unit="ft" value={elevationFt} step={10} onChange={setElevationFt} />
              <SliderField label="QNH" unit="hPa" value={qnhHpa} min={950} max={1050} onChange={setQnhHpa} />
              <div className="derived-box">
                <div className="derived-label">Pressure Altitude</div>
                <div className="derived-value">{pressureAltitudeFt.toLocaleString("de-DE")} ft</div>
              </div>
            </div>
          ) : (
            <div className="pa-mode">
              <NumberField label="Pressure Altitude" unit="ft" value={directPressureAltitudeFt} step={100} onChange={setDirectPressureAltitudeFt} />
            </div>
          )}
          {pressureAltitudeMode !== "airport" ? <div style={{ marginTop: "1.25rem" }}><SliderField label="OAT" unit="°C" value={oatC} min={-20} max={40} onChange={setOatC} /></div> : null}
        </CalculatorInputSection>
        <CalculatorInputSection
          icon={<Plane aria-hidden="true" />}
          title="Flugzeug & Betrieb"
          description="Landemasse"
          summary={`${massKg} kg`}
          defaultOpen={false}
        >
          <FlightPlanMassImport
            label="Landemasse aus Flugplanung"
            massKg={flightPlan.masses?.landingMassKg}
            fuelLiters={flightPlan.masses?.landingFuelLiters}
            updatedAt={flightPlan.masses?.updatedAt}
            enabled={flightPlan.imports.landingMass}
            onEnabledChange={(enabled) => updateImports({ landingMass: enabled })}
            onImport={setMassKg}
          />
          <SliderField label="Masse" labelDetail={`kg · max. ${performance.limits.landingMassMaxKg}`} unit="kg" value={massKg} min={performance.limits.landingMassMinKg} max={performance.limits.landingMassMaxKg} disabled={flightPlan.imports.landingMass} onChange={setMassKg} />
        </CalculatorInputSection>
        <CalculatorInputSection
          icon={<Road aria-hidden="true" />}
          title="Pistenbedingungen"
          description="Wind und Zuschlag"
          summary={`${formatWindLabel(windKt)} · Zuschlag ${safetyMarginPercent}%`}
          defaultOpen={false}
        >
          <SliderField label="Wind" labelDetail="kt · HW(+) TW(−)" unit="kt" value={windKt} min={-11} max={22} disabled={flightPlan.imports.arrivalImport} onChange={setWindKt} />
          <SliderField label="Zuschlag" unit="%" value={safetyMarginPercent} min={0} max={60} inputMax={100} hint={`Default ${aircraft.shortName}: Gras ${performance.safetyMargins.landing.grass}% · Hartbelag ${performance.safetyMargins.landing.hard}%`} onChange={setSafetyMarginPercent} />
        </CalculatorInputSection>
      </aside>
      <main className="results">
        <CalculatorContextCard atmosphere={result.atmosphere} warnings={warnings} conditions={result.conditions} />
        <CalculatorCard title="Landeleistung" className="landing-primary-results">
          <div className="takeoff-summary-heading">
            <Gauge aria-hidden="true" />
            <span>Berechnete Strecken und Geschwindigkeiten</span>
          </div>
          <div className="result-grid landing-distance-grid">
            <MetricItem label="Landing Roll · Landerollstrecke" value={String(result.landingRollMeters)} unit="m" danger={landingRollExceedsLda} />
            <MetricItem label="Landing Distance · Landestrecke über 15 m" value={String(result.landingDistanceMeters)} unit="m" danger={landingDistanceExceedsLda} />
          </div>
          <div className="takeoff-summary-divider">Anfluggeschwindigkeiten</div>
          <div className="speed-grid">
            <MetricItem label={<span><SpeedSymbol index="APP" /> · Approach</span>} value={speedValue(result.approachSpeedKmh, resolvedSpeedUnit)} unit={speedUnitLabel(resolvedSpeedUnit)} speedType="IAS" />
            <MetricItem label={<span><SpeedSymbol index="REF" /> · 1.3 × <SpeedSymbol index="S0" /></span>} value={speedValue(result.referenceSpeedKmh, resolvedSpeedUnit)} unit={speedUnitLabel(resolvedSpeedUnit)} speedType="IAS" />
          </div>
        </CalculatorCard>
        {performance.hasChartOverlays ? (
          <TraceabilityCard inputs={inputs} result={result} exportContext={{ pressureAltitudeMode, elevationFt, qnhHpa }} />
        ) : (
          <PathTraceabilityCard inputs={inputs} result={result} exportContext={{ pressureAltitudeMode, elevationFt, qnhHpa }} aircraftLabel={aircraft.shortName} />
        )}
      </main>
    </div>
  );
}
