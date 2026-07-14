import { useEffect, useMemo, useState } from "react";
import { Gauge, Weight } from "lucide-react";
import { calculateWeightBalance as calculateG115BWeightBalance } from "../aircraft/g115b/calculators";
import { useAircraft } from "../app/AircraftContext";
import { performanceForAircraft } from "../app/aircraftPerformance";
import { useFlightPlan, type WeightBalancePlan } from "../app/FlightPlanContext";
import { kilometersPerHourToKnots } from "../domain";
import type { MassMomentPoint } from "../domain";
import { speedUnitLabel, speedValue } from "../app/speed";
import { CalculatorCard, MetricItem, SpeedSymbol } from "../components/CalculatorCard";
import { CalculatorInputSection } from "../components/CalculatorInputSection";
import { SliderField } from "../components/SliderField";
import { createPdfBlobFromCanvas, openExportBlob, openExportTab, warmPdfExportModule } from "../export/pdf";

type WeightBalanceResult = ReturnType<typeof calculateG115BWeightBalance>;
type WeightBalanceExportMeta = {
  aircraftLabel: string;
  envelope: readonly MassMomentPoint[];
  fuelDensityKgPerLiter: number;
  fuelSource: string;
  mtowKg: number;
};

function bankedStallSpeedKmh(stallSpeedKmh: number, bankDegrees: number): number {
  return stallSpeedKmh * Math.sqrt(1 / Math.cos((bankDegrees * Math.PI) / 180));
}

function deriveLandingFuel(plan: WeightBalancePlan, plannedFuelBurnLiters: number, aircraftId: string) {
  if (aircraftId !== "robin-dr400-180") {
    return { fuelLiters: Math.max(0, plan.startFuelLiters - plannedFuelBurnLiters) };
  }
  const startWingFuelLiters = plan.wingFuelLiters ?? 80;
  const startMainFuelLiters = plan.mainFuelLiters ?? 109;
  const mainFuelBurnLiters = Math.max(0, plan.plannedMainFuelBurnLiters ?? plannedFuelBurnLiters);
  const wingFuelBurnLiters = Math.max(0, plan.plannedWingFuelBurnLiters ?? 0);
  const wingFuelLiters = Math.max(0, startWingFuelLiters - wingFuelBurnLiters);
  const mainFuelLiters = Math.max(0, startMainFuelLiters - mainFuelBurnLiters);
  return { fuelLiters: mainFuelLiters + wingFuelLiters, mainFuelLiters, wingFuelLiters };
}

function plannedFuelBurnLiters(plan: WeightBalancePlan, aircraftId: string) {
  if (aircraftId !== "robin-dr400-180") return plan.plannedFuelBurnLiters;
  return (plan.plannedMainFuelBurnLiters ?? plan.plannedFuelBurnLiters) + (plan.plannedWingFuelBurnLiters ?? 0);
}

function axisTicksInside(minValue: number, maxValue: number, preferredStep: number) {
  const start = Math.ceil(minValue / preferredStep) * preferredStep;
  const end = Math.floor(maxValue / preferredStep) * preferredStep;
  const ticks: number[] = [];
  for (let tick = start; tick <= end; tick += preferredStep) ticks.push(tick);
  return ticks;
}

