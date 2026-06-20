import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Toast } from "../components";
import {
  BudgetAlertPanel,
  BudgetCategoryCard,
  BudgetComparisonChart,
  BudgetComparisonTable,
  BudgetFormModal,
  BudgetHistoryList,
  BudgetSummaryCard,
  DeleteConfirmationModal,
  MonthSelector,
  monthLabel,
} from "../components/Budgets/BudgetComponents";
import { useAuth } from "../contexts/AuthContext";
import { getApiErrorMessage } from "../services/api";
import { budgetsApi } from "../services/budgets";
import type {
  BudgetCategory,
  BudgetHistoryMonth,
  BudgetOverview,
  BudgetPayload,
  BudgetSummary,
} from "../types/budget";
import styles from "./BudgetsPage.module.css";

type ToastState = {
  title: string;
  message: string;
  variant: "success" | "error" | "warning" | "info";
};

function currentMonthState() {
  const now = new Date();
  return {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  };
}

export function BudgetsPage() {
  const initialMonth = currentMonthState();
  const { profile } = useAuth();
  const [month, setMonth] = useState(initialMonth.month);
  const [year, setYear] = useState(initialMonth.year);
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [overview, setOverview] = useState<BudgetOverview | null>(null);
  const [history, setHistory] = useState<BudgetHistoryMonth[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetSummary | null>(null);
  const [deletingBudget, setDeletingBudget] = useState<BudgetSummary | null>(null);
  const shownAlerts = useRef<Set<string>>(new Set());

  const currency = overview?.currency ?? profile?.currency ?? "USD";

  const loadBudgetData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [categoryResponse, overviewResponse, historyResponse] = await Promise.all([
        budgetsApi.categories(),
        budgetsApi.overview(month, year),
        budgetsApi.history(),
      ]);
      setCategories(categoryResponse);
      setOverview(overviewResponse);
      setHistory(historyResponse.months);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    void loadBudgetData();
  }, [loadBudgetData]);

  useEffect(() => {
    const handleTransactionsChanged = () => {
      void loadBudgetData();
    };
    window.addEventListener("moneymate:transactions-changed", handleTransactionsChanged);
    return () => {
      window.removeEventListener("moneymate:transactions-changed", handleTransactionsChanged);
    };
  }, [loadBudgetData]);

  useEffect(() => {
    if (!overview?.alerts.length) return;
    const alert = overview.alerts.find((item) => {
      const key = `${overview.year}-${overview.month}-${item.category_id}-${item.severity}-${item.usage_percentage}`;
      if (shownAlerts.current.has(key)) {
        return false;
      }
      shownAlerts.current.add(key);
      return true;
    });
    if (alert) {
      setToast({
        title: alert.severity === "alert" ? "Budget exceeded" : "Budget warning",
        message: alert.message,
        variant: alert.severity === "alert" ? "error" : "warning",
      });
    }
  }, [overview]);

  const openCreate = () => {
    setEditingBudget(null);
    setIsFormOpen(true);
  };

  const openEdit = (budget: BudgetSummary) => {
    setEditingBudget(budget);
    setIsFormOpen(true);
  };

  const submitBudget = async (payload: BudgetPayload) => {
    try {
      if (editingBudget) {
        await budgetsApi.update(editingBudget.budget_id, payload);
      } else {
        await budgetsApi.create(payload);
      }
      setToast({
        title: editingBudget ? "Budget updated" : "Budget created",
        message: "Your monthly budget data is up to date.",
        variant: "success",
      });
      setIsFormOpen(false);
      setEditingBudget(null);
      if (payload.month !== month || payload.year !== year) {
        setMonth(payload.month);
        setYear(payload.year);
      } else {
        await loadBudgetData();
      }
    } catch (err) {
      setToast({
        title: "Could not save budget",
        message: getApiErrorMessage(err),
        variant: "error",
      });
      throw err;
    }
  };

  const deleteBudget = async () => {
    if (!deletingBudget) return;
    try {
      await budgetsApi.delete(deletingBudget.budget_id);
      setToast({
        title: "Budget deleted",
        message: "The budget was removed from this month.",
        variant: "success",
      });
      setDeletingBudget(null);
      await loadBudgetData();
    } catch (err) {
      setToast({
        title: "Could not delete budget",
        message: getApiErrorMessage(err),
        variant: "error",
      });
      throw err;
    }
  };

  const selectMonth = (nextMonth: number, nextYear: number) => {
    setMonth(nextMonth);
    setYear(nextYear);
  };

  const hasBudgets = Boolean(overview?.budgets.length);

  return (
    <section className={styles.page}>
      {toast ? (
        <div className={styles.toastDock}>
          <Toast {...toast} onClose={() => setToast(null)} />
        </div>
      ) : null}

      <header className={styles.hero}>
        <div>
          <span className={styles.kicker}>Epic 7</span>
          <h2>Budget Management</h2>
          <p>
            Set category limits, compare actual spending, and track month-over-month adherence.
          </p>
        </div>
        <div className={styles.heroControls}>
          <MonthSelector month={month} year={year} onChange={selectMonth} />
          <Button onClick={openCreate}>+ Create Budget</Button>
        </div>
      </header>

      {isLoading ? <div className={styles.state}>Loading budget data...</div> : null}
      {error ? (
        <div className={styles.errorState}>
          <p>{error}</p>
          <Button variant="secondary" onClick={() => void loadBudgetData()}>Try again</Button>
        </div>
      ) : null}

      {!isLoading && !error && overview ? (
        <>
          <BudgetSummaryCard overview={overview} />

          {!hasBudgets ? (
            <section className={styles.emptyState}>
              <h2>No budgets for {monthLabel(month, year)}</h2>
              <p>
                Create your first category budget for this month to unlock progress bars,
                alerts, comparison charts, and adherence history.
              </p>
              <Button onClick={openCreate}>Create a budget</Button>
            </section>
          ) : (
            <>
              <section className={styles.gridTwo}>
                <div className={styles.panel}>
                  <div className={styles.panelHeader}>
                    <div>
                      <span className={styles.kicker}>Progress</span>
                      <h2>Category budgets</h2>
                    </div>
                    <span>{overview.budgets.length} categories</span>
                  </div>
                  <div className={styles.budgetList}>
                    {overview.budgets.map((budget) => (
                      <BudgetCategoryCard
                        budget={budget}
                        currency={currency}
                        key={budget.budget_id}
                        onDelete={setDeletingBudget}
                        onEdit={openEdit}
                      />
                    ))}
                  </div>
                </div>

                <BudgetAlertPanel alerts={overview.alerts} currency={currency} />
              </section>

              <section className={styles.panel}>
                <div className={styles.panelHeader}>
                  <div>
                    <span className={styles.kicker}>Comparison</span>
                    <h2>Budgeted versus actual</h2>
                  </div>
                </div>
                <BudgetComparisonChart budgets={overview.budgets} currency={currency} />
                <BudgetComparisonTable budgets={overview.budgets} currency={currency} />
              </section>
            </>
          )}

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <span className={styles.kicker}>History</span>
                <h2>Month-over-month adherence</h2>
              </div>
              <p>
                Adherence is the percentage of budgeted categories that stayed at or below 100%.
              </p>
            </div>
            <BudgetHistoryList
              currency={currency}
              history={history}
              onSelectMonth={selectMonth}
            />
          </section>
        </>
      ) : null}

      <BudgetFormModal
        categories={categories}
        currency={currency}
        initialBudget={editingBudget}
        isOpen={isFormOpen}
        month={month}
        year={year}
        onClose={() => {
          setIsFormOpen(false);
          setEditingBudget(null);
        }}
        onSubmit={submitBudget}
      />

      <DeleteConfirmationModal
        budget={deletingBudget}
        isOpen={Boolean(deletingBudget)}
        onClose={() => setDeletingBudget(null)}
        onConfirm={deleteBudget}
      />
    </section>
  );
}
