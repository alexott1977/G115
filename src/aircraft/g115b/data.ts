import type { LookupTable2D, MassMomentPoint } from "../../domain";

export type WeightBalanceStation = {
  label: string;
  armM: number;
};

export type EmptyAircraft = {
  name: string;
  massKg: number;
  armM: number;
  revision: number;
  revisionDate: string;
};

type G115BData = {
  takeoff: {
    source: string;
    digitization: string;
    groundRollFromAtmosphere: LookupTable2D;
    groundRollFromMass: LookupTable2D;
    groundRollFromSlope: LookupTable2D;
    groundRollFromWind: LookupTable2D;
    takeoffDistanceOver15m: {
      groundRollBreakpoints: readonly number[];
      takeoffDistanceMeters: readonly number[];
    };
    rotateSpeedMassBreakpoints: readonly number[];
    rotateSpeedKmh: readonly number[];
    speedAt15mKmh: readonly number[];
  };
  landing: {
    source: string;
    digitization: string;
    landingRollFromAtmosphere: LookupTable2D;
    landingRollFromMass: LookupTable2D;
    landingRollFromTailwind: LookupTable2D;
    landingRollFromHeadwind: LookupTable2D;
    landingDistanceOver15m: {
      landingRollBreakpoints: readonly number[];
      landingDistanceMeters: readonly number[];
      maximumDigitizedLandingRollMeters: number;
    };
    publishedLandingRoll: {
      chartRollBreakpoints: readonly number[];
      landingRollMeters: readonly number[];
    };
    approachSpeedMassBreakpoints: readonly number[];
    approachSpeedKmh: readonly number[];
  };
  cruise: {
    source: string;
    rpmTable: LookupTable2D;
    fuelFlowPowerBreakpoints: readonly number[];
    fuelFlowLitersPerHour: readonly number[];
    tasTable: LookupTable2D;
  };
  climbRate: {
    source: string;
    climbSpeedTable: LookupTable2D;
    rateOfClimbTable: LookupTable2D;
  };
  climb: {
    source: string;
    chartAxes: {
      densityAltitudeFt: ChartAxis;
      timeMinutes: ChartAxis;
      fuelLiters: ChartAxis;
      distanceKm: ChartAxis;
    };
    chartCurve: {
      densityAltitudeFt: readonly number[];
      pixels: readonly number[];
    };
  };
  stall: {
    source: string;
    massBreakpoints: readonly number[];
    chart: {
      width: number;
      height: number;
      massValues: readonly number[];
      fullPower: StallChartSection;
      idle: StallChartSection;
    };
    speedsKmh: {
      fullPower: StallSpeedSeries;
      idle: StallSpeedSeries;
    };
  };
  weightBalance: {
    source: string;
    fuelDensityKgPerLiter: number;
    maximumUsableFuelLiters: number;
    envelope: readonly MassMomentPoint[];
    stations: {
      pilot: WeightBalanceStation;
      copilot: WeightBalanceStation;
      baggage: WeightBalanceStation;
      fuel: WeightBalanceStation;
    };
    emptyAircraft: readonly EmptyAircraft[];
  };
};

type ChartAxis = {
  values: readonly number[];
  pixels: readonly number[];
};

type StallChartSection = {
  massPixels: readonly number[];
  speedValues: readonly number[];
  speedPixels: readonly number[];
  linePixels: StallSpeedSeries;
};

type StallSpeedSeries = {
  flaps0: readonly number[];
  flaps12: readonly number[];
  flaps40: readonly number[];
};

  // Tabellenkonvention:
  // - rowBreakpoints definieren die Zeilenachse.
  // - columnBreakpoints definieren die Spaltenachse.
  // - values[rowIndex][columnIndex] gehört immer zur jeweiligen Zeile/Spalte.
  // - Kommentare über values zeigen die Spaltenreihenfolge, Kommentare vor jeder Zeile den Zeilenkopf.
