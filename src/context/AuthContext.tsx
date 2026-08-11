import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "../lib/api";

interface AuthContextValue {
  isLocked: boolean;
  passwordEnabled: boolean;
  unlock: (password: string) => Promise<boolean>;
  lockNow: () => void;
  loading: boolean;
  /** يُستدعى فوراً بعد تفعيل/تعطيل/تغيير الباسورد أو الـ Auto-Lock من Settings
   *  بدلاً من الانتظار لحد إعادة فتح التطبيق — هذا يحل مشكلة عدم ظهور زر القفل فوراً */
  refreshPasswordStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [passwordEnabled, setPasswordEnabled] = useState(false);
  const [autoLockMinutes, setAutoLockMinutes] = useState<number | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshPasswordStatus = useCallback(async () => {
    const [enabled, lockMinutes] = await Promise.all([api.isPasswordEnabled(), api.getAutoLockMinutes()]);
    setPasswordEnabled(enabled);
    setAutoLockMinutes(lockMinutes);
  }, []);

  useEffect(() => {
    refreshPasswordStatus()
      .then(() => api.isPasswordEnabled())
      .then((enabled) => setIsLocked(enabled)) // لو الباسورد مفعّل، التطبيق يبدأ مقفول عند الفتح
      .finally(() => setLoading(false));
  }, [refreshPasswordStatus]);

  // Auto-Lock بعد فترة الخمول المحددة فعلياً من Settings (وليست قيمة ثابتة)
  useEffect(() => {
    if (!passwordEnabled || !autoLockMinutes) return;

    const resetTimer = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => setIsLocked(true), autoLockMinutes * 60 * 1000);
    };

    const events = ["mousemove", "keydown", "click", "scroll"];
    events.forEach((e) => window.addEventListener(e, resetTimer));
    resetTimer();

    return () => {
      events.forEach((e) => window.removeEventListener(e, resetTimer));
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [passwordEnabled, autoLockMinutes]);

  const unlock = async (password: string): Promise<boolean> => {
    const valid = await api.verifyPassword(password);
    if (valid) setIsLocked(false);
    return valid;
  };

  const lockNow = () => setIsLocked(true);

  return (
    <AuthContext.Provider value={{ isLocked, passwordEnabled, unlock, lockNow, loading, refreshPasswordStatus }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth يجب استخدامه داخل AuthProvider");
  return ctx;
}
