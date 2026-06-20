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
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3v2M12 19v2M4.2 7.5l1.7 1M18.1 15.5l1.7 1M4.2 16.5l1.7-1M18.1 8.5l1.7-1M3 12h2M19 12h2" />
      </>
    ),
  };

  return (
    <span className={styles.navIcon} aria-hidden="true">
      <svg viewBox="0 0 24 24">{paths[path]}</svg>
    </span>
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
  const shownBudgetAlerts = useRef<Set<string>>(new Set());
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
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
              <NavigationIcon path={item.path} />
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
                  Settings
                </button>
                <button
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
