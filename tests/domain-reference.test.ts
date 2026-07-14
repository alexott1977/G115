import assert from "node:assert/strict";
import { test } from "vitest";
import * as core from "../src/domain/core";
import * as calculators from "../src/aircraft/g115b/calculators";
import { g115bData as data } from "../src/aircraft/g115b/data";

function expectNonNull<T>(value: T): asserts value is NonNullable<T> {
  assert.notEqual(value, null);
}
test("density altitude uses ISA deviation formula consistently", () => {
  const atmosphere = core.densityAltitude(2000, 25);

  assert.equal(atmosphere.isaTemperatureC.toFixed(2), "11.04");
  assert.equal(atmosphere.isaDeviationC.toFixed(2), "13.96");
  assert.equal(atmosphere.densityAltitudeFt, 3675);
});

test("takeoff calculator returns stable reference result", () => {
  const result = calculators.calculateTakeoff({
    pressureAltitudeFt: 2000,
    oatC: 20,
    massKg: 850,
    slopePercent: 0,
    windKt: 0,
    safetyMarginPercent: 15,
  });

  assert.equal(result.atmosphere.densityAltitudeFt, 3075);
  assert.equal(result.groundRollMeters, 293);
  assert.equal(result.takeoffDistanceMeters, 509);
  assert.equal(result.rotateSpeedKmh.toFixed(1), "91.6");
  assert.equal(result.warnings.length, 0);
});

test("takeoff calculator reproduces the POH chart example", () => {
  const result = calculators.calculateTakeoff({
    pressureAltitudeFt: 2000,
    oatC: 15,
    massKg: 850,
    slopePercent: -1.5,
    windKt: 13 / core.KMH_PER_KT,
    safetyMarginPercent: 0,
  });

  assert.equal(result.groundRollMeters, 168);
  assert.equal(result.takeoffDistanceMeters, 320);
});

test("takeoff operational margin is added only as an absolute ground roll increment", () => {
  const withoutMargin = calculators.calculateTakeoff({
    pressureAltitudeFt: 2000,
    oatC: 20,
    massKg: 850,
    slopePercent: 0,
    windKt: 0,
    safetyMarginPercent: 0,
  });
  const withMargin = calculators.calculateTakeoff({
    pressureAltitudeFt: 2000,
    oatC: 20,
    massKg: 850,
    slopePercent: 0,
    windKt: 0,
    safetyMarginPercent: 50,
  });

  assert.equal(withMargin.groundRollMarginMeters, withoutMargin.groundRollByWindMeters * 0.5);
  assert.equal(withMargin.groundRollMeters, Math.round(withoutMargin.groundRollByWindMeters + withMargin.groundRollMarginMeters));
  assert.equal(withMargin.takeoffDistanceMeters, Math.round(withoutMargin.takeoffDistanceWithoutMarginMeters + withMargin.groundRollMarginMeters));
});

test("takeoff calculator warns instead of silently extrapolating outside chart limits", () => {
  const result = calculators.calculateTakeoff({
    pressureAltitudeFt: 9000,
    oatC: 45,
    massKg: 740,
    slopePercent: 3,
    windKt: 25,
    safetyMarginPercent: 100,
  });

  assert.ok(result.warnings.some((warning) => warning.text.includes("Druckhöhe")));
  assert.ok(result.warnings.some((warning) => warning.text.includes("OAT")));
  assert.ok(result.warnings.some((warning) => warning.text.includes("Masse ausserhalb")));
  assert.ok(result.warnings.some((warning) => warning.text.includes("Wind ausserhalb")));
  assert.ok(result.warnings.some((warning) => warning.text.includes("Neigung")));
});

test("landing calculator returns stable reference result", () => {
  const result = calculators.calculateLanding({
    pressureAltitudeFt: 2000,
    oatC: 20,
    massKg: 850,
    windKt: 0,
    safetyMarginPercent: 40,
  });

  assert.equal(result.atmosphere.densityAltitudeFt, 3075);
  assert.equal(result.landingRollMeters, 324);
  assert.equal(result.landingDistanceMeters, 604);
  assert.equal(Math.round(result.approachSpeedKmh), 118);
  assert.equal(result.referenceSpeedKmh.toFixed(1), "113.1");
});

test("landing mass correction leaves the chart reference mass unchanged", () => {
  const result = calculators.calculateLanding({
    pressureAltitudeFt: 7,
    oatC: 15,
    massKg: 920,
    windKt: 0,
    safetyMarginPercent: 0,
  });

  assert.equal(result.landingRollByMassMeters, result.landingRollByAtmosphereMeters);
});

