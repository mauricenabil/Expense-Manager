import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { WeekStart } from "../lib/dateRanges";

interface WeekStartContextValue {
  weekStart: WeekStart;
  setWeekStart: (w: WeekStart) => void;
}

const WeekStartContext = createContext<WeekStartContextValue | null>(null);
const STORAGE_KEY = "expense-manager-week-start";

export function WeekStartProvider({ children }: { children: ReactNode }) {
  const [weekStart, setWeekStartState] = useState<WeekStart>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return (saved ? (Number(saved) as WeekStart) : 0);
  });

  useEffect(() => { localStorage.setItem(STORAGE_KEY, String(weekStart)); }, [weekStart]);

  const setWeekStart = (w: WeekStart) => setWeekStartState(w);

  return <WeekStartContext.Provider value={{ weekStart, setWeekStart }}>{children}</WeekStartContext.Provider>;
}

export function useWeekStart() {
  const ctx = useContext(WeekStartContext);
  if (!ctx) throw new Error("useWeekStart يجب استخدامه داخل WeekStartProvider");
  return ctx;
}
