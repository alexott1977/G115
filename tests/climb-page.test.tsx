import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FlightPlanProvider } from "../src/app/FlightPlanContext";
import { ClimbPage } from "../src/pages/ClimbPage";

describe("ClimbPage", () => {
  it("renders the default climb calculation and POH chart", () => {
    const markup = renderToStaticMarkup(<FlightPlanProvider><ClimbPage /></FlightPlanProvider>);

    expect(markup).toContain("Steigzeit · Climb Time");
    expect(markup).toContain("Start- und Ziel-Dichtehöhe sind gültig");
    expect(markup).toContain("grob115b-climb-chart.png");
    expect(markup).toContain("PDF öffnen");
    expect(markup).toContain("Steigflug · Differenz");
    expect(markup).toContain("Start aus Takeoff übernehmen");
  });
});