test("landing standard-day reference follows the published rollout scale", () => {
  const result = calculators.calculateLanding({
    pressureAltitudeFt: 7,
    oatC: 15,
    massKg: 920,
    windKt: 0,
    safetyMarginPercent: 0,
  });

  assert.equal(result.landingRollMeters, 250);
  assert.equal(result.landingDistanceMeters, 542);
});

test("landing published rollout scale follows the lower chart region", () => {
  assert.equal(
    core.interpolate1D(
      data.landing.publishedLandingRoll.chartRollBreakpoints,
      data.landing.publishedLandingRoll.landingRollMeters,
      101
    ),
    150
  );
});

test("landing published rollout scale follows the upper chart region", () => {
  [
    [298, 350],
    [400, 450],
  ].forEach(([chartRollMeters, publishedRollMeters]) => {
    assert.equal(
      core.interpolate1D(
        data.landing.publishedLandingRoll.chartRollBreakpoints,
        data.landing.publishedLandingRoll.landingRollMeters,
        chartRollMeters
      ),
      publishedRollMeters
    );
  });
});

test("landing mass and wind corrections interpolate along straight diagram lines", () => {
  const massAt700 = core.lookup2D(data.landing.landingRollFromMass, 210, 700);
  const massAt920 = core.lookup2D(data.landing.landingRollFromMass, 210, 920);
  const massAt810 = core.lookup2D(data.landing.landingRollFromMass, 210, 810);
  const windAt0 = core.lookup2D(data.landing.landingRollFromHeadwind, 196, 0);
  const windAt40 = core.lookup2D(data.landing.landingRollFromHeadwind, 196, 40);
  const windAt20 = core.lookup2D(data.landing.landingRollFromHeadwind, 196, 20);

  assert.equal(massAt810, (massAt700 + massAt920) / 2);
  assert.equal(windAt20, (windAt0 + windAt40) / 2);
});

test("landing wind correction never changes the mass result at zero wind", () => {
  [0, 50, 100, 200, 300, 400].forEach((landingRollMeters) => {
    assert.equal(
      core.lookup2D(data.landing.landingRollFromHeadwind, landingRollMeters, 0),
      landingRollMeters
    );
    assert.equal(
      core.lookup2D(data.landing.landingRollFromTailwind, landingRollMeters, 0),
      landingRollMeters
    );
  });
});

test("landing headwind and tailwind slopes vary with the incoming landing roll", () => {
  const lowHeadwindReduction = 130 - core.lookup2D(data.landing.landingRollFromHeadwind, 130, 40);
  const highHeadwindReduction = 307 - core.lookup2D(data.landing.landingRollFromHeadwind, 307, 40);
  const lowTailwindIncrease = core.lookup2D(data.landing.landingRollFromTailwind, 129, -20) - 129;
  const highTailwindIncrease = core.lookup2D(data.landing.landingRollFromTailwind, 307, -20) - 307;

  assert.ok(highHeadwindReduction > lowHeadwindReduction);
  assert.ok(highTailwindIncrease > lowTailwindIncrease);
});

test("landing wind corrections follow the digitized diagram lines", () => {
  [
    [92, 164],
    [129, 209],
    [161, 255],
    [220, 323],
    [254, 362],
    [307, 431],
  ].forEach(([incomingRollMeters, correctedRollMeters]) => {
    assert.equal(
      core.lookup2D(data.landing.landingRollFromTailwind, incomingRollMeters, -20),
      correctedRollMeters
    );
  });

  [
    [130, 17],
    [174, 39],
    [220, 58],
    [266, 85],
    [307, 114],
  ].forEach(([incomingRollMeters, correctedRollMeters]) => {
    assert.equal(
      core.lookup2D(data.landing.landingRollFromHeadwind, incomingRollMeters, 40),
      correctedRollMeters
    );
  });
});

test("landing headwind correction stops at zero before the chart maximum when required", () => {
  const result = calculators.calculateLanding({
    pressureAltitudeFt: 0,
    oatC: -20,
    massKg: 700,
    windKt: 40 / core.KMH_PER_KT,
    safetyMarginPercent: 0,
  });

  assert.equal(result.landingRollByWindMeters, 0);
  assert.ok(core.lookup2D(data.landing.landingRollFromHeadwind, result.landingRollByMassChartMeters, 40) < 0);
});

