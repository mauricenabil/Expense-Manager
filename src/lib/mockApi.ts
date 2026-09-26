import type {
  Category,
  PaymentMethod,
  Expense,
  ExpenseWithDetails,
  DashboardSummary,
  SubCategory,
  Tag,
  PlannedPurchase,
  PlannedPurchaseInput,
} from "../types";
import { APP_VERSION } from "./version";

/**
 * Mock Backend — يُستخدم فقط عند التشغيل في متصفح عادي (npm run dev بدون Tauri).
 * نفس الشكل والسلوك بالضبط مثل قاعدة بيانات SQLite الحقيقية، لكن مخزّن في localStorage.
 * هذا يسمح بمعاينة كل صفحات التطبيق فعلياً أثناء التطوير بدون الحاجة لبناء تطبيق Tauri.
 *
 * ملاحظة: هذه البيانات تجريبية فقط للمعاينة، ولا علاقة لها بقاعدة البيانات
 * الحقيقية (SQLite) المستخدمة في النسخة النهائية لسطح المكتب.
 */

const DB_KEY = "expense-manager-mock-db";

interface MockDB {
  categories: Category[];
  subCategories: SubCategory[];
  paymentMethods: PaymentMethod[];
  tags: Tag[];
  expenses: (Expense & { created_at: string; deleted_at: string | null })[];
  security: { password_hash: string | null; password_enabled: boolean; auto_lock_minutes: number | null; recovery_code_hash: string | null };
  budgets: { id: string; category_id: string | null; amount: number; period: "monthly" | "yearly"; pinned: boolean }[];
  budgetsEnabled: boolean;
  savingsGoals: { id: string; name: string; target_amount: number; current_amount: number; target_date: string | null; pinned: boolean }[];
  recurringExpenses: {
    id: string; name: string; amount: number; category_id: string | null;
    payment_method_id: string | null; frequency: "daily" | "weekly" | "monthly" | "yearly";
    next_due_date: string; is_active: boolean;
  }[];
  activityLog: { id: string; action_type: string; table_name: string | null; created_at: string }[];
  plannedPurchases: (PlannedPurchase & { deleted_at: string | null })[];
}

const DEFAULT_DB: MockDB = {
  categories: [
    { id: "cat-food", name: "Food & Dining", icon: "utensils", color: "#ED6F50", sort_order: 1 },
    { id: "cat-transport", name: "Transportation", icon: "car", color: "#5B8FD9", sort_order: 2 },
    { id: "cat-bills", name: "Bills & Utilities", icon: "receipt", color: "#D6A032", sort_order: 3 },
    { id: "cat-shopping", name: "Shopping", icon: "shopping-bag", color: "#A46FB0", sort_order: 4 },
    { id: "cat-health", name: "Health", icon: "heart-pulse", color: "#D4564A", sort_order: 5 },
    { id: "cat-entertain", name: "Entertainment", icon: "film", color: "#3FA9A0", sort_order: 6 },
    { id: "cat-other", name: "Other", icon: "tag", color: "#8A93A6", sort_order: 8 },
  ],
  subCategories: [
    { id: "sub-groceries", category_id: "cat-food", name: "Groceries" },
    { id: "sub-restaurants", category_id: "cat-food", name: "Restaurants" },
    { id: "sub-fuel", category_id: "cat-transport", name: "Fuel" },
  ],
  paymentMethods: [
    { id: "pm-cash", name: "Cash", icon: "banknote" },
    { id: "pm-wallet", name: "Mobile Wallet", icon: "smartphone" },
    { id: "pm-visa", name: "Visa / Card", icon: "credit-card" },
    { id: "pm-bank", name: "Bank Transfer", icon: "building-2" },
  ],
  tags: [
    { id: "tag-urgent", name: "Urgent" },
    { id: "tag-recurring", name: "Recurring" },
  ],
  expenses: [],
  security: { password_hash: null, password_enabled: false, auto_lock_minutes: null, recovery_code_hash: null },
  budgets: [],
  budgetsEnabled: false,
  savingsGoals: [],
  recurringExpenses: [],
  activityLog: [],
  plannedPurchases: [],
};

