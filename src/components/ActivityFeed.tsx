import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  Plus, Pencil, Trash2, RotateCcw, Tag, Wallet, Lock, ShieldOff, KeyRound,
  CreditCard, Layers, Target, CheckCircle2, Save, History,
  Activity as ActivityIcon, ChevronDown,
} from "lucide-react";
import type { ActivityLogEntry } from "../types";

/* ===================================================================
   Recent Activity — سجل نشاط بشكل Timeline
   -------------------------------------------------------------------
   المشكلة في التصميم القديم: كل سطر في قاعدة البيانات كان بيتحوّل لصف
   منفصل بنفس النص وبنفس الدقيقة تقريباً. إضافة 18 مصروف بالتتابع كانت
   بتملأ البطاقة بـ 18 صف متطابق بلا أي معلومة إضافية — ضوضاء مش سجلّ.

   التصميم الجديد يعالج ده بأربع أفكار:

   1) تجميع (Collapsing): الأحداث المتتالية من نفس النوع وفي نفس اليوم
      وخلال نافذة قصيرة تتحوّل لحدث واحد مع عدّاد (\"Added 18 expenses\").
      ده بالظبط اللي بيعمله GitHub و Slack و Linear في سجلاتهم.

   2) فواصل زمنية: Today / Yesterday / التاريخ — عشان العين تلاقي مكانها
      بدل ما تقرأ 20 طابع وقت متشابه.

   3) خط زمني بصري: عمود رفيع بيوصل أيقونات الأحداث، وكل نوع حدث له
      أيقونة ولون من لوحة الهوية. اللون وحده بيخلي \"حذف\" و\"إضافة\"
      يتميّزوا من غير ما تقرأ النص.

   4) وقت نسبي (\"2h ago\") مع الوقت الدقيق في الـ title عند المرور.

   وكمان: عرض أول 6 أحداث فقط مع زر توسيع، فالبطاقة ما بتطوّلش الصفحة.
   =================================================================== */

interface ActionMeta {
  icon: ReactNode;
  color: string;
  /** (n) => النص المعروض؛ n = عدد الأحداث المجمّعة */
  text: (n: number) => string;
}

const s = (n: number, one: string, many: string) => (n === 1 ? one : many.replace("{n}", String(n)));

const ACTIONS: Record<string, ActionMeta> = {
  expense_added:   { icon: <Plus size={13} />,          color: "var(--c1)",     text: (n) => s(n, "Added an expense", "Added {n} expenses") },
  expense_updated: { icon: <Pencil size={12} />,        color: "var(--c4)",     text: (n) => s(n, "Updated an expense", "Updated {n} expenses") },
  expense_deleted: { icon: <Trash2 size={12} />,        color: "var(--danger)", text: (n) => s(n, "Deleted an expense", "Deleted {n} expenses") },
  expense_permanently_deleted: { icon: <Trash2 size={12} />, color: "var(--danger)", text: (n) => s(n, "Permanently deleted an expense", "Permanently deleted {n} expenses") },
  expense_restored: { icon: <RotateCcw size={12} />,    color: "var(--c3)",     text: (n) => s(n, "Restored an expense", "Restored {n} expenses") },

  category_added:   { icon: <Tag size={12} />,          color: "var(--c5)",     text: (n) => s(n, "Added a category", "Added {n} categories") },
  category_updated: { icon: <Tag size={12} />,          color: "var(--c5)",     text: (n) => s(n, "Updated a category", "Updated {n} categories") },
  category_deleted: { icon: <Tag size={12} />,          color: "var(--danger)", text: (n) => s(n, "Deleted a category", "Deleted {n} categories") },

  sub_category_added:   { icon: <Layers size={12} />,   color: "var(--c5)",     text: (n) => s(n, "Added a sub-category", "Added {n} sub-categories") },
  sub_category_updated: { icon: <Layers size={12} />,   color: "var(--c5)",     text: (n) => s(n, "Updated a sub-category", "Updated {n} sub-categories") },
  sub_category_deleted: { icon: <Layers size={12} />,   color: "var(--danger)", text: (n) => s(n, "Deleted a sub-category", "Deleted {n} sub-categories") },

  payment_method_added:   { icon: <CreditCard size={12} />, color: "var(--c7)", text: (n) => s(n, "Added a payment method", "Added {n} payment methods") },
  payment_method_updated: { icon: <CreditCard size={12} />, color: "var(--c7)", text: (n) => s(n, "Updated a payment method", "Updated {n} payment methods") },
  payment_method_deleted: { icon: <CreditCard size={12} />, color: "var(--danger)", text: (n) => s(n, "Deleted a payment method", "Deleted {n} payment methods") },

  budget_changed:  { icon: <Wallet size={12} />,        color: "var(--c2)",     text: (n) => s(n, "Updated a budget", "Updated budgets {n} times") },

  planned_added:     { icon: <Target size={12} />,      color: "var(--c3)",     text: (n) => s(n, "Planned a purchase", "Planned {n} purchases") },
  planned_converted: { icon: <CheckCircle2 size={12} />, color: "var(--success)", text: (n) => s(n, "Converted a plan into an expense", "Converted {n} plans into expenses") },

  backup_created:  { icon: <Save size={12} />, color: "var(--c8)",    text: (n) => s(n, "Created a backup", "Created {n} backups") },
  backup_restored: { icon: <History size={12} />,   color: "var(--warning)", text: (n) => s(n, "Restored a backup", "Restored {n} backups") },

  password_changed:  { icon: <Lock size={12} />,        color: "var(--c6)",     text: (n) => s(n, "Changed password", "Changed password {n} times") },
  password_disabled: { icon: <ShieldOff size={12} />,   color: "var(--warning)", text: () => "Disabled the app password" },
  password_reset_via_recovery: { icon: <KeyRound size={12} />, color: "var(--warning)", text: () => "Reset password with a recovery code" },
};