test("landing atmosphere calibration follows sea level at 40 degrees Celsius", () => {
  const result = calculators.calculateLanding({
    pressureAltitudeFt: 0,
    oatC: 40,
    massKg: 920,
    windKt: 0,
    safetyMarginPercent: 0,
  });

  assert.equal(Math.round(result.landingRollByAtmosphereMeters), 267);
  assert.equal(result.landingRollByMassMeters, result.landingRollByAtmosphereMeters);
});

test("landing atmosphere calibration follows all pressure-altitude lines at minus 20 degrees Celsius", () => {
  [
    [0, 176],
    [2000, 187],
    [4000, 201],
    [6000, 214],
    [8000, 233],
  ].forEach(([pressureAltitudeFt, expectedLandingRollMeters]) => {
    const result = calculators.calculateLanding({
      pressureAltitudeFt,
      oatC: -20,
      massKg: 920,
      windKt: 0,
      safetyMarginPercent: 0,
    });

    assert.equal(Math.round(result.landingRollByAtmosphereChartMeters), expectedLandingRollMeters);
  });
});

test("landing atmosphere interpolation follows the digitized curved temperature lines", () => {
  assert.equal(core.lookup2D(data.landing.landingRollFromAtmosphere, 0, 20), 198);
  assert.equal(core.lookup2D(data.landing.landingRollFromAtmosphere, 2000, 20), 212);
  assert.equal(core.lookup2D(data.landing.landingRollFromAtmosphere, 2000, 30), 220);
  assert.equal(core.lookup2D(data.landing.landingRollFromAtmosphere, 2000, 40), 228);
  assert.equal(core.lookup2D(data.landing.landingRollFromAtmosphere, 4000, 20), 230);
  assert.equal(core.lookup2D(data.landing.landingRollFromAtmosphere, 8000, 0), 251);
  assert.equal(core.lookup2D(data.landing.landingRollFromAtmosphere, 8000, 20), 273);
});

test("landing calculator returns stable digitized-path reference values", () => {
  const result = calculators.calculateLanding({
    pressureAltitudeFt: 2500,
    oatC: 27,
    massKg: 816,
    windKt: 13 / core.KMH_PER_KT,
    safetyMarginPercent: 0,
  });

  assert.equal(result.landingRollMeters, 175);
  assert.equal(result.landingDistanceMeters, 425);
  assert.equal(Math.round(result.approachSpeedKmh), 116);
});

test("landing distance over 15 meters follows every digitized diagram line", () => {
  [
    [-32, 192],
    [85, 346],
    [127, 425],
    [172, 500],
    [256, 654],
    [330, 788],
  ].forEach(([landingRollMeters, landingDistanceMeters]) => {
    assert.equal(
      core.interpolate1D(
        data.landing.landingDistanceOver15m.landingRollBreakpoints,
        data.landing.landingDistanceOver15m.landingDistanceMeters,
        landingRollMeters
      ),
      landingDistanceMeters
    );
  });
});

test("landing operational margin is added only as an absolute landing roll increment", () => {
  const withoutMargin = calculators.calculateLanding({
    pressureAltitudeFt: 2000,
    oatC: 20,
    massKg: 850,
    windKt: 0,
    safetyMarginPercent: 0,
  });
  const withMargin = calculators.calculateLanding({
    pressureAltitudeFt: 2000,
    oatC: 20,
    massKg: 850,
    windKt: 0,
    safetyMarginPercent: 40,
  });

  assert.equal(withMargin.landingRollMarginMeters, withoutMargin.landingRollByWindMeters * 0.4);
  assert.equal(withMargin.landingRollMeters, Math.round(withoutMargin.landingRollByWindMeters + withMargin.landingRollMarginMeters));
  assert.equal(withMargin.landingDistanceMeters, Math.round(withoutMargin.landingDistanceWithoutMarginMeters + withMargin.landingRollMarginMeters));
});

test("cruise calculator returns stable RPM, fuel flow and TAS values", () => {
  const result = calculators.calculateCruise({
    powerPercent: 65,
    densityAltitudeFt: 6000,
  });

  assert.equal(Math.round(result.rpm), 2539);
  assert.equal(result.fuelFlowLitersPerHour, 28.8);
  assert.equal(Math.round(result.tasKmh), 212);
  assert.equal(result.tasKt.toFixed(1), "114.5");
  assert.equal(result.powerLabel, "65%");
});

test("cruise RPM reproduces the POH chart example density altitude", () => {
  const result = calculators.calculateCruise({
    powerPercent: 65,
    densityAltitudeFt: 5240,
  });

  assert.ok(Math.abs(result.rpm - 2520) <= 2);
});

