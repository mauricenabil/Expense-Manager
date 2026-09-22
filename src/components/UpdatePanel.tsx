import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import {
  FolderOpen, Download, Check, AlertTriangle, ShieldCheck, HardDrive, Info, FileDown,
} from "lucide-react";
import { api, isPreviewMode } from "../lib/api";
import { APP_VERSION, compareVersions, versionFromFileName } from "../lib/version";
import { useConfirm } from "./ConfirmDialog";
import type { UpdateFileInfo, AppPaths } from "../types";

/**
 * Settings → Update
 *
 * تحديث بدون إنترنت وبدون إلغاء تثبيت:
 * المستخدم يجيب Setup.exe الجديد بأي وسيلة (فلاشة، شبكة محلية، جهاز تاني)،
 * يختاره من هنا، فناخد نسخة احتياطية أولاً ثم نشغّل المثبّت ونقفل التطبيق.
 * NSIS بيستبدل ملفات البرنامج في مكانها، وقاعدة البيانات في AppData مالهاش
 * علاقة بمجلد التثبيت فبتفضل كما هي بكل المصروفات والإعدادات.
 *
 * التطبيق لا يتصل بالإنترنت هنا ولا في أي مكان آخر.
 */
export default function UpdatePanel() {
  const confirm = useConfirm();

  const [paths, setPaths] = useState<AppPaths | null>(null);
  const [file, setFile] = useState<UpdateFileInfo | null>(null);
  const [backupFirst, setBackupFirst] = useState(true);
  const [busy, setBusy] = useState<null | "picking" | "backup" | "installing">(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    api.getAppPaths().then(setPaths).catch(() => setPaths(null));
  }, []);

  const installedVersion = paths?.version || APP_VERSION;
  const fileVersion = file ? versionFromFileName(file.file_name) : null;
  const cmp = fileVersion ? compareVersions(fileVersion, installedVersion) : null;

  const pick = async () => {
    setError(null);
    setNote(null);
    setBusy("picking");
    try {
      const picked = await api.pickUpdateFile();
      if (picked) setFile(picked);
    } catch (e: any) {
      setFile(null);
      setError(e?.message || String(e));
    } finally {
      setBusy(null);
    }
  };

  /** نسخة احتياطية قبل التحديث — تُكتب في مجلد النسخ المحفوظ، وإلا نسأل عن مجلد */
  const takeBackup = async (): Promise<boolean> => {
    setBusy("backup");
    try {
      let folder = await api.getAppSetting("backup_folder");
      if (!folder) {
        folder = await api.pickBackupFolder();
        if (!folder) {
          setError("No folder chosen for the pre-update backup.");
          return false;
        }
        await api.setAppSetting("backup_folder", folder);
      }

      const writable = await api.checkFolderWritable(folder);
      if (!writable) {
        setError(`The backup folder is not available right now:\n${folder}`);
        return false;
      }

      const json = await api.exportBackupJson();
      const bytes = Array.from(new TextEncoder().encode(json));
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      const saved = await api.writeBackupFile(
        folder,
        `expense-manager-before-update-${stamp}.json`,
        bytes
      );
      setNote(`Backup saved: ${saved}`);
      return true;
    } catch (e: any) {
      setError(`Backup failed, so the update was stopped: ${e?.message || e}`);
      return false;
    } finally {
      setBusy(null);
    }
  };

  const install = async () => {
    if (!file) return;
    setError(null);
    setNote(null);

    // الملف اتفحص وقت الاختيار، بس الفلاشة ممكن تكون اتفصلت من ساعتها
    let fresh: UpdateFileInfo;
    try {
      fresh = await api.inspectUpdateFile(file.path);
      setFile(fresh);
    } catch (e: any) {
      setError(e?.message || String(e));
      return;
    }

    const older = cmp !== null && cmp < 0;
    const same = cmp === 0;

    const ok = await confirm({
      title: "Install this update?",
      message:
        `${fresh.file_name}\n\n` +
        (older
          ? `⚠ This file looks like version ${fileVersion}, older than the installed ${installedVersion}.\n\n`
          : same
          ? `⚠ This file looks like version ${fileVersion} — the same version already installed.\n\n`
          : "") +
        "The app will close and the Windows installer will open. Your expenses, settings and backups " +
        "are stored outside the program folder and stay untouched.",
      confirmLabel: "Close app and install",
      danger: older || same,
    });
    if (!ok) return;

    if (backupFirst) {
      const done = await takeBackup();
      if (!done) return;
    }

    setBusy("installing");
    try {
      await api.runUpdateInstaller(fresh.path);
      // في التطبيق الحقيقي النافذة بتتقفل هنا، فالسطر ده بيظهر في المعاينة فقط
      setNote("Installer launched.");
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* ---------- الإصدار الحالي ---------- */}
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Update</h3>
        <div style={versionRow}>
          <div>
            <div style={{ ...muted, marginBottom: 2 }}>Installed version</div>
            <div style={{ fontSize: "calc(22px * var(--app-font-scale, 1))", fontWeight: 800, letterSpacing: "-0.02em" }}>
              v{installedVersion}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, ...muted }}>
            <ShieldCheck size={15} style={{ color: "var(--success)" }} />
            100% offline — the app never contacts the internet
          </div>
        </div>
      </div>

      {/* ---------- اختيار ملف التحديث ---------- */}
      <div className="card">
        <h3 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 8 }}>
          <Download size={16} /> Install an update from a file
        </h3>
        <p style={{ ...muted, marginTop: 0 }}>
          Copy the new <code style={code}>ExpenseManager-Setup.exe</code> onto this machine (USB stick,
          local network, anywhere), then pick it below. No uninstall, no data loss — installing over the
          current version replaces the program files only.
        </p>

        <button onClick={pick} disabled={busy !== null} style={{ ...secondaryBtn, opacity: busy ? 0.6 : 1 }}>
          <FolderOpen size={15} /> {busy === "picking" ? "Opening..." : file ? "Choose a different file" : "Choose update file"}
        </button>

        {file && (
          <div style={filePanel}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, wordBreak: "break-all" }}>
              <FileDown size={15} style={{ flexShrink: 0, color: "var(--accent)" }} />
              {file.file_name}
            </div>
            <div style={{ ...muted, marginTop: 6, wordBreak: "break-all" }}>{file.path}</div>
            <div style={{ ...muted, marginTop: 4 }}>
              {(file.size_bytes / (1024 * 1024)).toFixed(1)} MB
              {fileVersion ? ` · detected version ${fileVersion}` : " · version not detected from the file name"}
            </div>

            {cmp !== null && cmp < 0 && (
              <Warn>This file is older than the installed version. Installing it would downgrade the app.</Warn>
            )}
            {cmp === 0 && <Warn>This is the same version already installed.</Warn>}
            {file.is_portable && (
              <Warn>
                This is the Portable build, not the installer. Close the app and replace the portable .exe
                yourself, or pick the Setup file instead.
              </Warn>
            )}

            <label style={checkboxRow}>
              <input
                type="checkbox"
                checked={backupFirst}
                onChange={(e) => setBackupFirst(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: "var(--accent)" }}
              />
              Take a backup before installing (recommended)
            </label>

            <button
              onClick={install}
              disabled={busy !== null || file.is_portable}
              style={{
                ...primaryBtn, marginTop: 12,
                opacity: busy !== null || file.is_portable ? 0.6 : 1,
                cursor: busy !== null || file.is_portable ? "not-allowed" : "pointer",
              }}
            >
              <Download size={15} />
              {busy === "backup" ? "Backing up..." : busy === "installing" ? "Starting installer..." : "Back up and install"}
            </button>
          </div>
        )}

        {error && (
          <div style={{ ...alertBox, borderColor: "var(--danger)", color: "var(--danger)" }}>
            <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
            <span style={{ whiteSpace: "pre-wrap" }}>{error}</span>
          </div>
        )}
        {note && (
          <div style={{ ...alertBox, borderColor: "var(--success)", color: "var(--success)" }}>
            <Check size={15} style={{ flexShrink: 0, marginTop: 2 }} />
            <span style={{ whiteSpace: "pre-wrap" }}>{note}</span>
          </div>
        )}

        {isPreviewMode && (
          <div style={{ ...alertBox, borderColor: "var(--warning)", color: "var(--warning)" }}>
            <Info size={15} style={{ flexShrink: 0, marginTop: 2 }} />
            Browser preview mode — picking and installing a real file only works in the desktop app.
          </div>
        )}
      </div>

      {/* ---------- أين تعيش بياناتك ---------- */}
      <div className="card">
        <h3 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 8 }}>
          <HardDrive size={16} /> Where your data lives
        </h3>
        <p style={{ ...muted, marginTop: 0 }}>
          These two live in different places on purpose: an update rewrites the program folder and never
          touches the data folder.
        </p>
        <PathRow label="Database" value={paths?.db_path} />
        <PathRow label="Program folder" value={paths?.install_dir} />
        {paths?.app_data_dir && (
          <button onClick={() => api.openFolderInExplorer(paths.app_data_dir)} style={{ ...secondaryBtn, marginTop: 10 }}>
            <FolderOpen size={14} /> Open the data folder
          </button>
        )}
      </div>

      {/* ---------- الخطوات ---------- */}
      <div className="card">
        <h3 style={{ marginTop: 0 }}>How an offline update works</h3>
        <ol style={{ ...muted, margin: 0, paddingInlineStart: 20, display: "flex", flexDirection: "column", gap: 6 }}>
          <li>Build or receive the newer <code style={code}>ExpenseManager-Setup.exe</code>.</li>
          <li>Copy it to this machine — a USB stick is enough, no network needed.</li>
          <li>Pick it above and press <b>Back up and install</b>.</li>
          <li>The app closes, Windows runs the installer over the existing install.</li>
          <li>Reopen the app: same database, same settings, new version number here.</li>
        </ol>
        <p style={{ ...muted, marginBottom: 0, marginTop: 12 }}>
          Never uninstall first. Uninstalling is the one path that can remove the program's data folder,
          and it buys you nothing — the installer already replaces every file it owns.
        </p>
      </div>
    </div>
  );
}

