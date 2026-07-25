import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import OnboardingTour from "@/components/erp/OnboardingTour";

const DONE_KEY = "sc.erp.tour.completed.v1";

const TourCtx = createContext({ start: () => {}, close: () => {}, restart: () => {}, running: false });

/**
 * Route-persistent host for the ERP onboarding tour. Mount ONCE at the app
 * root so the overlay survives route transitions between /vendor/erp/*.
 * Any component can call `useTour().start()` / `.restart()`.
 */
export function TourProvider({ children }) {
  const [running, setRunning] = useState(false);
  const location = useLocation();

  // Auto-open on the vendor's first visit to the ERP hub — react-router
  // location changes (including in-app <Link/> clicks) trigger this.
  useEffect(() => {
    if (location.pathname !== "/vendor/erp") return;
    if (localStorage.getItem(DONE_KEY)) return;
    const t = setTimeout(() => setRunning(true), 900);
    return () => clearTimeout(t);
  }, [location.pathname]);

  const start = useCallback(() => setRunning(true), []);
  const close = useCallback(() => {
    localStorage.setItem(DONE_KEY, new Date().toISOString());
    setRunning(false);
  }, []);
  const restart = useCallback(() => {
    localStorage.removeItem(DONE_KEY);
    setRunning(true);
  }, []);

  return (
    <TourCtx.Provider value={{ start, close, restart, running }}>
      {children}
      <OnboardingTour running={running} onClose={close} />
    </TourCtx.Provider>
  );
}

export const useTour = () => useContext(TourCtx);