function EnvelopeChart({ envelope, startResult, landingResult }: { envelope: readonly MassMomentPoint[]; startResult: WeightBalanceResult; landingResult: WeightBalanceResult }) {
  const results = [startResult, landingResult];
  const minMoment =
    Math.min(...envelope.map((point) => point.momentKgM), ...results.map((result) => result.totalMomentKgM)) - 8;
  const maxMoment =
    Math.max(...envelope.map((point) => point.momentKgM), ...results.map((result) => result.totalMomentKgM)) + 8;
  const minMass =
    Math.min(...envelope.map((point) => point.massKg), ...results.map((result) => result.totalMassKg)) - 14;
  const maxMass =
    Math.max(...envelope.map((point) => point.massKg), ...results.map((result) => result.totalMassKg)) + 14;
  const width = 680;
  const height = 300;
  const padding = { top: 18, right: 18, bottom: 34, left: 58 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const x = (moment: number) =>
    padding.left + ((moment - minMoment) / (maxMoment - minMoment)) * plotWidth;
  const y = (mass: number) =>
    padding.top + (1 - (mass - minMass) / (maxMass - minMass)) * plotHeight;
  const polygonPoints = envelope
    .map((point) => `${x(point.momentKgM).toFixed(1)},${y(point.massKg).toFixed(1)}`)
    .join(" ");
  const massTicks = axisTicksInside(minMass, maxMass, 100);
  const momentTicks = axisTicksInside(minMoment, maxMoment, 50);

  return (
    <div className="wb-chart-wrap">
      <div className="wb-chart-axis-key">
        <span>Masse [kg]</span>
        <div className="wb-chart-legend"><span className="start">Start</span><span className="landing">Landung</span></div>
      </div>
      <svg
        className="wb-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Weight and balance envelope"
      >
        {massTicks.map((tick) => (
          <line
            className="wb-grid-line"
            x1={padding.left}
            y1={y(tick)}
            x2={width - padding.right}
            y2={y(tick)}
            key={`mass-grid-${tick}`}
          />
        ))}
        {momentTicks.map((tick) => (
          <line
            className="wb-grid-line"
            x1={x(tick)}
            y1={padding.top}
            x2={x(tick)}
            y2={height - padding.bottom}
            key={`moment-grid-${tick}`}
          />
        ))}
        <polygon className="wb-envelope" points={polygonPoints} />
        <polyline
          className="wb-envelope-line"
          points={`${polygonPoints} ${polygonPoints.split(" ")[0]}`}
        />
        {massTicks.map((tick) => (
          <text className="wb-axis-label" x={16} y={y(tick) + 4} key={`mass-${tick}`}>
            {tick}
          </text>
        ))}
        {momentTicks.map((tick) => (
          <text
            className="wb-axis-label"
            x={x(tick)}
            y={height - 16}
            textAnchor="middle"
            key={`moment-${tick}`}
          >
            {tick}
          </text>
        ))}
        <line
          className="wb-flight-line"
          x1={x(startResult.totalMomentKgM)}
          y1={y(startResult.totalMassKg)}
          x2={x(landingResult.totalMomentKgM)}
          y2={y(landingResult.totalMassKg)}
        />
        {results.map((result, index) => (
          <circle
            className={`wb-current-point ${index === 0 ? "start" : "landing"}${result.withinEnvelope ? "" : " danger"}`}
            cx={x(result.totalMomentKgM).toFixed(1)}
            cy={y(result.totalMassKg).toFixed(1)}
            r={7}
            key={index}
          />
        ))}
      </svg>
      <div className="wb-chart-axis-footer">
        <span>Moment [kg m]</span>
      </div>
    </div>
  );
}

function BreakdownTable({
  startResult,
  landingResult,
  plannedFuelBurnLiters,
}: {
  startResult: WeightBalanceResult;
  landingResult: WeightBalanceResult;
  plannedFuelBurnLiters: number;
}) {
  const burnedFuelMassKg = startResult.fuelMassKg - landingResult.fuelMassKg;
  const burnedFuelMomentKgM = startResult.totalMomentKgM - landingResult.totalMomentKgM;
  return (
    <table className="breakdown-table wb-breakdown">
      <thead>
        <tr>
          <th>Wert</th>
          <th>Masse</th>
          <th>Arm</th>
          <th>Moment</th>
        </tr>
      </thead>
      <tbody>
        {startResult.stations.map((station) => (
          <tr key={station.label}>
            <td>{station.label}</td>
            <td>{station.massKg.toFixed(1)} kg</td>
            <td>{station.armM.toFixed(4)} m</td>
            <td>{station.momentKgM.toFixed(2)} kg m</td>
          </tr>
        ))}
        <tr className="wb-total-row">
          <td>Gesamt · Start</td>
          <td>{startResult.totalMassKg.toFixed(1)} kg</td>
          <td>{startResult.cgArmM.toFixed(4)} m</td>
          <td>{startResult.totalMomentKgM.toFixed(2)} kg m</td>
        </tr>
        <tr className="wb-burn-row">
          <td>− Verbrauch · {plannedFuelBurnLiters.toFixed(1)} l</td>
          <td>−{burnedFuelMassKg.toFixed(1)} kg</td>
          <td>{burnedFuelMassKg > 0 ? (burnedFuelMomentKgM / burnedFuelMassKg).toFixed(4) : "—"} m</td>
          <td>−{burnedFuelMomentKgM.toFixed(2)} kg m</td>
        </tr>
        <tr className="wb-total-row landing">
          <td>Gesamt · Landung</td>
          <td>{landingResult.totalMassKg.toFixed(1)} kg</td>
          <td>{landingResult.cgArmM.toFixed(4)} m</td>
          <td>{landingResult.totalMomentKgM.toFixed(2)} kg m</td>
        </tr>
      </tbody>
    </table>
  );
}

function SpeedMetric({
  label,
  speedKmh,
  unit,
}: {
  label: React.ReactNode;
  speedKmh: number;
  unit: "kt" | "kmh";
}) {
  return (
    <MetricItem
      label={label}
      value={speedValue(speedKmh, unit)}
      unit={speedUnitLabel(unit)}
      speedType="IAS"
    />
  );
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

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("PNG konnte nicht erzeugt werden.")), "image/png");
  });
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

function exportText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  options: { color?: string; size?: number; weight?: number; align?: CanvasTextAlign } = {},
) {
  context.fillStyle = options.color || "#152235";
  context.font = `${options.weight || 400} ${options.size || 24}px Arial, sans-serif`;
  context.textAlign = options.align || "left";
  context.fillText(text, x, y);
}

function exportRightAlignedNumber(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  options: { color?: string; size?: number; weight?: number } = {},
) {
  const negativeMatch = text.match(/^([-−])(.+)$/);
  if (!negativeMatch) {
    exportText(context, text, x, y, { ...options, align: "right" });
    return;
  }
  const value = negativeMatch[2].trimStart();
  exportText(context, value, x, y, { ...options, align: "right" });
  const valueWidth = context.measureText(value).width;
  exportText(context, "−", x - valueWidth - 8, y, { ...options, align: "right" });
}

function drawExportTable(
  context: CanvasRenderingContext2D,
  rows: string[][],
  x: number,
  y: number,
  widths: number[],
  rowHeight: number,
  headerRows = 1,
  footerRows = 1,
  rightAlignedColumns: number[] = [],
) {
  const textPadding = 14;
  const numericPadding = 30;
  let rowY = y;
  rows.forEach((row, rowIndex) => {
    let cellX = x;
    const isHeader = rowIndex < headerRows;
    const isFooter = footerRows > 0 && rowIndex >= rows.length - footerRows;
    context.fillStyle = isHeader ? "#e9eef2" : "#ffffff";
    context.fillRect(x, rowY, widths.reduce((sum, width) => sum + width, 0), rowHeight);
    row.forEach((cell, cellIndex) => {
      context.strokeStyle = "#152235";
      context.lineWidth = isHeader || isFooter ? 3 : 2;
      context.strokeRect(cellX, rowY, widths[cellIndex], rowHeight);
      const alignRight = rightAlignedColumns.includes(cellIndex);
      const textOptions = {
        size: isHeader ? 19 : 18,
        weight: isHeader || isFooter ? 700 : 400,
      };
      if (alignRight) {
        exportRightAlignedNumber(context, cell, cellX + widths[cellIndex] - numericPadding, rowY + rowHeight * 0.64, textOptions);
      } else {
        exportText(context, cell, cellX + textPadding, rowY + rowHeight * 0.64, textOptions);
      }
      cellX += widths[cellIndex];
    });
    rowY += rowHeight;
  });
}

type StatusExportRow = {
  danger: boolean;
  label: string;
  value: string;
};