function loadDB(): MockDB {
  const raw = localStorage.getItem(DB_KEY);
  if (!raw) {
    localStorage.setItem(DB_KEY, JSON.stringify(DEFAULT_DB));
    return structuredClone(DEFAULT_DB);
  }
  const db = JSON.parse(raw) as MockDB;
  // قواعد بيانات المعاينة المحفوظة قبل هذه الميزة لا تحتوي المفتاح الجديد،
  // فنضيفه هنا بدل ما تنفجر الصفحة على undefined.
  if (!db.plannedPurchases) db.plannedPurchases = [];
  return db;
}

function saveDB(db: MockDB) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

const uuid = () => crypto.randomUUID();
const delay = <T>(value: T) => new Promise<T>((res) => setTimeout(() => res(value), 80));

function generateRecoveryCode(): string {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const part = (len: number) => Array.from({ length: len }, () => charset[Math.floor(Math.random() * charset.length)]).join("");
  return `${part(6)}-${part(6)}`;
}

export const mockApi = {
  // ---------- Planned Purchases ----------
  getPlannedPurchases: () => {
    const db = loadDB();
    return delay(
      db.plannedPurchases
        .filter((p) => !p.deleted_at)
        .map((p) => ({
          ...p,
          category_name: db.categories.find((c) => c.id === p.category_id)?.name ?? null,
          category_color: db.categories.find((c) => c.id === p.category_id)?.color ?? null,
          payment_method_name: db.paymentMethods.find((m) => m.id === p.payment_method_id)?.name ?? null,
        }))
        .sort((a, b) => {
          const rank = (s: string) => (s === "planned" ? 0 : s === "purchased" ? 1 : 2);
          return rank(a.status) - rank(b.status)
            || b.priority - a.priority
            || (a.target_date ?? "9999-12-31").localeCompare(b.target_date ?? "9999-12-31");
        })
    );
  },
  createPlannedPurchase: (input: PlannedPurchaseInput) => {
    const db = loadDB();
    const id = uuid();
    db.plannedPurchases.push({
      id,
      name: input.name.trim(),
      estimated_amount: input.estimated_amount,
      category_id: input.category_id,
      payment_method_id: input.payment_method_id,
      target_date: input.target_date,
      priority: input.priority,
      notes: input.notes,
      status: "planned",
      converted_expense_id: null,
      purchased_at: null,
      created_at: new Date().toISOString(),
      deleted_at: null,
    });
    saveDB(db);
    return delay(id);
  },
  updatePlannedPurchase: (id: string, input: PlannedPurchaseInput) => {
    const db = loadDB();
    const p = db.plannedPurchases.find((x) => x.id === id);
    if (!p) throw new Error("That plan no longer exists.");
    if (p.status === "purchased")
      throw new Error("This plan was already converted to an expense. Edit the expense instead.");
    Object.assign(p, input);
    saveDB(db);
    return delay(undefined);
  },
  convertPlannedToExpense: (id: string, date: string, actualAmount: number | null) => {
    const db = loadDB();
    const p = db.plannedPurchases.find((x) => x.id === id);
    if (!p) throw new Error("That plan no longer exists.");
    if (p.status === "purchased") throw new Error("This plan was already converted to an expense.");
    const expenseId = uuid();
    db.expenses.push({
      id: expenseId,
      name: p.name,
      date,
      amount: actualAmount ?? p.estimated_amount,
      category_id: p.category_id ?? null,
      sub_category_id: null,
      payment_method_id: p.payment_method_id ?? null,
      description: "Converted from a planned purchase",
      created_at: new Date().toISOString(),
      deleted_at: null,
    });
    p.status = "purchased";
    p.converted_expense_id = expenseId;
    p.purchased_at = new Date().toISOString();
    db.activityLog.unshift({ id: uuid(), action_type: "planned_converted", table_name: "planned_purchases", created_at: new Date().toISOString() });
    saveDB(db);
    return delay(expenseId);
  },
  cancelPlannedPurchase: (id: string) => {
    const db = loadDB();
    const p = db.plannedPurchases.find((x) => x.id === id);
    if (p && p.status === "planned") p.status = "cancelled";
    saveDB(db);
    return delay(undefined);
  },
  restorePlannedPurchase: (id: string) => {
    const db = loadDB();
    const p = db.plannedPurchases.find((x) => x.id === id);
    if (p && p.status === "cancelled") p.status = "planned";
    saveDB(db);
    return delay(undefined);
  },
  deletePlannedPurchase: (id: string) => {
    const db = loadDB();
    const p = db.plannedPurchases.find((x) => x.id === id);
    if (p) p.deleted_at = new Date().toISOString();
    saveDB(db);
    return delay(undefined);
  },

  // ---------- Categories ----------
  getCategories: () => delay(loadDB().categories),
  createCategory: (name: string, icon?: string, color?: string) => {
    const db = loadDB();
    const id = uuid();
    db.categories.push({ id, name, icon, color, sort_order: db.categories.length + 1 });
    saveDB(db);
    return delay(id);
  },
  updateCategory: (id: string, name: string, icon?: string, color?: string) => {
    const db = loadDB();
    const cat = db.categories.find((c) => c.id === id);
    if (cat) Object.assign(cat, { name, icon, color });
    saveDB(db);
    return delay(undefined);
  },
  deleteCategory: (id: string) => {
    const db = loadDB();
    db.categories = db.categories.filter((c) => c.id !== id);
    saveDB(db);
    return delay(undefined);
  },

  // ---------- Payment Methods ----------
  getPaymentMethods: () => delay(loadDB().paymentMethods),
  createPaymentMethod: (name: string, icon?: string) => {
    const db = loadDB();
    const id = uuid();
    db.paymentMethods.push({ id, name, icon });
    saveDB(db);
    return delay(id);
  },
  updatePaymentMethod: (id: string, name: string, icon?: string) => {
    const db = loadDB();
    const pm = db.paymentMethods.find((p) => p.id === id);
    if (pm) Object.assign(pm, { name, icon });
    saveDB(db);
    return delay(undefined);
  },
  deletePaymentMethod: (id: string) => {
    const db = loadDB();
    db.paymentMethods = db.paymentMethods.filter((p) => p.id !== id);
    saveDB(db);
    return delay(undefined);
  },

  // ---------- Sub Categories ----------
  getSubCategories: () => delay(loadDB().subCategories),
  createSubCategory: (categoryId: string, name: string) => {
    const db = loadDB();
    const id = uuid();
    db.subCategories.push({ id, category_id: categoryId, name });
    saveDB(db);
    return delay(id);
  },
  updateSubCategory: (id: string, name: string) => {
    const db = loadDB();
    const sc = db.subCategories.find((s) => s.id === id);
    if (sc) sc.name = name;
    saveDB(db);
    return delay(undefined);
  },
  deleteSubCategory: (id: string) => {
    const db = loadDB();
    db.subCategories = db.subCategories.filter((s) => s.id !== id);
    saveDB(db);
    return delay(undefined);
  },

  // ---------- Tags ----------
  getTags: () => delay(loadDB().tags),
  createTag: (name: string) => {
    const db = loadDB();
    const existing = db.tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (existing) return delay(existing.id);
    const id = uuid();
    db.tags.push({ id, name });
    saveDB(db);
    return delay(id);
  },
  deleteTag: (id: string) => {
    const db = loadDB();
    db.tags = db.tags.filter((t) => t.id !== id);
    saveDB(db);
    return delay(undefined);
  },

  // ---------- Expenses ----------
  getExpenses: (limit = 100000, offset = 0): Promise<ExpenseWithDetails[]> => {
    const db = loadDB();
    const result = db.expenses
      .filter((e) => !e.deleted_at)
      // نفس ترتيب get_expenses الحقيقي في الـ backend: التاريخ تنازلياً، وعند
      // تساوي التاريخ يُفصَل بينهما بوقت الإنشاء الفعلي تنازلياً (الأحدث أولاً).
      .sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        if (a.created_at !== b.created_at) return a.created_at < b.created_at ? 1 : -1;
        return 0;
      })
      .slice(offset, offset + limit)
      .map((e) => {
        const cat = db.categories.find((c) => c.id === e.category_id);
        const pm = db.paymentMethods.find((p) => p.id === e.payment_method_id);
        return {
          id: e.id,
          name: e.name,
          date: e.date,
          amount: e.amount,
          category_id: e.category_id ?? null,
          category_name: cat?.name ?? null,
          category_color: cat?.color ?? null,
          sub_category_id: e.sub_category_id ?? null,
          payment_method_id: e.payment_method_id ?? null,
          payment_method_name: pm?.name ?? null,
          description: e.description ?? null,
          tag_ids: e.tag_ids ?? [],
          created_at: e.created_at,
        };
      });
    return delay(result);
  },
  addExpense: (expense: Partial<Expense>) => {
    const db = loadDB();
    const id = expense.id || uuid();
    db.expenses.push({
      id,
      name: expense.name ?? "",
      date: expense.date ?? new Date().toISOString().slice(0, 10),
      amount: expense.amount ?? 0,
      category_id: expense.category_id ?? null,
      sub_category_id: expense.sub_category_id ?? null,
      payment_method_id: expense.payment_method_id ?? null,
      description: expense.description ?? null,
      tag_ids: expense.tag_ids ?? [],
      created_at: new Date().toISOString(),
      deleted_at: null,
    });
    saveDB(db);
    return delay(id);
  },
  updateExpense: (expense: Expense) => {
    const db = loadDB();
    const existing = db.expenses.find((e) => e.id === expense.id);
    if (existing) Object.assign(existing, expense);
    saveDB(db);
    return delay(undefined);
  },
  deleteExpense: (id: string) => {
    const db = loadDB();
    const e = db.expenses.find((x) => x.id === id);
    if (e) e.deleted_at = new Date().toISOString();
    saveDB(db);
    return delay(undefined);
  },
  restoreExpense: (id: string) => {
    const db = loadDB();
    const e = db.expenses.find((x) => x.id === id);
    if (e) e.deleted_at = null;
    saveDB(db);
    return delay(undefined);
  },

  // ---------- Dashboard ----------
  getDashboardSummary: (): Promise<DashboardSummary> => {
    const db = loadDB();
    const today = new Date().toISOString().slice(0, 10);
    const thisMonth = today.slice(0, 7);
    const active = db.expenses.filter((e) => !e.deleted_at);

    const totalToday = active.filter((e) => e.date === today).reduce((s, e) => s + e.amount, 0);
    const monthExpenses = active.filter((e) => e.date.slice(0, 7) === thisMonth);
    const totalMonth = monthExpenses.reduce((s, e) => s + e.amount, 0);
    const totalYear = active
      .filter((e) => e.date.slice(0, 4) === today.slice(0, 4))
      .reduce((s, e) => s + e.amount, 0);

    const dayOfMonth = new Date().getDate();
    const biggest = monthExpenses.reduce((m, e) => Math.max(m, e.amount), 0);

    const byCategory: Record<string, number> = {};
    monthExpenses.forEach((e) => {
      if (e.category_id) byCategory[e.category_id] = (byCategory[e.category_id] || 0) + e.amount;
    });
    const topCatId = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0]?.[0];
    const topCategory = db.categories.find((c) => c.id === topCatId)?.name ?? null;

    return delay({
      total_today: totalToday,
      total_this_month: totalMonth,
      total_this_year: totalYear,
      expense_count_this_month: monthExpenses.length,
      daily_average: dayOfMonth > 0 ? totalMonth / dayOfMonth : 0,
      biggest_expense: biggest,
      top_category: topCategory,
    });
  },

  // ---------- Security ----------
  isPasswordEnabled: () => delay(loadDB().security.password_enabled),
  setPassword: (newPassword: string) => {
    const db = loadDB();
    const code = generateRecoveryCode();
    // في المعاينة بالمتصفح فقط: تخزين بسيط بدون Argon2 (التشفير الحقيقي في Rust فقط)
    db.security = { password_hash: btoa(newPassword), password_enabled: true, auto_lock_minutes: db.security.auto_lock_minutes, recovery_code_hash: btoa(code) };
    saveDB(db);
    return delay(code);
  },
  verifyPassword: (password: string) => {
    const db = loadDB();
    if (!db.security.password_enabled) return delay(true);
    return delay(db.security.password_hash === btoa(password));
  },
  resetPasswordWithRecoveryCode: (recoveryCode: string, newPassword: string) => {
    const db = loadDB();
    if (db.security.recovery_code_hash !== btoa(recoveryCode.trim().toUpperCase())) {
      return Promise.reject("Invalid recovery code.");
    }
    const newCode = generateRecoveryCode();
    db.security = { ...db.security, password_hash: btoa(newPassword), recovery_code_hash: btoa(newCode) };
    saveDB(db);
    return delay(newCode);
  },
  disablePassword: () => {
    const db = loadDB();
    db.security = { password_hash: null, password_enabled: false, auto_lock_minutes: db.security.auto_lock_minutes, recovery_code_hash: null };
    saveDB(db);
    return delay(undefined);
  },
  getAutoLockMinutes: () => delay(loadDB().security.auto_lock_minutes),
  setAutoLockMinutes: (minutes: number | null) => {
    const db = loadDB();
    db.security.auto_lock_minutes = minutes;
    saveDB(db);
    return delay(undefined);
  },

  // ---------- Deleted Expenses (Recycle Bin) ----------
  getDeletedExpenses: (): Promise<ExpenseWithDetails[]> => {
    const db = loadDB();
    const result = db.expenses
      .filter((e) => !!e.deleted_at)
      .map((e) => {
        const cat = db.categories.find((c) => c.id === e.category_id);
        const pm = db.paymentMethods.find((p) => p.id === e.payment_method_id);
        return {
          id: e.id, name: e.name, date: e.date, amount: e.amount,
          category_id: e.category_id ?? null, category_name: cat?.name ?? null, category_color: cat?.color ?? null,
          sub_category_id: e.sub_category_id ?? null,
          payment_method_id: e.payment_method_id ?? null, payment_method_name: pm?.name ?? null,
          description: e.description ?? null,
          created_at: e.created_at,
        };
      });
    return delay(result);
  },
  permanentlyDeleteExpense: (id: string) => {
    const db = loadDB();
    db.expenses = db.expenses.filter((e) => e.id !== id);
    saveDB(db);
    return delay(undefined);
  },

  // ---------- Budgets ----------
  getBudgets: () => {
    const db = loadDB();
    return delay(
      db.budgets.map((b) => ({
        ...b,
        category_name: db.categories.find((c) => c.id === b.category_id)?.name ?? null,
      }))
    );
  },
  setBudget: (categoryId: string | null, amount: number, period: "monthly" | "yearly") => {
    const db = loadDB();
    const id = uuid();
    db.budgets.push({ id, category_id: categoryId, amount, period, pinned: false });
    saveDB(db);
    return delay(id);
  },
  deleteBudget: (id: string) => {
    const db = loadDB();
    db.budgets = db.budgets.filter((b) => b.id !== id);
    saveDB(db);
    return delay(undefined);
  },
  toggleBudgetPin: (id: string, pinned: boolean) => {
    const db = loadDB();
    const b = db.budgets.find((b) => b.id === id);
    if (b) b.pinned = pinned;
    saveDB(db);
    return delay(undefined);
  },
  isBudgetsEnabled: () => delay(loadDB().budgetsEnabled),
  setBudgetsEnabled: (enabled: boolean) => {
    const db = loadDB();
    db.budgetsEnabled = enabled;
    saveDB(db);
    return delay(undefined);
  },

  // ---------- Savings Goals ----------
  getSavingsGoals: () => delay(loadDB().savingsGoals),
  createSavingsGoal: (name: string, targetAmount: number, targetDate?: string) => {
    const db = loadDB();
    const id = uuid();
    db.savingsGoals.push({ id, name, target_amount: targetAmount, current_amount: 0, target_date: targetDate ?? null, pinned: false });
    saveDB(db);
    return delay(id);
  },
  updateSavingsGoalProgress: (id: string, currentAmount: number) => {
    const db = loadDB();
    const g = db.savingsGoals.find((g) => g.id === id);
    if (g) g.current_amount = currentAmount;
    saveDB(db);
    return delay(undefined);
  },
  deleteSavingsGoal: (id: string) => {
    const db = loadDB();
    db.savingsGoals = db.savingsGoals.filter((g) => g.id !== id);
    saveDB(db);
    return delay(undefined);
  },
  toggleSavingsGoalPin: (id: string, pinned: boolean) => {
    const db = loadDB();
    const g = db.savingsGoals.find((g) => g.id === id);
    if (g) g.pinned = pinned;
    saveDB(db);
    return delay(undefined);
  },

  // ---------- Recurring Expenses ----------
  getRecurringExpenses: () => delay(loadDB().recurringExpenses),
  createRecurringExpense: (
    name: string, amount: number, categoryId: string | null,
    paymentMethodId: string | null, frequency: string, startDate: string
  ) => {
    const db = loadDB();
    const id = uuid();
    db.recurringExpenses.push({
      id, name, amount, category_id: categoryId, payment_method_id: paymentMethodId,
      frequency: frequency as any, next_due_date: startDate, is_active: true,
    });
    saveDB(db);
    return delay(id);
  },
  confirmRecurringExpense: (recurringId: string, date: string) => {
    const db = loadDB();
    const r = db.recurringExpenses.find((x) => x.id === recurringId);
    if (!r) return delay("");
    const expenseId = uuid();
    db.expenses.push({
      id: expenseId, name: r.name, date, amount: r.amount,
      category_id: r.category_id, payment_method_id: r.payment_method_id,
      description: null, created_at: new Date().toISOString(), deleted_at: null,
    });
    const d = new Date(r.next_due_date);
    if (r.frequency === "daily") d.setDate(d.getDate() + 1);
    else if (r.frequency === "weekly") d.setDate(d.getDate() + 7);
    else if (r.frequency === "monthly") d.setMonth(d.getMonth() + 1);
    else d.setFullYear(d.getFullYear() + 1);
    r.next_due_date = d.toISOString().slice(0, 10);
    saveDB(db);
    return delay(expenseId);
  },
  deleteRecurringExpense: (id: string) => {
    const db = loadDB();
    db.recurringExpenses = db.recurringExpenses.filter((r) => r.id !== id);
    saveDB(db);
    return delay(undefined);
  },

  // ---------- Activity Log ----------
  getActivityLog: (limit = 100) => delay(loadDB().activityLog.slice(0, limit)),

  // ---------- Backup & Restore ----------
  exportBackupJson: () => {
    const db = loadDB();
    return delay(JSON.stringify({ version: 1, exported_at: new Date().toISOString(), ...db }, null, 2));
  },
  importBackupJson: (jsonData: string) => {
    const parsed = JSON.parse(jsonData);
    saveDB({ ...DEFAULT_DB, ...parsed });
    return delay(undefined);
  },
  deleteAllData: () => {
    saveDB(structuredClone(DEFAULT_DB));
    return delay(undefined);
  },

  // ---------- Backup Location & File System (محاكاة فقط — المتصفح لا يقدر يكتب لمجلد حقيقي) ----------
  pickBackupFolder: () => {
    // في المتصفح: مفيش Folder Picker حقيقي، فقط محاكاة لتجربة الواجهة أثناء التطوير
    return delay("C:\\Users\\User\\Documents\\Expense Manager Backups (Preview Mode)");
  },
  openFolderInExplorer: () => delay(undefined),
  checkFolderWritable: () => delay(true),
  writeBackupFile: (_folder: string, filename: string) => delay(filename),
  getAppSetting: (key: string) => {
    return delay(localStorage.getItem(`expense-manager-setting-${key}`));
  },
  setAppSetting: (key: string, value: string) => {
    localStorage.setItem(`expense-manager-setting-${key}`, value);
    return delay(undefined);
  },
  closeSplashscreen: () => delay(undefined), // لا نافذة splash فعلية في وضع المعاينة بالمتصفح

  // ---------- Offline Update (محاكاة — المتصفح ما يقدرش يشغّل مثبّت ويندوز) ----------
  getAppPaths: () =>
    delay({
      version: APP_VERSION,
      app_data_dir: "C:\\Users\\User\\AppData\\Roaming\\com.personal.expensemanager (Preview Mode)",
      db_path: "C:\\Users\\User\\AppData\\Roaming\\com.personal.expensemanager\\expenses.db (Preview Mode)",
      exe_path: "(Preview Mode)",
      install_dir: "C:\\Program Files\\Expense Manager (Preview Mode)",
    }),
  pickUpdateFile: () =>
    Promise.reject(new Error("Choosing an update file only works in the desktop app.")),
  inspectUpdateFile: () =>
    Promise.reject(new Error("Update files can only be inspected in the desktop app.")),
  runUpdateInstaller: () =>
    Promise.reject(new Error("The installer can only be launched from the desktop app.")),
};
