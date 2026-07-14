import type { AircraftCapability } from "./aircraft";

export type CalculatorDefinition = {
  capability: AircraftCapability;
  href: string;
  icon: string;
  documentTitle: string;
  navTitle: string;
  tag: string;
  title: string;
  description: string;
  source: string;
  group: "planning" | "reference";
};

export const calculatorRegistry: CalculatorDefinition[] = [
  {
    capability: "weightBalance",
    href: "/weight_balance.html",
    icon: "WB",
    documentTitle: "Weight & Balance",
    navTitle: "W&B",
    tag: "Beladung",
    title: "Weight & Balance",
    description: "Schwerpunktlage, Moment und relevante IAS nach Beladung.",
    source: "POH 6.4 und Wägeberichte",
    group: "planning",
  },
  {
    capability: "takeoff",
    href: "/takeoff.html",
    icon: "TO",
    documentTitle: "Takeoff",
    navTitle: "Takeoff",
    tag: "Startstrecke",
    title: "Take-Off",
    description: "Startrollstrecke und Startstrecke über Hindernis.",
    source: "POH 5.3.7",
    group: "planning",
  },
  {
    capability: "climb",
    href: "/climb.html",
    icon: "CLB",
    documentTitle: "Climb",
    navTitle: "Climb",
    tag: "Steigflug",
    title: "Climb",
    description: "Zeit, Kraftstoff und Distanz zwischen zwei Höhen.",
    source: "POH 5.3.9",
    group: "planning",
  },
  {
    capability: "cruise",
    href: "/cruise.html",
    icon: "CR",
    documentTitle: "Cruise",
    navTitle: "Cruise",
    tag: "Reiseflug",
    title: "Cruise",
    description: "Drehzahl, Kraftstoffverbrauch und TAS.",
    source: "POH 5.3.10, 5.3.11, 5.3.12",
    group: "planning",
  },
  {
    capability: "landing",
    href: "/landing.html",
    icon: "LDG",
    documentTitle: "Landing",
    navTitle: "Landing",
    tag: "Landestrecke",
    title: "Landing",
    description: "Landerollstrecke und Landestrecke über Hindernis.",
    source: "POH 5.3.15",
    group: "planning",
  },
  {
    capability: "stall",
    href: "/stall.html",
    icon: "VS",
    documentTitle: "Stall",
    navTitle: "Stall",
    tag: "Überziehgeschwindigkeit",
    title: "Stall",
    description: "VS0 und VS1 nach Masse, Klappen und Leistung.",
    source: "POH 5.3.4",
    group: "reference",
  },
  {
    capability: "climbRate",
    href: "/climb_rate.html",
    icon: "VY",
    documentTitle: "Climb Rate",
    navTitle: "Climb Rate",
    tag: "Steigleistung",
    title: "Climb Rate",
    description: "Rate of Climb und VY nach Masse und Dichtehöhe.",
    source: "POH 5.3.8",
    group: "reference",
  },
];

export const homeNavigationHref = "/";
export const settingsNavigationHref = "/settings.html";

export function getCalculatorByHref(pathname: string) {
  return calculatorRegistry.find((calculator) => calculator.href === pathname);
}

export function navigationHrefForPath(pathname: string) {
  if (pathname === "/" || pathname === "/index.html") return homeNavigationHref;
  if (pathname === settingsNavigationHref) return settingsNavigationHref;
  return getCalculatorByHref(pathname)?.href ?? homeNavigationHref;
}

export function pageTitleForPath(pathname: string) {
  if (pathname === settingsNavigationHref) return "Einstellungen";
  return getCalculatorByHref(pathname)?.documentTitle ?? "Performance";
}
