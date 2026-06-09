import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Card, FormField, Input } from "../components";
import { setMockAuthSession } from "../utils/auth";
import styles from "./AuthPages.module.css";

export function RegisterPage() {
  const navigate = useNavigate();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();

    setMockAuthSession({ name, email });
    navigate("/dashboard", { replace: true });
  };

  return (
    <main className={styles.authPage}>
      <Card className={styles.panel}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>M</span>
          <div>
            <strong>MoneyMate</strong>
            <span>Smart personal finance</span>
          </div>
        </div>
        <h1 className={styles.title}>Create your account</h1>
        <p className={styles.intro}>
          Registration is mocked for Epic 1, so any values will continue to the app.
        </p>
        <form className={styles.form} onSubmit={handleSubmit}>
          <FormField htmlFor="name" label="Full name">
            <Input
              autoComplete="name"
              id="name"
              name="name"
              placeholder="Your name"
              required
            />
          </FormField>
          <FormField htmlFor="email" label="Email">
            <Input
              autoComplete="email"
              id="email"
              name="email"
              placeholder="you@example.com"
              required
              type="email"
            />
          </FormField>
          <FormField htmlFor="password" label="Password" helperText="Use any demo password.">
            <Input
              autoComplete="new-password"
              id="password"
              name="password"
              placeholder="Create a password"
              required
              type="password"
            />
          </FormField>
          <Button type="submit">Register</Button>
        </form>
        <p className={styles.switchText}>
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </Card>
    </main>
  );
}
