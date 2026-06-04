import type { ReactNode } from "react";
import { Button } from "../Button/Button";
import styles from "./Modal.module.css";

type ModalProps = {
  isOpen: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
};

export function Modal({ isOpen, title, children, onClose }: ModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className={styles.overlay} role="presentation" onMouseDown={onClose}>
      <section
        aria-modal="true"
        className={styles.modal}
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <h2>{title}</h2>
          <Button aria-label="Close modal" variant="secondary" onClick={onClose}>
            x
          </Button>
        </header>
        <div className={styles.body}>{children}</div>
      </section>
    </div>
  );
}
