import { useCallback, useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Button, Modal, Toast } from "../components";
import { useAuth } from "../contexts/AuthContext";
import { budgetsApi } from "../services/budgets";
import { getPageTitle, protectedNavigation } from "../utils/navigation";
import {
  getProfileAvatar,
  subscribeToProfileAvatar,
} from "../utils/profileAvatar";
import styles from "./AppShell.module.css";

type ThemeMode = "dark" | "light";

const THEME_STORAGE_KEY = "moneymate-theme";

function getInitialTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "dark";
  }

  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  return savedTheme === "light" || savedTheme === "dark" ? savedTheme : "dark";
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function NavigationIcon({ path }: { path: string }) {
  const paths: Record<string, JSX.Element> = {
    "/dashboard": (
      <>
        <path d="M4 13h6V4H4v9ZM14 20h6V4h-6v16ZM4 20h6v-3H4v3Z" />
      </>
    ),
    "/transactions": (
      <>
        <path d="M6 7h12M6 12h12M6 17h8" />
        <path d="m16 15 2 2 3-4" />
      </>
    ),
    "/budgets": (
      <>
        <path d="M4 19V5h16v14H4Z" />
        <path d="M8 15V9M12 15v-4M16 15V7" />
      </>
    ),
    "/goals": (
      <>
        <circle cx="11" cy="13" r="7" />
        <circle cx="11" cy="13" r="3" />
        <path d="m14 10 6-6M17 4h3v3" />
      </>
    ),
    "/reports": (
      <>
        <path d="M5 20V4h14v16H5Z" />
        <path d="M8 16h8M8 8h8M8 12h4" />
      </>
    ),
    "/chat": (
      <>
        <path d="M5 6.5A3.5 3.5 0 0 1 8.5 3h7A3.5 3.5 0 0 1 19 6.5v5A3.5 3.5 0 0 1 15.5 15H11l-5 4v-4.5A3.5 3.5 0 0 1 5 12V6.5Z" />
      </>
    ),
    "/settings": (
      <>
        <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
        <path d="M19.4 13.2a7.7 7.7 0 0 0 .1-2.4l2.1-1.2-2-3.5-2.4.8a7.7 7.7 0 0 0-2.1-1.2l-.4-2.5H11l-.4 2.5a7.7 7.7 0 0 0-2.1 1.2l-2.4-.8-2 3.5 2.1 1.2a7.7 7.7 0 0 0 0 2.4L4.1 14.4l2 3.5 2.4-.8a7.7 7.7 0 0 0 2.1 1.2l.4 2.5h4l.4-2.5a7.7 7.7 0 0 0 2.1-1.2l2.4.8 2-3.5-2.1-1.2Z" />
      </>
    ),
  };

  return (
    <span className={styles.navIcon} aria-hidden="true">
      <svg viewBox="0 0 24 24">{paths[path]}</svg>
    </span>
  );
}

function SettingsIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
      <path d="M19.4 13.2a7.7 7.7 0 0 0 .1-2.4l2.1-1.2-2-3.5-2.4.8a7.7 7.7 0 0 0-2.1-1.2l-.4-2.5H11l-.4 2.5a7.7 7.7 0 0 0-2.1 1.2l-2.4-.8-2 3.5 2.1 1.2a7.7 7.7 0 0 0 0 2.4L4.1 14.4l2 3.5 2.4-.8a7.7 7.7 0 0 0 2.1 1.2l.4 2.5h4l.4-2.5a7.7 7.7 0 0 0 2.1-1.2l2.4.8 2-3.5-2.1-1.2Z" />
    </svg>
  );
}

