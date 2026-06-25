import { NavLink, useLocation } from "react-router-dom";
import styles from "./ReportsPage.module.css";

export function ReportsPage() {
  const location = useLocation();
  const activePath = location.pathname.startsWith("/reports/annual") ? "/reports/annual" : "/reports/monthly";

  return (
    <section className={styles.page}>
      <div className={styles.viewSwitcher} role="group" aria-label="Report view mode">
        <NavLink
          className={activePath === "/reports/monthly" ? styles.viewSwitcherActive : ""}
          to="/reports/monthly"
        >
          Monthly
        </NavLink>
        <NavLink
          className={activePath === "/reports/annual" ? styles.viewSwitcherActive : ""}
          to="/reports/annual"
        >
          Annual
        </NavLink>
      </div>
    </section>
  );
}
