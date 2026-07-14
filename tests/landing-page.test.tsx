import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { FlightPlanProvider } from "../src/app/FlightPlanContext";
import { LandingPage } from "../src/pages/LandingPage";

describe("LandingPage", () => {
  it("renders the default calculation and chart as React markup", () => {
    const markup = renderToStaticMarkup(<MemoryRouter><FlightPlanProvider><LandingPage /></FlightPlanProvider></MemoryRouter>);

    expect(markup).toContain("Landing Roll · Landerollstrecke");
    expect(markup).toContain("Landing Distance · Landestrecke über 15 m");
    expect(markup).toContain("PDF öffnen");
    expect(markup).toContain("grob115b-landing-chart.png");
    expect(markup).toContain("Anfluggeschwindigkeiten");
    expect(markup).toContain("Airport");
    expect(markup).toContain("Suchen");
    expect(markup).toContain("Flugplatzdaten werden geladen…");
  });
});
