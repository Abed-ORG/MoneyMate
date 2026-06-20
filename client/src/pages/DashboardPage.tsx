import { Card } from "../components";
import { SpendingChart } from "../components/Charts/SpendingChart";
import styles from "./DashboardPage.module.css";

const summaries = [
  { label: "Monthly balance", value: "$4,280", detail: "+12% from last month" },
  { label: "Budget used", value: "68%", detail: "$1,755 left this month" },
  { label: "Savings goal", value: "$8,900", detail: "74% toward vacation fund" },
  { label: "Upcoming bills", value: "$620", detail: "Due over the next 7 days" },
];

export function DashboardPage() {
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
          <p>
            Mock account data for validating the MoneyMate frontend foundation,
            routing, components, and charting setup.
          </p>
        </div>
      </section>

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
    </div>
  );
}
