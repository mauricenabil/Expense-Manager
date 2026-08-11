import { invoke } from "@tauri-apps/api/core";
import type {
  Category,
  PaymentMethod,
  Expense,
  ExpenseWithDetails,
  DashboardSummary,
  SubCategory,
  Tag,
  Budget,
  SavingsGoal,
  RecurringExpense,
  ActivityLogEntry,
} from "../types";
import { isTauri } from "./platform";
import { mockApi } from "./mockApi";

/**
 * طبقة API موحّدة لكل صفحات التطبيق.
 *
 * - داخل تطبيق Tauri الحقيقي (Setup.exe / Portable.exe): تستخدم قاعدة بيانات
 *   SQLite الحقيقية عبر invoke() — هذا هو المصدر الوحيد للحقيقة في النسخة النهائية.
 * - داخل متصفح عادي (npm run dev للمعاينة فقط): تستخدم mockApi المعتمد على
 *   localStorage تلقائياً، بدون أي كود إضافي في الصفحات نفسها.
 *
 * أي صفحة في الواجهة تستورد `api` من هنا فقط، ولا تستدعي invoke() مباشرة أبداً.
 */
const realApi = {
  // ---------- Categories ----------
  getCategories: () => invoke<Category[]>("get_categories"),
  createCategory: (name: string, icon?: string, color?: string) =>
    invoke<string>("create_category", { name, icon, color }),
  updateCategory: (id: string, name: string, icon?: string, color?: string) =>
    invoke<void>("update_category", { id, name, icon, color }),
  deleteCategory: (id: string) => invoke<void>("delete_category", { id }),

  // ---------- Payment Methods ----------
  getPaymentMethods: () => invoke<PaymentMethod[]>("get_payment_methods"),
  createPaymentMethod: (name: string, icon?: string) =>
    invoke<string>("create_payment_method", { name, icon }),
  updatePaymentMethod: (id: string, name: string, icon?: string) =>
    invoke<void>("update_payment_method", { id, name, icon }),
  deletePaymentMethod: (id: string) => invoke<void>("delete_payment_method", { id }),

  // ---------- Sub Categories ----------
  getSubCategories: () => invoke<SubCategory[]>("get_sub_categories"),
  createSubCategory: (categoryId: string, name: string) =>
    invoke<string>("create_sub_category", { categoryId, name }),
  updateSubCategory: (id: string, name: string) =>
    invoke<void>("update_sub_category", { id, name }),
  deleteSubCategory: (id: string) => invoke<void>("delete_sub_category", { id }),

  // ---------- Tags ----------
  getTags: () => invoke<Tag[]>("get_tags"),
  createTag: (name: string) => invoke<string>("create_tag", { name }),
  deleteTag: (id: string) => invoke<void>("delete_tag", { id }),

  // ---------- Expenses ----------
  getExpenses: (limit = 100000, offset = 0) =>
    invoke<ExpenseWithDetails[]>("get_expenses", { limit, offset }),
  getDeletedExpenses: () => invoke<ExpenseWithDetails[]>("get_deleted_expenses"),
  addExpense: (expense: Partial<Expense>) =>
    invoke<string>("add_expense", {
      // نضمن وجود كل الحقول دائماً بقيم افتراضية صريحة (null وليس absent) قبل الإرسال لـ Rust.
      // السبب: Expense struct في Rust يستخدم Option<String> بدون #[serde(default)]،
      // فأي مفتاح غائب تماماً من الـ JSON (وليس حتى null) يفشّل الـ deserialization بالكامل.
      // هذا كان يسبب فشل كل صفوف الاستيراد رغم نجاح المتصفح (JS متسامح مع المفاتيح الغائبة).
      expense: {
        id: "",
        name: "",
        date: new Date().toISOString().slice(0, 10),
        amount: 0,
        category_id: null,
        sub_category_id: null,
        payment_method_id: null,
        description: null,
        ...expense,
      },
    }),
  updateExpense: (expense: Expense) =>
    invoke<void>("update_expense", {
      expense: {
        category_id: null,
        sub_category_id: null,
        payment_method_id: null,
        description: null,
        ...expense,
      },
    }),
  deleteExpense: (id: string) => invoke<void>("soft_delete_expense", { id }),
  restoreExpense: (id: string) => invoke<void>("restore_expense", { id }),
  permanentlyDeleteExpense: (id: string) => invoke<void>("permanently_delete_expense", { id }),

  // ---------- Dashboard ----------
  getDashboardSummary: () => invoke<DashboardSummary>("get_dashboard_summary"),

  // ---------- Security ----------
  isPasswordEnabled: () => invoke<boolean>("is_password_enabled"),
  setPassword: (newPassword: string) => invoke<string>("set_password", { newPassword }),
  verifyPassword: (password: string) => invoke<boolean>("verify_password", { password }),
  resetPasswordWithRecoveryCode: (recoveryCode: string, newPassword: string) =>
    invoke<string>("reset_password_with_recovery_code", { recoveryCode, newPassword }),
  disablePassword: () => invoke<void>("disable_password"),
  getAutoLockMinutes: () => invoke<number | null>("get_auto_lock_minutes"),
  setAutoLockMinutes: (minutes: number | null) => invoke<void>("set_auto_lock_minutes", { minutes }),

  // ---------- Budgets ----------
  getBudgets: () => invoke<Budget[]>("get_budgets"),
  setBudget: (categoryId: string | null, amount: number, period: "monthly" | "yearly") =>
    invoke<string>("set_budget", { categoryId, amount, period }),
  deleteBudget: (id: string) => invoke<void>("delete_budget", { id }),
  toggleBudgetPin: (id: string, pinned: boolean) => invoke<void>("toggle_budget_pin", { id, pinned }),
  isBudgetsEnabled: () => invoke<boolean>("is_budgets_enabled"),
  setBudgetsEnabled: (enabled: boolean) => invoke<void>("set_budgets_enabled", { enabled }),

  // ---------- Savings Goals ----------
  getSavingsGoals: () => invoke<SavingsGoal[]>("get_savings_goals"),
  createSavingsGoal: (name: string, targetAmount: number, targetDate?: string) =>
    invoke<string>("create_savings_goal", { name, targetAmount, targetDate }),
  updateSavingsGoalProgress: (id: string, currentAmount: number) =>
    invoke<void>("update_savings_goal_progress", { id, currentAmount }),
  deleteSavingsGoal: (id: string) => invoke<void>("delete_savings_goal", { id }),
  toggleSavingsGoalPin: (id: string, pinned: boolean) => invoke<void>("toggle_savings_goal_pin", { id, pinned }),

  // ---------- Recurring Expenses ----------
  getRecurringExpenses: () => invoke<RecurringExpense[]>("get_recurring_expenses"),
  createRecurringExpense: (
    name: string, amount: number, categoryId: string | null,
    paymentMethodId: string | null, frequency: string, startDate: string
  ) => invoke<string>("create_recurring_expense", { name, amount, categoryId, paymentMethodId, frequency, startDate }),
  confirmRecurringExpense: (recurringId: string, date: string) =>
    invoke<string>("confirm_recurring_expense", { recurringId, date }),
  deleteRecurringExpense: (id: string) => invoke<void>("delete_recurring_expense", { id }),

  // ---------- Activity Log ----------
  getActivityLog: (limit = 100) => invoke<ActivityLogEntry[]>("get_activity_log", { limit }),

  // ---------- Backup & Restore ----------
  exportBackupJson: () => invoke<string>("export_backup_json"),
  importBackupJson: (jsonData: string) => invoke<void>("import_backup_json", { jsonData }),
  deleteAllData: () => invoke<void>("delete_all_data"),

  // ---------- Backup Location & File System ----------
  pickBackupFolder: () => invoke<string | null>("pick_backup_folder"),
  openFolderInExplorer: (path: string) => invoke<void>("open_folder_in_explorer", { path }),
  checkFolderWritable: (path: string) => invoke<boolean>("check_folder_writable", { path }),
  writeBackupFile: (folder: string, filename: string, content: number[]) =>
    invoke<string>("write_backup_file", { folder, filename, content }),
  getAppSetting: (key: string) => invoke<string | null>("get_app_setting", { key }),
  setAppSetting: (key: string, value: string) => invoke<void>("set_app_setting", { key, value }),
  closeSplashscreen: () => invoke<void>("close_splashscreen"),
};

export const api = isTauri() ? realApi : mockApi;

/** علم صريح تستخدمه أي صفحة لو احتاجت تنبيه المستخدم إنه في وضع المعاينة */
export const isPreviewMode = !isTauri();
