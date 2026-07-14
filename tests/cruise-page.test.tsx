import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CruisePage } from "../src/pages/CruisePage";
import { FlightPlanProvider } from "../src/app/FlightPlanContext";

describe("CruisePage", () => {
  it("renders the default result and both POH charts", () => {
    const markup = renderToStaticMarkup(<FlightPlanProvider><CruisePage /></FlightPlanProvider>);

    expect(markup).toContain("Wahre Fluggeschwindigkeit · POH 5.3.12");
    expect(markup).toContain("grob115b-cruise-speed-chart.png");
    expect(markup).toContain("grob115b-cruise-rpm-chart.png");
    expect(markup).toContain("Charts PDF öffnen");
    expect(markup).toContain("Density Altitude");
  });
});
