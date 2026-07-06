import { budgetsApi } from "./budgets";
import { transactionsApi } from "./transactions";
import type { BudgetSummary } from "../types/budget";
import type { Transaction, TransactionListParams } from "../types/transaction";

export type MonthlyReportCategory = {
  category: string;
  spent: number;
  budgeted: number;
  remaining: number;
  usagePercentage: number;
};

export type MonthlyReport = {
  month: number;
  year: number;
  monthLabel: string;
  income: number;
  expenses: number;
  netSavings: number;
  budgetCategories: MonthlyReportCategory[];
  topSpendingCategories: Array<{
    category: string;
    spent: number;
    percentageOfExpenses: number;
  }>;
  budgets: BudgetSummary[];
};

export type AnnualReportMonth = {
  month: number;
  monthLabel: string;
  income: number;
  expenses: number;
  netSavings: number;
};

export type AnnualReport = {
  year: number;
  months: AnnualReportMonth[];
  previousYearMonths: AnnualReportMonth[];
  totals: {
    income: number;
    expenses: number;
    netSavings: number;
  };
  previousYearComparison: null | {
    incomeChange: number;
    expenseChange: number;
    savingsChange: number;
  };
};

function toNumber(value: string | number | undefined | null) {
  return Number(value ?? 0) || 0;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function monthLabel(month: number, year: number) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(
    new Date(year, month - 1, 1),
  );
}

