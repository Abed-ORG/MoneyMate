import { useEffect, useState } from "react";
import { Card } from "../components";
import { SpendingChart } from "../components/Charts/SpendingChart";
import { transactionsApi } from "../services/transactions";
import { insightsApi } from "../services/insights";
import type { Transaction } from "../types/transaction";
import type { SpendingInsightResponse, RecurringDetectionResponse, AnomalyDetectionResponse, MonthlySummaryResponse } from "../services/insights";
import styles from "./DashboardPage.module.css";

const summaries = [
  { label: "Monthly balance", value: "$4,280", detail: "+12% from last month" },
  { label: "Budget used", value: "68%", detail: "$1,755 left this month" },
  { label: "Savings goal", value: "$8,900", detail: "74% toward vacation fund" },
  { label: "Upcoming bills", value: "$620", detail: "Due over the next 7 days" },
];

type Status<T> =
  | { state: "loading" }
  | { state: "success"; data: T }
  | { state: "error"; error: string };

export function DashboardPage() {
  const [_transactions, setTransactions] = useState<Transaction[]>([]);
  const [spendingStatus, setSpendingStatus] = useState<Status<SpendingInsightResponse>>({ state: "loading" });
  const [recurringStatus, setRecurringStatus] = useState<Status<RecurringDetectionResponse>>({ state: "loading" });
  const [anomaliesStatus, setAnomaliesStatus] = useState<Status<AnomalyDetectionResponse>>({ state: "loading" });
  const [monthlyStatus, setMonthlyStatus] = useState<Status<MonthlySummaryResponse>>({ state: "loading" });

  useEffect(() => {
    void transactionsApi.list({ page: 1, pageSize: 200, sortBy: "date", sortDir: "desc" }).then((res) => {
      setTransactions(res.items);
    });

    insightsApi.spending()
      .then((data) => setSpendingStatus({ state: "success", data }))
      .catch(() => setSpendingStatus({ state: "error", error: "Failed to load spending insights." }));

    insightsApi.recurring()
      .then((data) => setRecurringStatus({ state: "success", data }))
      .catch(() => setRecurringStatus({ state: "error", error: "Failed to load recurring charges." }));

    insightsApi.anomalies()
      .then((data) => setAnomaliesStatus({ state: "success", data }))
      .catch(() => setAnomaliesStatus({ state: "error", error: "Failed to detect anomalies." }));

    insightsApi.monthlySummary()
      .then((data) => setMonthlyStatus({ state: "success", data }))
      .catch(() => setMonthlyStatus({ state: "error", error: "Failed to load monthly summary." }));
  }, []);

  return (
    <div className={styles.page}>
      <section className={styles.summaryGrid} aria-label="Financial summary">
        {summaries.map((item) => (
          <Card className={styles.summaryCard} key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <p>{item.detail}</p>
          </Card>
        ))}
      </section>

      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>Demo dashboard</p>
          <h2>Your money snapshot</h2>
          <p>Mock account data for validating the MoneyMate frontend foundation, routing, components, and charting setup.</p>
        </div>
      </section>

      <div className={styles.twoCol}>
        <Card className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <div>
              <h3>Spending vs budget</h3>
              <p>Sample category spending with Recharts responsive sizing.</p>
            </div>
            <span className={styles.badge}>Mock data</span>
          </div>
          <SpendingChart />
        </Card>

        <Card className={styles.insightCard}>
          <h3>AI spending insights</h3>

          {spendingStatus.state === "loading" && <p className={styles.statusLoading}>Loading spending insights...</p>}
          {spendingStatus.state === "error" && <p className={styles.statusError}>{spendingStatus.error}</p>}
          {spendingStatus.state === "success" && <p>{spendingStatus.data.summary}</p>}

          <div className={styles.insightList}>
            <div>
              <strong>Recurring charges</strong>
              {recurringStatus.state === "loading" && <span className={styles.statusLoading}>Loading...</span>}
              {recurringStatus.state === "error" && <span className={styles.statusError}>{recurringStatus.error}</span>}
              {recurringStatus.state === "success" && (
                <span>{recurringStatus.data.recurring?.length ? `${recurringStatus.data.recurring.length} subscription(s) detected` : "No recurring pattern yet"}</span>
              )}
            </div>
            <div>
              <strong>Anomalies</strong>
              {anomaliesStatus.state === "loading" && <span className={styles.statusLoading}>Loading...</span>}
              {anomaliesStatus.state === "error" && <span className={styles.statusError}>{anomaliesStatus.error}</span>}
              {anomaliesStatus.state === "success" && (
                <span>{anomaliesStatus.data.anomalies?.length ? `${anomaliesStatus.data.anomalies.length} unusual transaction(s)` : "Nothing unusual flagged"}</span>
              )}
            </div>
            <div>
              <strong>Top category</strong>
              {spendingStatus.state === "loading" && <span className={styles.statusLoading}>Loading...</span>}
              {spendingStatus.state === "error" && <span className={styles.statusError}>n/a</span>}
              {spendingStatus.state === "success" && <span>{spendingStatus.data.top_category}</span>}
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
    </div>
  );
}
