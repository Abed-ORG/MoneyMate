import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Button, Card, FormField, Input, Modal, Select, Toast } from "../components";
import {
  DashboardFilters,
  IncomeExpenseChart,
  NetPositionSummary,
  SpendingDistributionChart,
  SpendingTrendChart,
} from "../components/DashboardAnalytics/DashboardAnalytics";
import { useAuth } from "../contexts/AuthContext";
import { useDashboardFilters } from "../contexts/DashboardFiltersContext";
import { analyticsApi } from "../services/analytics";
import { getApiErrorMessage } from "../services/api";
import { insightsApi } from "../services/insights";
import { transactionsApi } from "../services/transactions";
import { transactionCategories } from "../constants/categories";
import type { DashboardAnalyticsResponse } from "../types/analytics";
import type {
  AnomalyDetectionResponse,
  MonthlySummaryResponse,
  RecurringDetectionResponse,
  SpendingInsightResponse,
} from "../services/insights";
import type { Category, TransactionPayload } from "../types/transaction";
import styles from "./DashboardPage.module.css";

type Status<T> =
  | { state: "loading"; data?: T }
  | { state: "success"; data: T }
  | { state: "error"; error: string; data?: T };

type QuickAddForm = {
  date: string;
  amount: string;
  category: string;
  vendor: string;
  notes: string;
};

type ToastState = {
  title: string;
  message: string;
  variant: "success" | "error" | "warning" | "info";
};

const ONBOARDING_STORAGE_KEY = "moneymate.dashboardOnboarding.dismissed";
const noteMaxLength = 160;

function onboardingStorageKey(userId?: number) {
  return userId
    ? `${ONBOARDING_STORAGE_KEY}.${userId}`
    : ONBOARDING_STORAGE_KEY;
}

function createEmptyQuickAddForm(): QuickAddForm {
  return {
    date: new Date().toISOString().slice(0, 10),
    amount: "",
    category: "",
    vendor: "",
    notes: "",
  };
}

function validateQuickAddForm(form: QuickAddForm) {
  const errors: Partial<Record<keyof QuickAddForm, string>> = {};
  const amount = Number(form.amount);
  if (!form.date) errors.date = "Date is required.";
  if (!form.amount) errors.amount = "Amount is required.";
  if (form.amount && Number.isNaN(amount)) errors.amount = "Amount must be numeric.";
  if (amount === 0) errors.amount = "Amount cannot be zero.";
  if (!form.category.trim()) errors.category = "Category is required.";
  return errors;
}

function quickAddPayload(form: QuickAddForm): TransactionPayload {
  return {
    date: new Date(`${form.date}T12:00:00`).toISOString(),
    amount: Number(form.amount),
    category: form.category.trim(),
    vendor: form.vendor.trim(),
    notes: form.notes.trim().slice(0, noteMaxLength),
  };
}

function MoneyMateLoader({ className = "" }: { className?: string }) {
  return (
    <div className={`${styles.moneyMateLoader} ${className}`} aria-hidden="true">
      <span />
      <img src="/moneymate-logo.png" alt="" />
    </div>
  );
}

function SparklesIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3Z" />
      <path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14Z" />
      <path d="M5 13l.7 1.8L7.5 15.5l-1.8.7L5 18l-.7-1.8-1.8-.7 1.8-.7L5 13Z" />
    </svg>
  );
}

function isFirstTimeDashboard(data?: DashboardAnalyticsResponse) {
  if (!data) return false;
  return (
    Number(data.summary.current.total_income) === 0 &&
    Number(data.summary.current.total_expenses) === 0 &&
    data.spending_by_category.length === 0 &&
    data.monthly_income_expenses.every(
      (item) => Number(item.income) === 0 && Number(item.expenses) === 0,
    )
  );
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs, value]);

  return debounced;
}