/** أي نوع حدث جديد في الباك-إند يظهر بشكل مقروء تلقائياً بدل ما يختفي */
function metaFor(action: string): ActionMeta {
  return (
    ACTIONS[action] || {
      icon: <ActivityIcon size={12} />,
      color: "var(--text-muted)",
      text: (n: number) => {
        const label = action.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
        return n === 1 ? label : `${label} ×${n}`;
      },
    }
  );
}

/* --- الوقت: نقرأ الطابع يدوياً عشان ما يتزحلقش مع المنطقة الزمنية --- */
function parseStamp(raw: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(raw);
  if (!m) return new Date(raw);
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], m[6] ? +m[6] : 0);
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

function dayLabel(d: Date): string {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(d) === dayKey(today)) return "Today";
  if (dayKey(d) === dayKey(yesterday)) return "Yesterday";
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

const hhmm = (d: Date) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

function relative(d: Date): string {
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  const days = Math.floor(diff / 86400);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

/* --- التجميع --- */
interface Group {
  id: string;
  action: string;
  count: number;
  /** أحدث حدث في المجموعة */
  latest: Date;
  /** أقدم حدث في المجموعة — يُعرض كمدى زمني لما يكونوا أكتر من واحد */
  earliest: Date;
}

/** نافذة الدمج: أحداث نفس النوع خلال ساعتين تُعتبر \"دفعة واحدة\" */
const MERGE_WINDOW_MS = 2 * 60 * 60 * 1000;

function groupEntries(entries: ActivityLogEntry[]): { day: string; date: Date; items: Group[] }[] {
  const sorted = [...entries].sort(
    (a, b) => parseStamp(b.created_at).getTime() - parseStamp(a.created_at).getTime()
  );

  const days: { day: string; date: Date; items: Group[] }[] = [];

  for (const e of sorted) {
    const at = parseStamp(e.created_at);
    let bucket = days[days.length - 1];
    if (!bucket || bucket.day !== dayKey(at)) {
      bucket = { day: dayKey(at), date: at, items: [] };
      days.push(bucket);
    }

    const last = bucket.items[bucket.items.length - 1];
    const mergeable =
      last &&
      last.action === e.action_type &&
      last.earliest.getTime() - at.getTime() <= MERGE_WINDOW_MS;

    if (mergeable) {
      last.count += 1;
      last.earliest = at;
    } else {
      bucket.items.push({ id: e.id, action: e.action_type, count: 1, latest: at, earliest: at });
    }
  }

  return days;
}

const COLLAPSED_COUNT = 6;

export default function ActivityFeed({ entries }: { entries: ActivityLogEntry[] }) {
  const [expanded, setExpanded] = useState(false);
  const days = useMemo(() => groupEntries(entries), [entries]);

  const totalGroups = days.reduce((n, d) => n + d.items.length, 0);

  // نقصّ على مستوى المجموعات (مش الأيام) عشان العدّ يبقى متوقّع
  const visible = useMemo(() => {
    if (expanded) return days;
    let left = COLLAPSED_COUNT;
    const out: typeof days = [];
    for (const d of days) {
      if (left <= 0) break;
      const items = d.items.slice(0, left);
      left -= items.length;
      out.push({ ...d, items });
    }
    return out;
  }, [days, expanded]);

  if (!entries.length) {
    return (
      <div className="activity-empty">
        <ActivityIcon size={19} />
        <span>No activity yet — your recent actions will show up here.</span>
      </div>
    );
  }

  let index = 0;

  return (
    <div className="activity-feed">
      {visible.map((day) => (
        <div key={day.day}>
          <div className="activity-day">
            <span>{dayLabel(day.date)}</span>
            <span className="activity-day-line" />
          </div>

          <div className="activity-rail">
            {day.items.map((g) => {
              const meta = metaFor(g.action);
              const i = index++;
              const range =
                g.count > 1 && hhmm(g.earliest) !== hhmm(g.latest)
                  ? `${hhmm(g.earliest)} – ${hhmm(g.latest)}`
                  : hhmm(g.latest);
              return (
                <div
                  key={g.id}
                  className="activity-row stagger-item"
                  style={{ "--stagger-index": i } as CSSProperties}
                  title={`${range} · ${g.latest.toLocaleDateString("en-GB")}`}
                >
                  <span className="activity-dot" style={{ color: meta.color, borderColor: meta.color }}>
                    {meta.icon}
                  </span>

                  <span className="activity-text">{meta.text(g.count)}</span>

                  {g.count > 1 && <span className="activity-badge num">×{g.count}</span>}

                  <span className="activity-time num" title={range}>
                    {relative(g.latest)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {totalGroups > COLLAPSED_COUNT && (
        <button className="activity-more" onClick={() => setExpanded((v) => !v)}>
          <ChevronDown size={13} className={expanded ? "activity-chevron open" : "activity-chevron"} />
          {expanded ? "Show less" : `Show ${totalGroups - COLLAPSED_COUNT} more`}
        </button>
      )}
    </div>
  );
}