export function AppShell() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isLogoutConfirmationOpen, setIsLogoutConfirmationOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [budgetToast, setBudgetToast] = useState<{
    title: string;
    message: string;
    variant: "warning" | "error" | "success" | "info";
  } | null>(null);
  const [budgetAlertCount, setBudgetAlertCount] = useState(0);
  const shownBudgetAlerts = useRef<Set<string>>(new Set());
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const pageTitle = getPageTitle(location.pathname);
  const displayName = user?.full_name || "MoneyMate user";
  const initials = getInitials(displayName) || "MM";
  const [profileAvatar, setProfileAvatar] = useState("");
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    setProfileAvatar(getProfileAvatar(user?.id));
    return subscribeToProfileAvatar((userId, dataUrl) => {
      if (userId === user?.id) {
        setProfileAvatar(dataUrl);
      }
    });
  }, [user?.id]);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  useEffect(() => {
    setIsProfileMenuOpen(false);
  }, [location.pathname]);

  const refreshBudgetAlerts = useCallback(
    async (
      month: number,
      year: number,
      showToast: boolean,
    ) => {
      try {
        const alerts = await budgetsApi.alerts(month, year);
        setBudgetAlertCount(alerts.length);
        if (!showToast) {
          return;
        }
        const alert = alerts.find((item) => {
          const key = `${year}-${month}-${item.category_id}-${item.severity}-${item.usage_percentage}`;
          if (shownBudgetAlerts.current.has(key)) {
            return false;
          }
          shownBudgetAlerts.current.add(key);
          return true;
        });
        if (alert) {
          setBudgetToast({
            title: alert.severity === "alert" ? "Budget exceeded" : "Budget warning",
            message: alert.message,
            variant: alert.severity === "alert" ? "error" : "warning",
          });
        }
      } catch {
        // Budget alerts should never block navigation or transaction workflows.
      }
    },
    [],
  );

  useEffect(() => {
    if (!user?.id) {
      setBudgetAlertCount(0);
      return;
    }
    const now = new Date();
    void refreshBudgetAlerts(now.getMonth() + 1, now.getFullYear(), false);
  }, [refreshBudgetAlerts, user?.id]);

  useEffect(() => {
    const handleTransactionChange = (event: Event) => {
      const detail = (event as CustomEvent<{ month?: number; year?: number }>).detail;
      const now = new Date();
      const month = detail?.month ?? now.getMonth() + 1;
      const year = detail?.year ?? now.getFullYear();
      void refreshBudgetAlerts(month, year, location.pathname !== "/budgets");
    };

    window.addEventListener("moneymate:transactions-changed", handleTransactionChange);
    return () => {
      window.removeEventListener("moneymate:transactions-changed", handleTransactionChange);
    };
  }, [location.pathname, refreshBudgetAlerts]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      navigate("/login", { replace: true });
    } finally {
      setIsLoggingOut(false);
      setIsLogoutConfirmationOpen(false);
    }
  };

  return (
    <div
      className={`${styles.shell} ${
        isSidebarCollapsed ? styles.shellCollapsed : ""
      }`}
    >
      <aside className={`${styles.sidebar} ${isSidebarOpen ? styles.sidebarOpen : ""}`}>
        <div className={styles.brand}>
          <img className={styles.brandMark} src="/moneymate-logo.png" alt="" />
          <div>
            <strong>
              Money<span>Mate</span>
            </strong>
            <span>Smart budgeting</span>
          </div>
        </div>
        <nav className={styles.nav} aria-label="Main navigation">
          {protectedNavigation.map((item) => (
            <NavLink
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.active : ""}`
              }
              key={item.path}
              onClick={() => setIsSidebarOpen(false)}
              to={item.path}
            >
              <NavigationIcon path={item.path} />
              <span>{item.label}</span>
              {item.path === "/budgets" && budgetAlertCount ? (
                <span
                  aria-label={`${budgetAlertCount} budget alert${budgetAlertCount === 1 ? "" : "s"}`}
                  className={styles.navBadge}
                >
                  {budgetAlertCount}
                </span>
              ) : null}
            </NavLink>
          ))}
        </nav>
      </aside>

      {isSidebarOpen ? (
        <button
          aria-label="Close navigation"
          className={styles.scrim}
          onClick={() => setIsSidebarOpen(false)}
          type="button"
        />
      ) : null}

      <div className={styles.contentWrap}>
        {budgetToast ? (
          <div className={styles.toastDock}>
            <Toast {...budgetToast} onClose={() => setBudgetToast(null)} />
          </div>
        ) : null}

        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <button
              aria-label={isSidebarCollapsed ? "Show navigation" : "Hide navigation"}
              aria-expanded={!isSidebarCollapsed}
              className={styles.collapseButton}
              onClick={() => setIsSidebarCollapsed((current) => !current)}
              type="button"
            >
              <span />
              <span />
              <span />
            </button>
            <button
              aria-label="Open navigation"
              className={styles.menuButton}
              onClick={() => setIsSidebarOpen(true)}
              type="button"
            >
              <span />
              <span />
              <span />
            </button>
            <h1>{pageTitle}</h1>
          </div>
          <div className={styles.headerActions}>
            <button
              aria-label={`Switch to ${themeMode === "dark" ? "light" : "dark"} mode`}
              className={styles.themeButton}
              onClick={() =>
                setThemeMode((current) => (current === "dark" ? "light" : "dark"))
              }
              type="button"
            >
              {themeMode === "dark" ? (
                <svg aria-hidden="true" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                </svg>
              ) : (
                <svg aria-hidden="true" viewBox="0 0 24 24">
                  <path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 7 7 0 1 0 20 15.5Z" />
                </svg>
              )}
              <span>{themeMode === "dark" ? "Light" : "Dark"}</span>
            </button>
            <div className={styles.userArea} ref={profileMenuRef}>
              <button
                aria-expanded={isProfileMenuOpen}
                aria-haspopup="menu"
                className={styles.userButton}
                onClick={() => setIsProfileMenuOpen((current) => !current)}
                type="button"
              >
                <span className={styles.avatar}>
                  {profileAvatar ? (
                    <img src={profileAvatar} alt={`${displayName} profile`} />
                  ) : (
                    initials
                  )}
                </span>
                <div>
                  <strong>{displayName}</strong>
                  <span>{user?.email}</span>
                </div>
              </button>
              {isProfileMenuOpen ? (
                <div className={styles.profileMenu} role="menu">
                  <button
                    onClick={() => navigate("/settings")}
                    role="menuitem"
                    type="button"
                  >
                    <span className={styles.profileMenuIcon}>
                      <SettingsIcon />
                    </span>
                    Settings
                  </button>
                  <button
                    className={styles.logoutMenuButton}
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      setIsLogoutConfirmationOpen(true);
                    }}
                    role="menuitem"
                    type="button"
                  >
                    Logout
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <main className={styles.main}>
          <Outlet />
        </main>
      </div>

      <Modal
        isOpen={isLogoutConfirmationOpen}
        onClose={() => {
          if (!isLoggingOut) {
            setIsLogoutConfirmationOpen(false);
          }
        }}
        title="Are you sure you want to log out?"
      >
        <div className={styles.logoutPrompt}>
          <p>You will need to sign in again to access your MoneyMate account.</p>
          <div className={styles.logoutActions}>
            <Button
              disabled={isLoggingOut}
              onClick={() => setIsLogoutConfirmationOpen(false)}
              variant="secondary"
            >
              Cancel
            </Button>
            <Button
              disabled={isLoggingOut}
              onClick={handleLogout}
              variant="danger"
            >
              {isLoggingOut ? "Logging out..." : "Log out"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
