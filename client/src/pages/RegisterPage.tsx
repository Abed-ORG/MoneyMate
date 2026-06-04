import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Card, FormField, Input } from "../components";
import { setMockAuthToken } from "../utils/auth";
import styles from "./AuthPages.module.css";

export function RegisterPage() {
  const navigate = useNavigate();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMockAuthToken();
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
            <Input id="name" name="name" placeholder="Celine Salameh" />
          </FormField>
          <FormField htmlFor="email" label="Email">
            <Input id="email" name="email" placeholder="celine@example.com" type="email" />
          </FormField>
          <FormField htmlFor="password" label="Password" helperText="Use any demo password.">
            <Input id="password" name="password" placeholder="Create a password" type="password" />
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
