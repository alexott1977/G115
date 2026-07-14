import { type ReactElement, useEffect, useState } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import type { AircraftCapability } from "./app/aircraft";
import { useAircraft } from "./app/AircraftContext";
import {
  calculatorRegistry,
  navigationHrefForPath,
  pageTitleForPath,
} from "./app/calculators";
import { useFlightPlan } from "./app/FlightPlanContext";
import { useTheme } from "./app/useTheme";
import { AppHeader } from "./components/AppHeader";
import {
  shouldShowUsageNoticeOnStartup,
  UsageNotice,
} from "./components/UsageNotice";
import { HomePage } from "./pages/HomePage";
import { ClimbPage } from "./pages/ClimbPage";
import { ClimbRatePage } from "./pages/ClimbRatePage";
import { CruisePage } from "./pages/CruisePage";
import { LandingPage } from "./pages/LandingPage";
import { StallPage } from "./pages/StallPage";
import { TakeoffPage } from "./pages/TakeoffPage";
import { WeightBalancePage } from "./pages/WeightBalancePage";
import { SettingsPage } from "./pages/SettingsPage";

const calculatorRouteElements: Record<AircraftCapability, ReactElement> = {
  weightBalance: <WeightBalancePage />,
  takeoff: <TakeoffPage />,
  landing: <LandingPage />,
  cruise: <CruisePage />,
  climb: <ClimbPage />,
  climbRate: <ClimbRatePage />,
  stall: <StallPage />,
};

export function App() {
  const location = useLocation();
  const { aircraft, availableAircraft, selectAircraft, selectSpeedUnitPreference, speedUnitPreference } = useAircraft();
  const { resetFlightPlan } = useFlightPlan();
  const { preference, resolvedTheme, setThemePreference } = useTheme();
  const [usageNoticeOpen, setUsageNoticeOpen] = useState(
    shouldShowUsageNoticeOnStartup,
  );
  const pageTitle = pageTitleForPath(location.pathname);
  const currentNavigationHref = navigationHrefForPath(location.pathname);

  useEffect(() => {
    document.title = pageTitle === "Performance" ? "Aircraft Performance" : `${pageTitle} - Aircraft Performance`;
  }, [pageTitle]);

  return (
    <>
      <AppHeader
        aircraft={aircraft}
        currentNavigationHref={currentNavigationHref}
      />
      <Routes>
        <Route path="/" element={<HomePage aircraft={aircraft} availableAircraft={availableAircraft} onResetFlightPlan={resetFlightPlan} onSelectAircraft={selectAircraft} />} />
        <Route path="/index.html" element={<HomePage aircraft={aircraft} availableAircraft={availableAircraft} onResetFlightPlan={resetFlightPlan} onSelectAircraft={selectAircraft} />} />
        {calculatorRegistry.map((calculator) => (
          <Route
            element={calculatorRouteElements[calculator.capability]}
            key={calculator.href}
            path={calculator.href}
          />
        ))}
        <Route path="/settings.html" element={<SettingsPage preference={preference} speedUnitPreference={speedUnitPreference} onOpenUsageNotice={() => setUsageNoticeOpen(true)} onSelectSpeedUnit={selectSpeedUnitPreference} onSelectTheme={setThemePreference} />} />
        <Route path="*" element={<HomePage aircraft={aircraft} availableAircraft={availableAircraft} onResetFlightPlan={resetFlightPlan} onSelectAircraft={selectAircraft} />} />
      </Routes>
      <UsageNotice
        open={usageNoticeOpen}
        onClose={() => setUsageNoticeOpen(false)}
      />
    </>
  );
}
