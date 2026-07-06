import {
  Children,
  isValidElement,
  type ChangeEventHandler,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
  useCallback,
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
  searchable?: boolean;
  searchPlaceholder?: string;
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
  searchable = false,
  searchPlaceholder = "Search...",
  value,
}: SelectProps) {
  const options = getOptions(children, optionsProp);
  const [internalValue, setInternalValue] = useState(
    String(value ?? defaultValue ?? options[0]?.value ?? ""),
  );
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const [searchTerm, setSearchTerm] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const nativeSelectRef = useRef<HTMLSelectElement | null>(null);
  const listboxId = useId();
  const currentValue = value == null ? internalValue : String(value);
  const selectedOption =
    options.find((option) => option.value === currentValue) ?? options[0];
  const filteredOptions = searchable && searchTerm.trim()
    ? options.filter((option) => {
      const query = searchTerm.trim().toLowerCase();
      return (
        option.label.toLowerCase().includes(query) ||
        option.value.toLowerCase().includes(query)
      );
    })
    : options;
  const updateMenuPosition = useCallback(() => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;

    const viewportPadding = 8;
    const gap = 6;
    const maxMenuHeight = 240;
    const minMenuHeight = 120;
    const spaceBelow = window.innerHeight - rect.bottom - gap - viewportPadding;
    const spaceAbove = rect.top - gap - viewportPadding;
    const openAbove =
      menuPlacement === "top" ||
      (menuPlacement === "bottom" && spaceBelow < minMenuHeight && spaceAbove > spaceBelow);
    const availableHeight = Math.max(
      minMenuHeight,
      Math.min(maxMenuHeight, openAbove ? spaceAbove : spaceBelow),
    );
    const width = Math.min(rect.width, window.innerWidth - viewportPadding * 2);
    const left = Math.max(
      viewportPadding,
      Math.min(rect.left, window.innerWidth - viewportPadding - width),
    );
    const top = openAbove
      ? Math.max(viewportPadding, rect.top - gap - availableHeight)
      : Math.min(
        rect.bottom + gap,
        window.innerHeight - viewportPadding - availableHeight,
      );

    setMenuStyle({
      bottom: "auto",
      left,
      maxHeight: availableHeight,
      position: "fixed",
      right: "auto",
      top,
      width,
      zIndex: 1000,
    });
  }, [menuPlacement]);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };

    document.addEventListener("mousedown", closeOnOutsideClick, true);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick, true);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setMenuStyle({});
      return undefined;
    }

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [isOpen, updateMenuPosition]);

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
    setSearchTerm("");
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
        onClick={() => setIsOpen((current) => {
          const next = !current;
          if (!next) {
            setSearchTerm("");
          }
          return next;
        })}
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
          style={menuStyle}
        >
          {searchable ? (
            <div className={styles.searchWrap}>
              <input
                autoFocus
                className={styles.searchInput}
                onChange={(event) => setSearchTerm(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setIsOpen(false);
                    setSearchTerm("");
                  }
                }}
                placeholder={searchPlaceholder}
                value={searchTerm}
              />
            </div>
          ) : null}
          {filteredOptions.map((option) => (
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
          {filteredOptions.length === 0 ? (
            <div className={styles.emptyOption}>No results</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
