import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "../css/theme.css";
import "../css/index.css";
import "../css/calculator.css";
import { App } from "./App";
import { AircraftProvider } from "./app/AircraftContext";
import { FlightPlanProvider } from "./app/FlightPlanContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AircraftProvider>
        <FlightPlanProvider>
          <App />
        </FlightPlanProvider>
      </AircraftProvider>
    </BrowserRouter>
  </StrictMode>,
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(
      `${import.meta.env.BASE_URL}service-worker.js?v=88`,
      { updateViaCache: "none" },
    );
  });
}