function drawStatusExportTable(
  context: CanvasRenderingContext2D,
  rows: StatusExportRow[],
  x: number,
  y: number,
  widths: number[],
  rowHeight: number,
) {
  let rowY = y;
  rows.forEach((row) => {
    let cellX = x;
    context.fillStyle = row.danger ? "#fff1f0" : "#ffffff";
    context.fillRect(x, rowY, widths.reduce((sum, width) => sum + width, 0), rowHeight);
    [row.label, row.value].forEach((cell, cellIndex) => {
      context.strokeStyle = row.danger ? "#b42318" : "#152235";
      context.lineWidth = row.danger ? 3 : 2;
      context.strokeRect(cellX, rowY, widths[cellIndex], rowHeight);
      exportText(context, cell, cellX + 14, rowY + rowHeight * 0.64, {
        color: row.danger ? "#b42318" : "#152235",
        size: 18,
        weight: row.danger ? 700 : 400,
      });
      cellX += widths[cellIndex];
    });
    rowY += rowHeight;
  });
}

type SpeedExportRow = {
  bank30Kt?: string;
  bank45Kt?: string;
  detail?: string;
  group?: never;
  kt: string;
  suffixSymbolSubscript?: string;
  suffixText?: string;
  subscript: string;
};

type SpeedExportGroupRow = {
  group: string;
};

function speedRowsForResult(result: WeightBalanceResult): SpeedExportRow[] {
  return [
    { detail: "Approach", kt: kilometersPerHourToKnots(result.speeds.approachSpeedKmh).toFixed(1), subscript: "APP" },
    { kt: kilometersPerHourToKnots(result.speeds.referenceSpeedKmh).toFixed(1), subscript: "REF", suffixSymbolSubscript: "S0", suffixText: "1.3 x" },
    {
      bank30Kt: kilometersPerHourToKnots(result.speeds.stallIdleFlaps40Bank30Kmh).toFixed(1),
      bank45Kt: kilometersPerHourToKnots(result.speeds.stallIdleFlaps40Bank45Kmh).toFixed(1),
      detail: "Leerlauf 40°",
      kt: kilometersPerHourToKnots(result.speeds.stallIdleFlaps40Kmh).toFixed(1),
      subscript: "S0",
    },
  ];
}

function drawSpeedSymbol(context: CanvasRenderingContext2D, x: number, y: number, subscript: string) {
  exportText(context, "V", x, y, { size: 20, weight: 400 });
  exportText(context, subscript, x + 15, y + 5, { size: 10, weight: 400 });
  return x + 18 + context.measureText(subscript).width;
}

function drawSpeedLabel(context: CanvasRenderingContext2D, row: SpeedExportRow, x: number, y: number) {
  let nextX = drawSpeedSymbol(context, x, y, row.subscript);
  if (row.suffixText && row.suffixSymbolSubscript) {
    exportText(context, ` ${row.suffixText} `, nextX, y, { size: 17 });
    nextX += context.measureText(` ${row.suffixText} `).width;
    nextX = drawSpeedSymbol(context, nextX, y, row.suffixSymbolSubscript);
  }
  if (row.detail) exportText(context, ` ${row.detail}`, nextX + 4, y, { size: 17 });
}

function drawSpeedExportTable(
  context: CanvasRenderingContext2D,
  rows: Array<SpeedExportRow | SpeedExportGroupRow>,
  x: number,
  y: number,
  widths: number[],
  rowHeight: number,
) {
  const header = ["Wert", "IAS [kt]", "30° Bank (Φ)", "45° Bank (Φ)"];
  const groupHeight = 28;
  const textPadding = 14;
  const numericPadding = 30;
  const tableWidth = widths.reduce((sum, width) => sum + width, 0);
  let rowY = y;
  [header, ...rows].forEach((row, rowIndex) => {
    let cellX = x;
    const isHeader = rowIndex === 0;
    const isGroup = !Array.isArray(row) && "group" in row;
    const currentRowHeight = isGroup ? groupHeight : rowHeight;
    context.fillStyle = isHeader ? "#e9eef2" : "#ffffff";
    context.fillRect(x, rowY, tableWidth, currentRowHeight);
    if (isGroup) {
      context.fillStyle = "#f2f6f8";
      context.fillRect(x, rowY, tableWidth, currentRowHeight);
      context.strokeStyle = "#152235";
      context.lineWidth = 2;
      context.strokeRect(x, rowY, tableWidth, currentRowHeight);
      exportText(context, row.group ?? "", x + 14, rowY + 19, { size: 15, weight: 700, color: "#006f9f" });
      rowY += currentRowHeight;
      return;
    }
    widths.forEach((width, cellIndex) => {
      context.strokeStyle = "#152235";
      context.lineWidth = isHeader ? 3 : 2;
      context.strokeRect(cellX, rowY, width, currentRowHeight);
      if (isHeader) {
        exportText(context, header[cellIndex] ?? "", cellIndex === 0 ? cellX + textPadding : cellX + width / 2, rowY + currentRowHeight * 0.64, {
          align: cellIndex === 0 ? "left" : "center",
          size: cellIndex === 0 ? 18 : 17,
          weight: 700,
        });
      } else {
        const speedRow = row as SpeedExportRow;
        const textY = rowY + currentRowHeight * 0.64;
        if (cellIndex === 0) drawSpeedLabel(context, speedRow, cellX + textPadding, textY);
        if (cellIndex === 1) exportText(context, speedRow.kt, cellX + width - numericPadding, textY, { align: "right", size: 18 });
        if (cellIndex === 2 || cellIndex === 3) {
          const value = cellIndex === 2 ? speedRow.bank30Kt : speedRow.bank45Kt;
          if (value) {
            exportText(context, value, cellX + width - numericPadding, textY, { align: "right", size: 18 });
          } else {
            context.fillStyle = "#edf1f4";
            context.fillRect(cellX + 1, rowY + 1, width - 2, currentRowHeight - 2);
            context.strokeStyle = "#9aa8b3";
            context.lineWidth = 1.5;
            context.beginPath();
            context.moveTo(cellX + 10, rowY + currentRowHeight - 8);
            context.lineTo(cellX + width - 10, rowY + 8);
            context.stroke();
          }
        }
      }
      cellX += width;
    });
    rowY += currentRowHeight;
  });
}

