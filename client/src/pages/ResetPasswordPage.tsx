import { type FormEvent, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, getApiErrorMessage } from "../services/api";
import styles from "./AuthRecoveryPage.module.css";

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const token = searchParams.get("token") ?? "";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const newPassword = String(formData.get("newPassword") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (!token) {
      setMessage("This password reset link is missing its token.");
      setIsError(true);
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage("Passwords do not match.");
      setIsError(true);
      return;
    }

    setMessage("");
    setIsError(false);
    setIsSubmitting(true);
    try {
      const response = await api.post<{ message: string }>(
        "/auth/reset-password",
        { token, new_password: newPassword },
      );
      setMessage(response.message);
      setIsComplete(true);
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
        <h1>Choose a new password</h1>
        <p className={styles.intro}>
          Use at least eight characters. This reset link can only be used once.
        </p>

        {!isComplete ? (
          <form className={styles.form} onSubmit={handleSubmit}>
            <label className={styles.field} htmlFor="new-password">
              <span>New password</span>
              <input
                autoComplete="new-password"
                id="new-password"
                minLength={8}
                name="newPassword"
                placeholder="Enter a new password"
                required
                type="password"
              />
            </label>
            <label className={styles.field} htmlFor="confirm-password">
              <span>Confirm new password</span>
              <input
                autoComplete="new-password"
                id="confirm-password"
                minLength={8}
                name="confirmPassword"
                placeholder="Re-enter your new password"
                required
                type="password"
              />
            </label>
            <button className={styles.submit} disabled={isSubmitting} type="submit">
              {isSubmitting ? "Updating password..." : "Save new password"}
            </button>
          </form>
        ) : null}

        {message ? (
          <p className={`${styles.message} ${isError ? styles.error : ""}`}>
            {message}
          </p>
        ) : null}

        <p className={styles.footer}>
          {isComplete ? (
            <Link to="/login">Continue to login</Link>
          ) : (
            <>
              Need a new link? <Link to="/forgot-password">Request another</Link>
            </>
          )}
        </p>
      </section>
    </main>
  );
}
