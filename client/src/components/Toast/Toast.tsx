import { useEffect } from "react";
import styles from "./Toast.module.css";

type ToastVariant = "success" | "error" | "warning" | "info";

type ToastProps = {
  title: string;
  message: string;
  variant?: ToastVariant;
  onClose?: () => void;
  duration?: number;
};

export function Toast({
  title,
  message,
  variant = "info",
  onClose,
  duration = 4500,
}: ToastProps) {
  useEffect(() => {
    if (!onClose || duration <= 0) {
      return undefined;
    }

    const timeout = window.setTimeout(onClose, duration);
    return () => window.clearTimeout(timeout);
  }, [duration, onClose]);

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
