import styles from "./LoadingSpinner.module.css";

type LoadingSpinnerProps = {
  label?: string;
};

export function LoadingSpinner({ label = "Loading" }: LoadingSpinnerProps) {
  return (
    <div className={styles.wrapper} role="status" aria-live="polite">
      <span className={styles.spinner} aria-hidden="true" />
      <span className={styles.label}>{label}</span>
    </div>
  );
}
