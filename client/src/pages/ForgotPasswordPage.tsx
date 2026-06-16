import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { api, getApiErrorMessage } from "../services/api";
import styles from "./AuthRecoveryPage.module.css";

export function ForgotPasswordPage() {
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const email = String(formData.get("email") ?? "").trim();

    setMessage("");
    setIsError(false);
    setIsSubmitting(true);
    try {
      const response = await api.post<{ message: string }>(
        "/auth/forgot-password",
        { email },
      );
      setMessage(response.message);
      form.reset();
    } catch (error) {
      setMessage(getApiErrorMessage(error));
      setIsError(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <Link className={styles.brand} to="/">
          <img src="/moneymate-logo.png" alt="" />
          <span>MoneyMate</span>
        </Link>
        <h1>Reset your password</h1>
        <p className={styles.intro}>
          Enter your account email and we will send a secure, single-use reset
          link.
        </p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.field} htmlFor="forgot-email">
            <span>Email address</span>
            <input
              autoComplete="email"
              id="forgot-email"
              name="email"
              placeholder="you@example.com"
              required
              type="email"
            />
          </label>
          <button className={styles.submit} disabled={isSubmitting} type="submit">
            {isSubmitting ? "Sending link..." : "Send reset link"}
          </button>
        </form>

        {message ? (
          <p className={`${styles.message} ${isError ? styles.error : ""}`}>
            {message}
          </p>
        ) : null}

        <p className={styles.footer}>
          Remembered your password? <Link to="/login">Back to login</Link>
        </p>
      </section>
    </main>
  );
}