export const g115bData = {
    takeoff: {
      source: "POH 5.3.7",
      digitization: "Bild 5.3.7 Startstrecke, Ausgabe 1, August 1992",

      groundRollFromAtmosphere: {
        rowBreakpoints: [
          -1000, 0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000,
        ], // pressure altitude ft
        columnBreakpoints: [-20, 40], // OAT C
        values: [
          // OAT C:       -20   40
          /* -1000 ft */ [190, 262],
          /*     0 ft */ [205, 282],
          /*  1000 ft */ [221, 301],
          /*  2000 ft */ [236, 323],
          /*  3000 ft */ [255, 346],
          /*  4000 ft */ [274, 374],
          /*  5000 ft */ [296, 401],
          /*  6000 ft */ [318, 428],
          /*  7000 ft */ [342, 458],
          /*  8000 ft */ [369, 498],
        ], // ground roll m
      },

      groundRollFromMass: {
        rowBreakpoints: [205, 255, 303, 353, 408, 462, 512, 561], // prior ground roll m
        columnBreakpoints: [750, 770, 820, 870, 920], // mass kg
        values: [
          // mass kg:  750  770  820  870  920
          /* 205 m */ [140, 146, 165, 185, 205],
          /* 255 m */ [174, 183, 205, 230, 255],
          /* 303 m */ [203, 215, 245, 275, 303],
          /* 353 m */ [240, 252, 284, 317, 353],
          /* 408 m */ [274, 288, 323, 364, 408],
          /* 462 m */ [305, 321, 362, 410, 462],
          /* 512 m */ [340, 355, 400, 452, 512],
          /* 561 m */ [374, 392, 441, 498, 561],
        ], // corrected ground roll m
      },

      groundRollFromSlope: {
        rowBreakpoints: [104, 153, 204, 256, 304, 353, 404, 452, 506, 556], // prior ground roll m
        columnBreakpoints: [-2, 0, 2], // slope percent
        values: [
          // slope %:   -2    0    2
          /* 104 m */ [94, 104, 117],
          /* 153 m */ [140, 153, 175],
          /* 204 m */ [185, 204, 231],
          /* 256 m */ [227, 256, 288],
          /* 304 m */ [274, 304, 343],
          /* 353 m */ [319, 353, 402],
          /* 404 m */ [363, 404, 453],
          /* 452 m */ [408, 452, 511],
          /* 506 m */ [453, 506, 570],
          /* 556 m */ [499, 556, 622],
        ], // corrected ground roll m
      },

      groundRollFromWind: {
        rowBreakpoints: [155, 209, 256, 304, 354, 405, 453, 502, 555], // prior ground roll m
        columnBreakpoints: [-20, -10, 0, 10, 20, 30, 40], // wind km/h (negative = tailwind)
        values: [
          // wind km/h:  -20  -10    0   10   20   30   40
          /* 155 m */ [227, 187, 155, 123, 96, 76, 55],
          /* 209 m */ [298, 251, 209, 164, 128, 100, 74],
          /* 256 m */ [371, 310, 256, 204, 161, 124, 93],
          /* 304 m */ [441, 369, 304, 245, 189, 147, 112],
          /* 354 m */ [517, 430, 354, 283, 222, 169, 127],
          /* 405 m */ [589, 490, 405, 324, 254, 193, 145],
          /* 453 m */ [661, 552, 453, 361, 283, 214, 158],
          /* 502 m */ [733, 610, 502, 402, 313, 242, 174],
          /* 555 m */ [807, 671, 555, 442, 342, 265, 193],
        ], // corrected ground roll m
      },

      takeoffDistanceOver15m: {
        groundRollBreakpoints: [52, 154, 168, 175, 249, 348, 449, 545, 645, 742, 843], // ground roll m
        takeoffDistanceMeters: [94, 277, 320, 321, 460, 632, 814, 996, 1183, 1359, 1538], // fixed 15 m obstacle
      },

      rotateSpeedMassBreakpoints: [770, 820, 870, 920], // mass kg
      rotateSpeedKmh: [89, 91, 92, 96], // km/h
      speedAt15mKmh: [113, 117, 120, 124], // km/h
    },

    landing: {
      source: "POH 5.3.15",
      digitization: "Bild 5.3.15 Landestrecke, Ausgabe 1, August 1992",

      landingRollFromAtmosphere: {
        rowBreakpoints: [
          0, 2000, 4000, 6000, 8000,
        ], // pressure altitude ft
        columnBreakpoints: [-20, -10, 0, 10, 20, 30, 40], // OAT C
        values: [
          // OAT C:       -20  -10    0   10   20   30   40
          /*     0 ft */ [176, 181, 186, 192, 198, 205, 212],
          /*  2000 ft */ [187, 192, 198, 204, 212, 220, 228],
          /*  4000 ft */ [201, 208, 215, 222, 230, 239, 247],
          /*  6000 ft */ [214, 222, 230, 241, 250, 262, 273],
          /*  8000 ft */ [233, 242, 251, 261, 273, 287, 303],
        ], // landing roll m
      },

      landingRollFromMass: {
        rowBreakpoints: [0, 190, 257, 310, 400], // prior landing roll m at 920 kg
        columnBreakpoints: [700, 920], // mass kg; diagram correction lines are straight
        values: [
          // mass kg: 700  920
          /*   0 m */ [0, 0],
          /* 190 m */ [94, 190],
          /* 257 m */ [131, 257],
          /* 310 m */ [163, 310],
          /* 400 m */ [220, 400],
        ], // corrected landing roll m
      },

      landingRollFromTailwind: {
        rowBreakpoints: [0, 92, 129, 161, 220, 254, 307, 400], // prior landing roll m
        columnBreakpoints: [-20, 0], // tailwind km/h
        values: [
          // wind km/h: -20    0
          /*   0 m */ [0, 0],
          /*  92 m */ [164, 92],
          /* 129 m */ [209, 129],
          /* 161 m */ [255, 161],
          /* 220 m */ [323, 220],
          /* 254 m */ [362, 254],
          /* 307 m */ [431, 307],
          /* 400 m */ [550, 400],
        ], // corrected landing roll m
      },

      landingRollFromHeadwind: {
        rowBreakpoints: [0, 130, 174, 220, 266, 307, 400], // prior landing roll m
        columnBreakpoints: [0, 40], // headwind km/h
        values: [
          // wind km/h:   0   40
          /*   0 m */ [0, -48],
          /* 130 m */ [130, 17],
          /* 174 m */ [174, 39],
          /* 220 m */ [220, 58],
          /* 266 m */ [266, 85],
          /* 307 m */ [307, 114],
          /* 400 m */ [400, 190],
        ], // corrected landing roll m
      },

      landingDistanceOver15m: {
        landingRollBreakpoints: [-32, 85, 127, 172, 256, 330, 400], // chart roll coordinate; lowest line enters through bottom edge
        landingDistanceMeters: [192, 346, 425, 500, 654, 788, 915], // fixed 15 m obstacle; includes the printed POH example
        maximumDigitizedLandingRollMeters: 330,
      },

      publishedLandingRoll: {
        chartRollBreakpoints: [0, 101, 127, 195, 298, 400],
        landingRollMeters: [0, 150, 175, 250, 350, 450],
      },

      approachSpeedMassBreakpoints: [700, 750, 800, 850, 920], // mass kg
      approachSpeedKmh: [107, 111, 115, 118, 123], // km/h
    },

    cruise: {
      source: "POH 5.3.10-12",

      rpmTable: {
        rowBreakpoints: [45, 55, 65, 75, 100], // power percent
        columnBreakpoints: [
          0, 2000, 4000, 6000, 8000, 10000, 12000, 14000, 16000, 18000, 20000,
        ], // density altitude ft
        values: [
          // DA ft:         0  2000  4000  6000  8000 10000 12000 14000 16000 18000 20000
          // Digitised from the printed curves in POH Bild 5.3.11.
          /*  45%    */ [2143, 2176, 2209, 2242, 2275, 2308, 2341, 2374, 2407, 2440, 2473],
          /*  55%    */ [2270, 2312, 2353, 2395, 2436, 2478, 2520, 2562, 2604, 2646, 2688],
          /*  65%    */ [2397, 2445, 2492, 2539, 2585, 2630, 2677, 2700, 2700, 2700, 2700],
          /*  75%    */ [2518, 2573, 2622, 2671, 2700, 2700, 2700, 2700, 2700, 2700, 2700],
          /* Vollgas */ [
            2700, 2700, 2700, 2700, 2700, 2700, 2700, 2700, 2700, 2700, 2700,
          ],
        ], // RPM
      },

      fuelFlowPowerBreakpoints: [45, 55, 65, 75], // power percent
      fuelFlowLitersPerHour: [20.4, 24.2, 28.8, 33.3], // l/h

      tasTable: {
        rowBreakpoints: [45, 55, 65, 75, 100], // power percent
        columnBreakpoints: [
          0, 2000, 4000, 6000, 8000, 10000, 12000, 14000, 16000, 18000, 20000,
        ], // density altitude ft
        values: [
          // DA ft:        0  2000  4000  6000  8000 10000 12000 14000 16000 18000 20000
          // Digitised from POH Bild 5.3.12; cross-validated via km/L chart (Bild 5.3.10).
          // DA computed with formula, not from left chart (POH instruction).
          /*  45%    */ [173, 175, 177, 179, 181, 183, 185, 187, 189, 191, 193],
          /*  55%    */ [190, 193, 195, 198, 200, 203, 205, 208, 210, 213, 215],
          /*  65%    */ [203, 206, 209, 212, 215, 218, 221, 224, 226, 229, 232],
          /*  75%    */ [215, 218, 221, 224, 227, 230, 233, 236, 238, 240, 242],
          /* Vollgas */ [235, 238, 240, 242, 244, 246, 247, 248, 249, 250, 250],
        ], // TAS km/h
      },
    },

    climbRate: {
      source: "POH 5.3.8",

      climbSpeedTable: {
        rowBreakpoints: [750, 835, 920], // mass kg
        columnBreakpoints: [0, 8000, 16000], // pressure altitude ft
        values: [
          // PA ft:       0  8000 16000
          /* 750 kg */ [135, 119, 107],
          /* 835 kg */ [143, 124, 115],
          /* 920 kg */ [150, 131, 120],
        ], // climb speed km/h
      },

      rateOfClimbTable: {
        rowBreakpoints: [750, 835, 920], // mass kg
        columnBreakpoints: [
          0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000,
          10000, 11000, 12000, 13000, 14000, 15000, 16000, 17000, 18000,
        ], // density altitude ft
        values: [
          // Digitised from the improved POH scan at 1,000 ft intervals; rounded to 5 ft/min.
          /* 750 kg */ [
            1700, 1610, 1520, 1430, 1345, 1260, 1180, 1100, 1020, 945,
            875, 805, 730, 660, 595, 535, 470, 405, 345,
          ],
          /* 835 kg */ [
            1460, 1380, 1295, 1215, 1135, 1060, 985, 915, 845, 775,
            710, 640, 575, 515, 460, 400, 340, 275, 220,
          ],
          /* 920 kg */ [
            1260, 1180, 1105, 1035, 960, 890, 825, 755, 690, 625,
            565, 500, 445, 385, 335, 275, 220, 170, 110,
          ],
        ], // ft/min
      },
    },

    climb: {
      source: "POH 5.3.9",
      chartAxes: {
        densityAltitudeFt: {
          values: [0, 2000, 4000, 6000, 8000, 10000, 12000, 14000, 16000, 18000, 20000],
          pixels: [879, 824, 770, 716, 662, 608, 554, 499, 445, 391, 337],
        },
        timeMinutes: {
          values: [0, 5, 10, 15, 20, 25, 30, 35, 40],
          pixels: [170, 242, 315, 388, 460, 533, 605, 678, 750],
        },
        fuelLiters: {
          values: [0, 2, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22],
          pixels: [170, 205, 210.5, 245, 287, 333, 383, 436, 493, 553, 615, 681, 750],
        },
        distanceKm: {
          values: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
          pixels: [170, 227, 286, 346, 404.5, 465.5, 525.5, 587.5, 647.5, 709.5, 750],
        },
      },
      chartCurve: {
        densityAltitudeFt: [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 11000, 12000, 13000, 14000, 15000, 16000, 17000, 18000, 18300],
        pixels: [170, 182, 199, 213, 226, 243, 262, 280, 300, 327, 355, 382, 415, 448, 489, 542, 585, 655, 724, 750],
      },
    },

    stall: {
      source: "POH 5.3.4",
      massBreakpoints: [750, 800, 850, 900, 920], // mass kg
      chart: {
        width: 937,
        height: 1367,
        massValues: [750, 800, 850, 900, 950],
        fullPower: {
          massPixels: [199, 330, 460, 591, 721],
          speedValues: [70, 75, 80, 85, 90],
          speedPixels: [644, 547, 450, 354, 258],
          linePixels: {
            flaps0: [482, 434, 386, 337, 318],
            flaps12: [578, 535, 491, 448, 431],
            flaps40: [597, 559, 522, 485, 469],
          },
        },
        idle: {
          massPixels: [211, 339, 466, 594, 722],
          speedValues: [80, 85, 90, 95, 100],
          speedPixels: [1117, 1019, 921, 824, 726],
          linePixels: {
            flaps0: [935, 892, 849, 806, 789],
            flaps12: [1003, 957, 912, 866, 847],
            flaps40: [1085, 1036, 986, 937, 918],
          },
        },
      },
      speedsKmh: {
        fullPower: {
          // mass kg: 750  800  850  900  920
          flaps0: [78.4, 80.8, 83.4, 85.9, 86.9], // km/h
          flaps12: [73.4, 75.6, 77.9, 80.1, 81.0], // km/h
          flaps40: [72.4, 74.4, 76.3, 78.2, 79.0], // km/h
        },
        idle: {
          // mass kg: 750  800  850  900  920
          flaps0: [89.3, 91.4, 93.7, 96.0, 96.8], // km/h
          flaps12: [85.8, 88.1, 90.4, 92.8, 93.8], // km/h
          flaps40: [81.6, 84.3, 87.0, 89.3, 90.2], // km/h
        },
      },
    },

    weightBalance: {
      source: "Vereinsdaten",
      fuelDensityKgPerLiter: 0.72,
      maximumUsableFuelLiters: 107,
      envelope: [
        { momentKgM: 150.0, massKg: 750.0 },
        { momentKgM: 167.0, massKg: 840.0 },
        { momentKgM: 234.0, massKg: 920.0 },
        { momentKgM: 274.0, massKg: 920.0 },
        { momentKgM: 223.0, massKg: 750.0 },
      ],
      stations: {
        pilot: { label: "Pilot", armM: 0.25 },
        copilot: { label: "Co-Pilot", armM: 0.25 },
        baggage: { label: "Gepäck", armM: 0.9 },
        fuel: { label: "Kraftstoff", armM: 0.89 },
      },
      emptyAircraft: [
        { name: "D-EBFT", massKg: 668.6, armM: 0.217409, revision: 4, revisionDate: "10.01.2026" },
        { name: "D-ELWF", massKg: 665, armM: 0.205579, revision: 2, revisionDate: "12.03.2023" },
        { name: "D-ENZM", massKg: 673.286, armM: 0.2315, revision: 2, revisionDate: "12.04.2023" },
      ],
    },
} satisfies G115BData;
