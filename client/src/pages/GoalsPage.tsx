import { Card } from "../components";
import styles from "./PlaceholderPage.module.css";

export function GoalsPage() {
  return (
    <section className={styles.page}>
      <Card className={styles.card}>
        <h2>Goals</h2>
        <p>
          Savings goals and progress tracking will be implemented in a future
          feature slice.
        </p>
      </Card>
    </section>
  );
}
