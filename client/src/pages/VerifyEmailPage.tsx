import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button, Card, LoadingSpinner } from "../components";
import { api, getApiErrorMessage } from "../services/api";
import styles from "./VerifyEmailPage.module.css";

type VerificationState = "loading" | "success" | "error";

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<VerificationState>("loading");
  const [message, setMessage] = useState("Verifying your email address...");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setState("error");
      setMessage("This verification link is missing its token.");
      return;
    }

    const verify = async () => {
      try {
        const response = await api.post<{ message: string }>("/auth/verify-email", {
          token,
        });
        setMessage(response.message);
        setState("success");
      } catch (error) {
        setMessage(getApiErrorMessage(error));
        setState("error");
      }
    };

    void verify();
  }, [searchParams]);

  return (
    <main className={styles.page}>
      <Card className={styles.card}>
        <img src="/moneymate-logo.png" alt="MoneyMate" />
        {state === "loading" ? (
          <LoadingSpinner label={message} />
        ) : (
          <>
            <p className={state === "success" ? styles.success : styles.error}>
              {state === "success" ? "Email verified" : "Verification failed"}
            </p>
            <h1>{message}</h1>
            <p>
              {state === "success"
                ? "You can now log in and continue setting up MoneyMate."
                : "Return to login to request a new verification email."}
            </p>
            <Link to="/login">
              <Button>{state === "success" ? "Continue to login" : "Back to login"}</Button>
            </Link>
          </>
        )}
      </Card>
    </main>
  );
}