function drawExportEnvelope(
  context: CanvasRenderingContext2D,
  envelope: readonly MassMomentPoint[],
  startResult: WeightBalanceResult,
  landingResult: WeightBalanceResult,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const results = [startResult, landingResult];
  const minMoment = Math.min(...envelope.map((point) => point.momentKgM), ...results.map((result) => result.totalMomentKgM)) - 8;
  const maxMoment = Math.max(...envelope.map((point) => point.momentKgM), ...results.map((result) => result.totalMomentKgM)) + 8;
  const minMass = Math.min(...envelope.map((point) => point.massKg), ...results.map((result) => result.totalMassKg)) - 14;
  const maxMass = Math.max(...envelope.map((point) => point.massKg), ...results.map((result) => result.totalMassKg)) + 14;
  const padding = { top: 88, right: 64, bottom: 84, left: 82 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const px = (moment: number) => x + padding.left + ((moment - minMoment) / (maxMoment - minMoment)) * plotWidth;
  const py = (mass: number) => y + padding.top + (1 - (mass - minMass) / (maxMass - minMass)) * plotHeight;
  const massTicks = axisTicksInside(minMass, maxMass, 100);
  const momentTicks = axisTicksInside(minMoment, maxMoment, 50);

  context.fillStyle = "#f7fafc";
  context.strokeStyle = "#152235";
  context.lineWidth = 3;
  context.fillRect(x, y, width, height);
  context.strokeRect(x, y, width, height);
  exportText(context, "Envelope", x + 22, y + 38, { size: 22, weight: 700 });
  const titleStartX = x + 138;
  context.fillStyle = "#20a879";
  context.beginPath();
  context.arc(titleStartX, y + 30, 7, 0, Math.PI * 2);
  context.fill();
  exportText(context, "Start", titleStartX + 16, y + 38, { size: 22, weight: 700, color: "#20a879" });
  exportText(context, "/", titleStartX + 88, y + 38, { size: 22, weight: 700 });
  context.fillStyle = "#006f9f";
  context.beginPath();
  context.arc(titleStartX + 120, y + 30, 7, 0, Math.PI * 2);
  context.fill();
  exportText(context, "Landung", titleStartX + 136, y + 38, { size: 22, weight: 700, color: "#006f9f" });
  exportText(context, "Masse [kg]", x + 22, y + 68, { size: 17, weight: 700, color: "#607487" });
  exportText(context, "Moment [kg m]", x + width - 22, y + height - 16, { size: 17, weight: 700, align: "right", color: "#607487" });

  context.strokeStyle = "#b9c4cc";
  context.lineWidth = 1.5;
  massTicks.forEach((tick) => {
    context.beginPath();
    context.moveTo(x + padding.left, py(tick));
    context.lineTo(x + width - padding.right, py(tick));
    context.stroke();
    exportText(context, String(tick), x + 20, py(tick) + 6, { size: 16, color: "#607487" });
  });
  momentTicks.forEach((tick) => {
    context.beginPath();
    context.moveTo(px(tick), y + padding.top);
    context.lineTo(px(tick), y + height - padding.bottom);
    context.stroke();
    exportText(context, String(tick), px(tick), y + height - 36, { size: 16, align: "center", color: "#607487" });
  });

  context.beginPath();
  envelope.forEach((point, index) => index === 0 ? context.moveTo(px(point.momentKgM), py(point.massKg)) : context.lineTo(px(point.momentKgM), py(point.massKg)));
  context.closePath();
  context.fillStyle = "rgba(0, 111, 159, 0.10)";
  context.fill();
  context.strokeStyle = "#006f9f";
  context.lineWidth = 4;
  context.stroke();

  context.strokeStyle = "#526274";
  context.lineWidth = 3;
  context.setLineDash([12, 8]);
  context.beginPath();
  context.moveTo(px(startResult.totalMomentKgM), py(startResult.totalMassKg));
  context.lineTo(px(landingResult.totalMomentKgM), py(landingResult.totalMassKg));
  context.stroke();
  context.setLineDash([]);

  [
    { result: startResult, color: "#20a879" },
    { result: landingResult, color: "#006f9f" },
  ].forEach(({ result, color }) => {
    const pointX = px(result.totalMomentKgM);
    const pointY = py(result.totalMassKg);
    const markerRadius = 8;
    const labelColor = result.withinEnvelope ? color : "#b42318";
    context.fillStyle = labelColor;
    context.beginPath();
    context.arc(pointX, pointY, markerRadius, 0, Math.PI * 2);
    context.fill();
  });
}

async function createWeightBalanceExportCanvas(
  plan: WeightBalancePlan,
  startResult: WeightBalanceResult,
  landingResult: WeightBalanceResult,
  landingFuelLiters: number,
  meta: WeightBalanceExportMeta,
) {
  const exportDate = new Date();
  const burnedFuelMassKg = startResult.fuelMassKg - landingResult.fuelMassKg;
  const burnedFuelMomentKgM = startResult.totalMomentKgM - landingResult.totalMomentKgM;
  const burnedFuelArmM = burnedFuelMassKg > 0 ? burnedFuelMomentKgM / burnedFuelMassKg : 0;
  const canvas = document.createElement("canvas");
  canvas.width = 2200;
  canvas.height = 1500;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas wird von diesem Browser nicht unterstützt.");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "#152235";
  context.lineWidth = 6;
  context.strokeRect(48, 42, canvas.width - 96, 136);
  exportText(context, `${meta.aircraftLabel} - ${plan.registration}`, canvas.width / 2, 100, { size: 38, weight: 700, align: "center" });
  exportText(context, "Beladeplan", canvas.width / 2, 144, { size: 34, weight: 700, align: "center" });
  exportText(context, `Revision ${startResult.emptyAircraft.revision}`, canvas.width - 210, 96, { size: 25, weight: 700, align: "center" });
  exportText(context, startResult.emptyAircraft.revisionDate, canvas.width - 210, 136, { size: 25, align: "center" });
  exportText(context, exportTimestamp(exportDate), 78, 144, { size: 22, color: "#607487" });

  const startRows = [
    ["Position", "Masse [kg]", "Arm [m]", "Moment [kg m]"],
    ...startResult.stations.map((station) => [station.label, station.massKg.toFixed(1), station.armM.toFixed(4), station.momentKgM.toFixed(2)]),
    ["Abfluggewicht", startResult.totalMassKg.toFixed(1), startResult.cgArmM.toFixed(4), startResult.totalMomentKgM.toFixed(2)],
  ];
  const fuelStations = startResult.stations.filter((station) => station.label.toLowerCase().includes("tank") || station.label === "Kraftstoff");
  const fuelBurnRows = fuelStations.map((startStation) => {
    const landingStation = landingResult.stations.find((station) => station.label === startStation.label);
    const massDeltaKg = Math.max(0, startStation.massKg - (landingStation?.massKg ?? 0));
    const momentDeltaKgM = Math.max(0, startStation.momentKgM - (landingStation?.momentKgM ?? 0));
    return [`${startStation.label}-Verbrauch`, `-${massDeltaKg.toFixed(1)}`, startStation.armM.toFixed(4), `-${momentDeltaKgM.toFixed(2)}`];
  });
  const landingRows = [
    ["Position", "Masse [kg]", "Arm [m]", "Moment [kg m]"],
    ...(fuelStations.length > 1
      ? fuelBurnRows
      : [[`Kraftstoff-Verbrauch (${plan.plannedFuelBurnLiters.toFixed(1)} l)`, `-${burnedFuelMassKg.toFixed(1)}`, burnedFuelArmM.toFixed(4), `-${burnedFuelMomentKgM.toFixed(2)}`]]),
    ["Landegewicht", landingResult.totalMassKg.toFixed(1), landingResult.cgArmM.toFixed(4), landingResult.totalMomentKgM.toFixed(2)],
  ];
  const leftX = 60;
  const tableWidths = [360, 170, 160, 210];
  const wbRowHeight = 45;
  const startY = 318;
  const startTableHeight = startRows.length * wbRowHeight;
  const mtowY = startY + startTableHeight + 34;
  const landingTitleY = mtowY + 62;
  const landingY = landingTitleY + 34;
  const landingTableHeight = landingRows.length * wbRowHeight;
  const statusTitleY = landingY + landingTableHeight + 84;
  const statusY = statusTitleY + 34;

  exportText(context, "Startbeladung", 60, 286, { size: 28, weight: 700, color: "#006f9f" });
  drawExportTable(
    context,
    startRows,
    leftX,
    startY,
    tableWidths,
    wbRowHeight,
    1,
    1,
    [1, 2, 3],
  );
  exportText(context, `MTOW: ${meta.mtowKg} kg`, 72, mtowY, { size: 24, weight: 700 });

  exportText(context, "Landung", 60, landingTitleY, { size: 28, weight: 700, color: "#006f9f" });
  drawExportTable(
    context,
    landingRows,
    leftX,
    landingY,
    tableWidths,
    wbRowHeight,
    1,
    1,
    [1, 2, 3],
  );

  exportText(context, "Status", 60, statusTitleY, { size: 28, weight: 700, color: "#006f9f" });
  const envelopeStatusRows = [
    { danger: !startResult.withinEnvelope, label: "Start", value: startResult.withinEnvelope ? "Envelope OK" : "Ausserhalb Envelope" },
    { danger: !landingResult.withinEnvelope, label: "Landung", value: landingResult.withinEnvelope ? "Envelope OK" : "Ausserhalb Envelope" },
  ];
  drawStatusExportTable(context, envelopeStatusRows, 60, statusY, [250, 650], 43);
  const statusRows = [
    ["Kraftstoffdichte", `${meta.fuelDensityKgPerLiter.toLocaleString("de-DE")} kg/l`],
    ["Quelle", meta.fuelSource],
    ["Revision", `Beladeplan ${startResult.emptyAircraft.revision} vom ${startResult.emptyAircraft.revisionDate}`],
  ];
  drawExportTable(context, statusRows, 60, statusY + 92, [250, 650], 43, 0, 0);

  exportText(context, "Geschwindigkeiten", 1030, 286, { size: 28, weight: 700, color: "#006f9f" });
  drawSpeedExportTable(
    context,
    [
      { group: "Start" },
      { detail: "Rotate", kt: kilometersPerHourToKnots(startResult.speeds.rotateSpeedKmh).toFixed(1), subscript: "R" },
      { kt: kilometersPerHourToKnots(startResult.speeds.speedAt15mKmh).toFixed(1), subscript: "15m" },
      { group: "Landung mit Abfluggewicht" },
      ...speedRowsForResult(startResult),
      { group: "Landung mit Landegewicht" },
      ...speedRowsForResult(landingResult),
    ],
    1030,
    318,
    [330, 110, 145, 145],
    40,
  );
  drawExportEnvelope(context, meta.envelope, startResult, landingResult, 1030, 780, 1040, 600);

  return { canvas, exportDate };
}

async function exportWeightBalanceImage(
  plan: WeightBalancePlan,
  startResult: WeightBalanceResult,
  landingResult: WeightBalanceResult,
  landingFuelLiters: number,
  meta: WeightBalanceExportMeta,
) {
  const { canvas, exportDate } = await createWeightBalanceExportCanvas(plan, startResult, landingResult, landingFuelLiters, meta);
  const blob = await canvasToBlob(canvas);
  await saveExportBlob(blob, `${timestamp(exportDate)}Z ${filenameSafeLabel(meta.aircraftLabel)} Beladeplan ${plan.registration}.png`, "image/png");
}

async function exportWeightBalancePdf(
  plan: WeightBalancePlan,
  startResult: WeightBalanceResult,
  landingResult: WeightBalanceResult,
  landingFuelLiters: number,
  meta: WeightBalanceExportMeta,
  options: { openWindow?: Window | null } = {},
) {
  const { canvas, exportDate } = await createWeightBalanceExportCanvas(plan, startResult, landingResult, landingFuelLiters, meta);
  const blob = await createPdfBlobFromCanvas(canvas, { orientation: "landscape", maxDimensionPx: 2400 });
  if (options.openWindow) {
    openExportBlob(blob, options.openWindow);
    return;
  }
  await saveExportBlob(blob, `${timestamp(exportDate)}Z ${filenameSafeLabel(meta.aircraftLabel)} Beladeplan ${plan.registration}.pdf`, "application/pdf");
}

function WeightBalanceExportCard({
  landingFuelLiters,
  landingResult,
  meta,
  plan,
  startResult,
}: {
  landingFuelLiters: number;
  landingResult: WeightBalanceResult;
  meta: WeightBalanceExportMeta;
  plan: WeightBalancePlan;
  startResult: WeightBalanceResult;
}) {
  const [exporting, setExporting] = useState<"png" | "pdf" | "pdf-open" | null>(null);
  const saveImage = async () => {
    setExporting("png");
    try {
      await exportWeightBalanceImage(plan, startResult, landingResult, landingFuelLiters, meta);
    } finally {
      setExporting(null);
    }
  };
  const savePdf = async () => {
    setExporting("pdf");
    try {
      await exportWeightBalancePdf(plan, startResult, landingResult, landingFuelLiters, meta);
    } finally {
      setExporting(null);
    }
  };
  const openPdf = async () => {
    setExporting("pdf-open");
    let exportWindow: Window | null = null;
    try {
      exportWindow = openExportTab();
      await exportWeightBalancePdf(plan, startResult, landingResult, landingFuelLiters, meta, { openWindow: exportWindow });
    } catch (error) {
      exportWindow?.close();
      console.error(error);
    } finally {
      setExporting(null);
    }
  };
  return (
    <section className="card weight-balance-export-card traceability-card">
      <div className="traceability-header">
        <div>
          <div className="card-title">Beladeplan exportieren</div>
          <div className="traceability-description">Start, Landung, Revision und Envelope gemeinsam speichern</div>
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
    </section>
  );
}

export function WeightBalancePage() {
  const { aircraft, resolvedSpeedUnit } = useAircraft();
  const performance = performanceForAircraft(aircraft);
  const { calculateWeightBalance } = performance.calculators;
  const weightBalanceData = performance.data.weightBalance;
  const { flightPlan, updateWeightBalance, publishMasses } = useFlightPlan();
  const plan = flightPlan.weightBalance;
  const dr400 = aircraft.id === "robin-dr400-180";
  const startFuelLiters = dr400 ? (plan.mainFuelLiters ?? 109) + (plan.wingFuelLiters ?? 80) : plan.startFuelLiters;
  const plannedBurnLiters = plannedFuelBurnLiters(plan, aircraft.id);
  const landingFuel = deriveLandingFuel({ ...plan, startFuelLiters }, plannedBurnLiters, aircraft.id);
  const landingFuelLiters = landingFuel.fuelLiters;
  const exportMeta = useMemo<WeightBalanceExportMeta>(() => ({
    aircraftLabel: aircraft.shortName,
    envelope: weightBalanceData.envelope,
    fuelDensityKgPerLiter: weightBalanceData.fuelDensityKgPerLiter,
    fuelSource: weightBalanceData.source,
    mtowKg: performance.limits.takeoffMassMaxKg,
  }), [aircraft.shortName, performance.limits.takeoffMassMaxKg, weightBalanceData.envelope, weightBalanceData.fuelDensityKgPerLiter, weightBalanceData.source]);
  const startResult = useMemo(
    () =>
      calculateWeightBalance({
        aircraftName: plan.registration,
        pilotMassKg: plan.pilotMassKg,
        copilotMassKg: plan.copilotMassKg,
        passengerLeftMassKg: plan.passengerLeftMassKg,
        passengerRightMassKg: plan.passengerRightMassKg,
        baggageMassKg: plan.baggageMassKg,
        fuelLiters: startFuelLiters,
        mainFuelLiters: plan.mainFuelLiters,
        wingFuelLiters: plan.wingFuelLiters,
      }),
    [calculateWeightBalance, plan.registration, plan.pilotMassKg, plan.copilotMassKg, plan.passengerLeftMassKg, plan.passengerRightMassKg, plan.baggageMassKg, startFuelLiters, plan.mainFuelLiters, plan.wingFuelLiters],
  );
  const landingResult = useMemo(
    () =>
      calculateWeightBalance({
        aircraftName: plan.registration,
        pilotMassKg: plan.pilotMassKg,
        copilotMassKg: plan.copilotMassKg,
        passengerLeftMassKg: plan.passengerLeftMassKg,
        passengerRightMassKg: plan.passengerRightMassKg,
        baggageMassKg: plan.baggageMassKg,
        ...landingFuel,
      }),
    [calculateWeightBalance, landingFuel.fuelLiters, landingFuel.mainFuelLiters, landingFuel.wingFuelLiters, plan.registration, plan.pilotMassKg, plan.copilotMassKg, plan.passengerLeftMassKg, plan.passengerRightMassKg, plan.baggageMassKg],
  );

  useEffect(() => {
    publishMasses({
      startMassKg: startResult.totalMassKg,
      landingMassKg: landingResult.totalMassKg,
      startFuelLiters,
      landingFuelLiters,
    });
  }, [landingFuelLiters, landingResult.totalMassKg, publishMasses, startFuelLiters, startResult.totalMassKg]);
  useEffect(() => {
    if (aircraft.registrations.includes(plan.registration)) return;
    updateWeightBalance({
      registration: aircraft.registrations[0] ?? plan.registration,
      startFuelLiters: dr400 ? 189 : Math.min(plan.startFuelLiters, performance.limits.fuelMaxLiters),
      mainFuelLiters: dr400 ? 109 : undefined,
      wingFuelLiters: dr400 ? 80 : undefined,
      plannedMainFuelBurnLiters: dr400 ? (plan.plannedMainFuelBurnLiters ?? plan.plannedFuelBurnLiters) : undefined,
      plannedWingFuelBurnLiters: dr400 ? (plan.plannedWingFuelBurnLiters ?? 0) : undefined,
    });
  }, [aircraft.registrations, dr400, performance.limits.fuelMaxLiters, plan.plannedFuelBurnLiters, plan.plannedMainFuelBurnLiters, plan.plannedWingFuelBurnLiters, plan.registration, plan.startFuelLiters, updateWeightBalance]);
  useEffect(() => {
    document.body.classList.add("weight-balance-calculator");
    return () => document.body.classList.remove("weight-balance-calculator");
  }, []);

  return (
    <div className="page-layout compact-calculator-layout">
      <aside className="sidebar compact-input-panel">
        <CalculatorInputSection
          icon={<Weight aria-hidden="true" />}
          title="Beladung"
          description="Besatzung, Gepäck und Kraftstoff"
          summary={`Start ${startResult.totalMassKg.toFixed(1)} kg · Landung ${landingResult.totalMassKg.toFixed(1)} kg`}
        >
          <SliderField
            label="Pilot"
            unit="kg"
            value={plan.pilotMassKg}
            min={0}
            max={130}
            inputMax={150}
            onChange={(pilotMassKg) => updateWeightBalance({ pilotMassKg })}
          />
          <SliderField
            label="Co-Pilot"
            unit="kg"
            value={plan.copilotMassKg}
            min={0}
            max={130}
            inputMax={150}
            onChange={(copilotMassKg) => updateWeightBalance({ copilotMassKg })}
          />
          <SliderField
            label="Gepäck"
            unit="kg"
            value={plan.baggageMassKg}
            min={0}
            max={dr400 ? 60 : 20}
            onChange={(baggageMassKg) => updateWeightBalance({ baggageMassKg })}
          />
          {dr400 ? (
            <>
              <SliderField
                label="Passagier links"
                unit="kg"
                value={plan.passengerLeftMassKg ?? 0}
                min={0}
                max={130}
                inputMax={150}
                onChange={(passengerLeftMassKg) => updateWeightBalance({ passengerLeftMassKg })}
              />
              <SliderField
                label="Passagier rechts"
                unit="kg"
                value={plan.passengerRightMassKg ?? 0}
                min={0}
                max={130}
                inputMax={150}
                onChange={(passengerRightMassKg) => updateWeightBalance({ passengerRightMassKg })}
              />
            </>
          ) : null}
          <SliderField
            label={dr400 ? "Haupttank" : "Kraftstoff beim Start"}
            unit="l"
            value={dr400 ? (plan.mainFuelLiters ?? 109) : plan.startFuelLiters}
            min={0}
            max={dr400 ? 109 : performance.limits.fuelMaxLiters}
            inputMax={dr400 ? 109 : 130}
            hint="Kraftstoffmasse mit 0,72 kg/l."
            onChange={(value) => updateWeightBalance(dr400 ? { mainFuelLiters: value, startFuelLiters: value + (plan.wingFuelLiters ?? 80) } : { startFuelLiters: value })}
          />
          {dr400 ? (
            <SliderField
              label="Flächentanks"
              unit="l"
              value={plan.wingFuelLiters ?? 80}
              min={0}
              max={80}
              inputMax={80}
              hint="Verbrauch wird für die Landeberechnung zuerst den Flächentanks entnommen."
              onChange={(wingFuelLiters) => updateWeightBalance({ wingFuelLiters, startFuelLiters: (plan.mainFuelLiters ?? 109) + wingFuelLiters })}
            />
          ) : null}
          {dr400 ? (
            <>
              <SliderField
                label="Verbrauch Haupttank"
                unit="l"
                value={plan.plannedMainFuelBurnLiters ?? plan.plannedFuelBurnLiters}
                min={0}
                max={plan.mainFuelLiters ?? 109}
                inputMax={109}
                hint={`${(landingFuel.mainFuelLiters ?? 0).toFixed(1)} l im Haupttank bei Landung.`}
                onChange={(plannedMainFuelBurnLiters) => updateWeightBalance({
                  plannedMainFuelBurnLiters,
                  plannedFuelBurnLiters: plannedMainFuelBurnLiters + (plan.plannedWingFuelBurnLiters ?? 0),
                })}
              />
              <SliderField
                label="Verbrauch Flächentanks"
                unit="l"
                value={plan.plannedWingFuelBurnLiters ?? 0}
                min={0}
                max={plan.wingFuelLiters ?? 80}
                inputMax={80}
                hint={`${(landingFuel.wingFuelLiters ?? 0).toFixed(1)} l in den Flächentanks bei Landung.`}
                onChange={(plannedWingFuelBurnLiters) => updateWeightBalance({
                  plannedWingFuelBurnLiters,
                  plannedFuelBurnLiters: (plan.plannedMainFuelBurnLiters ?? plan.plannedFuelBurnLiters) + plannedWingFuelBurnLiters,
                })}
              />
            </>
          ) : (
            <SliderField
              label="Geplanter Verbrauch"
              unit="l"
              value={plan.plannedFuelBurnLiters}
              min={0}
              max={performance.limits.fuelMaxLiters}
              inputMax={performance.limits.fuelMaxLiters}
              hint={`Verbleibend bei Landung: ${landingFuelLiters.toFixed(1)} l`}
              onChange={(plannedFuelBurnLiters) => updateWeightBalance({ plannedFuelBurnLiters })}
            />
          )}
        </CalculatorInputSection>
      </aside>
      <main className="results">
        <CalculatorCard title="Flugplanung" className="weight-balance-primary-results">
          <div className="takeoff-summary-heading">
            <Gauge aria-hidden="true" />
            <span>{plan.registration} · Revision {startResult.emptyAircraft.revision} vom {startResult.emptyAircraft.revisionDate}</span>
          </div>
          <div className="wb-summary">
            <div className="result-grid weight-balance-result-grid">
              <MetricItem
                label="Startmasse"
                value={startResult.totalMassKg.toFixed(1)}
                unit="kg"
                subtext={
                  startResult.withinEnvelope ? `${startFuelLiters.toFixed(1)} l Kraftstoff · zentral gespeichert` : "Ausserhalb Envelope"
                }
                danger={!startResult.withinEnvelope}
              />
              <MetricItem
                label="Landemasse"
                value={landingResult.totalMassKg.toFixed(1)}
                unit="kg"
                subtext={
                  landingResult.withinEnvelope ? `${landingFuelLiters.toFixed(1)} l Kraftstoff · zentral gespeichert` : "Ausserhalb Envelope"
                }
                danger={!landingResult.withinEnvelope}
              />
            </div>
            <div className="conditions-grid wb-planning-conditions">
              {startResult.conditions.map((condition) => <span key={condition}>{condition}</span>)}
              <span>Beladeplan Revision {startResult.emptyAircraft.revision} vom {startResult.emptyAircraft.revisionDate}</span>
              <span>Landung = Start − geplanter Kraftstoffverbrauch{dr400 ? " je Tank" : ""}</span>
            </div>
            <div className="wb-status-grid">
              <div className={`wb-status-pill${startResult.withinEnvelope ? "" : " danger"}`}>
                <span>Start</span>
                <strong>{startResult.withinEnvelope ? "Envelope OK" : "Außerhalb Envelope"}</strong>
              </div>
              <div className={`wb-status-pill${landingResult.withinEnvelope ? "" : " danger"}`}>
                <span>Landung</span>
                <strong>{landingResult.withinEnvelope ? "Envelope OK" : "Außerhalb Envelope"}</strong>
              </div>
            </div>
            {plannedBurnLiters > startFuelLiters ? (
              <div className="wb-inline-warnings">
                <div className="wb-inline-warning danger">Geplanter Verbrauch überschreitet den Kraftstoff beim Start.</div>
              </div>
            ) : null}
            {[...startResult.warnings, ...landingResult.warnings].length > 0 ? (
              <div className="wb-inline-warnings">
                {[...startResult.warnings, ...landingResult.warnings].map((warning, index) => (
                  <div
                    className={`wb-inline-warning${warning.danger ? " danger" : ""}`}
                    key={`${warning.text}-${index}`}
                  >
                    {warning.text}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </CalculatorCard>
        <WeightBalanceExportCard meta={exportMeta} plan={{ ...plan, startFuelLiters, plannedFuelBurnLiters: plannedBurnLiters }} startResult={startResult} landingResult={landingResult} landingFuelLiters={landingFuelLiters} />
        <CalculatorCard title="Envelope · Start und Landung">
          <EnvelopeChart envelope={weightBalanceData.envelope} startResult={startResult} landingResult={landingResult} />
        </CalculatorCard>
        <CalculatorCard title="Geschwindigkeiten" className="weight-balance-speed-results">
          <div className="wb-speed-groups">
            <div className="wb-speed-group start">
              <div className="wb-speed-group-title">Start</div>
              <div className="speed-grid">
                <SpeedMetric
                  label={
                    <span>
                      <SpeedSymbol index="R" /> · Rotate
                    </span>
                  }
                  speedKmh={startResult.speeds.rotateSpeedKmh}
                  unit={resolvedSpeedUnit}
                />
                <SpeedMetric label="in 15 m Höhe" speedKmh={startResult.speeds.speedAt15mKmh} unit={resolvedSpeedUnit} />
              </div>
            </div>
            <div className="wb-speed-group">
              <div className="wb-speed-group-title">Landung mit Abfluggewicht</div>
              <div className="speed-grid">
                <SpeedMetric label={<span><SpeedSymbol index="APP" /> · Approach</span>} speedKmh={startResult.speeds.approachSpeedKmh} unit={resolvedSpeedUnit} />
                <SpeedMetric label={<span><SpeedSymbol index="REF" /> · 1.3 x <SpeedSymbol index="S0" /></span>} speedKmh={startResult.speeds.referenceSpeedKmh} unit={resolvedSpeedUnit} />
                <SpeedMetric label={<span><SpeedSymbol index="S0" /> · Leerlauf 40°</span>} speedKmh={startResult.speeds.stallIdleFlaps40Kmh} unit={resolvedSpeedUnit} />
                <SpeedMetric label={<span><SpeedSymbol index="S0" /> · 30° Bank</span>} speedKmh={startResult.speeds.stallIdleFlaps40Bank30Kmh} unit={resolvedSpeedUnit} />
                <SpeedMetric label={<span><SpeedSymbol index="S0" /> · 45° Bank</span>} speedKmh={startResult.speeds.stallIdleFlaps40Bank45Kmh} unit={resolvedSpeedUnit} />
              </div>
            </div>
            <div className="wb-speed-group">
              <div className="wb-speed-group-title">Landung mit Landegewicht</div>
              <div className="speed-grid">
                <SpeedMetric label={<span><SpeedSymbol index="APP" /> · Approach</span>} speedKmh={landingResult.speeds.approachSpeedKmh} unit={resolvedSpeedUnit} />
                <SpeedMetric label={<span><SpeedSymbol index="REF" /> · 1.3 x <SpeedSymbol index="S0" /></span>} speedKmh={landingResult.speeds.referenceSpeedKmh} unit={resolvedSpeedUnit} />
                <SpeedMetric label={<span><SpeedSymbol index="S0" /> · Leerlauf 40°</span>} speedKmh={landingResult.speeds.stallIdleFlaps40Kmh} unit={resolvedSpeedUnit} />
                <SpeedMetric label={<span><SpeedSymbol index="S0" /> · 30° Bank</span>} speedKmh={landingResult.speeds.stallIdleFlaps40Bank30Kmh} unit={resolvedSpeedUnit} />
                <SpeedMetric label={<span><SpeedSymbol index="S0" /> · 45° Bank</span>} speedKmh={landingResult.speeds.stallIdleFlaps40Bank45Kmh} unit={resolvedSpeedUnit} />
              </div>
            </div>
          </div>
        </CalculatorCard>
        <CalculatorCard title="Beladung · Start bis Landung">
          <BreakdownTable startResult={startResult} landingResult={landingResult} plannedFuelBurnLiters={plannedBurnLiters} />
        </CalculatorCard>
      </main>
    </div>
  );
}
