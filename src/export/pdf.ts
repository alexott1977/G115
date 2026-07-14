let pdfModulePromise: Promise<typeof import("jspdf")> | null = null;

export function preloadPdfExportModule() {
  pdfModulePromise ??= import("jspdf").catch((error) => {
    pdfModulePromise = null;
    throw error;
  });
  return pdfModulePromise;
}

export function warmPdfExportModule() {
  void preloadPdfExportModule().catch(() => undefined);
}

type PdfCanvasOptions = {
  maxDimensionPx?: number;
  orientation?: "portrait" | "landscape";
};

function scaleCanvasForPdf(canvas: HTMLCanvasElement, maxDimensionPx?: number) {
  if (!maxDimensionPx || Math.max(canvas.width, canvas.height) <= maxDimensionPx) return canvas;
  const scale = maxDimensionPx / Math.max(canvas.width, canvas.height);
  const scaledCanvas = document.createElement("canvas");
  scaledCanvas.width = Math.max(1, Math.round(canvas.width * scale));
  scaledCanvas.height = Math.max(1, Math.round(canvas.height * scale));
  const context = scaledCanvas.getContext("2d");
  if (!context) throw new Error("Canvas wird von diesem Browser nicht unterstützt.");
  context.drawImage(canvas, 0, 0, scaledCanvas.width, scaledCanvas.height);
  return scaledCanvas;
}

export async function createPdfBlobFromCanvas(canvas: HTMLCanvasElement, options: PdfCanvasOptions = {}) {
  const { jsPDF } = await preloadPdfExportModule();
  const pdfCanvas = scaleCanvasForPdf(canvas, options.maxDimensionPx);
  const orientation = options.orientation ?? (pdfCanvas.width > pdfCanvas.height ? "landscape" : "portrait");
  const pdf = new jsPDF({
    compress: true,
    format: [pdfCanvas.width, pdfCanvas.height],
    orientation,
    unit: "px",
  });
  pdf.addImage(pdfCanvas.toDataURL("image/png"), "PNG", 0, 0, pdfCanvas.width, pdfCanvas.height);
  return pdf.output("blob");
}

export function openExportTab() {
  const opened = window.open("about:blank", "_blank");
  if (!opened) throw new Error("Der neue Tab wurde vom Browser blockiert.");
  opened.opener = null;
  opened.document.title = "PDF wird vorbereitet";
  opened.document.body.style.fontFamily = "Arial, sans-serif";
  opened.document.body.style.margin = "24px";
  opened.document.body.textContent = "PDF wird vorbereitet...";
  return opened;
}

export function openExportBlob(blob: Blob, targetWindow?: Window | null) {
  const url = URL.createObjectURL(blob);
  if (targetWindow) {
    targetWindow.location.href = url;
  } else {
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) {
      URL.revokeObjectURL(url);
      throw new Error("Der neue Tab wurde vom Browser blockiert.");
    }
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
