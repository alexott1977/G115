import { useEffect, useMemo, useState } from "react";
import { Gauge, Mountain, Plane } from "lucide-react";
import { useAircraft } from "../app/AircraftContext";
import { performanceForAircraft } from "../app/aircraftPerformance";
import {
  densityAltitude,
  flightLevelToFeet,
  formatSigned,
  interpolate1D,
  pressureAltitudeFromQnh,
} from "../domain";
import { CalculatorCard, MetricItem } from "../components/CalculatorCard";
import { CalculatorInputSection } from "../components/CalculatorInputSection";
import { NumberField } from "../components/NumberField";
import { SliderField } from "../components/SliderField";
import { useFlightPlan } from "../app/FlightPlanContext";
import { createPdfBlobFromCanvas, openExportBlob, openExportTab, warmPdfExportModule } from "../export/pdf";
import { speedText, speedUnitLabel, speedValue } from "../app/speed";

type CruiseMode = "alt" | "fl" | "da";
type ChartPoint = readonly [number, number];
type CruiseChart = {
  title: string;
  cardTitle: string;
  source: string;
  width: number;
  height: number;
  temperatureValues: readonly number[];
  temperaturePixels: readonly number[];
  temperatureBottomPixel: number;
  resultBottomPixel: number;
  altitudeValues: readonly number[];
  altitudePixels: readonly number[];
  densityAxisPixels: readonly number[];
  resultEntryPixels: readonly number[];
  resultValues: readonly number[];
  resultPixels: readonly number[];
  value: number;
  resultText: string;
  exportResultLabel: string;
  exportResultValue: string;
};
type CruiseViewInputs = {
  mode: CruiseMode;
  altitudeFt?: number;
  qnhHpa?: number;
  flightLevel?: number;
  pressureAltitudeFt?: number;
  oatC?: number;
  isaDeviationC?: number;
  densityAltitudeFt: number;
  powerPercent: number;
};

function axisPosition(value: number, values: readonly number[], pixels: readonly number[]) {
  return interpolate1D(values, pixels, Math.min(values[values.length - 1], Math.max(values[0], value)));
}

