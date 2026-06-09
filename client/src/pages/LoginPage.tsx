import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button, Card, FormField, Input } from "../components";
import { setMockAuthSession } from "../utils/auth";
import styles from "./AuthPages.module.css";

type RedirectState = {
  from?: {
    pathname?: string;
  };
};

function getDisplayNameFromEmail(email: string) {
  const localPart = email.split("@")[0];
  const name = localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase()}${part.slice(1)}`)
    .join(" ");

  return name || "Demo user";
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo =
    (location.state as RedirectState | null)?.from?.pathname ?? "/dashboard";

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const name = getDisplayNameFromEmail(email);

    setMockAuthSession({ name, email });
    navigate(redirectTo, { replace: true });
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
        <h1 className={styles.title}>Welcome back</h1>
        <p className={styles.intro}>
          Sign in with any demo values to enter the protected app shell.
        </p>
        <form className={styles.form} onSubmit={handleSubmit}>
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
          <FormField htmlFor="password" label="Password">
            <Input
              autoComplete="current-password"
              id="password"
              name="password"
              placeholder="Demo password"
              required
              type="password"
            />
          </FormField>
          <Button type="submit">Log in</Button>
        </form>
        <p className={styles.switchText}>
          New to MoneyMate? <Link to="/register">Create an account</Link>
        </p>
      </Card>
    </main>
  );
}