/* ========================================================= */

function PathRow({ label, value }: { label: string; value?: string }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ ...muted, marginBottom: 2 }}>{label}</div>
      <div
        style={{
          fontFamily: "var(--font-mono, monospace)",
          fontSize: "calc(12px * var(--app-font-scale, 1))",
          background: "var(--surface-sunken)", border: "1px solid var(--border)",
          borderRadius: 8, padding: "8px 10px", wordBreak: "break-all",
        }}
      >
        {value || "—"}
      </div>
    </div>
  );
}

function Warn({ children }: { children: ReactNode }) {
  return (
    <div style={{ ...alertBox, borderColor: "var(--warning)", color: "var(--warning)" }}>
      <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
      <span>{children}</span>
    </div>
  );
}

/* ---------- styles ---------- */
const muted: CSSProperties = {
  color: "var(--text-muted)",
  fontSize: "calc(12.5px * var(--app-font-scale, 1))",
  lineHeight: 1.65,
};

const versionRow: CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  gap: 16, flexWrap: "wrap",
  padding: "14px 16px", borderRadius: 10,
  background: "var(--surface-sunken)", border: "1px solid var(--border)",
};

const filePanel: CSSProperties = {
  marginTop: 14, padding: "14px 16px", borderRadius: 10,
  background: "var(--surface-sunken)", border: "1px solid var(--border)",
};

const alertBox: CSSProperties = {
  display: "flex", gap: 8, alignItems: "flex-start",
  marginTop: 12, padding: "10px 12px", borderRadius: 8,
  border: "1px solid var(--border)",
  fontSize: "calc(12.5px * var(--app-font-scale, 1))", lineHeight: 1.6,
};

const checkboxRow: CSSProperties = {
  display: "flex", alignItems: "center", gap: 8, marginTop: 14, cursor: "pointer",
  fontSize: "calc(12.5px * var(--app-font-scale, 1))", color: "var(--text)",
};

const baseBtn: CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 7,
  padding: "9px 16px", borderRadius: 8, cursor: "pointer",
  fontSize: "calc(13px * var(--app-font-scale, 1))", fontWeight: 700,
};

const primaryBtn: CSSProperties = {
  ...baseBtn, border: "none", background: "var(--accent)", color: "var(--on-accent)",
};

const secondaryBtn: CSSProperties = {
  ...baseBtn, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)",
};

const code: CSSProperties = {
  background: "var(--surface-sunken)", padding: "1px 6px", borderRadius: 5,
  fontFamily: "var(--font-mono, monospace)", fontSize: "0.92em",
};
