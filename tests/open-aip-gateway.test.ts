import { describe, expect, it, vi } from "vitest";
import { handleApiRequest, nearestForecastHour, openAipSearchVariants } from "../worker";
import { openAipAirportFixture } from "./fixtures/openAipAirport";

const context = { waitUntil: () => undefined };
const assets = { fetch: async () => new Response("asset") };

describe("Flight data gateway", () => {
  it("reports a missing server-side API key clearly", async () => {
    const response = await handleApiRequest(new Request("https://example.test/api/airports?search=EDFE"), { ASSETS: assets }, context);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "OpenAIP ist noch nicht konfiguriert. Das Worker-Secret OPENAIP_API_KEY fehlt." });
  });

  it("loads the nearest ICON-D2 forecast independently of OpenAIP", async () => {
    expect(nearestForecastHour("2026-06-14T18:29:00.000Z")).toBe("2026-06-14T18:00");
    expect(nearestForecastHour("2026-06-14T18:30:00.000Z")).toBe("2026-06-14T19:00");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(Response.json({
      hourly: {
        time: ["2026-06-14T19:00"],
        temperature_2m: [16.5],
        pressure_msl: [1015.9],
        wind_speed_10m: [5.1],
        wind_direction_10m: [328],
        wind_gusts_10m: [15.4],
      },
    }));

    const response = await handleApiRequest(
      new Request("https://example.test/api/weather?latitude=49.9608&longitude=8.6436&elevationFt=384&plannedAt=2026-06-14T18%3A30%3A00.000Z&airportId=open-aip-edfe"),
      { ASSETS: assets },
      context,
    );
    const payload = await response.json() as { validAt: string; source: { model: string } };
    const upstreamUrl = String(fetchMock.mock.calls[0][0]);

    expect(response.status).toBe(200);
    expect(payload.validAt).toBe("2026-06-14T19:00Z");
    expect(payload.source.model).toBe("ICON-D2");
    expect(upstreamUrl).toContain("models=icon_d2");
    expect(upstreamUrl).toContain("elevation=117");
    expect(upstreamUrl).toContain("wind_speed_unit=kn");
    fetchMock.mockRestore();
  });

  it("loads current 15-minute ICON-D2 model conditions", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(Response.json({
      current: {
        time: "2026-06-14T19:15",
        temperature_2m: 16.2,
        pressure_msl: 1016.1,
        wind_speed_10m: 4.8,
        wind_direction_10m: 330,
        wind_gusts_10m: 14.9,
      },
    }));

    const response = await handleApiRequest(
      new Request("https://example.test/api/weather?latitude=49.9608&longitude=8.6436&elevationFt=384&plannedAt=invalid&current=true"),
      { ASSETS: assets },
      context,
    );
    const payload = await response.json() as { validAt: string };
    const upstreamUrl = String(fetchMock.mock.calls[0][0]);

    expect(response.status).toBe(200);
    expect(payload.validAt).toBe("2026-06-14T19:15Z");
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=300");
    expect(upstreamUrl).toContain("current=temperature_2m%2Cpressure_msl");
    expect(upstreamUrl).not.toContain("hourly=");
    fetchMock.mockRestore();
  });

  it("normalizes OpenAIP search responses without exposing the API key", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(Response.json({ totalCount: 1, items: [openAipAirportFixture] }));
    const response = await handleApiRequest(
      new Request("https://example.test/api/airports?search=EDFE"),
      { ASSETS: assets, OPENAIP_API_KEY: "secret-key" },
      context,
    );
    const payload = await response.json() as { items: Array<{ icaoCode: string }> };

    expect(response.status).toBe(200);
    expect(payload.items[0].icaoCode).toBe("EDFE");
    expect(fetchMock.mock.calls[0][1]?.headers).toEqual(expect.objectContaining({ "x-openaip-api-key": "secret-key" }));
    expect(JSON.stringify(payload)).not.toContain("secret-key");
    fetchMock.mockRestore();
  });

  it("searches umlaut names using OpenAIP-compatible variants", async () => {
    expect(openAipSearchVariants("Günzburg")).toEqual(["Günzburg", "Gunzburg", "Guenzburg"]);

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
      Response.json(String(input).includes("Guenzburg")
        ? { totalCount: 1, items: [{ ...openAipAirportFixture, name: "Guenzburg-Donauried" }] }
        : { totalCount: 0, items: [] }));
    const response = await handleApiRequest(
      new Request("https://example.test/api/airports?search=G%C3%BCnzburg"),
      { ASSETS: assets, OPENAIP_API_KEY: "secret-key" },
      context,
    );
    const payload = await response.json() as { items: Array<{ name: string }> };

    expect(payload.items[0].name).toBe("Guenzburg-Donauried");
    fetchMock.mockRestore();
  });
});
