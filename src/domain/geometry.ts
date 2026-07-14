import type { MassMomentPoint } from "./types";

export function isPointInPolygon(
  point: MassMomentPoint,
  polygon: readonly MassMomentPoint[],
): boolean {
  const epsilon = 1e-9;

  function isPointOnSegment(
    segmentStart: MassMomentPoint,
    segmentEnd: MassMomentPoint,
  ): boolean {
    const cross =
      (point.momentKgM - segmentStart.momentKgM) *
        (segmentEnd.massKg - segmentStart.massKg) -
      (point.massKg - segmentStart.massKg) *
        (segmentEnd.momentKgM - segmentStart.momentKgM);
    if (Math.abs(cross) > epsilon) return false;

    const withinMoment =
      point.momentKgM >=
        Math.min(segmentStart.momentKgM, segmentEnd.momentKgM) - epsilon &&
      point.momentKgM <=
        Math.max(segmentStart.momentKgM, segmentEnd.momentKgM) + epsilon;
    const withinMass =
      point.massKg >= Math.min(segmentStart.massKg, segmentEnd.massKg) - epsilon &&
      point.massKg <= Math.max(segmentStart.massKg, segmentEnd.massKg) + epsilon;

    return withinMoment && withinMass;
  }

  let inside = false;
  for (
    let index = 0, previousIndex = polygon.length - 1;
    index < polygon.length;
    previousIndex = index, index += 1
  ) {
    const current = polygon[index];
    const previous = polygon[previousIndex];

    if (isPointOnSegment(current, previous)) return true;

    const intersects =
      current.massKg > point.massKg !== previous.massKg > point.massKg &&
      point.momentKgM <
        ((previous.momentKgM - current.momentKgM) *
          (point.massKg - current.massKg)) /
          (previous.massKg - current.massKg) +
          current.momentKgM;

    if (intersects) inside = !inside;
  }

  return inside;
}

