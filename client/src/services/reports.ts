import { budgetsApi } from "./budgets";
import { transactionsApi } from "./transactions";
import type { BudgetSummary } from "../types/budget";
import type { Transaction } from "../types/transaction";

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

function monthLabel(month: number, year: number) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(
    new Date(year, month - 1, 1),
  );
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

async function loadTransactions() {
  try {
    const response = await transactionsApi.list({
      page: 1,
      pageSize: 10000,
      sortBy: "date",
      sortDir: "desc",
    });
    return response.items;
  } catch {
    return getLocalTransactions();
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
  const parsed = new Date(date);
  return parsed.getMonth() + 1 === month && parsed.getFullYear() === year;
}

function summarizeTransactions(transactions: Transaction[]) {
  return transactions.reduce(
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
}

export async function getMonthlyReport(month: number, year: number): Promise<MonthlyReport> {
  const [transactions, budgets] = await Promise.all([loadTransactions(), loadBudgets(month, year)]);
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
        (spendingByCategory.get(transaction.category || "Uncategorized") ?? 0) + Math.abs(amount),
      );
    }
  });

  const budgetCategories = budgets.map((budget) => {
    const spent = spendingByCategory.get(budget.category_name) ?? 0;
    const budgeted = toNumber(budget.budgeted_amount);
    const remaining = budgeted - spent;
    const usagePercentage = budgeted > 0 ? Math.min(100, (spent / budgeted) * 100) : 0;

    return {
      category: budget.category_name,
      spent,
      budgeted,
      remaining,
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
    netSavings: summary.income - summary.expenses,
    budgetCategories,
    topSpendingCategories,
    budgets,
  };
}

export async function getAnnualReport(year: number): Promise<AnnualReport> {
  const transactions = await loadTransactions();
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
      netSavings: summary.income - summary.expenses,
    };
  });

  const totals = months.reduce(
    (acc, month) => {
      acc.income += month.income;
      acc.expenses += month.expenses;
      acc.netSavings += month.netSavings;
      return acc;
    },
    { income: 0, expenses: 0, netSavings: 0 },
  );

  const previousYear = year - 1;
  const previousMonths = transactions.filter((transaction) =>
    new Date(transaction.date).getFullYear() === previousYear,
  );

  if (!previousMonths.length) {
    return {
      year,
      months,
      totals,
      previousYearComparison: null,
    };
  }

  const previousTotals = summarizeTransactions(previousMonths);
  const previousNet = previousTotals.income - previousTotals.expenses;

  return {
    year,
    months,
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
