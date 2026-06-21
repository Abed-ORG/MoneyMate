export type BudgetAlertLevel = "warning" | "alert";
export type BudgetStatus = "under_budget" | "close_to_budget" | "on_budget" | "over_budget";
export type BudgetProgressState = "green" | "yellow" | "orange" | "red";
export type BudgetTrend = "improvement" | "decline" | "no_change";

export type MoneyValue = number | string;

export type BudgetCategory = {
  id: number;
  name: string;
  icon?: string | null;
  color?: string | null;
};

export type Budget = {
  id: number;
  user_id: number;
  category_id: number;
  amount: MoneyValue;
  month: number;
  year: number;
  category_name: string;
  category_icon?: string | null;
  category_color?: string | null;
};

export type BudgetPayload = {
  category_id?: number;
  category_name?: string;
  amount: number;
  month: number;
  year: number;
};

export type BudgetSummary = {
  budget_id: number;
  category_id: number;
  category_name: string;
  category_icon?: string | null;
  category_color?: string | null;
  budgeted_amount: MoneyValue;
  actual_spending: MoneyValue;
  remaining_amount: MoneyValue;
  usage_percentage: MoneyValue;
  variance_amount: MoneyValue;
  variance_percentage: MoneyValue;
  status: BudgetStatus;
  alert_level?: BudgetAlertLevel | null;
  progress_state: BudgetProgressState;
};

export type BudgetTotals = {
  total_budgeted_amount: MoneyValue;
  total_actual_spending: MoneyValue;
  total_remaining_amount: MoneyValue;
  overall_usage_percentage: MoneyValue;
  categories_over_budget: number;
};

export type BudgetAlert = {
  severity: BudgetAlertLevel;
  category_id: number;
  category_name: string;
  category_icon?: string | null;
  category_color?: string | null;
  budgeted_amount: MoneyValue;
  actual_spending: MoneyValue;
  remaining_amount: MoneyValue;
  usage_percentage: MoneyValue;
  message: string;
};

export type BudgetOverview = {
  month: number;
  year: number;
  currency: string;
  totals: BudgetTotals;
  budgets: BudgetSummary[];
  alerts: BudgetAlert[];
};

export type BudgetHistoryMonth = {
  month: number;
  year: number;
  month_label: string;
  total_budgeted_amount: MoneyValue;
  total_actual_spending: MoneyValue;
  overall_usage_percentage: MoneyValue;
  adherence_percentage: MoneyValue;
  categories_within_budget: number;
  categories_over_budget: number;
  trend: BudgetTrend;
  trend_percentage_points: MoneyValue;
  trend_message: string;
};

export type BudgetHistoryResponse = {
  months: BudgetHistoryMonth[];
};

