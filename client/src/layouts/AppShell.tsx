import { useCallback, useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Button, LoadingSpinner, Modal } from "../components";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { budgetsApi } from "../services/budgets";
import { goalsApi } from "../services/goals";
import { transactionsApi } from "../services/transactions";
import type { Budget } from "../types/budget";
import type { Goal } from "../types/goal";
import type { Transaction } from "../types/transaction";
import { getPageTitle, protectedNavigation } from "../utils/navigation";
import {
  getProfileAvatar,
  subscribeToProfileAvatar,
} from "../utils/profileAvatar";
import styles from "./AppShell.module.css";

type ThemeMode = "dark" | "light";
type SearchResult = {
  id: string;
  type: "transaction" | "budget" | "goal";
  title: string;
  meta: string;
  path: string;
};

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

function SunIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2.5v2.2M12 19.3v2.2M4.7 4.7l1.6 1.6M17.7 17.7l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.7 19.3l1.6-1.6M17.7 6.3l1.6-1.6" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M20 14.8A8.2 8.2 0 0 1 9.2 4a8.2 8.2 0 1 0 10.8 10.8Z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.38 1.08V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.08-.38H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .38-1.08V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.2.37.57.6 1 .6h.09a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1 .6Z" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H3" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="7" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function formatSearchMoney(value: string | number) {
  const amount = Number(value);
  if (Number.isNaN(amount)) {
    return String(value);
  }
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(amount);
}

function transactionResult(transaction: Transaction): SearchResult {
  return {
    id: `transaction-${transaction.id}`,
    type: "transaction",
    title: transaction.vendor || transaction.category || "Transaction",
    meta: `${transaction.category} · ${formatSearchMoney(transaction.amount)}`,
    path: "/transactions",
  };
}

function budgetResult(budget: Budget): SearchResult {
  return {
    id: `budget-${budget.id}`,
    type: "budget",
    title: budget.category_name,
    meta: `Budget · ${formatSearchMoney(budget.amount)}`,
    path: "/budgets",
  };
}

function goalResult(goal: Goal): SearchResult {
  return {
    id: `goal-${goal.id}`,
    type: "goal",
    title: goal.name,
    meta: `Goal · ${formatSearchMoney(goal.current_amount)} saved`,
    path: "/goals",
  };
}

export function AppShell() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isLogoutConfirmationOpen, setIsLogoutConfirmationOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [budgetAlertCount, setBudgetAlertCount] = useState(0);
  const shownBudgetAlerts = useRef<Set<string>>(new Set());
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const toast = useToast();
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
          toast.showToast({
            title: alert.severity === "alert" ? "Budget exceeded" : "Budget warning",
            message: alert.message,
            variant: alert.severity === "alert" ? "error" : "warning",
          });
        }
      } catch {
        // Budget alerts should never block navigation or transaction workflows.
      }
    },
    [toast],
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

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  useEffect(() => {
    const query = globalSearch.trim();
    if (query.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return undefined;
    }

    let cancelled = false;
    setIsSearching(true);
    const timeout = window.setTimeout(() => {
      const normalized = query.toLowerCase();
      void Promise.all([
        transactionsApi.list({
          page: 1,
          pageSize: 5,
          search: query,
          sortBy: "date",
          sortDir: "desc",
        }),
        budgetsApi.list(),
        goalsApi.list(),
      ])
        .then(([transactions, budgets, goals]) => {
          if (cancelled) return;
          const budgetMatches = budgets
            .filter((budget) =>
              `${budget.category_name} ${budget.amount}`.toLowerCase().includes(normalized),
            )
            .slice(0, 5)
            .map(budgetResult);
          const goalMatches = goals
            .filter((goal) =>
              `${goal.name} ${goal.linked_account ?? ""}`.toLowerCase().includes(normalized),
            )
            .slice(0, 5)
            .map(goalResult);
          setSearchResults([
            ...transactions.items.slice(0, 5).map(transactionResult),
            ...budgetMatches,
            ...goalMatches,
          ]);
        })
        .catch(() => {
          if (!cancelled) {
            setSearchResults([]);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setIsSearching(false);
          }
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [globalSearch]);

  const openSearchResult = (result: SearchResult) => {
    setGlobalSearch("");
    setSearchResults([]);
    setIsSearchOpen(false);
    navigate(result.path);
  };

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
          <div className={styles.globalSearch} ref={searchRef}>
            <SearchIcon />
            <input
              aria-label="Search transactions, budgets, and goals"
              onChange={(event) => {
                setGlobalSearch(event.target.value);
                setIsSearchOpen(true);
              }}
              onFocus={() => setIsSearchOpen(true)}
              placeholder="Search money..."
              type="search"
              value={globalSearch}
            />
            {isSearchOpen && globalSearch.trim().length >= 2 ? (
              <div className={styles.searchPanel}>
                {isSearching ? (
                  <div className={styles.searchLoading}>
                    <LoadingSpinner label="Searching" />
                  </div>
                ) : searchResults.length ? (
                  searchResults.map((result) => (
                    <button
                      key={result.id}
                      onClick={() => openSearchResult(result)}
                      type="button"
                    >
                      <span>{result.type}</span>
                      <strong>{result.title}</strong>
                      <small>{result.meta}</small>
                    </button>
                  ))
                ) : (
                  <p>No matches found.</p>
                )}
              </div>
            ) : null}
          </div>
          <div className={styles.headerActions}>
            <button
              aria-label={`Switch to ${themeMode === "dark" ? "light" : "dark"} mode`}
              aria-pressed={themeMode === "dark"}
              className={styles.themeButton}
              onClick={() =>
                setThemeMode((current) => (current === "dark" ? "light" : "dark"))
              }
              type="button"
            >
              <span
                className={`${styles.themeButtonIcon} ${
                  themeMode === "light" ? styles.themeButtonIconActive : ""
                }`}
                aria-hidden="true"
              >
                <SunIcon />
              </span>
              <span
                className={`${styles.themeButtonIcon} ${
                  themeMode === "dark" ? styles.themeButtonIconActive : ""
                }`}
                aria-hidden="true"
              >
                <MoonIcon />
              </span>
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
                    <span>Settings</span>
                    <span className={styles.profileMenuIcon}>
                      <SettingsIcon />
                    </span>
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
                    <span>Logout</span>
                    <span className={styles.profileMenuIcon}>
                      <LogoutIcon />
                    </span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <main className={styles.main}>
          <div key={location.pathname} className={styles.pageTransition}>
            <Outlet />
          </div>
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