test("climb rate calculator returns stable VY and ROC values", () => {
  const result = calculators.calculateClimbRate({
    massKg: 920,
    referencePressureAltitudeFt: 4000,
    densityAltitudeFt: 6000,
  });

  assert.equal(result.climbSpeedKmh.toFixed(1), "140.5");
  assert.equal(Math.round(result.climbRateFpm), 825);
  assert.equal(result.warnings.length, 0);
});

test("climb rate calculator reproduces the POH example", () => {
  const result = calculators.calculateClimbRate({
    massKg: 850,
    referencePressureAltitudeFt: 4000,
    densityAltitudeFt: 3600,
  });

  assert.equal(Math.round(result.climbSpeedKmh), 135);
  assert.equal(Math.round(result.climbRateFpm / 100) * 100, 1100);
});

test("climb rate calculator follows the digitized POH curves", () => {
  const references = [
    [750, 0, 1700],
    [750, 9000, 945],
    [750, 18000, 345],
    [835, 5000, 1060],
    [835, 13000, 515],
    [920, 6000, 825],
    [920, 17000, 170],
  ];

  for (const [massKg, densityAltitudeFt, expectedClimbRateFpm] of references) {
    const result = calculators.calculateClimbRate({
      massKg,
      referencePressureAltitudeFt: 0,
      densityAltitudeFt,
    });
    assert.equal(result.climbRateFpm, expectedClimbRateFpm);
  }
});

test("climb rate calculator warns above the chart limit", () => {
  const result = calculators.calculateClimbRate({
    massKg: 920,
    referencePressureAltitudeFt: 19000,
    densityAltitudeFt: 19000,
  });

  assert.equal(result.climbRateFpm, 110);
  assert.equal(result.warnings[0].danger, true);
});

test("climb rate VY table follows the published reference values", () => {
  const referenceRows: Array<[number, number[]]> = [
    [750, [135, 119, 107]],
    [835, [143, 124, 115]],
    [920, [150, 131, 120]],
  ];

  for (const [massKg, expectedSpeeds] of referenceRows) {
    [0, 8000, 16000].forEach((referencePressureAltitudeFt, index) => {
      const result = calculators.calculateClimbRate({
        massKg,
        referencePressureAltitudeFt,
        densityAltitudeFt: 0,
      });
      assert.equal(result.climbSpeedKmh, expectedSpeeds[index]);
    });
  }
});

test("climb calculator rejects inverted altitude ranges", () => {
  const result = calculators.calculateClimb({
    departureDensityAltitudeFt: 4000,
    destinationDensityAltitudeFt: 3000,
  });

  expectNonNull(result.error);
  assert.equal(result.error.text, "Ziel-Dichtehöhe muss größer als Start-Dichtehöhe sein.");
  assert.equal(result.error.danger, true);
  assert.equal(result.climbTimeMinutes, null);
  assert.equal(result.climbFuelLiters, null);
  assert.equal(result.climbDistanceKm, null);
  assert.equal(result.departureCumulative.timeMinutes.toFixed(1), "3.9");
  assert.equal(result.destinationCumulative.timeMinutes.toFixed(1), "3.0");
});

test("climb calculator returns stable delta values", () => {
  const result = calculators.calculateClimb({
    departureDensityAltitudeFt: 2000,
    destinationDensityAltitudeFt: 8000,
  });

  expectNonNull(result.climbTimeMinutes);
  expectNonNull(result.climbFuelLiters);
  expectNonNull(result.climbDistanceKm);
  expectNonNull(result.climbDistanceNm);
  assert.equal(result.climbTimeMinutes.toFixed(1), "7.0");
  assert.equal(result.climbFuelLiters.toFixed(1), "4.9");
  assert.equal(result.climbDistanceKm.toFixed(1), "17.2");
  assert.equal(result.climbDistanceNm.toFixed(1), "9.3");
});

test("climb calculator reproduces the POH chart example", () => {
  const result = calculators.calculateClimb({
    departureDensityAltitudeFt: 3000,
    destinationDensityAltitudeFt: 8000,
  });

  expectNonNull(result.climbTimeMinutes);
  expectNonNull(result.climbFuelLiters);
  expectNonNull(result.climbDistanceKm);
  assert.equal(result.climbTimeMinutes.toFixed(1), "6.0");
  assert.equal(result.climbFuelLiters.toFixed(1), "4.4");
  assert.equal(result.climbDistanceKm.toFixed(1), "14.8");
});

