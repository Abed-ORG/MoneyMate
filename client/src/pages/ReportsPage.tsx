import { NavLink } from "react-router-dom";
import { Card } from "../components";
import styles from "./ReportsPage.module.css";

export function ReportsPage() {
  return (
    <section className={styles.page}>
      <div className={styles.hero}>
        <p className={styles.kicker}>Reporting & exports</p>
        <h2>Review monthly and annual performance</h2>
        <p>
          Track income, expenses, savings, budgets, and export-ready summaries from one
          place.
        </p>
      </div>

      <div className={styles.links}>
        <NavLink className={styles.linkCard} to="/reports/monthly">
          <Card className={styles.card}>
            <strong>Monthly report</strong>
            <span>Analyze one month at a time with budget adherence and top spend categories.</span>
          </Card>
        </NavLink>
        <NavLink className={styles.linkCard} to="/reports/annual">
          <Card className={styles.card}>
            <strong>Annual report</strong>
            <span>See year-over-year performance and a month-by-month breakdown.</span>
          </Card>
        </NavLink>
      </div>
    </section>
  );
}
