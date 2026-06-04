import { useNavigate } from "react-router-dom";
import { Button, Card } from "../components";
import styles from "./NotFoundPage.module.css";

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <main className={styles.notFound}>
      <Card className={styles.card}>
        <p className={styles.code}>404</p>
        <h1>Page not found</h1>
        <p>The page you are looking for does not exist in MoneyMate.</p>
        <Button onClick={() => navigate("/dashboard")}>
          Go to dashboard
        </Button>
      </Card>
    </main>
  );
}
