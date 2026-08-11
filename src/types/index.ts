export interface Category {
  id: string;
  name: string;
  icon?: string | null;
  color?: string | null;
  sort_order: number;
}

export interface PaymentMethod {
  id: string;
  name: string;
  icon?: string | null;
}

export interface SubCategory {
  id: string;
  category_id: string;
  name: string;
}

export interface Tag {
  id: string;
  name: string;
}

export interface Expense {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  amount: number;
  category_id?: string | null;
  sub_category_id?: string | null;
  payment_method_id?: string | null;
  description?: string | null;
}

export interface ExpenseWithDetails {
  id: string;
  name: string;
  date: string;
  amount: number;
  category_id?: string | null;
  category_name?: string | null;
  category_color?: string | null;
  sub_category_id?: string | null;
  payment_method_id?: string | null;
  payment_method_name?: string | null;
  description?: string | null;
}

export interface DashboardSummary {
  total_today: number;
  total_this_month: number;
  total_this_year: number;
  expense_count_this_month: number;
  daily_average: number;
  biggest_expense: number;
  top_category?: string | null;
}

export interface Budget {
  id: string;
  category_id?: string | null;
  category_name?: string | null;
  amount: number;
  period: "monthly" | "yearly";
  pinned: boolean;
}

export interface SavingsGoal {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date?: string | null;
  pinned: boolean;
}

export interface RecurringExpense {
  id: string;
  name: string;
  amount: number;
  category_id?: string | null;
  payment_method_id?: string | null;
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  next_due_date: string;
  is_active: boolean;
}

export interface ActivityLogEntry {
  id: string;
  action_type: string;
  table_name?: string | null;
  created_at: string;
}

export type ThemeMode = "dark" | "light";
