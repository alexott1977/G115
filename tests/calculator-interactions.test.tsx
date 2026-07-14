// @vitest-environment jsdom

import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AircraftProvider, useAircraft } from "../src/app/AircraftContext";
import type { AircraftDefinition } from "../src/app/aircraft";
import { FlightPlanProvider, useFlightPlan } from "../src/app/FlightPlanContext";
import { AltitudeInput, type AltitudeInputValue } from "../src/components/AltitudeInput";
import { utcDateTimeIso, utcDateTimeValue, weatherValuesForRunway } from "../src/components/AirportRunwayInput";
import type { Airport } from "../src/flight-data";
import { ClimbPage } from "../src/pages/ClimbPage";
import { StallPage } from "../src/pages/StallPage";
import { WeightBalancePage } from "../src/pages/WeightBalancePage";
import { TakeoffPage } from "../src/pages/TakeoffPage";
import { LandingPage } from "../src/pages/LandingPage";
import { CruisePage } from "../src/pages/CruisePage";
import { ClimbRatePage } from "../src/pages/ClimbRatePage";
import { AppHeader } from "../src/components/AppHeader";
import { defaultAircraft } from "../src/app/aircraft";
import { SettingsPage } from "../src/pages/SettingsPage";
import { HomePage } from "../src/pages/HomePage";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

function AltitudeInputHarness() {
  const [value, setValue] = useState<AltitudeInputValue>({
    mode: "alt",
    altitudeFt: 4500,
    flightLevel: 45,
    densityAltitudeFt: 4500,
    oatC: 6,
    qnhHpa: 1013,
  });

  return <AltitudeInput value={value} onChange={setValue} />;
}

const testAircraft: AircraftDefinition[] = [
  {
    id: "first",
    manufacturer: "Test",
    model: "One",
    shortName: "Test One",
    registrations: [],
    capabilities: ["weightBalance"],
  },
  {
    id: "second",
    manufacturer: "Test",
    model: "Two",
    shortName: "Test Two",
    registrations: [],
    capabilities: ["takeoff"],
  },
];

function AircraftContextHarness() {
  const { aircraft, availableAircraft, selectAircraft } = useAircraft();
  return (
    <>
      <span>{aircraft.shortName}</span>
      <button type="button" onClick={() => selectAircraft(availableAircraft[1].id)}>Nächstes Flugzeug</button>
    </>
  );
}

function FlightPlanContextHarness() {
  const { flightPlan, updateWeightBalance, publishMasses, resetFlightPlan } = useFlightPlan();
  return (
    <>
      <span>{flightPlan.weightBalance.pilotMassKg} kg</span>
      <span>{flightPlan.masses?.startMassKg ?? "Keine Masse"}</span>
      <button type="button" onClick={() => updateWeightBalance({ pilotMassKg: 90 })}>Pilot ändern</button>
      <button type="button" onClick={() => publishMasses({ startMassKg: 850, landingMassKg: 820, startFuelLiters: 60, landingFuelLiters: 18 })}>Massen veröffentlichen</button>
      <button type="button" onClick={resetFlightPlan}>Neue Flugplanung</button>
    </>
  );
}

