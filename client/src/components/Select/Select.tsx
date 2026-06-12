import {
  Children,
  isValidElement,
  type ChangeEventHandler,
  type ReactElement,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import styles from "./Select.module.css";

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type OptionElement = ReactElement<{
  value?: string | number;
  disabled?: boolean;
  children?: ReactNode;
}>;

type SelectProps = {
  "aria-describedby"?: string;
  "aria-label"?: string;
  children?: ReactNode;
  className?: string;
  defaultValue?: string;
  disabled?: boolean;
  error?: string;
  id?: string;
  menuPlacement?: "top" | "bottom";
  name?: string;
  onChange?: ChangeEventHandler<HTMLSelectElement>;
  onValueChange?: (value: string) => void;
  options?: SelectOption[];
  required?: boolean;
  value?: string;
};

function getOptions(children: ReactNode, options?: SelectOption[]) {
  if (options) {
    return options;
  }

  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement(child) || child.type !== "option") {
      return [];
    }

    const option = child as OptionElement;
    return [{
      value: String(option.props.value ?? ""),
      label: String(option.props.children ?? option.props.value ?? ""),
      disabled: option.props.disabled,
    }];
  });
}

export function Select({
  "aria-describedby": ariaDescribedBy,
  "aria-label": ariaLabel,
  children,
  className = "",
  defaultValue,
  disabled = false,
  error,
  id,
  menuPlacement = "bottom",
  name,
  onChange,
  onValueChange,
  options: optionsProp,
  required,
  value,
}: SelectProps) {
  const options = getOptions(children, optionsProp);
  const [internalValue, setInternalValue] = useState(
    String(value ?? defaultValue ?? options[0]?.value ?? ""),
  );
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const nativeSelectRef = useRef<HTMLSelectElement | null>(null);
  const listboxId = useId();
  const currentValue = value == null ? internalValue : String(value);
  const selectedOption =
    options.find((option) => option.value === currentValue) ?? options[0];

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  const selectValue = (nextValue: string) => {
    if (value == null) {
      setInternalValue(nextValue);
    }
    onValueChange?.(nextValue);

    const nativeSelect = nativeSelectRef.current;
    if (nativeSelect && onChange) {
      nativeSelect.value = nextValue;
      onChange({
        target: nativeSelect,
        currentTarget: nativeSelect,
      } as Parameters<ChangeEventHandler<HTMLSelectElement>>[0]);
    }
    setIsOpen(false);
  };

  return (
    <div
      className={`${styles.selectWrap} ${
        error ? styles.error : ""
      } ${className}`}
      ref={rootRef}
    >
      <select
        aria-hidden="true"
        className={styles.nativeSelect}
        disabled={disabled}
        name={name}
        ref={nativeSelectRef}
        required={required}
        tabIndex={-1}
        value={currentValue}
        onChange={() => undefined}
      >
        {options.map((option) => (
          <option disabled={option.disabled} key={option.value || option.label} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <button
        aria-describedby={ariaDescribedBy}
        aria-controls={listboxId}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className={styles.selectTrigger}
        disabled={disabled}
        id={id}
        onClick={() => setIsOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setIsOpen(false);
          }
        }}
        type="button"
      >
        <span>{selectedOption?.label}</span>
        <svg
          aria-hidden="true"
          className={`${styles.selectArrow} ${
            isOpen ? styles.selectArrowOpen : ""
          }`}
          focusable="false"
          viewBox="0 0 20 20"
        >
          <path d="m5 7.5 5 5 5-5" />
        </svg>
      </button>

      {isOpen ? (
        <div
          className={`${styles.selectMenu} ${
            menuPlacement === "top" ? styles.selectMenuTop : ""
          }`}
          id={listboxId}
          role="listbox"
        >
          {options.map((option) => (
            <button
              aria-selected={option.value === currentValue}
              className={`${styles.selectOption} ${
                option.value === currentValue ? styles.selectOptionActive : ""
              }`}
              disabled={option.disabled}
              key={option.value || option.label}
              onClick={() => selectValue(option.value)}
              role="option"
              type="button"
            >
              <span>{option.label}</span>
              {option.value === currentValue ? (
                <svg aria-hidden="true" className={styles.optionCheck} viewBox="0 0 20 20">
                  <path d="m4.5 10.5 3.2 3.2 7.8-8" />
                </svg>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
