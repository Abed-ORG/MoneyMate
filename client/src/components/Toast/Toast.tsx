import styles from "./Toast.module.css";

type ToastVariant = "success" | "error" | "warning" | "info";

type ToastProps = {
  title: string;
  message: string;
  variant?: ToastVariant;
  onClose?: () => void;
};

export function Toast({
  title,
  message,
  variant = "info",
  onClose,
}: ToastProps) {
  return (
    <aside className={`${styles.toast} ${styles[variant]}`} role="status">
      <div>
        <p className={styles.title}>{title}</p>
        <p className={styles.message}>{message}</p>
      </div>
      {onClose ? (
        <button
          className={styles.close}
          aria-label="Dismiss notification"
          onClick={onClose}
          type="button"
        >
          x
        </button>
      ) : null}
    </aside>
  );
}
