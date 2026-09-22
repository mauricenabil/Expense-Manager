import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../lib/api";
import type {
  Category, SubCategory, PaymentMethod, Tag, Expense, ExpenseWithDetails,
  Budget, SavingsGoal, RecurringExpense, ActivityLogEntry, DashboardSummary,
  PlannedPurchase, PlannedPurchaseInput,
} from "../types";

interface StoreState {
  loading: boolean;
  expenses: ExpenseWithDetails[];
  deletedExpenses: ExpenseWithDetails[];
  categories: Category[];
  subCategories: SubCategory[];
  paymentMethods: PaymentMethod[];
  tags: Tag[];
  budgets: Budget[];
  budgetsEnabled: boolean;
  savingsGoals: SavingsGoal[];
  recurringExpenses: RecurringExpense[];
  activityLog: ActivityLogEntry[];
  dashboardSummary: DashboardSummary | null;
  plannedPurchases: PlannedPurchase[];
}

interface StoreActions {
  reloadAll: () => Promise<void>;

  addExpense: (e: Partial<Expense>) => Promise<string>;
  updateExpense: (e: Expense) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  restoreExpense: (id: string) => Promise<void>;
  permanentlyDeleteExpense: (id: string) => Promise<void>;

  createCategory: (name: string, icon?: string, color?: string) => Promise<string>;
  updateCategory: (id: string, name: string, icon?: string, color?: string) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;

  createSubCategory: (categoryId: string, name: string) => Promise<string>;
  updateSubCategory: (id: string, name: string) => Promise<void>;
  deleteSubCategory: (id: string) => Promise<void>;

  createPaymentMethod: (name: string, icon?: string) => Promise<string>;
  updatePaymentMethod: (id: string, name: string, icon?: string) => Promise<void>;
  deletePaymentMethod: (id: string) => Promise<void>;

  createTag: (name: string) => Promise<string>;
  deleteTag: (id: string) => Promise<void>;

  setBudget: (categoryId: string | null, amount: number, period: "monthly" | "yearly") => Promise<string>;
  deleteBudget: (id: string) => Promise<void>;
  toggleBudgetPin: (id: string, pinned: boolean) => Promise<void>;
  setBudgetsEnabled: (enabled: boolean) => Promise<void>;

  createSavingsGoal: (name: string, targetAmount: number, targetDate?: string) => Promise<string>;
  updateSavingsGoalProgress: (id: string, currentAmount: number) => Promise<void>;
  deleteSavingsGoal: (id: string) => Promise<void>;
  toggleSavingsGoalPin: (id: string, pinned: boolean) => Promise<void>;

  createRecurringExpense: (name: string, amount: number, categoryId: string | null, paymentMethodId: string | null, frequency: string, startDate: string) => Promise<string>;
  confirmRecurringExpense: (recurringId: string, date: string) => Promise<string>;
  deleteRecurringExpense: (id: string) => Promise<void>;

  createPlannedPurchase: (input: PlannedPurchaseInput) => Promise<string>;
  updatePlannedPurchase: (id: string, input: PlannedPurchaseInput) => Promise<void>;
  convertPlannedToExpense: (id: string, date: string, actual: number | null) => Promise<string>;
  cancelPlannedPurchase: (id: string) => Promise<void>;
  restorePlannedPurchase: (id: string) => Promise<void>;
  deletePlannedPurchase: (id: string) => Promise<void>;

  importBackupJson: (json: string) => Promise<void>;
  importExpensesBulk: (rows: Partial<Expense>[]) => Promise<{ count: number; failed: number }>;
  deleteAllData: () => Promise<void>;
}

type StoreValue = StoreState & StoreActions;

const DataStoreContext = createContext<StoreValue | null>(null);

const EMPTY_SUMMARY: DashboardSummary = {
  total_today: 0, total_this_month: 0, total_this_year: 0,
  expense_count_this_month: 0, daily_average: 0, biggest_expense: 0, top_category: null,
};

