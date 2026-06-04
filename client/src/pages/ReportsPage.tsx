import { Card } from "../components";
import styles from "./PlaceholderPage.module.css";

export function ReportsPage() {
  return (
    <section className={styles.page}>
      <Card className={styles.card}>
        <h2>Reports</h2>
        <p>
          Financial reports and exports will use this route once reporting
          requirements are ready.
        </p>
      </Card>
    </section>
  );
}
