import type { OpenAipAirport } from "../../src/flight-data";

export const openAipAirportFixture: OpenAipAirport = {
  _id: "open-aip-edfe",
  name: "Frankfurt-Egelsbach",
  icaoCode: "EDFE",
  country: "DE",
  geometry: { coordinates: [8.6436, 49.9608] },
  elevation: { value: 117 },
  magneticDeclination: 3.5,
  updatedAt: "2026-06-14T12:00:00.000Z",
  runways: [
    {
      _id: "edfe-08",
      designator: "08",
      trueHeading: 82,
      operations: 0,
      surface: { mainComposite: 0 },
      dimension: { length: { value: 1400 }, width: { value: 25 } },
      declaredDistance: { tora: { value: 1400 }, toda: { value: 1400 }, asda: { value: 1400 }, lda: { value: 1300 } },
      thresholdLocation: { elevation: { value: 116 } },
    },
    {
      _id: "edfe-26",
      designator: "26",
      trueHeading: 262,
      operations: 0,
      surface: { mainComposite: 0 },
      dimension: { length: { value: 1400 }, width: { value: 25 } },
      declaredDistance: { tora: { value: 1400 }, toda: { value: 1400 }, asda: { value: 1400 }, lda: { value: 1300 } },
      thresholdLocation: { elevation: { value: 118 } },
    },
  ],
};
