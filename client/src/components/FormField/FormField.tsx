import type { ReactNode } from "react";
import styles from "./FormField.module.css";

type FormFieldProps = {
  label: string;
  htmlFor?: string;
  helperText?: string;
  error?: string;
  children: ReactNode;
};

export function FormField({
  label,
  htmlFor,
  helperText,
  error,
  children,
}: FormFieldProps) {
  return (
    <label className={styles.field} htmlFor={htmlFor}>
      <span className={styles.label}>{label}</span>
      {children}
      {error ? (
        <span className={styles.error}>{error}</span>
      ) : helperText ? (
        <span className={styles.helper}>{helperText}</span>
      ) : null}
    </label>
  );
}
