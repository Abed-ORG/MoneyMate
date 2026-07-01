import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { Toast } from "../components";
import styles from "./ToastContext.module.css";

type ToastVariant = "success" | "error" | "warning" | "info";

type ToastPayload = {
  title: string;
  message: string;
  variant?: ToastVariant;
  duration?: number;
};

type ToastEntry = ToastPayload & {
  id: number;
  variant: ToastVariant;
};

type ToastContextValue = {
  showToast: (toast: ToastPayload) => void;
  success: (title: string, message: string) => void;
  error: (title: string, message: string) => void;
  warning: (title: string, message: string) => void;
  info: (title: string, message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

let nextToastId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  const closeToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((toast: ToastPayload) => {
    const id = nextToastId++;
    setToasts((current) => [
      ...current.slice(-3),
      {
        id,
        title: toast.title,
        message: toast.message,
        variant: toast.variant ?? "info",
        duration: toast.duration,
      },
    ]);
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      showToast,
      success: (title, message) => showToast({ title, message, variant: "success" }),
      error: (title, message) => showToast({ title, message, variant: "error" }),
      warning: (title, message) => showToast({ title, message, variant: "warning" }),
      info: (title, message) => showToast({ title, message, variant: "info" }),
    }),
    [showToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toasts.length ? (
        <div className={styles.toastStack} aria-live="polite">
          {toasts.map((toast) => (
            <Toast
              duration={toast.duration}
              key={toast.id}
              message={toast.message}
              onClose={() => closeToast(toast.id)}
              title={toast.title}
              variant={toast.variant}
            />
          ))}
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return context;
}
