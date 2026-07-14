import {
  ChartNoAxesCombined,
  Gauge,
  PlaneLanding,
  PlaneTakeoff,
  Snail,
  TrendingUp,
  Weight,
} from "lucide-react";
import type { AircraftCapability } from "../app/aircraft";

export function CalculatorIcon({ capability }: { capability: AircraftCapability }) {
  const icons = {
    weightBalance: Weight,
    takeoff: PlaneTakeoff,
    climb: TrendingUp,
    cruise: Gauge,
    landing: PlaneLanding,
    stall: Snail,
    climbRate: ChartNoAxesCombined,
  };
  const Icon = icons[capability];
  return <Icon aria-hidden="true" />;
}
