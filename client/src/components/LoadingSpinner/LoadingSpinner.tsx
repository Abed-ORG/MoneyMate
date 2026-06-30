import styles from "./LoadingSpinner.module.css";

type LoadingSpinnerProps = {
  label?: string;
};

export function LoadingSpinner({ label = "Loading" }: LoadingSpinnerProps) {
  return (
    <div className={styles.wrapper} role="status" aria-live="polite">
      <span className={styles.logoLoader} aria-hidden="true">
        <span />
        <img src="/moneymate-logo.png" alt="" />
      </span>
      <span className={styles.label}>{label}</span>
    </div>
  );
}
