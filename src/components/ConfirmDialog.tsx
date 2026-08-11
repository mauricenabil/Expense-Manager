import { createContext, useCallback, useContext, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  /** لو محدّدة، المستخدم لازم يكتب هذا النص بالضبط قبل ما زر التأكيد يتفعّل — للعمليات شديدة الخطورة فقط */
  typeToConfirm?: string;
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

type ConfirmFn = (options: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * يوفّر بديلاً كاملاً لـ window.confirm() الأصلي عبر React Modal حقيقي.
 * السبب: window.confirm()/alert() غير موثوقين في بعض توزيعات Tauri WebView2 على
 * ويندوز (قد يرجعوا true تلقائياً بدون عرض أي حوار فعلي)، فأي كود يعتمد عليهم
 * لعمليات خطيرة (حذف بيانات) قد يُنفَّذ مباشرة بدون أي تأكيد حقيقي من المستخدم.
 * هذا البديل مبني بالكامل بـ React ونتحكم فيه 100%، فيعمل بنفس السلوك المضمون
 * في كل من وضع المعاينة بالمتصفح والتطبيق الفعلي على Windows.
 */
export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [typedText, setTypedText] = useState("");

  const confirmFn: ConfirmFn = useCallback((options) => {
    const opts: ConfirmOptions = typeof options === "string" ? { message: options } : options;
    return new Promise<boolean>((resolve) => {
      setTypedText("");
      setPending({ ...opts, resolve });
    });
  }, []);

  const handleClose = (result: boolean) => {
    if (pending) pending.resolve(result);
    setPending(null);
  };

  const needsTyping = !!pending?.typeToConfirm;
  const typingMatched = !needsTyping || typedText.trim() === pending?.typeToConfirm;

  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose(false);
      if (e.key === "Enter" && !needsTyping) handleClose(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, needsTyping]);

  return (
    <ConfirmContext.Provider value={confirmFn}>
      {children}
      {pending && createPortal(
        <div style={overlayStyle} onClick={() => handleClose(false)}>
          <div className="card modal-in" style={dialogStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
              {pending.danger && (
                <div style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 10, background: "var(--danger)22", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <AlertTriangle size={18} color="var(--danger)" />
                </div>
              )}
              <div>
                {pending.title && <h3 style={{ margin: "0 0 6px", fontSize: 16 }}>{pending.title}</h3>}
                <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5, whiteSpace: "pre-line" }}>{pending.message}</p>
              </div>
            </div>

            {needsTyping && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
                  Type <strong style={{ color: "var(--text)" }}>{pending.typeToConfirm}</strong> to confirm:
                </label>
                <input
                  autoFocus
                  value={typedText}
                  onChange={(e) => setTypedText(e.target.value)}
                  style={typeInputStyle}
                  placeholder={pending.typeToConfirm}
                />
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => handleClose(false)} style={cancelBtnStyle}>
                {pending.cancelLabel || "Cancel"}
              </button>
              <button
                onClick={() => handleClose(true)}
                disabled={!typingMatched}
                style={{
                  ...confirmBtnStyle,
                  background: pending.danger ? "var(--danger)" : "var(--accent)",
                  opacity: typingMatched ? 1 : 0.5,
                  cursor: typingMatched ? "pointer" : "not-allowed",
                }}
              >
                {pending.confirmLabel || "Confirm"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </ConfirmContext.Provider>
  );
}

/** يُستخدم بدل window.confirm() تماماً: `if (!(await confirmDialog("رسالة..."))) return;` */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm يجب استخدامه داخل ConfirmDialogProvider");
  return ctx;
}

const overlayStyle: CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
  display: "flex", alignItems: "center", justifyContent: "center",
  zIndex: "var(--z-modal)" as unknown as number,
};

const dialogStyle: CSSProperties = { width: 420, maxWidth: "90vw" };

const typeInputStyle: CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: 8,
  border: "1px solid var(--border)", background: "var(--surface-hover)",
  color: "var(--text)", fontSize: 14, outline: "none", boxSizing: "border-box",
};

const cancelBtnStyle: CSSProperties = {
  padding: "9px 16px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--surface-hover)", color: "var(--text)", fontWeight: 600,
  fontSize: 13, cursor: "pointer",
};

const confirmBtnStyle: CSSProperties = {
  padding: "9px 16px", borderRadius: 8, border: "none", color: "#fff",
  fontWeight: 600, fontSize: 13,
};
