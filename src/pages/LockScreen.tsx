import { useState, FormEvent } from "react";
import { Lock, Wallet, KeyRound } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

export default function LockScreen() {
  const { unlock } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRecoveryCode, setNewRecoveryCode] = useState<string | null>(null);
  const [recoveryError, setRecoveryError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setChecking(true);
    setError("");
    const ok = await unlock(password);
    if (!ok) { setError("Incorrect password. Please try again."); setPassword(""); }
    setChecking(false);
  };

  const handleRecovery = async (e: FormEvent) => {
    e.preventDefault();
    setRecoveryError("");
    if (newPassword.length < 4) { setRecoveryError("New password must be at least 4 characters."); return; }
    try {
      const code = await api.resetPasswordWithRecoveryCode(recoveryCode, newPassword);
      setNewRecoveryCode(code);
    } catch {
      setRecoveryError("Invalid recovery code.");
    }
  };

  if (showRecovery) {
    return (
      <div style={containerStyle}>
        <form onSubmit={handleRecovery} className="card" style={{ width: 380, textAlign: "center" }}>
          <div style={logoBoxStyle}><KeyRound size={28} color="var(--accent)" /></div>
          <h2 style={{ margin: "0 0 4px" }}>Reset Password</h2>
          <p className="text-muted" style={{ marginTop: 0, marginBottom: 20, fontSize: "calc(13px * var(--app-font-scale, 1))" }}>
            Enter the Recovery Code you saved when you first set your password.
          </p>

          {newRecoveryCode ? (
            <>
              <div className="card" style={{ background: "var(--accent-soft)", border: "1px solid var(--accent)", marginBottom: 16 }}>
                <strong style={{ fontSize: "calc(12px * var(--app-font-scale, 1))" }}>Password reset! Your new Recovery Code:</strong>
                <div style={{ fontFamily: "monospace", fontSize: "calc(18px * var(--app-font-scale, 1))", fontWeight: 700, letterSpacing: 1.5, marginTop: 6, color: "var(--accent)" }}>
                  {newRecoveryCode}
                </div>
                <p className="text-muted" style={{ fontSize: "calc(11px * var(--app-font-scale, 1))", marginTop: 6, marginBottom: 0 }}>Save this somewhere safe — it replaces your old code.</p>
              </div>
              <button type="button" onClick={() => { setShowRecovery(false); setNewRecoveryCode(null); setRecoveryCode(""); setNewPassword(""); }} style={primaryBtnStyle}>
                Back to Login
              </button>
            </>
          ) : (
            <>
              <input dir="auto" style={fieldStyle} placeholder="Recovery Code (XXXXXX-XXXXXX)" value={recoveryCode} onChange={(e) => setRecoveryCode(e.target.value)} />
              <input type="password" style={{ ...fieldStyle, marginTop: 10 }} placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              {recoveryError && <p style={{ color: "var(--danger)", fontSize: "calc(13px * var(--app-font-scale, 1))", marginTop: 10, marginBottom: 0 }}>{recoveryError}</p>}
              <button type="submit" style={{ ...primaryBtnStyle, marginTop: 16 }}>Reset Password</button>
              <button type="button" onClick={() => setShowRecovery(false)} style={linkBtnStyle}>Back to Login</button>
            </>
          )}
        </form>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <form onSubmit={handleSubmit} className="card" style={{ width: 360, textAlign: "center" }}>
        <div style={logoBoxStyle}><Wallet size={28} color="var(--accent)" /></div>

        <h2 style={{ margin: "0 0 4px" }}>Expense Manager</h2>
        <p className="text-muted" style={{ marginTop: 0, marginBottom: 24 }}>Enter your password to continue</p>

        <div style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px", background: "var(--surface-hover)" }}>
          <Lock size={18} color="var(--text-muted)" />
          <input
            type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password"
            style={{ flex: 1, border: "none", outline: "none", background: "transparent", color: "var(--text)", fontSize: "calc(15px * var(--app-font-scale, 1))" }}
          />
        </div>

        {error && <p style={{ color: "var(--danger)", fontSize: "calc(13px * var(--app-font-scale, 1))", marginTop: 10, marginBottom: 0 }}>{error}</p>}

        <button type="submit" disabled={checking || password.length === 0} style={{ ...primaryBtnStyle, width: "100%", marginTop: 20, opacity: checking || password.length === 0 ? 0.6 : 1 }}>
          {checking ? "Checking..." : "Unlock"}
        </button>

        <button type="button" onClick={() => setShowRecovery(true)} style={linkBtnStyle}>Forgot your password?</button>
      </form>
    </div>
  );
}

const containerStyle = { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" } as const;
const logoBoxStyle = { width: 56, height: 56, borderRadius: 16, background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" } as const;
const fieldStyle = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface-hover)", color: "var(--text)", fontSize: "calc(14px * var(--app-font-scale, 1))", outline: "none", boxSizing: "border-box" } as const;
const primaryBtnStyle = { width: "100%", padding: "12px", borderRadius: 10, border: "none", background: "var(--accent)", color: "var(--on-accent)", fontWeight: 600, fontSize: "calc(15px * var(--app-font-scale, 1))", cursor: "pointer" } as const;
const linkBtnStyle = { display: "block", width: "100%", marginTop: 14, background: "none", border: "none", color: "var(--text-muted)", fontSize: "calc(12px * var(--app-font-scale, 1))", cursor: "pointer", textDecoration: "underline" } as const;
