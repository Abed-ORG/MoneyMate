import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Button } from "../components";
import { useAuth } from "../contexts/AuthContext";
import { getPageTitle, protectedNavigation } from "../utils/navigation";
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
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const pageTitle = getPageTitle(location.pathname);
  const displayName = user?.full_name || "MoneyMate user";
  const initials = getInitials(displayName) || "MM";

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className={styles.shell}>
      <aside className={`${styles.sidebar} ${isSidebarOpen ? styles.sidebarOpen : ""}`}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>M</span>
          <div>
            <strong>MoneyMate</strong>
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
              {item.label}
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
              <span className={styles.avatar}>{initials}</span>
              <div>
                <strong>{displayName}</strong>
                <span>{user?.email}</span>
              </div>
            </div>
            <Button variant="secondary" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </header>

        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