test("climb fuel axis uses the printed two-liter tick instead of the dashed example line", () => {
  const result = calculators.calculateClimb({
    departureDensityAltitudeFt: 2400,
    destinationDensityAltitudeFt: 8000,
  });

  assert.equal(result.departureCumulative.timeMinutes.toFixed(1), "2.4");
  assert.equal(result.departureCumulative.fuelLiters.toFixed(1), "2.0");
});

test("climb calculator follows the separately calibrated chart axes", () => {
  const result = calculators.calculateClimb({
    departureDensityAltitudeFt: 0,
    destinationDensityAltitudeFt: 18300,
  });

  expectNonNull(result.climbTimeMinutes);
  expectNonNull(result.climbFuelLiters);
  expectNonNull(result.climbDistanceKm);
  assert.equal(result.climbTimeMinutes.toFixed(1), "40.0");
  assert.equal(result.climbFuelLiters.toFixed(1), "22.0");
  assert.equal(result.climbDistanceKm.toFixed(1), "100.0");
});

test("stall calculator returns stable IAS values", () => {
  const result = calculators.calculateStall({
    massKg: 850,
    powerMode: "leerlauf",
    flapsDegrees: 40,
  });

  assert.equal(result.stallLabel, "VSO");
  assert.equal(result.stallSpeedKmh.toFixed(1), "87.0");
  assert.equal(result.stallSpeedKt.toFixed(1), "47.0");
  assert.equal(data.stall.chart.idle.linePixels.flaps40[2], 986);
});

test("stall calculator follows all calibrated POH chart lines", () => {
  const cases: Array<["leerlauf" | "vollast", 0 | 12 | 40, number, number]> = [
    ["vollast", 0, 750, 78.4],
    ["vollast", 0, 920, 86.9],
    ["vollast", 12, 750, 73.4],
    ["vollast", 12, 920, 81.0],
    ["vollast", 40, 750, 72.4],
    ["vollast", 40, 920, 79.0],
    ["leerlauf", 0, 750, 89.3],
    ["leerlauf", 0, 920, 96.8],
    ["leerlauf", 12, 750, 85.8],
    ["leerlauf", 12, 920, 93.8],
    ["leerlauf", 40, 750, 81.6],
    ["leerlauf", 40, 920, 90.2],
  ];

  cases.forEach(([powerMode, flapsDegrees, massKg, expectedKmh]) => {
    const result = calculators.calculateStall({ massKg, powerMode, flapsDegrees });
    assert.equal(result.stallSpeedKmh.toFixed(1), expectedKmh.toFixed(1));
  });
});

test("weight and balance calculator returns stable loading result", () => {
  const result = calculators.calculateWeightBalance({
    aircraftName: "D-EBFT",
    pilotMassKg: 85,
    copilotMassKg: 0,
    baggageMassKg: 0,
    fuelLiters: 107,
  });

  assert.equal(result.totalMassKg.toFixed(1), "830.6");
  assert.equal(result.totalMomentKgM.toFixed(2), "235.18");
  assert.equal(result.cgArmM.toFixed(4), "0.2831");
  assert.equal(result.withinEnvelope, true);
  assert.equal(result.speeds.rotateSpeedKmh.toFixed(1), "91.2");
  assert.equal(result.speeds.speedAt15mKmh.toFixed(1), "117.6");
  assert.equal(result.speeds.approachSpeedKmh.toFixed(1), "116.8");
  assert.equal(result.speeds.stallIdleFlaps40Kmh.toFixed(1), "86.0");
  assert.equal(result.speeds.stallIdleFlaps40Bank30Kmh.toFixed(1), "92.4");
  assert.equal(result.speeds.stallIdleFlaps40Bank45Kmh.toFixed(1), "102.2");
  assert.equal(result.speeds.referenceSpeedKmh.toFixed(1), "111.7");
  assert.equal(result.speeds.referenceSpeedKmh, result.speeds.stallIdleFlaps40Kmh * 1.3);
  assert.equal(
    result.speeds.stallIdleFlaps40Bank30Kmh,
    result.speeds.stallIdleFlaps40Kmh * Math.sqrt(1 / Math.cos((30 * Math.PI) / 180))
  );
});

test("weight and balance accepts envelope boundary points", () => {
  const result = calculators.calculateWeightBalance({
    aircraftName: "D-EBFT",
    pilotMassKg: 130,
    copilotMassKg: 81.10258968749997,
    baggageMassKg: 0,
    fuelLiters: 55.968625434027786,
  });

  assert.equal(result.totalMassKg.toFixed(1), "920.0");
  assert.equal(result.totalMomentKgM.toFixed(2), "234.00");
  assert.equal(result.withinEnvelope, true);
});


