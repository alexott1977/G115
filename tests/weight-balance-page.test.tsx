import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FlightPlanProvider } from "../src/app/FlightPlanContext";
import { WeightBalancePage } from "../src/pages/WeightBalancePage";

describe("WeightBalancePage", () => {
  it("renders the default G115B calculation from the TypeScript domain layer", () => {
    const markup = renderToStaticMarkup(<FlightPlanProvider><WeightBalancePage /></FlightPlanProvider>);

    expect(markup).toContain("Flugplanung");
    expect(markup).toContain("Startmasse");
    expect(markup).toContain("Landemasse");
    expect(markup).toContain("D-EBFT");
    expect(markup).toContain("Revision 4 vom 10.01.2026");
    expect(markup).toContain("830.6");
    expect(markup).toContain("235.18");
    expect(markup).toContain("zentral gespeichert");
    expect(markup).toContain("Beladeplan exportieren");
    expect(markup).toContain("Start, Landung, Revision und Envelope gemeinsam speichern");
    expect(markup).toContain("PNG speichern");
    expect(markup).toContain("PDF speichern");
    expect(markup).toContain("PDF öffnen");
    expect(markup.match(/Weight and balance envelope/g)).toHaveLength(1);
    expect(markup).toContain("Envelope · Start und Landung");
    expect(markup).toContain("Beladung · Start bis Landung");
    expect(markup).toContain("Gesamt · Start");
    expect(markup).toContain("Gesamt · Landung");
    expect(markup).toContain("30° Bank");
    expect(markup).toContain("45° Bank");
    expect(markup).not.toContain("<div class=\"card-title\">Bedingungen</div>");
  });
});