function createTrace(inputs: CruiseViewInputs, chart: CruiseChart) {
  const resultX = axisPosition(chart.value, chart.resultValues, chart.resultPixels);
  const y = axisPosition(inputs.densityAltitudeFt, chart.altitudeValues, chart.altitudePixels);
  const densityAxisX = axisPosition(inputs.densityAltitudeFt, chart.altitudeValues, chart.densityAxisPixels);
  const resultEntryX = axisPosition(inputs.densityAltitudeFt, chart.altitudeValues, chart.resultEntryPixels);
  if (inputs.mode === "da") {
    return {
      linePoints: [[densityAxisX, y], [resultEntryX, y], [resultX, y], [resultX, chart.resultBottomPixel]] as ChartPoint[],
      markerPoints: [[densityAxisX, y], [resultX, chart.resultBottomPixel]] as ChartPoint[],
    };
  }
  const oatX = axisPosition(inputs.oatC!, chart.temperatureValues, chart.temperaturePixels);
  return {
    linePoints: [[oatX, chart.temperatureBottomPixel], [oatX, y], [densityAxisX, y], [resultEntryX, y], [resultX, y], [resultX, chart.resultBottomPixel]] as ChartPoint[],
    markerPoints: [[oatX, chart.temperatureBottomPixel], [oatX, y], [densityAxisX, y], [resultX, chart.resultBottomPixel], [resultX, y]] as ChartPoint[],
  };
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

function drawText(context: CanvasRenderingContext2D, text: string, x: number, y: number, options: { color?: string; weight?: number; size?: number } = {}) {
  context.fillStyle = options.color || "#152235";
  context.font = `${options.weight || 400} ${options.size || 28}px Arial, sans-serif`;
  context.fillText(text, x, y);
}

function drawField(context: CanvasRenderingContext2D, label: string, value: string, x: number, y: number, width: number, disabled = false) {
  context.fillStyle = disabled ? "#f1f3f5" : "#f7fafc";
  context.strokeStyle = disabled ? "#aeb6bd" : "#9aafc0";
  context.lineWidth = 2;
  context.setLineDash(disabled ? [10, 7] : []);
  context.beginPath();
  context.roundRect(x, y, width, 116, 18);
  context.fill();
  context.stroke();
  context.setLineDash([]);
  drawText(context, label.toUpperCase(), x + 24, y + 39, { size: 21, weight: 700, color: disabled ? "#7d878f" : "#607487" });
  drawText(context, value, x + 24, y + 87, { size: disabled ? 28 : 34, weight: 700, color: disabled ? "#7d878f" : "#152235" });
}

function timestamp(date: Date) {
  return date.toISOString().replace("T", " ").replace(/:/g, "-").slice(0, 19);
}

function exportTimestamp(date: Date) {
  const value = date.toISOString();
  return `${value.slice(8, 10)}.${value.slice(5, 7)}.${value.slice(0, 4)} ${value.slice(11, 19)}Z`;
}

function formatAltitudeSummary(inputs: CruiseViewInputs) {
  if (inputs.mode === "alt") return `Altitude ${inputs.altitudeFt!.toLocaleString("de-DE")} ft · QNH ${inputs.qnhHpa} hPa · DA ${inputs.densityAltitudeFt.toLocaleString("de-DE")} ft`;
  if (inputs.mode === "fl") return `FL ${inputs.flightLevel} · DA ${inputs.densityAltitudeFt.toLocaleString("de-DE")} ft`;
  return `DA ${inputs.densityAltitudeFt.toLocaleString("de-DE")} ft`;
}

function altitudeFields(inputs: CruiseViewInputs): Array<[string, string, boolean?]> {
  if (inputs.mode === "alt") {
    return [
      ["Höhenmodus", "Altitude"],
      ["Flughöhe", `${inputs.altitudeFt!.toLocaleString("de-DE")} ft`],
      ["QNH", `${inputs.qnhHpa!.toLocaleString("de-DE")} hPa`],
      ["Druckhöhe", `${inputs.pressureAltitudeFt!.toLocaleString("de-DE")} ft`],
    ];
  }
  if (inputs.mode === "fl") {
    return [
      ["Höhenmodus", "Flight Level"],
      ["Flight Level", `FL ${inputs.flightLevel}`],
      ["Druckhöhe", `${inputs.pressureAltitudeFt!.toLocaleString("de-DE")} ft`],
      ["QNH", "Nicht anwendbar", true],
    ];
  }
  return [
    ["Höhenmodus", "Density Altitude"],
    ["Density Altitude", `${inputs.densityAltitudeFt.toLocaleString("de-DE")} ft`],
    ["Druckhöhe", "Nicht bereitgestellt", true],
    ["QNH", "Nicht bereitgestellt", true],
  ];
}

function drawExportHeader(context: CanvasRenderingContext2D, inputs: CruiseViewInputs, charts: readonly CruiseChart[], exportDate: Date, width: number) {
  const margin = 96;
  const gap = 32;
  const fieldWidth = (width - margin * 2 - gap * 3) / 4;
  drawText(context, `${exportTimestamp(exportDate)} – Grob G115B Reiseflugberechnung`, margin, 76, { size: 46, weight: 700 });
  drawText(context, "Wahre Fluggeschwindigkeit und Drehzahl", margin, 126, { size: 28, weight: 600, color: "#526274" });
  drawText(context, "Eingangswerte", margin, 188, { size: 30, weight: 700, color: "#006f9f" });
  altitudeFields(inputs).forEach(([label, value, disabled], index) => drawField(context, label, value, margin + index * (fieldWidth + gap), 212, fieldWidth, disabled));
  drawField(context, "OAT", inputs.mode === "da" ? "Nicht bereitgestellt" : `${inputs.oatC!.toLocaleString("de-DE")} °C`, margin, 352, fieldWidth, inputs.mode === "da");
  drawField(context, "Leistung", inputs.powerPercent >= 100 ? "Vollgas" : `${inputs.powerPercent}%`, margin + fieldWidth + gap, 352, fieldWidth);
  drawField(context, "Density Altitude", `${inputs.densityAltitudeFt.toLocaleString("de-DE")} ft`, margin + 2 * (fieldWidth + gap), 352, fieldWidth);
  drawField(context, "ISA-Abweichung", inputs.mode === "da" ? "Nicht berechnet" : `${formatSigned(inputs.isaDeviationC!, 1)} °C`, margin + 3 * (fieldWidth + gap), 352, fieldWidth, inputs.mode === "da");
  drawText(context, "Ergebnis", margin, 528, { size: 30, weight: 700, color: "#006f9f" });
  charts.forEach((chart, index) => drawField(context, chart.exportResultLabel, chart.exportResultValue, margin + index * (fieldWidth * 2 + gap), 552, fieldWidth * 2 + gap));
}

async function exportCharts(inputs: CruiseViewInputs, charts: readonly CruiseChart[]) {
  const { canvas, time } = await createCruiseExportCanvas(inputs, charts);
  const blob = await canvasToBlob(canvas);
  await saveExportBlob(blob, `${time}Z Grob G115B Reiseflugberechnung.png`, "image/png");
}

async function exportChartsPdf(inputs: CruiseViewInputs, charts: readonly CruiseChart[], options: { openWindow?: Window | null } = {}) {
  const { canvas, time } = await createCruiseExportCanvas(inputs, charts);
  const blob = await createPdfBlobFromCanvas(canvas, { maxDimensionPx: 3600 });
  if (options.openWindow) {
    openExportBlob(blob, options.openWindow);
    return;
  }
  await saveExportBlob(blob, `${time}Z Grob G115B Reiseflugberechnung.pdf`, "application/pdf");
}

function drawChartTrace(context: CanvasRenderingContext2D, chart: CruiseChart, trace: ReturnType<typeof createTrace>, xOffset: number, yOffset: number) {
  context.save();
  context.translate(xOffset, yOffset);
  context.strokeStyle = "#e90000";
  context.fillStyle = "#e90000";
  context.lineWidth = chart.width * (5 / 1516);
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  trace.linePoints.forEach(([x, y], index) => index === 0 ? context.moveTo(x, y) : context.lineTo(x, y));
  context.stroke();
  trace.markerPoints.forEach(([x, y]) => {
    context.beginPath();
    context.arc(x, y, chart.width * (6 / 1516), 0, Math.PI * 2);
    context.fill();
  });
  context.restore();
}

async function createCruiseExportCanvas(inputs: CruiseViewInputs, charts: readonly CruiseChart[]) {
  const exportDate = new Date();
  const time = timestamp(exportDate);
  const headerHeight = 720;
  const chartGap = 140;
  const chartTitleHeight = 72;
  const images = await Promise.all(charts.map((chart) => loadImage(chart.source)));
  const width = Math.max(...charts.map((chart) => chart.width));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = headerHeight + charts.reduce((sum, chart) => sum + chartTitleHeight + chart.height, 0) + chartGap * (charts.length - 1);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas wird von diesem Browser nicht unterstützt.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  drawExportHeader(context, inputs, charts, exportDate, canvas.width);
  let y = headerHeight;
  charts.forEach((chart, index) => {
    const x = (canvas.width - chart.width) / 2;
    drawText(context, chart.title, 96, y + 40, { size: 30, weight: 700, color: "#152235" });
    context.drawImage(images[index], x, y + chartTitleHeight);
    drawChartTrace(context, chart, createTrace(inputs, chart), x, y + chartTitleHeight);
    y += chartTitleHeight + chart.height + chartGap;
  });

  return { canvas, time };
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

function CruiseExportToolbar({ inputs, charts }: { inputs: CruiseViewInputs; charts: readonly CruiseChart[] }) {
  const [exporting, setExporting] = useState<"png" | "pdf" | "pdf-open" | null>(null);
  const saveImage = async () => {
    setExporting("png");
    try {
      await exportCharts(inputs, charts);
    } finally {
      setExporting(null);
    }
  };
  const savePdf = async () => {
    setExporting("pdf");
    try {
      await exportChartsPdf(inputs, charts);
    } finally {
      setExporting(null);
    }
  };
  const openPdf = async () => {
    setExporting("pdf-open");
    let exportWindow: Window | null = null;
    try {
      exportWindow = openExportTab();
      await exportChartsPdf(inputs, charts, { openWindow: exportWindow });
    } catch (error) {
      exportWindow?.close();
      console.error(error);
    } finally {
      setExporting(null);
    }
  };
  return (
    <section className="card cruise-export-card traceability-card">
      <div className="traceability-header">
        <div>
          <div className="card-title">Nachvollziehbarkeit exportieren</div>
          <div className="traceability-description">TAS- und Drehzahldiagramm gemeinsam speichern</div>
        </div>
      </div>
      <div className="traceability-toolbar">
        <div className="takeoff-chart-actions">
          <button className="takeoff-chart-download" type="button" disabled={exporting !== null} onClick={saveImage}>
            {exporting === "png" ? "Erzeuge PNG…" : "Charts PNG speichern"}
          </button>
          <button className="takeoff-chart-download" type="button" disabled={exporting !== null} onFocus={warmPdfExportModule} onPointerEnter={warmPdfExportModule} onClick={savePdf}>
            {exporting === "pdf" ? "PDF vorbereiten…" : "Charts PDF speichern"}
          </button>
          <button className="takeoff-chart-download" type="button" disabled={exporting !== null} onFocus={warmPdfExportModule} onPointerEnter={warmPdfExportModule} onClick={openPdf}>
            {exporting === "pdf-open" ? "PDF öffnen…" : "Charts PDF öffnen"}
          </button>
        </div>
      </div>
    </section>
  );
}

function CruiseChartCard({ inputs, chart }: { inputs: CruiseViewInputs; chart: CruiseChart }) {
  const trace = createTrace(inputs, chart);
  return (
    <section className="card takeoff-chart-card traceability-card">
      <div className="traceability-header">
        <div>
          <div className="card-title">{chart.cardTitle.replace("Grafische Nachvollziehbarkeit · ", "Nachvollziehbarkeit · ")}</div>
          <div className="traceability-description">Rechenweg im originalen Flughandbuchdiagramm</div>
        </div>
      </div>
      <div className="takeoff-chart-scroll">
        <div className="takeoff-chart-stage cruise-chart-stage" style={{ aspectRatio: `${chart.width} / ${chart.height}` }}>
          <img className="takeoff-chart-image" src={chart.source} alt={chart.title} width={chart.width} height={chart.height} />
          <svg className="takeoff-chart-overlay" viewBox={`0 0 ${chart.width} ${chart.height}`} aria-label={`Grafischer Rechenweg im originalen ${chart.title}`}>
            <polyline className="cruise-chart-trace" points={trace.linePoints.map((point) => point.join(",")).join(" ")} />
            {trace.markerPoints.map(([x, y], index) => <circle className="cruise-chart-trace-point" cx={x} cy={y} r={Math.max(9, chart.width / 350)} key={`${index}-${x}-${y}`} />)}
          </svg>
        </div>
      </div>
      <div className="takeoff-chart-legend">
        <span className="takeoff-chart-key">Rechenweg im POH-Diagramm</span>
        <span>Density Altitude: {inputs.densityAltitudeFt.toLocaleString("de-DE")} ft</span>
        <span>{chart.resultText}</span>
      </div>
    </section>
  );
}

const chartBase = {
  altitudeValues: [0, 2000, 4000, 6000, 8000, 10000, 12000, 14000, 16000, 18000, 20000],
};

export function CruisePage() {
  const { aircraft, resolvedSpeedUnit } = useAircraft();
  const performance = performanceForAircraft(aircraft);
  const { calculateCruise } = performance.calculators;
  const { flightPlan, updateCruiseCalculator } = useFlightPlan();
  const savedCalculator = flightPlan.cruiseCalculator;
  const [mode, setMode] = useState<CruiseMode>(savedCalculator?.mode ?? "alt");
  const [altitudeFt, setAltitudeFt] = useState(savedCalculator?.altitudeFt ?? 4500);
  const [flightLevel, setFlightLevel] = useState(savedCalculator?.flightLevel ?? 45);
  const [directDensityAltitudeFt, setDirectDensityAltitudeFt] = useState(savedCalculator?.directDensityAltitudeFt ?? 4500);
  const [qnhHpa, setQnhHpa] = useState(savedCalculator?.qnhHpa ?? 1013);
  const [oatC, setOatC] = useState(savedCalculator?.oatC ?? 6);
  const [powerPercent, setPowerPercent] = useState(savedCalculator?.powerPercent ?? 65);
  const inputs = useMemo<CruiseViewInputs>(() => {
    if (mode === "da") return { mode, densityAltitudeFt: directDensityAltitudeFt, powerPercent };
    const pressureAltitudeFt = mode === "alt" ? pressureAltitudeFromQnh(altitudeFt, qnhHpa) : flightLevelToFeet(flightLevel);
    const atmosphere = densityAltitude(pressureAltitudeFt, oatC);
    return {
      mode,
      altitudeFt: mode === "alt" ? altitudeFt : undefined,
      qnhHpa: mode === "alt" ? qnhHpa : undefined,
      flightLevel: mode === "fl" ? flightLevel : undefined,
      pressureAltitudeFt,
      oatC,
      isaDeviationC: atmosphere.isaDeviationC,
      densityAltitudeFt: atmosphere.densityAltitudeFt,
      powerPercent,
    };
  }, [mode, altitudeFt, flightLevel, directDensityAltitudeFt, qnhHpa, oatC, powerPercent]);
  const result = useMemo(() => calculateCruise(inputs), [inputs]);

  useEffect(() => {
    document.body.classList.add("cruise-calculator");
    return () => document.body.classList.remove("cruise-calculator");
  }, []);
  useEffect(() => {
    updateCruiseCalculator({
      mode,
      altitudeFt,
      flightLevel,
      directDensityAltitudeFt,
      qnhHpa,
      oatC,
      powerPercent,
    });
  }, [altitudeFt, directDensityAltitudeFt, flightLevel, mode, oatC, powerPercent, qnhHpa, updateCruiseCalculator]);

  const speedChart: CruiseChart = {
    ...chartBase,
    title: "POH Bild 5.3.12 Reiseflug wahre Fluggeschwindigkeit",
    cardTitle: "Grafische Nachvollziehbarkeit · Wahre Fluggeschwindigkeit",
    source: `${import.meta.env.BASE_URL}assets/grob115b-cruise-speed-chart.png`,
    width: 4101,
    height: 2880,
    temperatureValues: [-30, -20, -10, 0, 10, 20, 30, 40],
    temperaturePixels: [675, 843, 1011, 1179, 1347, 1515, 1682, 1849],
    temperatureBottomPixel: 2253,
    resultBottomPixel: 2253,
    altitudePixels: [2253, 2083, 1916, 1746, 1579, 1409, 1236, 1068, 899, 731, 563],
    densityAxisPixels: Array(11).fill(675),
    resultEntryPixels: Array(11).fill(1798),
    resultValues: [170, 180, 190, 200, 210, 220, 230, 240, 250, 260],
    resultPixels: [1948, 2112, 2276, 2440, 2604, 2768, 2932, 3096, 3260, 3423],
    value: result.tasKmh,
    resultText: `TAS · ${speedText(result.tasKmh, resolvedSpeedUnit)}`,
    exportResultLabel: "Wahre Fluggeschwindigkeit · TAS",
    exportResultValue: speedText(result.tasKmh, resolvedSpeedUnit),
  };
  const rpmChart: CruiseChart = {
    ...chartBase,
    title: "POH Bild 5.3.11 Reiseflug Drehzahl",
    cardTitle: "Grafische Nachvollziehbarkeit · Drehzahl",
    source: `${import.meta.env.BASE_URL}assets/grob115b-cruise-rpm-chart.png`,
    width: 4105,
    height: 2886,
    temperatureValues: [-30, -20, -10, 0, 10, 20, 30, 40],
    temperaturePixels: [696, 863, 1032, 1197, 1365, 1534, 1703, 1879],
    temperatureBottomPixel: 2185,
    resultBottomPixel: 2191,
    altitudePixels: [2181, 2012, 1843, 1673, 1507, 1340, 1166, 997, 830, 662, 494],
    densityAxisPixels: Array(11).fill(696),
    resultEntryPixels: Array(11).fill(1852),
    resultValues: [2000, 2100, 2200, 2300, 2400, 2500, 2600, 2700, 2800, 2900, 3000],
    resultPixels: [2010, 2152, 2292, 2436, 2580, 2724, 2867, 3012, 3152, 3296, 3440],
    value: result.rpm,
    resultText: `${Math.round(result.rpm)} rpm`,
    exportResultLabel: "Drehzahl",
    exportResultValue: `${Math.round(result.rpm)} rpm`,
  };
  const cruiseCharts = [speedChart, rpmChart] as const;

  return (
    <div className="page-layout compact-calculator-layout">
      <aside className="sidebar compact-input-panel">
        <CalculatorInputSection
          icon={<Mountain aria-hidden="true" />}
          title="Höhe"
          description="Flughöhe, QNH und Temperatur"
          summary={formatAltitudeSummary(inputs)}
        >
          <div className="mode-toggle" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
            {([["alt", "Altitude"], ["fl", "Flight Level"], ["da", "Density Alt."]] as const).map(([value, label]) => (
              <button className={`mode-btn${mode === value ? " active" : ""}`} type="button" onClick={() => setMode(value)} key={value}>{label}</button>
            ))}
          </div>
          {mode === "alt" ? <div className="pa-mode"><NumberField label="Flughöhe" unit="ft" value={altitudeFt} step={100} onChange={setAltitudeFt} /><SliderField label="QNH" unit="hPa" value={qnhHpa} min={950} max={1050} onChange={setQnhHpa} /></div> : null}
          {mode === "fl" ? <div className="pa-mode"><NumberField label="Flight Level" unit="FL" value={flightLevel} step={5} onChange={setFlightLevel} /></div> : null}
          {mode === "da" ? <div className="pa-mode"><NumberField label="Density Altitude" unit="ft" value={directDensityAltitudeFt} step={100} onChange={setDirectDensityAltitudeFt} /></div> : null}
          {mode !== "da" ? <div style={{ marginTop: "1.25rem" }}><SliderField label="OAT" unit="°C" value={oatC} min={-40} max={50} onChange={setOatC} /></div> : null}
          {mode !== "da" ? <div className="derived-box"><div className="derived-label">Density Altitude</div><div className="derived-value">{inputs.densityAltitudeFt.toLocaleString("de-DE")} ft</div></div> : null}
        </CalculatorInputSection>
        <CalculatorInputSection
          defaultOpen={false}
          icon={<Plane aria-hidden="true" />}
          title="Leistung"
          description="Motorleistung"
          summary={powerPercent >= 100 ? "Vollgas" : `${powerPercent}% Leistung`}
        >
          <SliderField label="Leistung" unit="%" value={powerPercent} min={45} max={100} hint="Vollgas = 100% · Leistungseinstellung POH Abschnitt 4" onChange={setPowerPercent} />
        </CalculatorInputSection>
      </aside>
      <main className="results">
        {mode !== "da" ? <CalculatorCard title="Atmosphäre"><div className="atmos-grid"><div className="atmos-item"><div className="atmos-item-label">Density Altitude</div><div className={`atmos-item-value${inputs.densityAltitudeFt > 10000 ? " warn" : ""}`}>{inputs.densityAltitudeFt.toLocaleString("de-DE")} <span>ft</span></div></div><div className="atmos-item"><div className="atmos-item-label">ISA-Abweichung</div><div className={`atmos-item-value${Math.abs(inputs.isaDeviationC!) < 0.1 ? "" : inputs.isaDeviationC! > 0 ? " warn" : " good"}`}>{formatSigned(inputs.isaDeviationC!, 1)} <span>°C</span></div></div></div></CalculatorCard> : null}
        <CalculatorCard title="Reiseflugleistung" className="cruise-primary-results">
          <div className="takeoff-summary-heading">
            <Gauge aria-hidden="true" />
            <span>{result.powerLabel} Leistung · DA {inputs.densityAltitudeFt.toLocaleString("de-DE")} ft</span>
          </div>
          <div className="result-grid cruise-result-grid">
            <MetricItem label="Drehzahl · POH 5.3.11" value={String(Math.round(result.rpm))} unit="rpm" />
            <MetricItem label="Fuel Flow · POH 5.3.10" value={result.fuelFlowLitersPerHour.toFixed(1)} unit="l/h" subtext={`${result.nauticalMilesPerLiter.toFixed(2)} nm/l`} />
            <MetricItem label="Wahre Fluggeschwindigkeit · POH 5.3.12" value={speedValue(result.tasKmh, resolvedSpeedUnit)} unit={speedUnitLabel(resolvedSpeedUnit)} speedType="TAS" />
          </div>
        </CalculatorCard>
        {performance.hasChartOverlays ? (
          <>
            <CruiseExportToolbar inputs={inputs} charts={cruiseCharts} />
            <CruiseChartCard inputs={inputs} chart={speedChart} />
            <CruiseChartCard inputs={inputs} chart={rpmChart} />
          </>
        ) : (
          <CalculatorCard title="Nachvollziehbarkeit">
            <div className="conditions-grid">
              <span>Werte aus DR400/180 Reiseflug-Tabelle interpoliert</span>
              <span>Leistung: {result.powerLabel}</span>
              <span>Density Altitude: {inputs.densityAltitudeFt.toLocaleString("de-DE")} ft</span>
            </div>
          </CalculatorCard>
        )}
      </main>
    </div>
  );
}
