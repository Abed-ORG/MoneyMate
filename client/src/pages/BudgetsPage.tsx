import { Card } from "../components";
import styles from "./PlaceholderPage.module.css";

export function BudgetsPage() {
  return (
    <section className={styles.page}>
      <Card className={styles.card}>
        <h2>Budgets</h2>
        <p>
          Budget setup and category tracking will be added after the foundation
          is in place.
        </p>
      </Card>
    </section>
  );
}
