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

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export function DashboardPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [spendingInsights, setSpendingInsights] = useState<SpendingInsightResponse | null>(null);
  const [recurring, setRecurring] = useState<RecurringDetectionResponse | null>(null);
  const [anomalies, setAnomalies] = useState<AnomalyDetectionResponse | null>(null);
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummaryResponse | null>(null);

  useEffect(() => {
    void transactionsApi.list({ page: 1, pageSize: 200, sortBy: "date", sortDir: "desc" }).then((res) => {
      setTransactions(res.items);
    });
    // Fetch AI insights from backend
    void insightsApi.spending().then(setSpendingInsights);
    void insightsApi.recurring().then(setRecurring);
    void insightsApi.anomalies().then(setAnomalies);
    void insightsApi.monthlySummary().then(setMonthlySummary);
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
          <p>{spendingInsights?.summary ?? "Loading insights..."}</p>
          <div className={styles.insightList}>
            <div>
              <strong>Recurring charges</strong>
              <span>{recurring?.recurring?.length ? `${recurring.recurring.length} subscription(s) detected` : "No recurring pattern yet"}</span>
            </div>
            <div>
              <strong>Anomalies</strong>
              <span>{anomalies?.anomalies?.length ? `${anomalies.anomalies.length} unusual transaction(s)` : "Nothing unusual flagged"}</span>
            </div>
            <div>
              <strong>Top category</strong>
              <span>{spendingInsights?.top_category ?? "n/a"}</span>
            </div>
          </div>
          {monthlySummary && (
            <div className={styles.monthlySummary}>
              <strong>Monthly summary</strong>
              <p>{monthlySummary.summary}</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
