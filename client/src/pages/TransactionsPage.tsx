import { Card } from "../components";
import styles from "./PlaceholderPage.module.css";

export function TransactionsPage() {
  return (
    <section className={styles.page}>
      <Card className={styles.card}>
        <h2>Transactions</h2>
        <p>
          Transaction tracking will live here in a later epic. This placeholder
          confirms the protected route and app shell are ready.
        </p>
      </Card>
    </section>
  );
}
