import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, CategoryIcon, LoadingSpinner, Modal } from "../components";
import {
  BudgetAllocationDonut,
  BudgetCategoryCard,
  BudgetComparisonChart,
  BudgetFormModal,
  BudgetSummaryCard,
  DeleteConfirmationModal,
  MonthSelector,
  monthLabel,
} from "../components/Budgets/BudgetComponents";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { getApiErrorMessage } from "../services/api";
import { budgetsApi } from "../services/budgets";
import type {
  BudgetCategory,
  BudgetHistoryMonth,
  BudgetOverview,
  BudgetPayload,
  BudgetSummary,
  BudgetStatus,
} from "../types/budget";
import styles from "./BudgetsPage.module.css";

type BudgetFilters = {
  statuses: BudgetStatus[];
  categoryIds: number[];
};

const budgetStatusOptions: Array<{ value: BudgetStatus; label: string }> = [
  { value: "under_budget", label: "Under budget" },
  { value: "close_to_budget", label: "Close to budget" },
  { value: "on_budget", label: "Exactly on budget" },
  { value: "over_budget", label: "Over budget" },
];

function currentMonthState() {
  const now = new Date();
  return {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  };
}

function daysRemainingInMonth(month: number, year: number) {
  const now = new Date();
  const lastDay = new Date(year, month, 0);
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;
  if (isCurrentMonth) {
    return Math.max(0, lastDay.getDate() - now.getDate() + 1);
  }
  return lastDay < now ? 0 : lastDay.getDate();
}

function FilterIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M7 14v6" />
      <circle cx="14" cy="7" r="2" />
      <circle cx="7" cy="17" r="2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

