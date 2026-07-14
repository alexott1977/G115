import type { Warning } from "../domain";
import type { RunwayDirection } from "./types";

function availableDistance(value: number | undefined, runway: RunwayDirection) {
  return {
    meters: value ?? runway.lengthM,
    fallback: value == null,
  };
}

function distanceLabel(name: string, distance: { meters: number; fallback: boolean }) {
  return `${name} ${distance.meters} m${distance.fallback ? " (Bahnlänge als Ersatz)" : ""}`;
}

export function takeoffRunwayWarnings(
  runway: RunwayDirection | undefined,
  groundRollMeters: number,
  takeoffDistanceMeters: number,
): Warning[] {
  if (!runway) return [];
  const tora = availableDistance(runway.toraM, runway);
  const warnings: Warning[] = [];

  if (groundRollMeters > tora.meters) {
    warnings.push({
      danger: true,
      text: `Startrollstrecke ${groundRollMeters} m überschreitet ${distanceLabel("TORA", tora)}.`,
    });
  } else if (takeoffDistanceMeters > tora.meters) {
    warnings.push({
      danger: false,
      text: `Startstrecke über 15 m ${takeoffDistanceMeters} m überschreitet ${distanceLabel("TORA", tora)}. Am Bahnende werden voraussichtlich noch keine 15 m erreicht.`,
    });
  }

  if (runway.todaM != null && takeoffDistanceMeters > runway.todaM) {
    warnings.push({
      danger: false,
      text: `Startstrecke über 15 m ${takeoffDistanceMeters} m überschreitet TODA ${runway.todaM} m. Die 15-m-Strecke ist nicht direkt mit der TODA-Bezugshöhe vergleichbar.`,
    });
  }

  return warnings;
}

export function landingRunwayWarnings(
  runway: RunwayDirection | undefined,
  landingRollMeters: number,
  landingDistanceMeters: number,
): Warning[] {
  if (!runway) return [];
  const lda = availableDistance(runway.ldaM, runway);

  if (landingRollMeters > lda.meters) {
    return [{
      danger: true,
      text: `Landerollstrecke ${landingRollMeters} m überschreitet ${distanceLabel("LDA", lda)}.`,
    }];
  }
  if (landingDistanceMeters > lda.meters) {
    return [{
      danger: true,
      text: `Landestrecke über 15 m ${landingDistanceMeters} m überschreitet ${distanceLabel("LDA", lda)}.`,
    }];
  }
  return [];
}
