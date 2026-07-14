import { describe, expect, it } from "vitest";
import { aircraftRegistry, defaultAircraft } from "./aircraft";
import {
  calculatorRegistry,
  navigationHrefForPath,
  pageTitleForPath,
  settingsNavigationHref,
} from "./calculators";

describe("aircraft registry", () => {
  it("contains a valid default aircraft", () => {
    expect(aircraftRegistry).toContain(defaultAircraft);
    expect(defaultAircraft.id).toBe("grob-g115b");
    expect(defaultAircraft.registrations).toEqual(["D-EBFT", "D-ELWF", "D-ENZM"]);
  });

  it("provides a calculator for every declared capability", () => {
    const calculatorCapabilities = new Set(
      calculatorRegistry.map((calculator) => calculator.capability),
    );

    for (const capability of defaultAircraft.capabilities) {
      expect(calculatorCapabilities.has(capability)).toBe(true);
    }
  });

  it("uses unique calculator links", () => {
    const links = calculatorRegistry.map((calculator) => calculator.href);
    expect(new Set(links).size).toBe(links.length);
  });

  it("derives navigation hrefs and document titles from registered paths", () => {
    expect(navigationHrefForPath("/index.html")).toBe("/");
    expect(navigationHrefForPath("/takeoff.html")).toBe("/takeoff.html");
    expect(navigationHrefForPath(settingsNavigationHref)).toBe(settingsNavigationHref);
    expect(navigationHrefForPath("/unknown.html")).toBe("/");

    expect(pageTitleForPath("/takeoff.html")).toBe("Takeoff");
    expect(pageTitleForPath(settingsNavigationHref)).toBe("Einstellungen");
    expect(pageTitleForPath("/unknown.html")).toBe("Performance");
  });

});