export function DataStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StoreState>({
    loading: true,
    expenses: [], deletedExpenses: [], categories: [], subCategories: [],
    paymentMethods: [], tags: [], budgets: [], budgetsEnabled: false,
    savingsGoals: [], recurringExpenses: [], activityLog: [], dashboardSummary: null,
    plannedPurchases: [],
  });

  // ------------------------------------------------------------
  // تحميل كامل لكل البيانات — يُستخدم عند بدء التشغيل وبعد أي
  // عملية شاملة (استرجاع Backup، حذف كل البيانات)
  // ------------------------------------------------------------
  const reloadAll = useCallback(async () => {
    const [
      expenses, deletedExpenses, categories, subCategories, paymentMethods, tags,
      budgets, budgetsEnabled, savingsGoals, recurringExpenses, activityLog, dashboardSummary,
      plannedPurchases,
    ] = await Promise.all([
      api.getExpenses(), api.getDeletedExpenses(), api.getCategories(), api.getSubCategories(),
      api.getPaymentMethods(), api.getTags(), api.getBudgets(), api.isBudgetsEnabled(),
      api.getSavingsGoals(), api.getRecurringExpenses(), api.getActivityLog(20),
      api.getDashboardSummary().catch(() => EMPTY_SUMMARY),
      api.getPlannedPurchases(),
    ]);
    setState({
      loading: false, expenses, deletedExpenses, categories, subCategories, paymentMethods, tags,
      budgets, budgetsEnabled, savingsGoals, recurringExpenses, activityLog, dashboardSummary,
      plannedPurchases,
    });
  }, []);

  useEffect(() => { reloadAll(); }, [reloadAll]);

  // ------------------------------------------------------------
  // Helpers: إعادة تحميل جزء معيّن فقط من الـ Store بعد عملية كتابة
  // (أسرع من إعادة تحميل كل شيء، وكافٍ لحجم بيانات تطبيق شخصي)
  // ------------------------------------------------------------
  const refreshExpenses = useCallback(async () => {
    const [expenses, deletedExpenses, dashboardSummary, activityLog] = await Promise.all([
      api.getExpenses(), api.getDeletedExpenses(),
      api.getDashboardSummary().catch(() => EMPTY_SUMMARY), api.getActivityLog(20),
    ]);
    setState((s) => ({ ...s, expenses, deletedExpenses, dashboardSummary, activityLog }));
  }, []);

  const refreshCategories = useCallback(async () => {
    const [categories, expenses] = await Promise.all([api.getCategories(), api.getExpenses()]);
    setState((s) => ({ ...s, categories, expenses }));
  }, []);

  const refreshSubCategories = useCallback(async () => {
    setState((s) => ({ ...s }));
    const subCategories = await api.getSubCategories();
    setState((s) => ({ ...s, subCategories }));
  }, []);

  const refreshPaymentMethods = useCallback(async () => {
    const [paymentMethods, expenses] = await Promise.all([api.getPaymentMethods(), api.getExpenses()]);
    setState((s) => ({ ...s, paymentMethods, expenses }));
  }, []);

  const refreshTags = useCallback(async () => {
    const tags = await api.getTags();
    setState((s) => ({ ...s, tags }));
  }, []);

  const refreshBudgets = useCallback(async () => {
    const [budgets, budgetsEnabled] = await Promise.all([api.getBudgets(), api.isBudgetsEnabled()]);
    setState((s) => ({ ...s, budgets, budgetsEnabled }));
  }, []);

  const refreshSavingsGoals = useCallback(async () => {
    const savingsGoals = await api.getSavingsGoals();
    setState((s) => ({ ...s, savingsGoals }));
  }, []);

  const refreshRecurring = useCallback(async () => {
    const recurringExpenses = await api.getRecurringExpenses();
    setState((s) => ({ ...s, recurringExpenses }));
  }, []);

  const refreshPlanned = useCallback(async () => {
    const plannedPurchases = await api.getPlannedPurchases();
    setState((s) => ({ ...s, plannedPurchases }));
  }, []);

  // ------------------------------------------------------------
  // Actions — كل عملية كتابة تنادي الـ API الحقيقي، وبعدين تحدّث
  // الـ Store المشترك فوراً، فكل مكوّن مستمع يتحدّث لحظياً
  // ------------------------------------------------------------
  const actions: StoreActions = useMemo(() => ({
    reloadAll,

    addExpense: async (e) => { const id = await api.addExpense(e); await refreshExpenses(); return id; },
    updateExpense: async (e) => { await api.updateExpense(e); await refreshExpenses(); },
    deleteExpense: async (id) => { await api.deleteExpense(id); await refreshExpenses(); },
    restoreExpense: async (id) => { await api.restoreExpense(id); await refreshExpenses(); },
    permanentlyDeleteExpense: async (id) => { await api.permanentlyDeleteExpense(id); await refreshExpenses(); },

    createCategory: async (name, icon, color) => { const id = await api.createCategory(name, icon, color); await refreshCategories(); return id; },
    updateCategory: async (id, name, icon, color) => { await api.updateCategory(id, name, icon, color); await refreshCategories(); },
    deleteCategory: async (id) => { await api.deleteCategory(id); await refreshCategories(); },

    createSubCategory: async (categoryId, name) => { const id = await api.createSubCategory(categoryId, name); await refreshSubCategories(); return id; },
    updateSubCategory: async (id, name) => { await api.updateSubCategory(id, name); await refreshSubCategories(); },
    deleteSubCategory: async (id) => { await api.deleteSubCategory(id); await refreshSubCategories(); },

    createPaymentMethod: async (name, icon) => { const id = await api.createPaymentMethod(name, icon); await refreshPaymentMethods(); return id; },
    updatePaymentMethod: async (id, name, icon) => { await api.updatePaymentMethod(id, name, icon); await refreshPaymentMethods(); },
    deletePaymentMethod: async (id) => { await api.deletePaymentMethod(id); await refreshPaymentMethods(); },

    createTag: async (name) => { const id = await api.createTag(name); await refreshTags(); return id; },
    deleteTag: async (id) => { await api.deleteTag(id); await refreshTags(); },

    setBudget: async (categoryId, amount, period) => { const id = await api.setBudget(categoryId, amount, period); await refreshBudgets(); return id; },
    deleteBudget: async (id) => { await api.deleteBudget(id); await refreshBudgets(); },
    toggleBudgetPin: async (id, pinned) => { await api.toggleBudgetPin(id, pinned); await refreshBudgets(); },
    setBudgetsEnabled: async (enabled) => { await api.setBudgetsEnabled(enabled); await refreshBudgets(); },

    createSavingsGoal: async (name, targetAmount, targetDate) => { const id = await api.createSavingsGoal(name, targetAmount, targetDate); await refreshSavingsGoals(); return id; },
    updateSavingsGoalProgress: async (id, currentAmount) => { await api.updateSavingsGoalProgress(id, currentAmount); await refreshSavingsGoals(); },
    deleteSavingsGoal: async (id) => { await api.deleteSavingsGoal(id); await refreshSavingsGoals(); },
    toggleSavingsGoalPin: async (id, pinned) => { await api.toggleSavingsGoalPin(id, pinned); await refreshSavingsGoals(); },

    createRecurringExpense: async (name, amount, categoryId, paymentMethodId, frequency, startDate) => {
      const id = await api.createRecurringExpense(name, amount, categoryId, paymentMethodId, frequency, startDate);
      await refreshRecurring();
      return id;
    },
    confirmRecurringExpense: async (recurringId, date) => {
      const expenseId = await api.confirmRecurringExpense(recurringId, date);
      await Promise.all([refreshRecurring(), refreshExpenses()]);
      return expenseId;
    },
    deleteRecurringExpense: async (id) => { await api.deleteRecurringExpense(id); await refreshRecurring(); },

    createPlannedPurchase: async (input) => {
      const id = await api.createPlannedPurchase(input);
      await refreshPlanned();
      return id;
    },
    updatePlannedPurchase: async (id, input) => { await api.updatePlannedPurchase(id, input); await refreshPlanned(); },
    convertPlannedToExpense: async (id, date, actual) => {
      const expenseId = await api.convertPlannedToExpense(id, date, actual);
      // التحويل يكتب في جدولين، فالاثنان يتحدّثان معاً وإلا ظهر المصروف
      // في القوائم بينما الخطة ما زالت معروضة كنشطة.
      await Promise.all([refreshPlanned(), refreshExpenses()]);
      return expenseId;
    },
    cancelPlannedPurchase: async (id) => { await api.cancelPlannedPurchase(id); await refreshPlanned(); },
    restorePlannedPurchase: async (id) => { await api.restorePlannedPurchase(id); await refreshPlanned(); },
    deletePlannedPurchase: async (id) => { await api.deletePlannedPurchase(id); await refreshPlanned(); },

    importBackupJson: async (json) => { await api.importBackupJson(json); await reloadAll(); },
    importExpensesBulk: async (rows) => {
      let count = 0;
      let failed = 0;
      for (const row of rows) {
        try {
          await api.addExpense(row);
          count++;
        } catch {
          // فشل الإدراج غالباً بسبب تعارض ID مع مصروف موجود بالفعل
          // (مثال: تصدير مصروف ثم إعادة استيراد نفس الملف بدون حذف الأصل)
          // نعيد المحاولة بـ id جديد تماماً بدل ما نفقد الصف بصمت
          try {
            await api.addExpense({ ...row, id: undefined });
            count++;
          } catch {
            failed++;
          }
        }
      }
      await reloadAll(); // نحدّث الـ UI دايماً حتى لو في بعض الصفوف فشلت
      return { count, failed };
    },
    deleteAllData: async () => { await api.deleteAllData(); await reloadAll(); },
  }), [
    reloadAll, refreshExpenses, refreshCategories, refreshSubCategories, refreshPaymentMethods,
    refreshTags, refreshBudgets, refreshSavingsGoals, refreshRecurring, refreshPlanned,
  ]);

  const value: StoreValue = { ...state, ...actions };

  return <DataStoreContext.Provider value={value}>{children}</DataStoreContext.Provider>;
}

export function useDataStore() {
  const ctx = useContext(DataStoreContext);
  if (!ctx) throw new Error("useDataStore يجب استخدامه داخل DataStoreProvider");
  return ctx;
}