function dateKey(year: number, month: number, day: number) {
  return [
    String(year).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

function lastDayOfMonth(month: number, year: number) {
  return new Date(year, month, 0).getDate();
}

function monthRange(month: number, year: number) {
  return {
    dateFrom: dateKey(year, month, 1),
    dateTo: dateKey(year, month, lastDayOfMonth(month, year)),
  };
}

function yearRange(year: number) {
  return {
    dateFrom: dateKey(year, 1, 1),
    dateTo: dateKey(year, 12, 31),
  };
}

function getLocalTransactions(): Transaction[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem("moneymate.local.transactions");
    return raw ? (JSON.parse(raw) as Transaction[]) : [];
  } catch {
    return [];
  }
}

async function loadTransactions(
  params: Pick<TransactionListParams, "dateFrom" | "dateTo"> = {},
) {
  const pageSize = 100;
  const items: Transaction[] = [];
  let page = 1;
  let total = 0;

  try {
    do {
      const response = await transactionsApi.list({
        page,
        pageSize,
        sortBy: "date",
        sortDir: "asc",
        ...params,
      });
      items.push(...response.items);
      total = response.total;
      if (response.items.length < pageSize) {
        break;
      }
      page += 1;
    } while (items.length < total);
    return items;
  } catch {
    return getLocalTransactions().filter((transaction) =>
      withinDateRange(transaction.date, params.dateFrom, params.dateTo),
    );
  }
}

async function loadBudgets(month: number, year: number) {
  try {
    const response = await budgetsApi.overview(month, year);
    return response.budgets;
  } catch {
    return [] as BudgetSummary[];
  }
}

function withinMonth(date: string, month: number, year: number) {
  const key = transactionDateKey(date);
  return key >= dateKey(year, month, 1) && key <= dateKey(year, month, lastDayOfMonth(month, year));
}

function transactionDateKey(value: string) {
  const directDate = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (directDate) {
    return `${directDate[1]}-${directDate[2]}-${directDate[3]}`;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return dateKey(
    parsed.getUTCFullYear(),
    parsed.getUTCMonth() + 1,
    parsed.getUTCDate(),
  );
}

function withinDateRange(
  date: string,
  dateFrom?: string,
  dateTo?: string,
) {
  const key = transactionDateKey(date);
  if (!key) {
    return false;
  }
  if (dateFrom && key < dateFrom) {
    return false;
  }
  if (dateTo && key > dateTo) {
    return false;
  }
  return true;
}

function summarizeTransactions(transactions: Transaction[]) {
  const summary = transactions.reduce(
    (acc, transaction) => {
      const amount = toNumber(transaction.amount);
      if (amount > 0) {
        acc.income += amount;
      } else {
        acc.expenses += Math.abs(amount);
      }
      return acc;
    },
    { income: 0, expenses: 0 },
  );
  return {
    income: roundMoney(summary.income),
    expenses: roundMoney(summary.expenses),
  };
}

export async function getMonthlyReport(month: number, year: number): Promise<MonthlyReport> {
  const range = monthRange(month, year);
  const [transactions, budgets] = await Promise.all([
    loadTransactions(range),
    loadBudgets(month, year),
  ]);
  const monthlyTransactions = transactions.filter((transaction) =>
    withinMonth(transaction.date, month, year),
  );
  const summary = summarizeTransactions(monthlyTransactions);
  const spendingByCategory = new Map<string, number>();

  monthlyTransactions.forEach((transaction) => {
    const amount = toNumber(transaction.amount);
    if (amount < 0) {
      spendingByCategory.set(
        transaction.category || "Uncategorized",
        roundMoney((spendingByCategory.get(transaction.category || "Uncategorized") ?? 0) + Math.abs(amount)),
      );
    }
  });

  const budgetCategories = budgets.map((budget) => {
    const spent = toNumber(budget.actual_spending);
    const budgeted = toNumber(budget.budgeted_amount);
    const remaining = toNumber(budget.remaining_amount);
    const usagePercentage = toNumber(budget.usage_percentage);

    return {
      category: budget.category_name,
      spent: roundMoney(spent),
      budgeted: roundMoney(budgeted),
      remaining: roundMoney(remaining),
      usagePercentage,
    };
  });

  const topSpendingCategories = [...spendingByCategory.entries()]
    .map(([category, spent]) => ({
      category,
      spent,
      percentageOfExpenses: summary.expenses > 0 ? (spent / summary.expenses) * 100 : 0,
    }))
    .sort((a, b) => b.spent - a.spent);

  return {
    month,
    year,
    monthLabel: monthLabel(month, year),
    income: summary.income,
    expenses: summary.expenses,
    netSavings: roundMoney(summary.income - summary.expenses),
    budgetCategories,
    topSpendingCategories,
    budgets,
  };
}

export async function getAnnualReport(year: number): Promise<AnnualReport> {
  const [transactions, previousYearTransactions] = await Promise.all([
    loadTransactions(yearRange(year)),
    loadTransactions(yearRange(year - 1)),
  ]);
  const months = Array.from({ length: 12 }, (_, index) => index + 1).map((month) => {
    const monthlyTransactions = transactions.filter(
      (transaction) => withinMonth(transaction.date, month, year),
    );
    const summary = summarizeTransactions(monthlyTransactions);
    return {
      month,
      monthLabel: new Intl.DateTimeFormat("en-US", { month: "short" }).format(
        new Date(year, month - 1, 1),
      ),
      income: summary.income,
      expenses: summary.expenses,
      netSavings: roundMoney(summary.income - summary.expenses),
    };
  });

  const previousYearMonths = Array.from({ length: 12 }, (_, index) => index + 1).map((month) => {
    const monthlyTransactions = previousYearTransactions.filter(
      (transaction) => withinMonth(transaction.date, month, year - 1),
    );
    const summary = summarizeTransactions(monthlyTransactions);
    return {
      month,
      monthLabel: new Intl.DateTimeFormat("en-US", { month: "short" }).format(
        new Date(year - 1, month - 1, 1),
      ),
      income: summary.income,
      expenses: summary.expenses,
      netSavings: roundMoney(summary.income - summary.expenses),
    };
  });

  const rawTotals = months.reduce(
    (acc, month) => {
      acc.income += month.income;
      acc.expenses += month.expenses;
      acc.netSavings += month.netSavings;
      return acc;
    },
    { income: 0, expenses: 0, netSavings: 0 },
  );
  const totals = {
    income: roundMoney(rawTotals.income),
    expenses: roundMoney(rawTotals.expenses),
    netSavings: roundMoney(rawTotals.netSavings),
  };

  if (!previousYearTransactions.length) {
    return {
      year,
      months,
      previousYearMonths,
      totals,
      previousYearComparison: null,
    };
  }

  const previousTotals = summarizeTransactions(previousYearTransactions);
  const previousNet = roundMoney(previousTotals.income - previousTotals.expenses);

  return {
    year,
    months,
    previousYearMonths,
    totals,
    previousYearComparison: {
      incomeChange:
        previousTotals.income > 0 ? ((totals.income - previousTotals.income) / previousTotals.income) * 100 : 0,
      expenseChange:
        previousTotals.expenses > 0 ? ((totals.expenses - previousTotals.expenses) / previousTotals.expenses) * 100 : 0,
      savingsChange:
        previousNet !== 0 ? ((totals.netSavings - previousNet) / Math.abs(previousNet)) * 100 : 0,
    },
  };
}
