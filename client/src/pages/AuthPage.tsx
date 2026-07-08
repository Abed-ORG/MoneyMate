import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getApiErrorMessage } from "../services/api";
import { consumeAuthNotice } from "../utils/auth";
import {
  clearRememberedCredentials,
  isRememberMeEnabled,
  loadRememberedCredentials,
  saveRememberedCredentials,
} from "../utils/rememberMe";
import styles from "./AuthPages.module.css";

type AuthMode = "login" | "register";

type AuthPageProps = {
  initialMode: AuthMode;
};

type RedirectState = {
  from?: {
    pathname?: string;
  };
  accountCreated?: boolean;
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
  error?: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
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
  error,
  value,
  onChange,
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
          onChange={onChange}
          placeholder={placeholder}
          required
          type={visible ? "text" : "password"}
          value={value}
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
      {error ? <p className={styles.fieldError}>{error}</p> : null}
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
  const [loginPassword, setLoginPassword] = useState("");
  const [loginErrors, setLoginErrors] = useState<{ email?: string; password?: string }>({});
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [verifyPassword, setVerifyPassword] = useState("");
  const [registerErrors, setRegisterErrors] = useState<{
    firstName?: string;
    lastName?: string;
    email?: string;
    password?: string;
    verifyPassword?: string;
  }>({});
  const [rememberMe, setRememberMe] = useState(false);
  const [submittingMode, setSubmittingMode] = useState<AuthMode | null>(null);
  const navigationTimer = useRef<number>();
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoading, login, register } = useAuth();
  const redirectState = location.state as RedirectState | null;

  // On mount, restore remembered credentials if they exist.
  useEffect(() => {
    const credentials = loadRememberedCredentials();
    if (credentials && isRememberMeEnabled()) {
      setLoginEmail(credentials.email);
      setLoginPassword(credentials.password);
      setRememberMe(true);
    }
  }, []);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (redirectState?.email) {
      setLoginEmail(redirectState.email);
    }
    if (redirectState?.accountCreated) {
      setAuthNotice("Account created. You can log in now.");
      return;
    }
    if (!isLoading) {
      setAuthNotice(consumeAuthNotice() ?? "");
    }
  }, [isLoading, redirectState?.accountCreated, redirectState?.email]);

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
    navigationTimer.current = window.setTimeout(() => {
      navigate(nextMode === "login" ? "/login" : "/register");
    }, 520);
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = loginEmail.trim();
    const password = loginPassword;
    const errors: { email?: string; password?: string } = {};

    if (!email) {
      errors.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = "Please enter a valid email address.";
    }

    if (!password) {
      errors.password = "Password is required.";
    } else if (password.length < 8) {
      errors.password = "Password must be at least 8 characters.";
    }

    setLoginErrors(errors);
    if (Object.keys(errors).length) {
      return;
    }

    const redirectTo = redirectState?.from?.pathname ?? "/dashboard";

    setFormError("");
    setAuthNotice("");
    setSubmittingMode("login");
    try {
      const profile = await login({ email, password });

      // Persist or clear remembered credentials based on checkbox state.
      if (rememberMe) {
        saveRememberedCredentials(email, password);
      } else {
        clearRememberedCredentials();
      }

      const destination =
        !profile.onboarding_completed && !profile.onboarding_skipped
          ? "/onboarding"
          : redirectTo;
      navigate(destination, { replace: true });
    } catch (error) {
      setFormError(getApiErrorMessage(error));
    } finally {
      setSubmittingMode(null);
    }
  };

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = registerEmail.trim();
    const password = registerPassword;
    const verifyPasswordValue = verifyPassword;
    const errors: {
      firstName?: string;
      lastName?: string;
      email?: string;
      password?: string;
      verifyPassword?: string;
    } = {};

    if (!firstName.trim()) {
      errors.firstName = "First name is required.";
    }

    if (!lastName.trim()) {
      errors.lastName = "Last name is required.";
    }

    if (!email) {
      errors.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = "Please enter a valid email address.";
    }

    if (!password) {
      errors.password = "Password is required.";
    } else if (password.length < 8) {
      errors.password = "Password must be at least 8 characters.";
    }

    if (!verifyPasswordValue) {
      errors.verifyPassword = "Please confirm your password.";
    } else if (password !== verifyPasswordValue) {
      errors.verifyPassword = "Passwords do not match.";
    }

    setRegisterErrors(errors);
    if (Object.keys(errors).length) {
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
        state: { accountCreated: true, email },
      });
    } catch (error) {
      setFormError(getApiErrorMessage(error));
    } finally {
      setSubmittingMode(null);
    }
  };

  const passwordStrength = (() => {
    const pw = registerPassword;
    if (pw.length === 0) {
      return { label: "", width: 0, tone: "neutral" as const };
    }

    let score = 0;

    // Length scoring
    if (pw.length >= 8) score += 1;
    if (pw.length >= 12) score += 1;

    // Character variety scoring
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1;
    if (/\d/.test(pw)) score += 1;
    if (/[^a-zA-Z0-9]/.test(pw)) score += 1;

    if (score <= 1) {
      return { label: "Weak", width: 25, tone: "danger" as const };
    }
    if (score === 2) {
      return { label: "Weak", width: 33, tone: "danger" as const };
    }
    if (score === 3) {
      return { label: "Medium", width: 66, tone: "warning" as const };
    }
    return { label: "Strong", width: 100, tone: "success" as const };
  })();

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
                onChange={(event) => {
                  setLoginEmail(event.target.value);
                  setLoginErrors((current) => ({ ...current, email: undefined }));
                }}
                value={loginEmail}
              />
              {loginErrors.email ? <p className={styles.fieldError}>{loginErrors.email}</p> : null}
            </label>

            <PasswordField
              autoComplete="current-password"
              disabled={!isLogin}
              error={loginErrors.password}
              id="login-password"
              label="Password"
              name="password"
              onChange={(event) => {
                setLoginPassword(event.target.value);
                setLoginErrors((current) => ({ ...current, password: undefined }));
              }}
              onToggle={() => setLoginPasswordVisible((current) => !current)}
              placeholder="Enter your password"
              value={loginPassword}
              visible={loginPasswordVisible}
            />

            <label className={styles.rememberRow} htmlFor="remember-me">
              <input
                checked={rememberMe}
                id="remember-me"
                onChange={(event) => setRememberMe(event.target.checked)}
                type="checkbox"
              />
              <span>Remember me</span>
            </label>

            <Link className={styles.forgotLink} to="/forgot-password">
              Forgot password?
            </Link>

            {formError && isLogin ? <p className={styles.formError}>{formError}</p> : null}

            <button
              className={styles.submitButton}
              disabled={!isLogin || submittingMode === "login"}
              type="submit"
            >
              <span className={styles.buttonContent}>
                {submittingMode === "login" ? (
                  <>
                    <span className={styles.buttonSpinner} aria-hidden="true" />
                    <span>Logging in...</span>
                  </>
                ) : (
                  "Log In"
                )}
              </span>
            </button>

            <p className={styles.switchText}>
              Don't have an account?{" "}
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
                onChange={(event) => {
                  setRegisterEmail(event.target.value);
                  setRegisterErrors((current) => ({ ...current, email: undefined }));
                }}
                placeholder="Enter your email address"
                required
                type="email"
                value={registerEmail}
              />
              {registerErrors.email ? <p className={styles.fieldError}>{registerErrors.email}</p> : null}
            </label>

            <PasswordField
              autoComplete="new-password"
              disabled={isLogin}
              error={registerErrors.password}
              id="register-password"
              label="Password"
              name="password"
              onChange={(event) => {
                setRegisterPassword(event.target.value);
                setRegisterErrors((current) => ({ ...current, password: undefined }));
              }}
              onToggle={() => setRegisterPasswordVisible((current) => !current)}
              placeholder="Create a strong password"
              value={registerPassword}
              visible={registerPasswordVisible}
            />
            {registerPassword ? (
              <div className={styles.passwordStrength}>
                <div className={styles.passwordStrengthBar}>
                  <span className={`${styles.passwordStrengthFill} ${styles[passwordStrength.tone]}`} style={{ width: `${passwordStrength.width}%` }} />
                </div>
                <span className={styles.passwordStrengthLabel}>{passwordStrength.label || "Add 8+ characters"}</span>
              </div>
            ) : null}

            <PasswordField
              autoComplete="new-password"
              disabled={isLogin}
              error={registerErrors.verifyPassword}
              id="verify-password"
              label="Verify Password"
              name="verifyPassword"
              onChange={(event) => {
                setVerifyPassword(event.target.value);
                setRegisterErrors((current) => ({ ...current, verifyPassword: undefined }));
              }}
              onToggle={() => setVerifyPasswordVisible((current) => !current)}
              placeholder="Re-enter your password"
              value={verifyPassword}
              visible={verifyPasswordVisible}
            />

            {formError && !isLogin ? <p className={styles.formError}>{formError}</p> : null}

            <button
              className={styles.submitButton}
              disabled={isLogin || submittingMode === "register"}
              type="submit"
            >
              <span className={styles.buttonContent}>
                {submittingMode === "register" ? (
                  <>
                    <span className={styles.buttonSpinner} aria-hidden="true" />
                    <span>Creating account...</span>
                  </>
                ) : (
                  "Create Account"
                )}
              </span>
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