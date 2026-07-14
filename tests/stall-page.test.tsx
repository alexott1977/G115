import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StallPage } from "../src/pages/StallPage";
import { FlightPlanProvider } from "../src/app/FlightPlanContext";

describe("StallPage", () => {
  it("renders the default stall result and POH chart", () => {
    const markup = renderToStaticMarkup(<FlightPlanProvider><StallPage /></FlightPlanProvider>);

    expect(markup).toContain("Überziehgeschwindigkeit");
    expect(markup).toContain("PDF öffnen");
    expect(markup).toContain("grob115b-stall-chart.png");
    expect(markup).toContain("Leerlauf");
    expect(markup).toContain("Klappen 40°");
  });
});