describe("calculator interactions", () => {
  it("selects the theme directly in settings", async () => {
    const user = userEvent.setup();
    const onSelectTheme = vi.fn();
    render(
      <MemoryRouter>
        <SettingsPage preference="auto" onOpenUsageNotice={() => undefined} onSelectTheme={onSelectTheme} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Automatisch" }).getAttribute("aria-pressed")).toBe("true");
    await user.click(screen.getByRole("button", { name: "Dunkel" }));

    expect(onSelectTheme).toHaveBeenCalledWith("dark");
  });

  it("selects the concrete aircraft and resets planning data on the overview", async () => {
    const user = userEvent.setup();
    const onResetFlightPlan = vi.fn();
    render(
      <MemoryRouter>
        <FlightPlanProvider>
          <HomePage
            aircraft={defaultAircraft}
            availableAircraft={[defaultAircraft]}
            onResetFlightPlan={onResetFlightPlan}
            onSelectAircraft={vi.fn()}
          />
        </FlightPlanProvider>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "D-ELWF" }));
    expect(screen.getByRole("button", { name: "D-ELWF" }).getAttribute("aria-pressed")).toBe("true");
    await waitFor(() => {
      const storedPlan = JSON.parse(window.localStorage.getItem("performance-calculators-flight-plan")!);
      expect(storedPlan.weightBalance.registration).toBe("D-ELWF");
    });

    const confirmSpy = vi.spyOn(window, "confirm");
    await user.click(screen.getByRole("button", { name: "Neue Planung" }));
    expect(onResetFlightPlan).toHaveBeenCalledTimes(1);
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it("keeps the important notice available from the settings tab", async () => {
    const user = userEvent.setup();
    const onOpenUsageNotice = vi.fn();
    render(
      <MemoryRouter>
        <AppHeader
          aircraft={defaultAircraft}
          currentNavigationHref="/takeoff.html"
        />
        <SettingsPage preference="auto" onOpenUsageNotice={onOpenUsageNotice} onSelectTheme={() => undefined} />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("button", { name: "Hinweis zur Nutzung" })).toBeNull();
    expect(screen.getByRole("link", { name: "Einstellungen" })).toBeTruthy();
    expect(screen.getByText(/^VERSION/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Disclaimer anzeigen" }));
    expect(onOpenUsageNotice).toHaveBeenCalledTimes(1);
  });

  it("stores planned airport times explicitly as UTC", () => {
    expect(utcDateTimeValue("2026-06-14T18:30:00.000Z")).toBe("2026-06-14T18:30");
    expect(utcDateTimeIso("2026-06-14T18:30")).toBe("2026-06-14T18:30:00.000Z");
  });

  it("selects and persists the central aircraft", async () => {
    const user = userEvent.setup();
    render(<AircraftProvider availableAircraft={testAircraft}><AircraftContextHarness /></AircraftProvider>);

    await user.click(screen.getByRole("button", { name: "Nächstes Flugzeug" }));

    expect(screen.getByText("Test Two")).toBeTruthy();
    expect(window.localStorage.getItem("performance-calculators-aircraft")).toBe("second");
  });

  it("stores the central flight plan and published masses", async () => {
    const user = userEvent.setup();
    render(<FlightPlanProvider><FlightPlanContextHarness /></FlightPlanProvider>);

    await user.click(screen.getByRole("button", { name: "Pilot ändern" }));
    await user.click(screen.getByRole("button", { name: "Massen veröffentlichen" }));

    expect(screen.getByText("90 kg")).toBeTruthy();
    expect(screen.getByText("850")).toBeTruthy();
    expect(window.localStorage.getItem("performance-calculators-flight-plan")).toContain('"landingMassKg":820');
  });

  it("resets all central flight planning data", async () => {
    const user = userEvent.setup();
    render(<FlightPlanProvider><FlightPlanContextHarness /></FlightPlanProvider>);

    await user.click(screen.getByRole("button", { name: "Pilot ändern" }));
    await user.click(screen.getByRole("button", { name: "Massen veröffentlichen" }));
    await user.click(screen.getByRole("button", { name: "Neue Flugplanung" }));

    expect(screen.getByText("85 kg")).toBeTruthy();
    expect(screen.getByText("Keine Masse")).toBeTruthy();
    await waitFor(() => expect(window.localStorage.getItem("performance-calculators-flight-plan")).not.toContain('"masses"'));
  });

  it("publishes a lower landing mass after planned fuel burn", async () => {
    render(<FlightPlanProvider><WeightBalancePage /></FlightPlanProvider>);
    const burnField = screen.getByText("Geplanter Verbrauch", { selector: ".field-label" }).parentElement!;
    const burnInput = burnField.querySelector('input[type="number"]')!;

    fireEvent.change(burnInput, { target: { value: "30" } });

    await waitFor(() => {
      const storedPlan = JSON.parse(window.localStorage.getItem("performance-calculators-flight-plan")!);
      expect(storedPlan.masses.startMassKg).toBeGreaterThan(storedPlan.masses.landingMassKg);
      expect(storedPlan.masses.landingFuelLiters).toBe(77);
    });
  });

  it("imports the planned takeoff mass without writing local changes back", async () => {
    window.localStorage.setItem("performance-calculators-flight-plan", JSON.stringify({
      weightBalance: {
        registration: "D-EBFT",
        pilotMassKg: 85,
        copilotMassKg: 0,
        baggageMassKg: 0,
        startFuelLiters: 60,
        plannedFuelBurnLiters: 30,
      },
      masses: {
        startMassKg: 850.3,
        landingMassKg: 828.4,
        startFuelLiters: 60,
        landingFuelLiters: 30,
        updatedAt: "2026-06-14T12:00:00.000Z",
      },
    }));
    const user = userEvent.setup();
    const view = render(<MemoryRouter><FlightPlanProvider><TakeoffPage /></FlightPlanProvider></MemoryRouter>);

    expect(screen.getByText("850.3 kg")).toBeTruthy();
    expect(screen.getByText(/Übernahme konservativ als 851 kg/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Flugzeug & Betrieb/ }));
    expect(screen.getByRole("checkbox", { name: "Masse übernommen" }).hasAttribute("checked")).toBe(true);
    const massField = screen.getByText("Masse", { selector: ".field-label" }).parentElement!;
    const massInput = massField.querySelector('input[type="number"]')!;
    await waitFor(() => expect(massInput.getAttribute("value")).toBe("851"));
    expect(massInput.hasAttribute("disabled")).toBe(true);

    await waitFor(() => {
      const storedPlan = JSON.parse(window.localStorage.getItem("performance-calculators-flight-plan")!);
      expect(storedPlan.imports.takeoffMass).toBe(true);
    });
    view.unmount();
    render(<MemoryRouter><FlightPlanProvider><TakeoffPage /></FlightPlanProvider></MemoryRouter>);
    await user.click(screen.getByRole("button", { name: /Flugzeug & Betrieb/ }));
    expect(screen.getByRole("checkbox", { name: "Masse übernommen" }).hasAttribute("checked")).toBe(true);
    const restoredMassField = screen.getByText("Masse", { selector: ".field-label" }).parentElement!;
    const restoredMassInput = restoredMassField.querySelector('input[type="number"]')!;
    await waitFor(() => expect(restoredMassInput.getAttribute("value")).toBe("851"));
    expect(restoredMassInput.hasAttribute("disabled")).toBe(true);

    await user.click(screen.getByRole("checkbox", { name: "Masse übernommen" }));
    expect(restoredMassInput.hasAttribute("disabled")).toBe(false);
    fireEvent.change(restoredMassInput, { target: { value: "840" } });

    await waitFor(() => {
      const storedPlan = JSON.parse(window.localStorage.getItem("performance-calculators-flight-plan")!);
      expect(storedPlan.masses.startMassKg).toBe(850.3);
      expect(storedPlan.imports.takeoffMass).toBe(false);
    });
  });

  it("keeps the supported decimal precision in slope input", () => {
    render(<MemoryRouter><FlightPlanProvider><TakeoffPage /></FlightPlanProvider></MemoryRouter>);
    const runwaySection = screen.getByText("Pistenbedingungen", { selector: ".calculator-input-header strong" }).closest(".calculator-input-section")!;
    const slopeField = within(runwaySection).getByText("Slope", { selector: ".field-label" }).parentElement!;
    const slopeInput = slopeField.querySelector('input[inputmode="decimal"]')!;

    expect(slopeInput.getAttribute("value")).toBe("0.0");
    fireEvent.change(slopeInput, { target: { value: "1" } });
    fireEvent.blur(slopeInput);
    expect(slopeInput.getAttribute("value")).toBe("1.0");
  });

  it("switches between takeoff chart and compact calculation path", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><FlightPlanProvider><TakeoffPage /></FlightPlanProvider></MemoryRouter>);

    expect(screen.getByRole("tab", { name: "Diagramm" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByAltText("Originales Flughandbuchdiagramm Bild 5.3.7 Startstrecke")).toBeTruthy();

    await user.click(screen.getByRole("tab", { name: "Rechenweg" }));
    expect(screen.getByRole("tab", { name: "Rechenweg" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Schritt 1 - Atmosphäre")).toBeTruthy();
    expect(screen.queryByAltText("Originales Flughandbuchdiagramm Bild 5.3.7 Startstrecke")).toBeNull();
  });

  const airport: Airport = {
    id: "open-aip-edfe",
    name: "Frankfurt-Egelsbach",
    icaoCode: "EDFE",
    country: "DE",
    coordinates: { latitude: 49.9608, longitude: 8.6436 },
    elevationFt: 384,
    magneticDeclinationDeg: 3.5,
    runways: [{
      id: "edfe-08",
      designator: "08",
      trueHeadingDeg: 82,
      magneticHeadingDeg: 78.5,
      lengthM: 1400,
      widthM: 25,
      surface: "asphalt",
    }],
    source: { provider: "OpenAIP", updatedAt: "2026-06-14T12:00:00.000Z" },
  };
  const weather = {
    id: "icon-d2-2026-06-14T19:00Z",
    airportId: airport.id,
    validAt: "2026-06-14T19:00Z",
    temperatureC: 16.5,
    qnhHpa: 1015.9,
    windDirectionTrueDeg: 82,
    windSpeedKt: 7.8,
    windGustKt: 12.4,
    source: { provider: "Open-Meteo" as const, model: "ICON-D2", updatedAt: "2026-06-14T18:45:00.000Z" },
  };

  function stubAirportSearch(selectedAirport = airport) {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/weather?")) return Response.json(weather);
      return Response.json(url.includes("/api/airports?") ? { items: [selectedAirport], totalCount: 1 } : selectedAirport);
    }));
  }

  it("maps ICON-D2 weather to supported calculator values", () => {
    expect(weatherValuesForRunway(weather, airport.runways[0])).toEqual({
      qnhHpa: 1016,
      oatC: 17,
      windKt: 8,
    });
  });

  it("applies real OpenAIP airport and runway data to takeoff", async () => {
    stubAirportSearch();
    const user = userEvent.setup();
    render(<MemoryRouter><FlightPlanProvider><TakeoffPage /></FlightPlanProvider></MemoryRouter>);

    const searchInput = screen.getByRole("searchbox", { name: "Flugplatzsuche" });
    await user.type(searchInput, "edfe");
    expect(searchInput.getAttribute("value")).toBe("EDFE");
    await user.click(screen.getByRole("button", { name: "Suchen" }));
    expect(await screen.findByText(/OpenAIP · Stand/)).toBeTruthy();
    expect(searchInput.getAttribute("value")).toBe("");
    expect(await screen.findByText(/Aktuelle ICON-D2-Werte/)).toBeTruthy();
    expect(screen.getByText("HW")).toBeTruthy();
    expect(screen.getByText("XW")).toBeTruthy();
    expect(screen.getByText(/082° \/ 8 G 12/)).toBeTruthy();
    expect(screen.getByText("TORA")).toBeTruthy();
    expect(screen.getByText("TODA")).toBeTruthy();
    expect(screen.getByText("Geplante Startzeit · UTC · 24 h")).toBeTruthy();
    expect(screen.getByText("RWY TRUE")).toBeTruthy();
    expect(screen.getByText("MAG")).toBeTruthy();
    let atmosphereSection = screen.getByText("Atmosphäre", { selector: ".calculator-input-header strong" }).closest(".calculator-input-section")!;
    await waitFor(() => {
      expect(atmosphereSection.querySelector('input[type="number"][value="1016"]')).toBeTruthy();
      expect(atmosphereSection.querySelector('input[type="number"][value="17"]')).toBeTruthy();
    });
    let runwaySection = screen.getByText("Pistenbedingungen", { selector: ".calculator-input-header strong" }).closest(".calculator-input-section")!;
    await user.click(within(runwaySection).getByRole("button", { name: /Pistenbedingungen/ }));
    expect(runwaySection.querySelector('input[type="number"][value="8"]')).toBeTruthy();
    await user.click(within(runwaySection).getByRole("button", { name: /Pistenbedingungen/ }));
    await waitFor(() => {
      expect((screen.getByRole("checkbox", { name: "Werte übernommen" }) as HTMLInputElement).checked).toBe(true);
    });
    await user.click(screen.getByRole("button", { name: /Atmosphäre/ }));
    const atmosphereButton = screen.getByRole("button", { name: /EDFE · RWY 08/ });
    expect(atmosphereButton.textContent).not.toContain("Frankfurt-Egelsbach");
    expect(atmosphereButton.textContent).toContain("Elev 384 ft");
    expect(atmosphereButton.textContent).toContain("QNH 1016 hPa");
    await user.click(atmosphereButton);
    expect(screen.getByRole("button", { name: "Elevation" }).hasAttribute("disabled")).toBe(true);
    atmosphereSection = screen.getByText("Atmosphäre", { selector: ".calculator-input-header strong" }).closest(".calculator-input-section")!;
    const qnhField = within(atmosphereSection).getByText("QNH", { selector: ".field-label" }).parentElement!;
    expect(qnhField.querySelector('input[type="number"]')?.hasAttribute("disabled")).toBe(true);
    runwaySection = screen.getByText("Pistenbedingungen", { selector: ".calculator-input-header strong" }).closest(".calculator-input-section")!;
    await user.click(within(runwaySection).getByRole("button", { name: /Pistenbedingungen/ }));
    const windField = within(runwaySection).getByText("Wind", { selector: ".field-label" }).parentElement!;
    expect(windField.querySelector('input[type="number"]')?.hasAttribute("disabled")).toBe(true);
    await user.click(screen.getByRole("checkbox", { name: "Werte übernommen" }));
    expect(screen.getByRole("button", { name: "Elevation" }).hasAttribute("disabled")).toBe(false);
    expect(qnhField.querySelector('input[type="number"]')?.hasAttribute("disabled")).toBe(false);
    await user.click(screen.getByRole("button", { name: "Elevation" }));

    expect(within(atmosphereSection).getByDisplayValue("384")).toBeTruthy();
    await waitFor(() => {
      const storedPlan = JSON.parse(window.localStorage.getItem("performance-calculators-flight-plan")!);
      expect(storedPlan.departure.airportId).toBe("open-aip-edfe");
      expect(storedPlan.departure.runwayId).toBe("edfe-08");
      expect(storedPlan.imports.departureImport).toBe(false);
      expect(storedPlan.departure.plannedAt).toMatch(/Z$/);
    });
  });


  it("does not re-enable takeoff airport imports when returning to a saved manual selection", async () => {
    stubAirportSearch();
    const user = userEvent.setup();
    const firstRender = render(<MemoryRouter><FlightPlanProvider><TakeoffPage /></FlightPlanProvider></MemoryRouter>);

    await user.type(screen.getByRole("searchbox", { name: "Flugplatzsuche" }), "edfe");
    await user.click(screen.getByRole("button", { name: "Suchen" }));
    await waitFor(() => {
      expect((screen.getByRole("checkbox", { name: "Werte übernommen" }) as HTMLInputElement).checked).toBe(true);
    });

    await user.click(screen.getByRole("checkbox", { name: "Werte übernommen" }));
    await waitFor(() => {
      const storedPlan = JSON.parse(window.localStorage.getItem("performance-calculators-flight-plan")!);
      expect(storedPlan.imports.departureImport).toBe(false);
    });

    firstRender.unmount();
    render(<MemoryRouter><FlightPlanProvider><TakeoffPage /></FlightPlanProvider></MemoryRouter>);

    expect(await screen.findByText(/OpenAIP · Stand/)).toBeTruthy();
    expect(await screen.findByText(/Aktuelle ICON-D2-Werte/)).toBeTruthy();
    const importToggle = screen.getByRole("checkbox", { name: "Werte übernehmen" }) as HTMLInputElement;
    expect(importToggle.checked).toBe(false);
    const atmosphereSection = screen.getByText("Atmosphäre", { selector: ".calculator-input-header strong" }).closest(".calculator-input-section")!;
    const qnhField = within(atmosphereSection).getByText("QNH", { selector: ".field-label" }).parentElement!;
    expect(qnhField.querySelector('input[type="number"]')?.hasAttribute("disabled")).toBe(false);
  });

  it("keeps manual takeoff values after leaving and returning to the page", async () => {
    const firstRender = render(<MemoryRouter><FlightPlanProvider><TakeoffPage /></FlightPlanProvider></MemoryRouter>);

    const atmosphereSection = screen.getByText("Atmosphäre", { selector: ".calculator-input-header strong" }).closest(".calculator-input-section")!;
    const qnhField = within(atmosphereSection).getByText("QNH", { selector: ".field-label" }).parentElement!;
    fireEvent.change(qnhField.querySelector('input[type="number"]')!, { target: { value: "1001" } });
    const oatField = within(atmosphereSection).getByText("OAT", { selector: ".field-label" }).parentElement!;
    fireEvent.change(oatField.querySelector('input[type="number"]')!, { target: { value: "23" } });
    const runwaySection = screen.getByText("Pistenbedingungen", { selector: ".calculator-input-header strong" }).closest(".calculator-input-section")!;
    await userEvent.setup().click(within(runwaySection).getByRole("button", { name: /Pistenbedingungen/ }));
    const windField = within(runwaySection).getByText("Wind", { selector: ".field-label" }).parentElement!;
    fireEvent.change(windField.querySelector('input[type="number"]')!, { target: { value: "6" } });

    await waitFor(() => {
      const storedPlan = JSON.parse(window.localStorage.getItem("performance-calculators-flight-plan")!);
      expect(storedPlan.takeoffCalculator.qnhHpa).toBe(1001);
      expect(storedPlan.takeoffCalculator.oatC).toBe(23);
      expect(storedPlan.takeoffCalculator.windKt).toBe(6);
    });

    firstRender.unmount();
    render(<MemoryRouter><FlightPlanProvider><TakeoffPage /></FlightPlanProvider></MemoryRouter>);

    const restoredAtmosphere = screen.getByText("Atmosphäre", { selector: ".calculator-input-header strong" }).closest(".calculator-input-section")!;
    const restoredQnhField = within(restoredAtmosphere).getByText("QNH", { selector: ".field-label" }).parentElement!;
    const restoredOatField = within(restoredAtmosphere).getByText("OAT", { selector: ".field-label" }).parentElement!;
    expect(restoredQnhField.querySelector('input[type="number"]')?.getAttribute("value")).toBe("1001");
    expect(restoredOatField.querySelector('input[type="number"]')?.getAttribute("value")).toBe("23");
    const restoredRunway = screen.getByText("Pistenbedingungen", { selector: ".calculator-input-header strong" }).closest(".calculator-input-section")!;
    await userEvent.setup().click(within(restoredRunway).getByRole("button", { name: /Pistenbedingungen/ }));
    const restoredWindField = within(restoredRunway).getByText("Wind", { selector: ".field-label" }).parentElement!;
    expect(restoredWindField.querySelector('input[type="number"]')?.getAttribute("value")).toBe("6");
  });

  it("retries transient weather failures before showing unavailable data", async () => {
    let weatherRequests = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/weather?")) {
        weatherRequests += 1;
        if (weatherRequests === 1) return Response.json({ error: "Kurz nicht verfügbar" }, { status: 503 });
        return Response.json(weather);
      }
      return Response.json(url.includes("/api/airports?") ? { items: [airport], totalCount: 1 } : airport);
    }));
    const user = userEvent.setup();
    render(<MemoryRouter><FlightPlanProvider><TakeoffPage /></FlightPlanProvider></MemoryRouter>);

    await user.type(screen.getByRole("searchbox", { name: "Flugplatzsuche" }), "EDFE");
    await user.click(screen.getByRole("button", { name: "Suchen" }));

    expect(await screen.findByText(/Aktuelle ICON-D2-Werte/, undefined, { timeout: 2500 })).toBeTruthy();
    expect(screen.queryByText("Kurz nicht verfügbar")).toBeNull();
    expect(weatherRequests).toBe(2);
  });

  it("applies real OpenAIP destination airport data to landing", async () => {
    stubAirportSearch();
    const user = userEvent.setup();
    render(<MemoryRouter><FlightPlanProvider><LandingPage /></FlightPlanProvider></MemoryRouter>);

    await user.type(screen.getByRole("searchbox", { name: "Flugplatzsuche" }), "EDFE");
    await user.click(screen.getByRole("button", { name: "Suchen" }));
    expect(await screen.findByText("Landebahn")).toBeTruthy();
    expect(screen.getByText("Geplante Landezeit · UTC · 24 h")).toBeTruthy();
    const plannedTime = screen.getByText("Geplante Landezeit · UTC · 24 h").parentElement!.querySelector("input")!;
    expect(plannedTime.hasAttribute("disabled")).toBe(true);
    await waitFor(() => {
      const storedPlan = JSON.parse(window.localStorage.getItem("performance-calculators-flight-plan")!);
      expect(storedPlan.imports.arrivalWeatherNow).toBe(true);
    });
    await waitFor(() => {
      expect((screen.getByRole("checkbox", { name: "Werte übernommen" }) as HTMLInputElement).checked).toBe(true);
    });
    await user.click(screen.getByRole("checkbox", { name: "Werte übernommen" }));
    await user.click(screen.getByRole("button", { name: "Elevation" }));

    const atmosphereSection = screen.getByText("Atmosphäre", { selector: ".calculator-input-header strong" }).closest(".calculator-input-section")!;
    expect(within(atmosphereSection).getByDisplayValue("384")).toBeTruthy();
    await waitFor(() => {
      const storedPlan = JSON.parse(window.localStorage.getItem("performance-calculators-flight-plan")!);
      expect(storedPlan.arrival.airportId).toBe("open-aip-edfe");
      expect(storedPlan.arrival.runwayId).toBe("edfe-08");
    });
  });

  it("colors takeoff result distances when runway limits are exceeded", async () => {
    stubAirportSearch({
      ...airport,
      runways: [{ ...airport.runways[0], lengthM: 100, toraM: 100, todaM: 100 }],
    });
    const user = userEvent.setup();
    render(<MemoryRouter><FlightPlanProvider><TakeoffPage /></FlightPlanProvider></MemoryRouter>);

    await user.type(screen.getByRole("searchbox", { name: "Flugplatzsuche" }), "EDFE");
    await user.click(screen.getByRole("button", { name: "Suchen" }));
    await screen.findByText(/OpenAIP · Stand/);

    expect(screen.getByText("Ground Roll · Startrollstrecke").parentElement?.classList.contains("danger")).toBe(true);
    expect(screen.getByText("Takeoff Distance · Startstrecke über 15 m").parentElement?.classList.contains("warn")).toBe(true);
  });

  it("expands compact takeoff input sections and keeps their summary current", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><FlightPlanProvider><TakeoffPage /></FlightPlanProvider></MemoryRouter>);

    const aircraftButton = screen.getByRole("button", { name: /Flugzeug & Betrieb/ });
    expect(aircraftButton.getAttribute("aria-expanded")).toBe("false");
    expect(aircraftButton.textContent).toContain("920 kg");
    const runwayButton = screen.getByRole("button", { name: /Pistenbedingungen/ });
    expect(runwayButton.textContent).toContain("Zuschlag 15%");

    await user.click(aircraftButton);
    expect(aircraftButton.getAttribute("aria-expanded")).toBe("true");
    const aircraftSection = aircraftButton.closest(".calculator-input-section")!;
    fireEvent.change(aircraftSection.querySelector('input[type="number"][value="920"]')!, { target: { value: "880" } });
    await user.click(aircraftButton);

    expect(aircraftButton.textContent).toContain("880 kg");
    expect(runwayButton.textContent).toContain("Zuschlag 15%");
  });

  it("persists manual cruise, climb rate, and stall planning inputs", async () => {
    const cruiseRender = render(<FlightPlanProvider><CruisePage /></FlightPlanProvider>);
    const cruisePowerButton = screen.getByRole("button", { name: /Leistung/ });
    await userEvent.setup().click(cruisePowerButton);
    const cruisePowerSection = cruisePowerButton.closest(".calculator-input-section")!;
    fireEvent.change(cruisePowerSection.querySelector('input[type="number"]')!, { target: { value: "72" } });
    await waitFor(() => {
      const storedPlan = JSON.parse(window.localStorage.getItem("performance-calculators-flight-plan")!);
      expect(storedPlan.cruiseCalculator.powerPercent).toBe(72);
    });
    cruiseRender.unmount();
    render(<FlightPlanProvider><CruisePage /></FlightPlanProvider>);
    await userEvent.setup().click(screen.getByRole("button", { name: /Leistung/ }));
    const restoredCruisePower = screen.getByRole("button", { name: /Leistung/ }).closest(".calculator-input-section")!;
    expect(restoredCruisePower.querySelector('input[type="number"]')?.getAttribute("value")).toBe("72");
    cleanup();

    const climbRateRender = render(<FlightPlanProvider><ClimbRatePage /></FlightPlanProvider>);
    const climbRateMassButton = screen.getByRole("button", { name: /Flugzeug/ });
    await userEvent.setup().click(climbRateMassButton);
    const climbRateMassSection = climbRateMassButton.closest(".calculator-input-section")!;
    fireEvent.change(climbRateMassSection.querySelector('input[type="number"]')!, { target: { value: "870" } });
    await waitFor(() => {
      const storedPlan = JSON.parse(window.localStorage.getItem("performance-calculators-flight-plan")!);
      expect(storedPlan.climbRateCalculator.massKg).toBe(870);
    });
    climbRateRender.unmount();
    render(<FlightPlanProvider><ClimbRatePage /></FlightPlanProvider>);
    await userEvent.setup().click(screen.getByRole("button", { name: /Flugzeug/ }));
    const restoredClimbRateMass = screen.getByRole("button", { name: /Flugzeug/ }).closest(".calculator-input-section")!;
    expect(restoredClimbRateMass.querySelector('input[type="number"]')?.getAttribute("value")).toBe("870");
    cleanup();

    const stallRender = render(<FlightPlanProvider><StallPage /></FlightPlanProvider>);
    const stallConfigButton = screen.getByRole("button", { name: /Konfiguration/ });
    await userEvent.setup().click(stallConfigButton);
    await userEvent.setup().click(screen.getByRole("button", { name: "Vollast" }));
    await userEvent.setup().click(screen.getByRole("button", { name: "12°" }));
    await waitFor(() => {
      const storedPlan = JSON.parse(window.localStorage.getItem("performance-calculators-flight-plan")!);
      expect(storedPlan.stallCalculator.powerMode).toBe("vollast");
      expect(storedPlan.stallCalculator.flapsDegrees).toBe(12);
    });
    stallRender.unmount();
    render(<FlightPlanProvider><StallPage /></FlightPlanProvider>);
    expect(screen.getAllByText("Vollast · Klappen 12°").length).toBeGreaterThan(0);
  });

  it("colors landing result distances when LDA is exceeded", async () => {
    stubAirportSearch({
      ...airport,
      runways: [{ ...airport.runways[0], lengthM: 100, ldaM: 100 }],
    });
    const user = userEvent.setup();
    render(<MemoryRouter><FlightPlanProvider><LandingPage /></FlightPlanProvider></MemoryRouter>);

    await user.type(screen.getByRole("searchbox", { name: "Flugplatzsuche" }), "EDFE");
    await user.click(screen.getByRole("button", { name: "Suchen" }));
    await screen.findByText(/OpenAIP · Stand/);

    expect(screen.getByText("Landing Roll · Landerollstrecke").parentElement?.classList.contains("danger")).toBe(true);
    expect(screen.getByText("Landing Distance · Landestrecke über 15 m").parentElement?.classList.contains("danger")).toBe(true);
  });

  it("switches the common altitude input to direct density altitude", async () => {
    const user = userEvent.setup();
    render(<AltitudeInputHarness />);

    expect(screen.getByText("Density Altitude", { selector: ".derived-label" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Density Alt." }));

    expect(screen.queryByText("OAT", { selector: ".field-label" })).toBeNull();
    expect(screen.queryByText("Density Altitude", { selector: ".derived-label" })).toBeNull();
    expect(screen.getByDisplayValue("4500")).toBeTruthy();
  });

  it("shows an error when the climb destination is below the departure", async () => {
    const user = userEvent.setup();
    render(<FlightPlanProvider><ClimbPage /></FlightPlanProvider>);
    const destinationButton = screen.getByRole("button", { name: /Ziel/ });
    await user.click(destinationButton);
    const destinationSection = screen.getByText("Ziel", { selector: ".calculator-input-header strong" }).closest(".calculator-input-section")!;

    await user.click(within(destinationSection).getByRole("button", { name: "Density Alt." }));
    const destinationAltitude = within(destinationSection).getByDisplayValue("4500");
    fireEvent.change(destinationAltitude, { target: { value: "-100" } });

    expect(screen.getByText("Ergebnis - Eingabe prüfen")).toBeTruthy();
    expect(screen.getByText("Ziel-Dichtehöhe muss größer als Start-Dichtehöhe sein.")).toBeTruthy();
  });

  it("updates the stall result when power and flap settings change", async () => {
    const user = userEvent.setup();
    render(<FlightPlanProvider><StallPage /></FlightPlanProvider>);

    const configurationButton = screen.getByRole("button", { name: /Konfiguration/ });
    await user.click(configurationButton);
    const configurationSection = screen.getByText("Konfiguration", { selector: ".calculator-input-header strong" }).closest(".calculator-input-section")!;

    await user.click(within(configurationSection).getByRole("button", { name: "Vollast" }));
    await user.click(within(configurationSection).getByRole("button", { name: "0°" }));

    expect(screen.getByText("920 kg · Vollast · Klappen 0°")).toBeTruthy();
    expect(within(configurationSection).getByRole("button", { name: "Vollast" }).classList.contains("active")).toBe(true);
    expect(within(configurationSection).getByRole("button", { name: "0°" }).classList.contains("active")).toBe(true);
    expect(screen.getByText("Vollast · Klappen 0°")).toBeTruthy();
  });
});
