import { useCallback, useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { api } from "./api";
import { useDataStore } from "../store/DataStore";
import {
  type BackupSchedule, DEFAULT_BACKUP_DAY, calcNextBackupDate, normalizeBackupDay, toLocalISODate,
} from "./backupSchedule";
import { isValidExpenseId, deriveExpenseIdFromUuid } from "./expenseId";

/* =========================================================
   Auto Backup System
   Architecture notes:
   - Settings stored in localStorage (work both in browser preview and desktop)
   - Actual file writing in desktop mode goes through Tauri fs plugin (see Desktop build)
   - In browser preview mode: downloads file via blob URL (simulated)
   - Future-ready: cloud provider integration point is marked clearly below
   ========================================================= */

export type BackupFormat = "json" | "excel" | "csv";
export type BackupHistory = 5 | 10 | 20 | "unlimited";

export interface AutoBackupSettings {
  enabled: boolean;
  format: BackupFormat;
  schedule: BackupSchedule;
  /** اليوم من الشهر (1–31) الذي تُنفَّذ فيه النسخة التلقائية — لا يُستخدم مع التكرار الأسبوعي */
  backupDay: number;
  maxHistory: BackupHistory;
  lastBackupDate: string | null;
  nextBackupDate: string | null;
  storedBackups: { name: string; date: string; size: string }[];
}

const BACKUP_SETTINGS_KEY = "expense-manager-auto-backup-settings";

export function loadBackupSettings(): AutoBackupSettings {
  const defaults: AutoBackupSettings = {
    enabled: false, format: "json", schedule: "monthly", backupDay: DEFAULT_BACKUP_DAY, maxHistory: 10,
    lastBackupDate: null, nextBackupDate: null, storedBackups: [],
  };
  try {
    const raw = localStorage.getItem(BACKUP_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // دمج مع القيم الافتراضية: الإعدادات المحفوظة من إصدار سابق لا تحتوي على backupDay
      return { ...defaults, ...parsed, backupDay: normalizeBackupDay(parsed.backupDay) };
    }
  } catch { /* ignore */ }
  return defaults;
}

export function saveBackupSettings(s: AutoBackupSettings) {
  localStorage.setItem(BACKUP_SETTINGS_KEY, JSON.stringify(s));
}

// علَم على مستوى الملف (مش داخل الـ component) — لأن الهوك ده ممكن يتنادى من مكانين
// في نفس الوقت تقريباً (AutoBackupRunner عند بدء التشغيل، وصفحة Settings لو المستخدم فتحها
// بسرعة بعد الإقلاع). الفحص "هل الموعد مستحق؟" لازم يحصل مرة واحدة بس لكل تشغيل للتطبيق،
// وإلا ممكن ينزل نسختين احتياطيتين مكررتين لو الاتنين اتنفذوا في نفس اللحظة.
let autoCheckStartedThisSession = false;

/**
 * الحالة والمنطق الكامل للنسخ الاحتياطي التلقائي: تحميل الإعدادات، تحميل مسار المجلد،
 * تنفيذ النسخة (يدوي أو تلقائي)، والفحص التلقائي عند بدء التشغيل.
 * يُستخدم من مكانين: AutoBackupRunner (يشتغل مع بدء التطبيق مباشرة) وصفحة
 * Settings → Backup (لعرض الحالة والتحكم اليدوي بنفس البيانات بالضبط).
 */
export function useAutoBackup() {
  const { expenses, loading: dataLoading } = useDataStore();
  const [settings, setSettings] = useState<AutoBackupSettings>(loadBackupSettings);
  const [backingUp, setBackingUp] = useState(false);
  const [msg, setMsg] = useState("");
  const [backupFolder, setBackupFolder] = useState<string | null>(null);
  const [folderStatus, setFolderStatus] = useState<"ok" | "unavailable" | "unset">("unset");
  // حالة تحميل مسار المجلد المحفوظ: النسخة التلقائية لازم تستنى "ready" قبل ما تشتغل،
  // وإلا هتلاقي backupFolder لسه null وتنزّل الملف في مجلد Downloads بدل المجلد المحدد.
  const [folderLoad, setFolderLoad] = useState<"loading" | "ready" | "error">("loading");
  const autoCheckDoneRef = useRef(false);

  // تحميل المسار المحفوظ (يستمر عبر إعادة تشغيل التطبيق لأنه محفوظ في قاعدة البيانات)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const folder = await api.getAppSetting("backup_folder");
        if (cancelled) return;
        if (folder) {
          setBackupFolder(folder);
          const writable = await api.checkFolderWritable(folder);
          if (cancelled) return;
          setFolderStatus(writable ? "ok" : "unavailable");
        }
        setFolderLoad("ready");
      } catch {
        if (!cancelled) setFolderLoad("error");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleChangeLocation = async () => {
    const folder = await api.pickBackupFolder();
    if (!folder) return; // المستخدم ألغى الاختيار
    await api.setAppSetting("backup_folder", folder);
    setBackupFolder(folder);
    const writable = await api.checkFolderWritable(folder);
    setFolderStatus(writable ? "ok" : "unavailable");
  };

  const handleOpenFolder = async () => {
    if (!backupFolder) return;
    await api.openFolderInExplorer(backupFolder);
  };

  const save = (partial: Partial<AutoBackupSettings>) => {
    const next = { ...settings, ...partial };
    if (partial.schedule !== undefined || partial.backupDay !== undefined) {
      next.nextBackupDate = calcNextBackupDate(next.schedule, next.backupDay);
    }
    setSettings(next);
    saveBackupSettings(next);
  };

  const doBackup = useCallback(async (triggered: "manual" | "auto" = "manual") => {
    setBackingUp(true);
    setMsg("");
    try {
      // نقرأ أحدث نسخة من الإعدادات دايماً من localStorage بدل الاعتماد على الـ closure —
      // مهم لو في instance تاني من نفس الهوك (مثلاً Settings) غيّر الإعدادات في نفس اللحظة.
      const current = loadBackupSettings();
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}`;
      const baseName = `ExpenseManager_Backup_${dateStr}`;

      let blob: Blob;
      let filename: string;

      if (current.format === "json") {
        const json = JSON.stringify({ expenses, exportedAt: now.toISOString() }, null, 2);
        blob = new Blob([json], { type: "application/json" });
        filename = `${baseName}.json`;
      } else if (current.format === "excel") {
        // نفس منطق التصدير اليدوي: xlsx حقيقي عبر SheetJS، يحفظ العربي بدون أي تشويه
        // ويفتح في Microsoft Excel بدون أي تحذير Format
        const wsData = expenses.map((e) => ({
          "Expense ID":     isValidExpenseId(e.id) ? e.id : deriveExpenseIdFromUuid(e.id, e.date),
          "Name":           e.name,
          "Date":           e.date,
          "Amount (EGP)":   e.amount,
          "Category":       e.category_name ?? "",
          "Payment Method": e.payment_method_name ?? "",
          "Notes":          e.description ?? "",
        }));
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(wsData);
        ws["!cols"] = [{ wch: 22 }, { wch: 28 }, { wch: 13 }, { wch: 14 }, { wch: 20 }, { wch: 20 }, { wch: 30 }];
        XLSX.utils.book_append_sheet(wb, ws, "Expenses");
        const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
        blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        filename = `${baseName}.xlsx`;
      } else {
        const escapeCsv = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
        const rows = expenses.map((e) =>
          [e.name, e.date, e.amount, e.category_name ?? "", e.payment_method_name ?? "", e.description ?? ""]
            .map(escapeCsv).join(",")
        );
        // BOM في البداية يضمن فتح Excel للملف كـ UTF-8 صحيح فيبان العربي سليم بدل رموز مشوّهة
        const csvContent = "\uFEFF" + ["Name,Date,Amount,Category,Payment Method,Notes", ...rows].join("\n");
        blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        filename = `${baseName}.csv`;
      }

      // لو المستخدم حدّد مجلد Backup: نتحقق أولاً من إمكانية الكتابة الفعلية (قد يكون محذوفاً،
      // أو قرص خارجي مفصول، أو بدون صلاحية) قبل أي محاولة كتابة — بدون أي Crash في كل الحالات
      let savedTo = "";
      if (backupFolder) {
        const writable = await api.checkFolderWritable(backupFolder);
        if (!writable) {
          setMsg(`❌ Automatic backup could not run — the backup folder is unavailable:\n${backupFolder}\nCheck that the folder still exists and is writable (e.g. external drive connected), then try again.`);
          setFolderStatus("unavailable");
          return;
        }
        setFolderStatus("ok");
        const bytes = Array.from(new Uint8Array(await blob.arrayBuffer()));
        savedTo = await api.writeBackupFile(backupFolder, filename, bytes);
      } else {
        // مفيش مجلد محدد: نستخدم تنزيل المتصفح العادي (المسار الافتراضي لتنزيلات المتصفح/التطبيق)
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
        savedTo = filename;
      }

      const sizeKB = Math.round(blob.size / 1024);
      const newBackup = { name: filename, date: now.toISOString().slice(0, 16).replace("T", " "), size: `${sizeKB} KB` };

      // Apply max history limit
      let storedBackups = [newBackup, ...current.storedBackups];
      if (current.maxHistory !== "unlimited") {
        storedBackups = storedBackups.slice(0, current.maxHistory);
      }

      // التاريخ المحلي (وليس UTC) عشان اليوم المختار من الشهر يتحسب صح.
      const todayStr = toLocalISODate(now);
      // ننقل موعد النسخة القادمة فقط لو النسخة الحالية هي المستحقة فعلاً (الموعد جه أو فات).
      // النسخة اليدوية (Backup Now) قبل الموعد لا تلغي اليوم المختار من المستخدم.
      let nextBackupDate = current.nextBackupDate;
      if (current.enabled && (!nextBackupDate || todayStr >= nextBackupDate)) {
        nextBackupDate = calcNextBackupDate(current.schedule, current.backupDay, now, true);
      }
      const updated: AutoBackupSettings = {
        ...current,
        lastBackupDate: todayStr,
        nextBackupDate,
        storedBackups,
      };
      setSettings(updated);
      saveBackupSettings(updated);
      setMsg(
        triggered === "manual"
          ? `✅ Backup saved: ${filename}${backupFolder ? `\n📁 ${savedTo}` : ""}`
          : `✅ Auto backup completed: ${filename}${backupFolder ? `\n📁 ${savedTo}` : ""}`
      );
    } catch (err) {
      setMsg(`❌ Automatic backup failed: ${String(err)}`);
    } finally {
      setBackingUp(false);
    }
  }, [expenses, backupFolder]);

  // Check if auto backup is due — يشتغل مرة واحدة بس لكل تشغيل للتطبيق (مش لكل مرة يتفتح فيها
  // هوك جديد)، وبعد ما مسار المجلد وبيانات المصروفات يخلصوا تحميل بالكامل (وليس عند أول رسم
  // مباشرة). السبب: قبل كده كان الفحص بيشتغل فوراً ومسار المجلد لسه null فيتحفظ الملف في
  // Downloads، وكمان كان مربوط بفتح صفحة Settings → Backup بس، فلو المستخدم ما فتحش
  // التبويب في يوم الموعد كانت النسخة بتتأخر لحد أول فتح.
  useEffect(() => {
    if (folderLoad === "loading" || dataLoading || autoCheckDoneRef.current) return;
    autoCheckDoneRef.current = true;
    if (autoCheckStartedThisSession) return; // فحص تاني (instance) خلّص الفحص ده فعلاً
    autoCheckStartedThisSession = true;

    if (!settings.enabled || !settings.nextBackupDate) return;
    if (toLocalISODate() < settings.nextBackupDate) return;
    if (folderLoad === "error") {
      // مش قادرين نقرأ المجلد المحدد → الأفضل نوقف النسخة بدل ما نكتب في مكان غير متوقع
      setMsg("❌ Automatic backup skipped: could not read the saved backup folder. Open Settings → Backup to re-select the folder.");
      return;
    }
    doBackup("auto");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderLoad, dataLoading]);

  return {
    settings, save, doBackup, backingUp, msg,
    backupFolder, folderStatus, handleChangeLocation, handleOpenFolder,
  };
}