export function BudgetsPage() {
  const initialMonth = currentMonthState();
  const { profile } = useAuth();
  const toast = useToast();
  const [month, setMonth] = useState(initialMonth.month);
  const [year, setYear] = useState(initialMonth.year);
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [overview, setOverview] = useState<BudgetOverview | null>(null);
  const [history, setHistory] = useState<BudgetHistoryMonth[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCopyingBudgets, setIsCopyingBudgets] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetSummary | null>(null);
  const [deletingBudget, setDeletingBudget] = useState<BudgetSummary | null>(null);
  const [viewMode, setViewMode] = useState<"visualize" | "list">("list");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [budgetFilters, setBudgetFilters] = useState<BudgetFilters>({
    statuses: [],
    categoryIds: [],
  });
  const shownAlerts = useRef<Set<string>>(new Set());

  const currency = overview?.currency ?? profile?.currency ?? "USD";
  const daysRemaining = useMemo(() => daysRemainingInMonth(month, year), [month, year]);
  const selectedHistory = history.find((item) => item.month === month && item.year === year);
  const budgetCategoryOptions = useMemo(
    () => overview?.budgets.map((budget) => ({
      id: budget.category_id,
      name: budget.category_name,
    })) ?? [],
    [overview?.budgets],
  );
  const filteredBudgets = useMemo(() => {
    const budgets = overview?.budgets ?? [];
    return budgets.filter((budget) => {
      const matchesStatus =
        !budgetFilters.statuses.length || budgetFilters.statuses.includes(budget.status);
      const matchesCategory =
        !budgetFilters.categoryIds.length || budgetFilters.categoryIds.includes(budget.category_id);
      return matchesStatus && matchesCategory;
    });
  }, [budgetFilters, overview?.budgets]);
  const activeBudgetFilterCount = budgetFilters.statuses.length + budgetFilters.categoryIds.length;

  const loadBudgetData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [categoryResult, overviewResult, historyResult] = await Promise.allSettled([
        budgetsApi.categories(),
        budgetsApi.overview(month, year),
        budgetsApi.history(),
      ]);

      if (categoryResult.status === "fulfilled") {
        setCategories(categoryResult.value);
      } else {
        setCategories([]);
      }

      if (overviewResult.status === "fulfilled") {
        setOverview(overviewResult.value);
      } else {
        setOverview(null);
      }

      if (historyResult.status === "fulfilled") {
        setHistory(historyResult.value.months);
      } else {
        setHistory([]);
      }

      const failedSections = [
        categoryResult.status === "rejected" ? `categories: ${getApiErrorMessage(categoryResult.reason)}` : null,
        overviewResult.status === "rejected" ? `overview: ${getApiErrorMessage(overviewResult.reason)}` : null,
        historyResult.status === "rejected" ? `history: ${getApiErrorMessage(historyResult.reason)}` : null,
      ].filter((value): value is string => Boolean(value));

      if (failedSections.length) {
        setError(`Budget data loaded partially. Failed to load ${failedSections.join("; ")}.`);
      }
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
      toast.showToast({
        title: alert.severity === "alert" ? "Budget exceeded" : "Budget warning",
        message: alert.message,
        variant: alert.severity === "alert" ? "error" : "warning",
      });
    }
  }, [overview, toast]);

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
      toast.showToast({
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
      toast.showToast({
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
      toast.showToast({
        title: "Budget deleted",
        message: "The budget was removed from this month.",
        variant: "success",
      });
      setDeletingBudget(null);
      await loadBudgetData();
    } catch (err) {
      toast.showToast({
        title: "Could not delete budget",
        message: getApiErrorMessage(err),
        variant: "error",
      });
      throw err;
    }
  };

  const copyPreviousMonthBudgets = async () => {
    setIsCopyingBudgets(true);
    try {
      const copied = await budgetsApi.copyFromPrevious(month, year);
      toast.showToast({
        title: copied.length ? "Budgets copied" : "Nothing to copy",
        message: copied.length
          ? `${copied.length} budget${copied.length === 1 ? "" : "s"} copied into ${monthLabel(month, year)}.`
          : "No missing budgets were found in the previous month.",
        variant: copied.length ? "success" : "info",
      });
      await loadBudgetData();
    } catch (err) {
      toast.showToast({
        title: "Could not copy budgets",
        message: getApiErrorMessage(err),
        variant: "error",
      });
    } finally {
      setIsCopyingBudgets(false);
    }
  };

  const selectMonth = (nextMonth: number, nextYear: number) => {
    setMonth(nextMonth);
    setYear(nextYear);
    setBudgetFilters({ statuses: [], categoryIds: [] });
  };

  const toggleStatusFilter = (status: BudgetStatus) => {
    setBudgetFilters((current) => ({
      ...current,
      statuses: current.statuses.includes(status)
        ? current.statuses.filter((item) => item !== status)
        : [...current.statuses, status],
    }));
  };

  const toggleCategoryFilter = (categoryId: number) => {
    setBudgetFilters((current) => ({
      ...current,
      categoryIds: current.categoryIds.includes(categoryId)
        ? current.categoryIds.filter((item) => item !== categoryId)
        : [...current.categoryIds, categoryId],
    }));
  };

  const resetBudgetFilters = () => {
    setBudgetFilters({ statuses: [], categoryIds: [] });
  };

  const hasBudgets = Boolean(overview?.budgets.length);
  return (
    <section className={styles.page}>
      <div className={styles.controlsBar}>
        <MonthSelector month={month} year={year} onChange={selectMonth} />
        <Button
          disabled={isCopyingBudgets || isLoading}
          onClick={() => void copyPreviousMonthBudgets()}
          variant="secondary"
        >
          {isCopyingBudgets ? "Copying..." : "Copy from last month"}
        </Button>
        <Button onClick={openCreate}>+ Create Budget</Button>
      </div>

      {isLoading ? (
        <div className={styles.state}>
          <LoadingSpinner label="Loading budget data" />
        </div>
      ) : null}
      {error ? (
        <div className={styles.errorState}>
          <p>{error}</p>
          <Button variant="secondary" onClick={() => void loadBudgetData()}>Try again</Button>
        </div>
      ) : null}

      {!isLoading && !error && overview ? (
        <>
          <BudgetSummaryCard historyItem={selectedHistory} overview={overview} />

          {!hasBudgets ? (
            <section className={styles.emptyState}>
              <h2>No budgets for {monthLabel(month, year)}</h2>
              <p>
                Create your first category budget for this month to unlock progress bars,
                comparison charts, and adherence history.
              </p>
              <Button onClick={openCreate}>Create a budget</Button>
            </section>
          ) : (
            <>
              <div className={styles.viewHeader}>
                <div className={styles.viewSwitcher} aria-label="Budget view mode">
                  <button
                    className={viewMode === "list" ? styles.viewSwitcherActive : ""}
                    onClick={() => setViewMode("list")}
                    type="button"
                  >
                    List
                  </button>
                  <button
                    className={viewMode === "visualize" ? styles.viewSwitcherActive : ""}
                    onClick={() => setViewMode("visualize")}
                    type="button"
                  >
                    Visualize
                  </button>
                </div>
              </div>

              {viewMode === "visualize" ? (
                <div className={styles.visualGrid}>
                  <BudgetAllocationDonut budgets={overview.budgets} currency={currency} />
                  <section className={`${styles.panel} ${styles.comparisonPanel}`}>
                    <h2>Actual vs budgeted</h2>
                    <BudgetComparisonChart budgets={overview.budgets} currency={currency} />
                  </section>
                </div>
              ) : (
                <section className={styles.workspaceGrid}>
                  <div className={`${styles.panel} ${styles.categoryPanel}`}>
                    <div className={styles.panelHeader}>
                      <span className={styles.budgetCount}>
                        {activeBudgetFilterCount
                          ? `${filteredBudgets.length} of ${overview.budgets.length} budgets`
                          : `${overview.budgets.length} budget${overview.budgets.length === 1 ? "" : "s"}`}
                      </span>
                      <Button
                        className={activeBudgetFilterCount ? styles.filterButtonActive : ""}
                        onClick={() => setIsFiltersOpen(true)}
                        variant="secondary"
                      >
                        <FilterIcon />
                        Filters
                        {activeBudgetFilterCount ? (
                          <span className={styles.filterCount}>{activeBudgetFilterCount}</span>
                        ) : null}
                      </Button>
                    </div>
                    <div className={styles.budgetList}>
                      {filteredBudgets.map((budget) => (
                        <BudgetCategoryCard
                          budget={budget}
                          currency={currency}
                          key={budget.budget_id}
                          daysRemaining={daysRemaining}
                          onDelete={setDeletingBudget}
                          onEdit={openEdit}
                        />
                      ))}
                      {!filteredBudgets.length ? (
                        <div className={styles.filteredEmpty}>
                          No budgets match the selected filters.
                        </div>
                      ) : null}
                    </div>
                  </div>
                </section>
              )}
            </>
          )}
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

      <Modal
        bodyClassName={styles.filterModalBody}
        isOpen={isFiltersOpen}
        title="Filters"
        onClose={() => setIsFiltersOpen(false)}
      >
        <fieldset className={styles.filterSection}>
          <legend>Level</legend>
          <div className={styles.filterChecklist}>
            {budgetStatusOptions.map((option) => {
              const isSelected = budgetFilters.statuses.includes(option.value);
              return (
                <label className={styles.filterRow} key={option.value}>
                  <input
                    checked={isSelected}
                    onChange={() => toggleStatusFilter(option.value)}
                    type="checkbox"
                  />
                  <span className={styles.filterCheck} aria-hidden="true">
                    {isSelected ? <CheckIcon /> : null}
                  </span>
                  <span className={`${styles.levelDot} ${styles[option.value]}`} />
                  <span>{option.label}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset className={styles.filterSection}>
          <legend>Category</legend>
          <div className={styles.filterChecklist}>
            {budgetCategoryOptions.map((category) => {
              const isSelected = budgetFilters.categoryIds.includes(category.id);
              return (
                <label className={styles.filterRow} key={category.id}>
                  <input
                    checked={isSelected}
                    onChange={() => toggleCategoryFilter(category.id)}
                    type="checkbox"
                  />
                  <span className={styles.filterCheck} aria-hidden="true">
                    {isSelected ? <CheckIcon /> : null}
                  </span>
                  <span className={styles.filterCategoryIcon} aria-hidden="true">
                    <CategoryIcon category={category.name} />
                  </span>
                  <span>{category.name}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className={styles.filterActions}>
          <Button
            disabled={!activeBudgetFilterCount}
            onClick={resetBudgetFilters}
            variant="secondary"
          >
            Reset Filters
          </Button>
          <Button onClick={() => setIsFiltersOpen(false)}>Apply</Button>
        </div>
      </Modal>
    </section>
  );
}
