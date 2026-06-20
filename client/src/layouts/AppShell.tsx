import { useEffect, useRef, useState } from "react";
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

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function AppShell() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isLogoutConfirmationOpen, setIsLogoutConfirmationOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [budgetToast, setBudgetToast] = useState<{
    title: string;
    message: string;
    variant: "warning" | "error" | "success" | "info";
  } | null>(null);
  const shownBudgetAlerts = useRef<Set<string>>(new Set());
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const pageTitle = getPageTitle(location.pathname);
  const displayName = user?.full_name || "MoneyMate user";
  const initials = getInitials(displayName) || "MM";
  const [profileAvatar, setProfileAvatar] = useState("");

  useEffect(() => {
    setProfileAvatar(getProfileAvatar(user?.id));
    return subscribeToProfileAvatar((userId, dataUrl) => {
      if (userId === user?.id) {
        setProfileAvatar(dataUrl);
      }
    });
  }, [user?.id]);

  useEffect(() => {
    const handleTransactionChange = async (event: Event) => {
      if (location.pathname === "/budgets") {
        return;
      }

      const detail = (event as CustomEvent<{ month?: number; year?: number }>).detail;
      const now = new Date();
      const month = detail?.month ?? now.getMonth() + 1;
      const year = detail?.year ?? now.getFullYear();

      try {
        const alerts = await budgetsApi.alerts(month, year);
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
        // Budget alerts should never block transaction workflows.
      }
    };

    window.addEventListener("moneymate:transactions-changed", handleTransactionChange);
    return () => {
      window.removeEventListener("moneymate:transactions-changed", handleTransactionChange);
    };
  }, [location.pathname]);

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
              <span className={styles.navIndicator} aria-hidden="true" />
              <span>{item.label}</span>
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
          <div className={styles.userArea}>
            <div className={styles.user}>
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
            </div>
            <Button
              variant="secondary"
              onClick={() => setIsLogoutConfirmationOpen(true)}
            >
              Logout
            </Button>
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
