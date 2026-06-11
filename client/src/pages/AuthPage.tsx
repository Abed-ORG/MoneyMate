import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { api, type ApiError, getApiErrorMessage } from "../services/api";
import { consumeAuthNotice } from "../utils/auth";
import styles from "./AuthPages.module.css";

type AuthMode = "login" | "register";

type AuthPageProps = {
  initialMode: AuthMode;
};

type RedirectState = {
  from?: {
    pathname?: string;
  };
  verificationSent?: boolean;
  email?: string;
};

type PasswordFieldProps = {
  autoComplete: string;
  id: string;
  label: string;
  name: string;
  placeholder: string;
  visible: boolean;
  disabled?: boolean;
  onToggle: () => void;
};

function EyeIcon({ visible }: { visible: boolean }) {
  return visible ? (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.75" />
    </svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m3 3 18 18" />
      <path d="M10.6 6.15A9.5 9.5 0 0 1 12 6c6 0 9.5 6 9.5 6a16.5 16.5 0 0 1-2.1 2.75M6.2 6.2C3.85 8.1 2.5 12 2.5 12s3.5 6 9.5 6a9.6 9.6 0 0 0 3.1-.5" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}

function PasswordField({
  autoComplete,
  id,
  label,
  name,
  placeholder,
  visible,
  disabled,
  onToggle,
}: PasswordFieldProps) {
  return (
    <label className={styles.field} htmlFor={id}>
      <span>{label}</span>
      <span className={styles.passwordWrap}>
        <input
          autoComplete={autoComplete}
          disabled={disabled}
          id={id}
          name={name}
          placeholder={placeholder}
          required
          type={visible ? "text" : "password"}
        />
        <button
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          className={styles.eyeButton}
          disabled={disabled}
          onClick={onToggle}
          type="button"
        >
          <EyeIcon visible={visible} />
        </button>
      </span>
    </label>
  );
}

export function AuthPage({ initialMode }: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loginPasswordVisible, setLoginPasswordVisible] = useState(false);
  const [registerPasswordVisible, setRegisterPasswordVisible] = useState(false);
  const [verifyPasswordVisible, setVerifyPasswordVisible] = useState(false);
  const [formError, setFormError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [showResend, setShowResend] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [submittingMode, setSubmittingMode] = useState<AuthMode | null>(null);
  const navigationTimer = useRef<number>();
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoading, login, register } = useAuth();
  const redirectState = location.state as RedirectState | null;

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (redirectState?.email) {
      setLoginEmail(redirectState.email);
    }
    if (redirectState?.verificationSent) {
      setAuthNotice(
        "Account created. Check your email and open the verification link before logging in.",
      );
      return;
    }
    if (!isLoading) {
      setAuthNotice(consumeAuthNotice() ?? "");
    }
  }, [isLoading, redirectState?.email, redirectState?.verificationSent]);

  useEffect(
    () => () => {
      if (navigationTimer.current) {
        window.clearTimeout(navigationTimer.current);
      }
    },
    [],
  );

  const switchMode = (nextMode: AuthMode, event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();

    if (nextMode === mode) {
      return;
    }

    setMode(nextMode);
    setFormError("");
    setAuthNotice("");
    setShowResend(false);
    navigationTimer.current = window.setTimeout(() => {
      navigate(nextMode === "login" ? "/login" : "/register");
    }, 520);
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const redirectTo =
      redirectState?.from?.pathname ?? "/dashboard";

    setFormError("");
    setAuthNotice("");
    setSubmittingMode("login");
    try {
      const profile = await login({ email, password });
      const destination =
        !profile.onboarding_completed && !profile.onboarding_skipped
          ? "/onboarding"
          : redirectTo;
      navigate(destination, { replace: true });
    } catch (error) {
      setFormError(getApiErrorMessage(error));
      setShowResend((error as ApiError)?.status === 403);
    } finally {
      setSubmittingMode(null);
    }
  };

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const verifyPassword = String(formData.get("verifyPassword") ?? "");

    if (password !== verifyPassword) {
      setFormError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setFormError("Password must contain at least 8 characters.");
      return;
    }

    setFormError("");
    setSubmittingMode("register");
    try {
      await register({
        full_name: `${firstName} ${lastName}`.trim(),
        email,
        password,
      });
      navigate("/login", {
        replace: true,
        state: { verificationSent: true, email },
      });
    } catch (error) {
      setFormError(getApiErrorMessage(error));
    } finally {
      setSubmittingMode(null);
    }
  };

  const handleResendVerification = async () => {
    if (!loginEmail.trim()) {
      setFormError("Enter your email address first.");
      return;
    }
    setIsResending(true);
    setFormError("");
    try {
      const response = await api.post<{ message: string }>(
        "/auth/resend-verification",
        { email: loginEmail.trim() },
      );
      setAuthNotice(response.message);
      setShowResend(false);
    } catch (error) {
      setFormError(getApiErrorMessage(error));
    } finally {
      setIsResending(false);
    }
  };

  const handleNameChange =
    (setter: (value: string) => void) => (event: ChangeEvent<HTMLInputElement>) => {
      setter(event.target.value);
    };

  const cardholderName =
    `${firstName} ${lastName}`.trim().toUpperCase() || "JOHN DOE";
  const isLogin = mode === "login";

  return (
    <main className={styles.authPage}>
      <div className={`${styles.authFrame} ${isLogin ? styles.loginMode : styles.registerMode}`}>
        <Link className={styles.backLink} to="/" aria-label="Back to MoneyMate home">
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="m15 18-6-6 6-6" />
          </svg>
          <span>Back home</span>
        </Link>

        <section
          aria-hidden={!isLogin}
          className={`${styles.formPanel} ${styles.loginPanel}`}
        >
          <form className={styles.authForm} onSubmit={handleLogin}>
            <h1>Log in to your MoneyMate account</h1>

            {authNotice && isLogin ? (
              <p className={styles.formNotice}>{authNotice}</p>
            ) : null}

            <label className={styles.field} htmlFor="login-email">
              <span>Email</span>
              <input
                autoComplete="email"
                disabled={!isLogin}
                id="login-email"
                name="email"
                placeholder="Enter your email address"
                required
                type="email"
                onChange={(event) => setLoginEmail(event.target.value)}
                value={loginEmail}
              />
            </label>

            <PasswordField
              autoComplete="current-password"
              disabled={!isLogin}
              id="login-password"
              label="Password"
              name="password"
              onToggle={() => setLoginPasswordVisible((current) => !current)}
              placeholder="Enter your password"
              visible={loginPasswordVisible}
            />

            {formError && isLogin ? <p className={styles.formError}>{formError}</p> : null}

            {showResend && isLogin ? (
              <button
                className={styles.resendButton}
                disabled={isResending}
                onClick={handleResendVerification}
                type="button"
              >
                {isResending ? "Sending..." : "Resend verification email"}
              </button>
            ) : null}

            <button
              className={styles.submitButton}
              disabled={!isLogin || submittingMode === "login"}
              type="submit"
            >
              {submittingMode === "login" ? "Logging in..." : "Log In"}
            </button>

            <p className={styles.switchText}>
              Don&apos;t have an account?{" "}
              <a href="/register" onClick={(event) => switchMode("register", event)}>
                Sign up
              </a>
            </p>
          </form>
        </section>

        <section
          aria-hidden={isLogin}
          className={`${styles.formPanel} ${styles.registerPanel}`}
        >
          <form className={`${styles.authForm} ${styles.registerForm}`} onSubmit={handleRegister}>
            <h1>Create your MoneyMate account</h1>

            <div className={styles.nameFields}>
              <label className={styles.field} htmlFor="first-name">
                <span>First Name</span>
                <input
                  autoComplete="given-name"
                  disabled={isLogin}
                  id="first-name"
                  name="firstName"
                  onChange={handleNameChange(setFirstName)}
                  placeholder="Enter your first name"
                  required
                  value={firstName}
                />
              </label>
              <label className={styles.field} htmlFor="last-name">
                <span>Last Name</span>
                <input
                  autoComplete="family-name"
                  disabled={isLogin}
                  id="last-name"
                  name="lastName"
                  onChange={handleNameChange(setLastName)}
                  placeholder="Enter your last name"
                  required
                  value={lastName}
                />
              </label>
            </div>

            <label className={styles.field} htmlFor="register-email">
              <span>Email</span>
              <input
                autoComplete="email"
                disabled={isLogin}
                id="register-email"
                name="email"
                placeholder="Enter your email address"
                required
                type="email"
              />
            </label>

            <PasswordField
              autoComplete="new-password"
              disabled={isLogin}
              id="register-password"
              label="Password"
              name="password"
              onToggle={() => setRegisterPasswordVisible((current) => !current)}
              placeholder="Create a strong password"
              visible={registerPasswordVisible}
            />

            <PasswordField
              autoComplete="new-password"
              disabled={isLogin}
              id="verify-password"
              label="Verify Password"
              name="verifyPassword"
              onToggle={() => setVerifyPasswordVisible((current) => !current)}
              placeholder="Re-enter your password"
              visible={verifyPasswordVisible}
            />

            {formError && !isLogin ? <p className={styles.formError}>{formError}</p> : null}

            <button
              className={styles.submitButton}
              disabled={isLogin || submittingMode === "register"}
              type="submit"
            >
              {submittingMode === "register" ? "Creating account..." : "Create Account"}
            </button>

            <p className={styles.switchText}>
              Already have an account?{" "}
              <a href="/login" onClick={(event) => switchMode("login", event)}>
                Log in
              </a>
            </p>
          </form>
        </section>

        <section className={styles.cardPanel} aria-label="MoneyMate card preview">
          <div className={styles.creditCard}>
            <div className={styles.cardTop}>
              <strong>
                Money<span>Mate</span>
              </strong>
              <svg className={styles.contactless} aria-label="Contactless" viewBox="0 0 46 46">
                <path d="M15 13c5 5 5 15 0 20" />
                <path d="M22 9c8 8 8 20 0 28" />
                <path d="M29 5c11 11 11 25 0 36" />
              </svg>
            </div>

            <div className={styles.chip} aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </div>

            <p className={styles.cardNumber}>1234 5678 9012 3456</p>

            <div className={styles.cardBottom}>
              <div>
                <span className={styles.expiry}>01/01</span>
                <span className={styles.cardholder}>{cardholderName}</span>
              </div>
              <img src="/moneymate-logo.png" alt="MoneyMate" />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