export function DashboardPage() {
  const { user } = useAuth();
  const { filters } = useDashboardFilters();
  const debouncedFilters = useDebouncedValue(filters, 250);
  const [refreshKey, setRefreshKey] = useState(0);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddForm, setQuickAddForm] = useState<QuickAddForm>(
    createEmptyQuickAddForm,
  );
  const [quickAddErrors, setQuickAddErrors] = useState<
    Partial<Record<keyof QuickAddForm, string>>
  >({});
  const [isSavingTransaction, setIsSavingTransaction] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isOnboardingDismissed, setIsOnboardingDismissed] = useState(false);
  const [analyticsStatus, setAnalyticsStatus] = useState<
    Status<DashboardAnalyticsResponse>
  >({ state: "loading" });
  const [spendingStatus, setSpendingStatus] = useState<
    Status<SpendingInsightResponse>
  >({ state: "loading" });
  const [recurringStatus, setRecurringStatus] = useState<
    Status<RecurringDetectionResponse>
  >({ state: "loading" });
  const [anomaliesStatus, setAnomaliesStatus] = useState<
    Status<AnomalyDetectionResponse>
  >({ state: "loading" });
  const [monthlyStatus, setMonthlyStatus] = useState<
    Status<MonthlySummaryResponse>
  >({ state: "loading" });

  useEffect(() => {
    const handleTransactionsChanged = () => setRefreshKey((current) => current + 1);
    window.addEventListener("moneymate:transactions-changed", handleTransactionsChanged);
    return () => {
      window.removeEventListener(
        "moneymate:transactions-changed",
        handleTransactionsChanged,
      );
    };
  }, []);

  useEffect(() => {
    void transactionsApi.categories().then(setCategories).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    setIsOnboardingDismissed(
      window.localStorage.getItem(onboardingStorageKey(user?.id)) === "true",
    );
  }, [user?.id]);

  useEffect(() => {
    if (debouncedFilters.startDate > debouncedFilters.endDate) {
      setAnalyticsStatus((current) => ({
        state: "error",
        data: current.data,
        error: "Start date must be before or equal to the end date.",
      }));
      return;
    }

    let cancelled = false;
    setAnalyticsStatus((current) => ({
      state: "loading",
      data: current.data,
    }));

    analyticsApi.dashboard({
      startDate: debouncedFilters.startDate,
      endDate: debouncedFilters.endDate,
      categoryIds: debouncedFilters.categoryIds,
      accountIds: debouncedFilters.accountIds,
      trendAggregation: debouncedFilters.trendAggregation,
      months: 12,
    })
      .then((data) => {
        if (!cancelled) {
          setAnalyticsStatus({ state: "success", data });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setAnalyticsStatus((current) => ({
            state: "error",
            data: current.data,
            error: getApiErrorMessage(error),
          }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedFilters, refreshKey]);

  useEffect(() => {
    setSpendingStatus({ state: "loading" });
    setRecurringStatus({ state: "loading" });
    setAnomaliesStatus({ state: "loading" });
    setMonthlyStatus({ state: "loading" });

    let cancelled = false;
    insightsApi.spending()
      .then((data) => {
        if (!cancelled) setSpendingStatus({ state: "success", data });
      })
      .catch(() =>
        !cancelled &&
        setSpendingStatus({
          state: "error",
          error: "MoneyMate could not refresh spending insights right now.",
        }),
      );

    insightsApi.recurring()
      .then((data) => {
        if (!cancelled) setRecurringStatus({ state: "success", data });
      })
      .catch(() =>
        !cancelled &&
        setRecurringStatus({
          state: "error",
          error: "Recurring-charge detection is unavailable for the moment.",
        }),
      );

    insightsApi.anomalies()
      .then((data) => {
        if (!cancelled) setAnomaliesStatus({ state: "success", data });
      })
      .catch(() =>
        !cancelled &&
        setAnomaliesStatus({
          state: "error",
          error: "Anomaly checks are taking a break. Your dashboard data is still available.",
        }),
      );

    insightsApi.monthlySummary()
      .then((data) => {
        if (!cancelled) setMonthlyStatus({ state: "success", data });
      })
      .catch(() =>
        !cancelled &&
        setMonthlyStatus({
          state: "error",
          error: "Monthly AI summary could not load right now.",
        }),
      );
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const analyticsData = analyticsStatus.data;
  const analyticsError =
    analyticsStatus.state === "error" ? analyticsStatus.error : undefined;
  const analyticsLoading = analyticsStatus.state === "loading";
  const categoryOptions = useMemo(
    () => [
      { value: "", label: "Select category" },
      ...Array.from(
        new Set([
          ...categories.map((category) => category.name),
          ...transactionCategories,
        ]),
      )
        .sort()
        .map((category) => ({ value: category, label: category })),
    ],
    [categories],
  );
  const shouldShowOnboarding =
    !isOnboardingDismissed &&
    analyticsStatus.state === "success" &&
    isFirstTimeDashboard(analyticsStatus.data);

  const openQuickAdd = () => {
    setQuickAddForm(createEmptyQuickAddForm());
    setQuickAddErrors({});
    setIsQuickAddOpen(true);
  };

  const dismissOnboarding = () => {
    setIsOnboardingDismissed(true);
    window.localStorage.setItem(onboardingStorageKey(user?.id), "true");
  };

  const applyQuickAddAiSuggestion = async () => {
    const amount = Number(quickAddForm.amount);
    if (!quickAddForm.amount || Number.isNaN(amount)) {
      setQuickAddErrors((current) => ({
        ...current,
        amount: "Enter an amount before asking AI to categorize it.",
      }));
      return;
    }

    try {
      const suggestion = await transactionsApi.suggest({
        amount,
        vendor: quickAddForm.vendor,
        notes: quickAddForm.notes,
      });
      setQuickAddForm((current) => ({
        ...current,
        category: suggestion.category,
      }));
      setQuickAddErrors((current) => ({ ...current, category: undefined }));
      setToast({
        title: "Category suggested",
        message: `MoneyMate suggested ${suggestion.category}.`,
        variant: "info",
      });
    } catch (error) {
      setToast({
        title: "Could not suggest category",
        message: getApiErrorMessage(error),
        variant: "error",
      });
    }
  };

  const submitQuickAdd = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors = validateQuickAddForm(quickAddForm);
    setQuickAddErrors(errors);
    if (Object.keys(errors).length) {
      return;
    }
    setIsSavingTransaction(true);
    try {
      await transactionsApi.create(quickAddPayload(quickAddForm));
      setToast({
        title: "Transaction added",
        message: "Your dashboard will refresh with the latest numbers.",
        variant: "success",
      });
      setQuickAddForm(createEmptyQuickAddForm());
      setIsQuickAddOpen(false);
      dismissOnboarding();
      setRefreshKey((current) => current + 1);
    } catch (error) {
      setToast({
        title: "Could not add transaction",
        message: getApiErrorMessage(error),
        variant: "error",
      });
    } finally {
      setIsSavingTransaction(false);
    }
  };

  return (
    <div className={styles.page}>
      {toast ? (
        <div className={styles.toastDock}>
          <Toast {...toast} onClose={() => setToast(null)} />
        </div>
      ) : null}

      {shouldShowOnboarding ? (
        <div className={styles.onboardingOverlay} role="dialog" aria-modal="true">
          <section className={styles.onboardingCard}>
            <div className={styles.onboardingLogoPanel} aria-hidden="true">
              <img src="/moneymate-logo.png" alt="" />
            </div>
            <div className={styles.onboardingContent}>
              <div>
                <h2>Welcome to MoneyMate!</h2>
                <p>Start by adding your first transaction.</p>
              </div>
              <div className={styles.onboardingActions}>
                <Button onClick={openQuickAdd}>Add Transaction</Button>
                <Button variant="secondary" onClick={dismissOnboarding}>
                  Later
                </Button>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      <div className={styles.dashboardHeader}>
        <div>
          <h2>Your money at a glance</h2>
        </div>
        <Button onClick={openQuickAdd}>+ Quick Add Transaction</Button>
      </div>

      <DashboardFilters
        filtersMeta={analyticsData?.filters}
        isLoading={analyticsLoading}
      />

      <NetPositionSummary
        data={analyticsData}
        error={analyticsError}
        isLoading={analyticsLoading}
      />

      <div className={styles.analyticsGrid}>
        <SpendingDistributionChart
          data={analyticsData}
          error={analyticsError}
          isLoading={analyticsLoading}
        />
        <IncomeExpenseChart
          data={analyticsData}
          error={analyticsError}
          isLoading={analyticsLoading}
        />
        <SpendingTrendChart
          data={analyticsData}
          error={analyticsError}
          isLoading={analyticsLoading}
        />
      </div>

      <Card className={styles.insightCard}>
        <div>
          <p className={styles.kicker}>AI insights</p>
          <h3>Financial signals</h3>
        </div>

        {spendingStatus.state === "loading" && (
          <div role="status" aria-label="Loading spending insights">
            <MoneyMateLoader className={styles.insightLoader} />
          </div>
        )}
        {spendingStatus.state === "error" && (
          <p className={styles.statusError}>
            {spendingStatus.error} Add a few transactions or try again shortly.
          </p>
        )}
        {spendingStatus.state === "success" && <p>{spendingStatus.data.summary}</p>}

        <div className={styles.insightList}>
          <div>
            <strong>Recurring charges</strong>
            {recurringStatus.state === "loading" && (
              <span className={styles.statusLoading}>Checking...</span>
            )}
            {recurringStatus.state === "error" && (
              <span className={styles.statusError}>{recurringStatus.error}</span>
            )}
            {recurringStatus.state === "success" && (
              <span>
                {recurringStatus.data.recurring?.length
                  ? `${recurringStatus.data.recurring.length} subscription(s) detected`
                  : "No recurring pattern yet"}
              </span>
            )}
          </div>
          <div>
            <strong>Anomalies</strong>
            {anomaliesStatus.state === "loading" && (
              <span className={styles.statusLoading}>Checking...</span>
            )}
            {anomaliesStatus.state === "error" && (
              <span className={styles.statusError}>{anomaliesStatus.error}</span>
            )}
            {anomaliesStatus.state === "success" && (
              <span>
                {anomaliesStatus.data.anomalies?.length
                  ? `${anomaliesStatus.data.anomalies.length} unusual transaction(s)`
                  : "Nothing unusual flagged"}
              </span>
            )}
          </div>
          <div>
            <strong>Top category</strong>
            {spendingStatus.state === "loading" && (
              <span className={styles.statusLoading}>Checking...</span>
            )}
            {spendingStatus.state === "error" && (
              <span className={styles.statusError}>Not available yet</span>
            )}
            {spendingStatus.state === "success" && (
              <span>{spendingStatus.data.top_category}</span>
            )}
          </div>
        </div>

        {monthlyStatus.state === "loading" && (
          <div className={styles.monthlySummary}>
            <strong>Monthly summary</strong>
            <div role="status" aria-label="Loading monthly summary">
              <MoneyMateLoader className={styles.insightLoader} />
            </div>
          </div>
        )}
        {monthlyStatus.state === "error" && (
          <div className={styles.monthlySummary}>
            <strong>Monthly summary</strong>
            <p className={styles.statusError}>
              {monthlyStatus.error} Your charts above are still based on saved data.
            </p>
          </div>
        )}
        {monthlyStatus.state === "success" && (
          <div className={styles.monthlySummary}>
            <strong>Monthly summary</strong>
            <p>{monthlyStatus.data.summary}</p>
          </div>
        )}
      </Card>

      <Modal
        isOpen={isQuickAddOpen}
        onClose={() => {
          if (!isSavingTransaction) {
            setIsQuickAddOpen(false);
          }
        }}
        title="Add Transaction"
      >
        <form className={styles.formGrid} onSubmit={submitQuickAdd}>
          <FormField label="Date" error={quickAddErrors.date}>
            <Input
              error={quickAddErrors.date}
              type="date"
              value={quickAddForm.date}
              onChange={(event) =>
                setQuickAddForm((current) => ({
                  ...current,
                  date: event.target.value,
                }))
              }
            />
          </FormField>
          <FormField label="Amount" error={quickAddErrors.amount}>
            <Input
              error={quickAddErrors.amount}
              inputMode="decimal"
              placeholder="-24.50 or 1200"
              value={quickAddForm.amount}
              onChange={(event) =>
                setQuickAddForm((current) => ({
                  ...current,
                  amount: event.target.value,
                }))
              }
            />
          </FormField>
          <FormField label="Vendor">
            <Input
              placeholder="Vendor"
              value={quickAddForm.vendor}
              onChange={(event) =>
                setQuickAddForm((current) => ({
                  ...current,
                  vendor: event.target.value,
                }))
              }
            />
          </FormField>
          <FormField
            helperText={`${quickAddForm.notes.length}/${noteMaxLength} characters`}
            label="Notes"
          >
            <Input
              maxLength={noteMaxLength}
              placeholder="Optional note"
              value={quickAddForm.notes}
              onChange={(event) =>
                setQuickAddForm((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
            />
          </FormField>
          <FormField label="Category" error={quickAddErrors.category}>
            <div className={styles.categoryAiRow}>
              <Select
                aria-label="Transaction category"
                error={quickAddErrors.category}
                options={categoryOptions}
                value={quickAddForm.category}
                onValueChange={(value) =>
                  setQuickAddForm((current) => ({ ...current, category: value }))
                }
              />
              <button
                aria-label="Let AI choose the category"
                className={styles.aiCategoryButton}
                onClick={() => void applyQuickAddAiSuggestion()}
                title="Let AI choose the category"
                type="button"
              >
                <SparklesIcon />
              </button>
            </div>
          </FormField>
          <div className={styles.modalActions}>
            <Button
              disabled={isSavingTransaction}
              type="button"
              variant="secondary"
              onClick={() => setIsQuickAddOpen(false)}
            >
              Cancel
            </Button>
            <Button disabled={isSavingTransaction} type="submit">
              {isSavingTransaction ? "Adding..." : "Add Transaction"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
