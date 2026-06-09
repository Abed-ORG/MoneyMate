import type { SelectHTMLAttributes } from "react";
import styles from "./Select.module.css";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  error?: string;
};

export function Select({ className = "", error, children, ...props }: SelectProps) {
  return (
    <select
      aria-invalid={Boolean(error)}
      className={`${styles.select} ${error ? styles.error : ""} ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}
