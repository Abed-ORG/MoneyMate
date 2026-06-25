import { useEffect, useState } from "react";
import { Card } from "../components";
import {
  DashboardFilters,
  IncomeExpenseChart,
  NetPositionSummary,
  SpendingDistributionChart,
  SpendingTrendChart,
} from "../components/DashboardAnalytics/DashboardAnalytics";
import { useDashboardFilters } from "../contexts/DashboardFiltersContext";
import { analyticsApi } from "../services/analytics";
import { getApiErrorMessage } from "../services/api";
import { insightsApi } from "../services/insights";
import type { DashboardAnalyticsResponse } from "../types/analytics";
import type {
  AnomalyDetectionResponse,
  MonthlySummaryResponse,
  RecurringDetectionResponse,
  SpendingInsightResponse,
} from "../services/insights";
import styles from "./DashboardPage.module.css";

type Status<T> =
  | { state: "loading"; data?: T }
  | { state: "success"; data: T }
  | { state: "error"; error: string; data?: T };

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs, value]);

  return debounced;
}

export function DashboardPage() {
  const { filters } = useDashboardFilters();
  const debouncedFilters = useDebouncedValue(filters, 250);
  const [refreshKey, setRefreshKey] = useState(0);
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
    insightsApi.spending()
      .then((data) => setSpendingStatus({ state: "success", data }))
      .catch(() =>
        setSpendingStatus({
          state: "error",
          error: "Failed to load spending insights.",
        }),
      );

    insightsApi.recurring()
      .then((data) => setRecurringStatus({ state: "success", data }))
      .catch(() =>
        setRecurringStatus({
          state: "error",
          error: "Failed to load recurring charges.",
        }),
      );

    insightsApi.anomalies()
      .then((data) => setAnomaliesStatus({ state: "success", data }))
      .catch(() =>
        setAnomaliesStatus({
          state: "error",
          error: "Failed to detect anomalies.",
        }),
      );

    insightsApi.monthlySummary()
      .then((data) => setMonthlyStatus({ state: "success", data }))
      .catch(() =>
        setMonthlyStatus({
          state: "error",
          error: "Failed to load monthly summary.",
        }),
      );
  }, []);

  const analyticsData = analyticsStatus.data;
  const analyticsError =
    analyticsStatus.state === "error" ? analyticsStatus.error : undefined;
  const analyticsLoading = analyticsStatus.state === "loading";

  return (
    <div className={styles.page}>
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
          <p className={styles.statusLoading}>Loading spending insights...</p>
        )}
        {spendingStatus.state === "error" && (
          <p className={styles.statusError}>{spendingStatus.error}</p>
        )}
        {spendingStatus.state === "success" && <p>{spendingStatus.data.summary}</p>}

        <div className={styles.insightList}>
          <div>
            <strong>Recurring charges</strong>
            {recurringStatus.state === "loading" && (
              <span className={styles.statusLoading}>Loading...</span>
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
              <span className={styles.statusLoading}>Loading...</span>
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
              <span className={styles.statusLoading}>Loading...</span>
            )}
            {spendingStatus.state === "error" && (
              <span className={styles.statusError}>n/a</span>
            )}
            {spendingStatus.state === "success" && (
              <span>{spendingStatus.data.top_category}</span>
            )}
          </div>
        </div>

        {monthlyStatus.state === "loading" && (
          <div className={styles.monthlySummary}>
            <strong>Monthly summary</strong>
            <p className={styles.statusLoading}>Loading...</p>
          </div>
        )}
        {monthlyStatus.state === "error" && (
          <div className={styles.monthlySummary}>
            <strong>Monthly summary</strong>
            <p className={styles.statusError}>{monthlyStatus.error}</p>
          </div>
        )}
        {monthlyStatus.state === "success" && (
          <div className={styles.monthlySummary}>
            <strong>Monthly summary</strong>
            <p>{monthlyStatus.data.summary}</p>
          </div>
        )}
      </Card>
    </div>
  );
}
