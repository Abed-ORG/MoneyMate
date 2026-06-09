import { Card } from "../components";
import styles from "./PlaceholderPage.module.css";

export function ChatPage() {
  return (
    <section className={styles.page}>
      <Card className={styles.card}>
        <h2>Chat</h2>
        <p>
          The AI financial assistant will appear here when backend and AI
          integrations are introduced.
        </p>
      </Card>
    </section>
  );
}
