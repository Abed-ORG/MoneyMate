import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Button } from "../components";
import { clearAuthToken } from "../utils/auth";
import { getPageTitle, protectedNavigation } from "../utils/navigation";
import styles from "./AppShell.module.css";

export function AppShell() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const pageTitle = getPageTitle(location.pathname);

  const handleLogout = () => {
    clearAuthToken();
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
            <div>
              <p className={styles.eyebrow}>Frontend Foundation</p>
              <h1>{pageTitle}</h1>
            </div>
          </div>
          <div className={styles.userArea}>
            <div className={styles.user}>
              <span className={styles.avatar}>CS</span>
              <div>
                <strong>Celine Salameh</strong>
                <span>Demo user</span>
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
