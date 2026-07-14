import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { FlightPlanProvider } from "../src/app/FlightPlanContext";
import { TakeoffPage } from "../src/pages/TakeoffPage";

describe("TakeoffPage", () => {
  it("renders the default calculation and chart as React markup", () => {
    const markup = renderToStaticMarkup(<MemoryRouter><FlightPlanProvider><TakeoffPage /></FlightPlanProvider></MemoryRouter>);

    expect(markup).toContain("Ground Roll · Startrollstrecke");
    expect(markup).toContain("Takeoff Distance · Startstrecke über 15 m");
    expect(markup).toContain("Nachvollziehbarkeit");
    expect(markup).toContain("PDF öffnen");
    expect(markup).toContain("grob115b-takeoff-chart.png");
    expect(markup).toContain("Rechenweg");
    expect(markup).toContain("Airport");
    expect(markup).toContain("Suchen");
    expect(markup).toContain("Flugplatzdaten werden geladen…");
    expect(markup).toContain("Noch kein Flugplatz ausgewählt");
    expect(markup).toContain("Keine Bahn ausgewählt");
    expect(markup).toContain("Wetterdaten nach Flugplatzauswahl");
    expect(markup).toContain("TORA");
    expect(markup).toContain("TODA");
    expect(markup).toContain("LDA");
    expect(markup).toContain("Wind true");
    expect(markup).toContain("HW");
    expect(markup).toContain("XW");
    expect(markup).toContain('step="1" value="920"');
  });
});
