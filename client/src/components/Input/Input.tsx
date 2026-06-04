import type { InputHTMLAttributes } from "react";
import styles from "./Input.module.css";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  error?: string;
};

export function Input({ className = "", error, ...props }: InputProps) {
  return (
    <input
      aria-invalid={Boolean(error)}
      className={`${styles.input} ${error ? styles.error : ""} ${className}`}
      {...props}
    />
  );
}
