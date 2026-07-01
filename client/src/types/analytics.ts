export type TrendAggregation = "daily" | "weekly";

export type AnalyticsPeriod = {
  start_date: string;
  end_date: string;
};

export type AnalyticsTotals = {
  total_income: string;
  total_expenses: string;
  net_amount: string;
};

export type AnalyticsPercentageChange = {
  value: string | null;
  label: string;
  direction: "increase" | "decrease" | "flat" | "new" | "no_previous_data";
};

export type NetPositionSummary = {
  current: AnalyticsTotals;
  previous: AnalyticsTotals;
  income_change: AnalyticsPercentageChange;
  expenses_change: AnalyticsPercentageChange;
  net_change: AnalyticsPercentageChange;
};

export type SpendingCategoryAnalytics = {
  category_id: number | null;
  category_name: string;
  color: string;
  amount: string;
  percentage: string;
};

export type MonthlyIncomeExpense = {
  month: string;
  month_label: string;
  income: string;
  expenses: string;
  net: string;
};

export type SpendingTrendPoint = {
  key: string;
  label: string;
  start_date: string;
  end_date: string;
  spending: string;
  moving_average: string;
};

export type AnalyticsFilterCategory = {
  id: number;
  name: string;
  color: string;
};

export type AnalyticsFilterAccount = {
  id: number;
  name: string;
  type: string;
  currency: string;
};

export type AnalyticsFilters = {
  categories: AnalyticsFilterCategory[];
  accounts: AnalyticsFilterAccount[];
};

export type DashboardAnalyticsResponse = {
  currency: string;
  period: AnalyticsPeriod;
  previous_period: AnalyticsPeriod;
  summary: NetPositionSummary;
  spending_by_category: SpendingCategoryAnalytics[];
  monthly_income_expenses: MonthlyIncomeExpense[];
  spending_trend: SpendingTrendPoint[];
  filters: AnalyticsFilters;
};

export type DashboardAnalyticsParams = {
  startDate: string;
  endDate: string;
  categoryIds: number[];
  accountIds: number[];
  trendAggregation: TrendAggregation;
  months?: number;
};
