import { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  FormField,
  Input,
  Modal,
  Select,
  Toast,
  type SelectOption,
} from "../components";
import {
  getCategoryIcon,
  transactionCategories,
} from "../constants/categories";
import { getApiErrorMessage } from "../services/api";
import { transactionsApi } from "../services/transactions";
import type {
  Category,
  Transaction,
  TransactionImportError,
  TransactionListParams,
  TransactionPayload,
} from "../types/transaction";
import styles from "./TransactionsPage.module.css";

type ToastState = {
  title: string;
  message: string;
  variant: "success" | "error" | "warning" | "info";
};

type FormState = {
  date: string;
  amount: string;
  category: string;
  vendor: string;
  notes: string;
};

type CsvRow = Record<string, string>;

const noteMaxLength = 160;
const templateHeaders = ["date", "amount", "category", "vendor", "notes"];

const emptyForm: FormState = {
  date: new Date().toISOString().slice(0, 10),
  amount: "",
  category: "",
  vendor: "",
  notes: "",
};

const defaultFilters: TransactionListParams = {
  page: 1,
  pageSize: 10,
  sortBy: "date",
  sortDir: "desc",
};

function toMoney(value: string | number) {
  const amount = Number(value);
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Math.abs(amount));
  return amount < 0 ? `-${formatted}` : formatted;
}

function formatDate(value: string, includeTime = false) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(includeTime ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(date);
}

function transactionToForm(transaction: Transaction): FormState {
  return {
    date: transaction.date.slice(0, 10),
    amount: String(transaction.amount),
    category: transaction.category,
    vendor: transaction.vendor,
    notes: transaction.notes.slice(0, noteMaxLength),
  };
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function parseCsv(content: string) {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    throw new Error("CSV must include a header row and at least one transaction.");
  }
  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return headers.reduce<CsvRow>((row, header, index) => {
      row[header] = cells[index] ?? "";
      return row;
    }, {});
  });
  return { headers, rows };
}

function parseHtmlTable(content: string) {
  const document = new DOMParser().parseFromString(content, "text/html");
  const table = document.querySelector("table");
  if (!table) {
    throw new Error("Excel template must include a transaction table.");
  }

  const tableRows = Array.from(table.querySelectorAll("tr")).map((row) =>
    Array.from(row.querySelectorAll("th,td")).map((cell) =>
      cell.textContent?.trim() ?? "",
    ),
  );
  const [headers = [], ...bodyRows] = tableRows.filter((row) =>
    row.some((cell) => cell.length > 0),
  );

  if (!headers.length || !bodyRows.length) {
    throw new Error("Excel template must include a header row and at least one transaction.");
  }

  const rows = bodyRows.map((cells) =>
    headers.reduce<CsvRow>((row, header, index) => {
      row[header] = cells[index] ?? "";
      return row;
    }, {}),
  );

  return { headers, rows };
}

function parseImportContent(content: string, fileName: string) {
  if (fileName.toLowerCase().endsWith(".xls") || /<table[\s>]/i.test(content)) {
    return parseHtmlTable(content);
  }

  return parseCsv(content);
}

function downloadExcelTemplate() {
  const rows = [
    templateHeaders,
    [new Date().toISOString().slice(0, 10), "-24.50", "Groceries", "Market", "Weekly groceries"],
  ];
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    table { border-collapse: collapse; font-family: Arial, sans-serif; }
    th, td { border: 1px solid #d7dfd5; padding: 8px 10px; min-width: 130px; }
    th { background: #102A23; color: #ffffff; }
  </style>
</head>
<body>
  <table>
    ${rows
      .map((row, rowIndex) =>
        `<tr>${row
          .map((cell) => `<${rowIndex === 0 ? "th" : "td"}>${cell}</${rowIndex === 0 ? "th" : "td"}>`)
          .join("")}</tr>`,
      )
      .join("")}
  </table>
</body>
</html>`;
  const blob = new Blob([html], { type: "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "moneymate-transaction-template.xls";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function validateForm(form: FormState) {
  const errors: Partial<Record<keyof FormState, string>> = {};
  if (!form.date) errors.date = "Date is required.";
  if (!form.amount) errors.amount = "Amount is required.";
  const amount = Number(form.amount);
  if (form.amount && Number.isNaN(amount)) errors.amount = "Amount must be numeric.";
  if (amount === 0) errors.amount = "Amount cannot be zero.";
  if (!form.category.trim()) errors.category = "Category is required.";
  return errors;
}

function toPayload(form: FormState): TransactionPayload {
  return {
    date: new Date(`${form.date}T12:00:00`).toISOString(),
    amount: Number(form.amount),
    category: form.category.trim(),
    vendor: form.vendor.trim(),
    notes: form.notes.trim().slice(0, noteMaxLength),
  };
}

function AddIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="m4 20 4.2-1 10.9-10.9a2.2 2.2 0 0 0-3.1-3.1L5.1 15.9 4 20Z" />
      <path d="m14.5 6.5 3 3" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="M4 7h16" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
      <path d="M18 7 17 19a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 7" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

function CloudUploadIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="M7 18.5a4.5 4.5 0 0 1-.6-8.95A6 6 0 0 1 17.7 7.8a5.4 5.4 0 0 1 .3 10.7h-3.5" />
      <path d="M12 18V9.5M8.8 12.7 12 9.5l3.2 3.2" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M7 14v6" />
      <circle cx="14" cy="7" r="2" />
      <circle cx="7" cy="17" r="2" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="M12 4v10" />
      <path d="m8 10 4 4 4-4" />
      <path d="M5 20h14" />
    </svg>
  );
}

function SpreadsheetIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="M6 3h9l3 3v15H6V3Z" />
      <path d="M15 3v4h4M8.5 11h7M8.5 15h7M11 9v9" />
    </svg>
  );
}

export function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<TransactionListParams>(defaultFilters);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isDetailsCollapsed, setIsDetailsCollapsed] = useState(false);
  const [datePreset, setDatePreset] = useState("custom");
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [csvContent, setCsvContent] = useState("");
  const [csvErrors, setCsvErrors] = useState<TransactionImportError[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selected = useMemo(
    () => transactions.find((transaction) => transaction.id === selectedId) ?? null,
    [selectedId, transactions],
  );

  const totalPages = Math.max(1, Math.ceil(total / filters.pageSize));
  const categoryOptions = useMemo(
    () => [
      { value: "", label: "All Categories" },
      ...transactionCategories.map((category) => ({ value: category, label: category })),
    ],
    [],
  );
  const formCategoryOptions = useMemo(
    () => [
      { value: "", label: "Select category" },
      ...categories.map((category) => ({ value: category.name, label: category.name })),
      ...transactionCategories.map((category) => ({ value: category, label: category })),
    ],
    [categories],
  );
  const expenses = transactions
    .filter((transaction) => Number(transaction.amount) < 0)
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const income = transactions
    .filter((transaction) => Number(transaction.amount) > 0)
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const selectedCount = selectedTransactionIds.length;

  const loadTransactions = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await transactionsApi.list(filters);
      setTransactions(response.items);
      setTotal(response.total);
      if (selectedId && !response.items.some((transaction) => transaction.id === selectedId)) {
        setSelectedId(null);
      }
      setSelectedTransactionIds((current) =>
        current.filter((id) => response.items.some((transaction) => transaction.id === id)),
      );
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    void transactionsApi.categories().then(setCategories).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setFilters((current) => ({
        ...current,
        page: 1,
        search: searchTerm.trim() || undefined,
      }));
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [searchTerm]);

  const updateFilter = (values: Partial<TransactionListParams>) => {
    setFilters((current) => ({ ...current, ...values, page: values.page ?? 1 }));
  };

  const toggleTransactionSelection = (id: string) => {
    setSelectedTransactionIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const selectVisibleTransactions = () => {
    setSelectedTransactionIds(transactions.map((transaction) => transaction.id));
  };

  const clearTransactionSelection = () => {
    setSelectedTransactionIds([]);
  };

  const resetImportState = () => {
    setCsvHeaders([]);
    setCsvRows([]);
    setCsvContent("");
    setCsvErrors([]);
    setMapping({});
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const openImportModal = () => {
    resetImportState();
    setIsImportOpen(true);
  };

  const closeImportModal = () => {
    resetImportState();
    setIsImportOpen(false);
  };

  const applyDatePreset = (preset: "7" | "30" | "custom") => {
    setDatePreset(preset);
    if (preset === "custom") {
      return;
    }
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - Number(preset));
    updateFilter({
      dateFrom: start.toISOString().slice(0, 10),
      dateTo: end.toISOString().slice(0, 10),
    });
  };

  const submitForm = async (mode: "add" | "edit") => {
    const errors = validateForm(form);
    setFormErrors(errors);
    if (Object.keys(errors).length) {
      return;
    }

    try {
      const payload = toPayload(form);
      const saved =
        mode === "add"
          ? await transactionsApi.create(payload)
          : selected
            ? await transactionsApi.update(selected.id, payload)
            : null;
      setToast({
        title: mode === "add" ? "Transaction added" : "Transaction updated",
        message: "Your transaction list is up to date.",
        variant: "success",
      });
      setForm(emptyForm);
      setIsAddOpen(false);
      setIsEditOpen(false);
      if (saved) setSelectedId(saved.id);
      await loadTransactions();
    } catch (err) {
      setToast({ title: "Could not save transaction", message: getApiErrorMessage(err), variant: "error" });
    }
  };

  const confirmDelete = async () => {
    if (!selected) return;
    try {
      await transactionsApi.delete(selected.id);
      setToast({ title: "Transaction deleted", message: "The transaction was removed.", variant: "success" });
      setSelectedId(null);
      setIsDeleteOpen(false);
      await loadTransactions();
    } catch (err) {
      setToast({ title: "Could not delete transaction", message: getApiErrorMessage(err), variant: "error" });
    }
  };

  const openEdit = (transaction: Transaction) => {
    setSelectedId(transaction.id);
    setForm(transactionToForm(transaction));
    setFormErrors({});
    setIsEditOpen(true);
  };

  const applyAiSuggestion = async () => {
    try {
      const suggestion = await transactionsApi.suggest({
        amount: Number(form.amount || 0),
        vendor: form.vendor.trim(),
        notes: form.notes.trim(),
      });
      setForm((current) => ({ ...current, category: suggestion.category }));
      setToast({
        title: "AI suggestion ready",
        message: `MoneyMate suggested ${suggestion.category}.`,
        variant: "info",
      });
    } catch (err) {
      setToast({
        title: "AI suggestion failed",
        message: getApiErrorMessage(err),
        variant: "warning",
      });
    }
  };

  const recategorizeCurrentPage = async () => {
    if (!transactions.length) {
      return;
    }
    await transactionsApi.bulkRecategorize({
      transaction_ids: transactions.map((item) => item.id),
    });
    setToast({
      title: "Page recategorized",
      message: "AI suggestions were refreshed for the current page.",
      variant: "success",
    });
    await loadTransactions();
  };

  const recategorizeSelected = async () => {
    if (!selectedTransactionIds.length) {
      return;
    }
    await transactionsApi.bulkRecategorize({
      transaction_ids: selectedTransactionIds,
    });
    setToast({
      title: "Selected transactions recategorized",
      message: "AI suggestions were refreshed for the selected transactions.",
      variant: "success",
    });
    clearTransactionSelection();
    await loadTransactions();
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    const lowerName = file.name.toLowerCase();
    const isSupported =
      lowerName.endsWith(".csv") ||
      lowerName.endsWith(".xls") ||
      lowerName.endsWith(".html") ||
      file.type === "text/csv" ||
      file.type === "text/html" ||
      file.type === "application/vnd.ms-excel";
    if (!isSupported) {
      setToast({ title: "Unsupported file", message: "Please upload a CSV or MoneyMate Excel template file.", variant: "warning" });
      return;
    }
    try {
      const content = await file.text();
      const parsed = parseImportContent(content, file.name);
      const guessed = {
        date: parsed.headers.find((header) => /date/i.test(header)) ?? parsed.headers[0],
        amount: parsed.headers.find((header) => /amount|debit|credit/i.test(header)) ?? parsed.headers[1],
        category: parsed.headers.find((header) => /category/i.test(header)) ?? parsed.headers[2],
        vendor: parsed.headers.find((header) => /vendor|merchant|description/i.test(header)) ?? parsed.headers[3],
        notes: parsed.headers.find((header) => /note|memo|description/i.test(header)) ?? parsed.headers[4],
      };
      setCsvContent(content);
      setCsvHeaders(parsed.headers);
      setCsvRows(parsed.rows);
      setMapping(guessed);
      setCsvErrors([]);
    } catch (err) {
      setCsvContent("");
      setCsvHeaders([]);
      setCsvRows([]);
      setCsvErrors([{ row: 0, message: err instanceof Error ? err.message : "Malformed CSV file." }]);
    }
  };

  const importCsv = async () => {
    try {
      const response = await transactionsApi.importCsv(csvContent, mapping);
      setCsvErrors(response.errors);
      setToast({
        title: "Import finished",
        message: `Imported: ${response.imported}. Failed: ${response.failed}.`,
        variant: response.failed ? "warning" : "success",
      });
      if (response.imported > 0) {
        resetImportState();
        setIsImportOpen(false);
        await loadTransactions();
      }
    } catch (err) {
      setToast({ title: "Import failed", message: getApiErrorMessage(err), variant: "error" });
    }
  };

  const renderModalForm = (mode: "add" | "edit") => (
    <form
      className={styles.formGrid}
      onSubmit={(event) => {
        event.preventDefault();
        void submitForm(mode);
      }}
    >
      <FormField label="Date" error={formErrors.date}>
        <Input
          type="date"
          value={form.date}
          error={formErrors.date}
          onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
        />
      </FormField>
      <FormField label="Amount" error={formErrors.amount}>
        <Input
          inputMode="decimal"
          placeholder="-24.50 or 1200"
          value={form.amount}
          error={formErrors.amount}
          onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
        />
      </FormField>
      <FormField label="Category" error={formErrors.category}>
        <Select
          aria-label="Transaction category"
          value={form.category}
          options={formCategoryOptions}
          onValueChange={(value) => setForm((current) => ({ ...current, category: value }))}
        />
      </FormField>
      <Button type="button" variant="secondary" onClick={() => void applyAiSuggestion()}>
        AI Suggest Category
      </Button>
      <FormField label="Vendor">
        <Input
          placeholder="Vendor"
          value={form.vendor}
          onChange={(event) => setForm((current) => ({ ...current, vendor: event.target.value }))}
        />
      </FormField>
      <FormField
        helperText={`${form.notes.length}/${noteMaxLength} characters`}
        label="Notes"
      >
        <Input
          maxLength={noteMaxLength}
          placeholder="Optional note"
          value={form.notes}
          onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
        />
      </FormField>
      <div className={styles.modalActions}>
        <Button variant="secondary" onClick={() => (mode === "add" ? setIsAddOpen(false) : setIsEditOpen(false))}>
          Cancel
        </Button>
        <Button type="submit">{mode === "add" ? "Add Transaction" : "Save Changes"}</Button>
      </div>
    </form>
  );

  return (
    <section
      className={`${styles.page} ${selected && !isDetailsCollapsed ? styles.withDetails : ""} ${
        !isFiltersOpen ? styles.filtersClosed : ""
      }`}
    >
      {toast ? (
        <div className={styles.toastDock}>
          <Toast {...toast} onClose={() => setToast(null)} />
        </div>
      ) : null}

      <header className={styles.pageHeader}>
        <div>
          <span className={styles.kicker}>Ledger</span>
          <h2>Transactions</h2>
          <p>Review, filter, import, and categorize every money movement in one place.</p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.addTransactionAction}>
            <Button
              onClick={() => {
                setForm(emptyForm);
                setFormErrors({});
                setIsAddOpen(true);
              }}
            >
              <AddIcon />
              Add Transaction
            </Button>
          </div>
          <div className={styles.utilityActions}>
            <Button variant="secondary" onClick={openImportModal}>
              <CloudUploadIcon />
              Import
            </Button>
            <Button variant="secondary" onClick={downloadExcelTemplate}>
              <DownloadIcon />
              Template
            </Button>
            <Button
              variant="secondary"
              disabled={!transactions.length}
              onClick={() => void recategorizeCurrentPage()}
            >
              Re-categorize Page
            </Button>
          </div>
        </div>
      </header>

      {isFiltersOpen ? (
      <aside className={styles.filters}>
        <div className={styles.panelHeader}>
          <h2>Filters</h2>
          <button
            aria-label="Close filters"
            className={styles.iconBox}
            onClick={() => setIsFiltersOpen(false)}
            type="button"
          >
            <FilterIcon />
          </button>
        </div>
        <Input
          aria-label="Search transactions by vendor"
          placeholder="Search transactions..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
        <FormField label="Category">
          <Select
            aria-label="Filter by category"
            value={filters.category ?? ""}
            options={categoryOptions}
            onValueChange={(value) => updateFilter({ category: value || undefined })}
          />
        </FormField>
        <FormField label="Date Range">
          <Select
            aria-label="Date range preset"
            value={datePreset}
            options={[
              { value: "custom", label: "Custom range" },
              { value: "7", label: "Last 7 days" },
              { value: "30", label: "Last 30 days" },
            ]}
            onValueChange={(value) => applyDatePreset(value as "7" | "30" | "custom")}
          />
        </FormField>
        <div className={styles.splitFields}>
          <Input type="date" value={filters.dateFrom ?? ""} onChange={(event) => updateFilter({ dateFrom: event.target.value || undefined })} />
          <Input type="date" value={filters.dateTo ?? ""} onChange={(event) => updateFilter({ dateTo: event.target.value || undefined })} />
        </div>
        <FormField label="Amount Range">
          <div className={styles.splitFields}>
            <Input placeholder="Min" value={filters.amountMin ?? ""} onChange={(event) => updateFilter({ amountMin: event.target.value || undefined })} />
            <Input placeholder="Max" value={filters.amountMax ?? ""} onChange={(event) => updateFilter({ amountMax: event.target.value || undefined })} />
          </div>
        </FormField>
        <FormField label="Sort By">
          <Select
            aria-label="Sort transactions"
            value={`${filters.sortBy}:${filters.sortDir}`}
            options={[
              { value: "date:desc", label: "Newest First" },
              { value: "date:asc", label: "Oldest First" },
              { value: "amount:desc", label: "Amount High to Low" },
              { value: "amount:asc", label: "Amount Low to High" },
              { value: "category:asc", label: "Category A to Z" },
            ]}
            onValueChange={(value) => {
              const [sortBy, sortDir] = value.split(":") as [TransactionListParams["sortBy"], TransactionListParams["sortDir"]];
              updateFilter({ sortBy, sortDir });
            }}
          />
        </FormField>
        <div className={styles.filterActions}>
          <Button variant="secondary" onClick={() => updateFilter({})}>
            <FilterIcon />
            Filter
          </Button>
          <Button variant="secondary" onClick={() => { setDatePreset("custom"); setSearchTerm(""); setFilters(defaultFilters); }}>
            Clear
          </Button>
        </div>

        <section className={styles.stats}>
          <h3>Quick Stats</h3>
          <strong>{total}</strong>
          <span>Transactions</span>
          <strong className={styles.expense}>{toMoney(expenses)}</strong>
          <span>Total Expenses</span>
          <strong className={styles.income}>{toMoney(income)}</strong>
          <span>Total Income</span>
        </section>
      </aside>
      ) : (
        <aside className={styles.filterRail} aria-label="Transaction filters">
          <button
            aria-label="Open filters"
            className={styles.filterRailButton}
            onClick={() => setIsFiltersOpen(true)}
            type="button"
          >
            <FilterIcon />
          </button>
        </aside>
      )}

      <main className={styles.content}>
        <section className={styles.tablePanel}>
          <header className={styles.tableHeader}>
            <h2>Transactions</h2>
            <span>
              Showing {transactions.length ? (filters.page - 1) * filters.pageSize + 1 : 0} to{" "}
              {Math.min(filters.page * filters.pageSize, total)} of {total}
            </span>
          </header>
          <div className={styles.bulkBar}>
            <span>{selectedCount} selected</span>
            <div className={styles.bulkActions}>
              <Button variant="secondary" onClick={selectVisibleTransactions}>
                Select Page
              </Button>
              <Button variant="secondary" onClick={clearTransactionSelection}>
                Clear Selection
              </Button>
              <Button
                disabled={!selectedCount}
                onClick={() => void recategorizeSelected()}
              >
                Re-categorize Selected
              </Button>
            </div>
          </div>

          {isLoading ? <div className={styles.state}>Loading transactions...</div> : null}
          {error ? <div className={styles.stateError}>{error}</div> : null}
          {!isLoading && !error && transactions.length === 0 ? (
            <div className={styles.state}>No transactions match your filters.</div>
          ) : null}

          {!isLoading && !error && transactions.length > 0 ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Select</th>
                    <th>Date</th>
                    <th>Vendor</th>
                    <th>Category</th>
                    <th>Notes</th>
                    <th>Amount</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => (
                    <tr
                      key={transaction.id}
                      className={selectedId === transaction.id ? styles.selectedRow : ""}
                      onClick={() => {
                        setSelectedId(transaction.id);
                        setIsDetailsCollapsed(false);
                      }}
                    >
                      <td>
                        <input
                          checked={selectedTransactionIds.includes(transaction.id)}
                          onClick={(event) => event.stopPropagation()}
                          onChange={() => toggleTransactionSelection(transaction.id)}
                          type="checkbox"
                        />
                      </td>
                      <td>{formatDate(transaction.date)}</td>
                      <td>
                        <span className={styles.vendorMark}>{transaction.vendor.slice(0, 1) || "$"}</span>
                        {transaction.vendor || "Unknown"}
                      </td>
                      <td>
                        <img
                          alt={transaction.category}
                          className={styles.categoryIcon}
                          src={getCategoryIcon(transaction.category)}
                          title={transaction.category}
                        />
                      </td>
                      <td className={styles.notesCell} title={transaction.notes || undefined}>
                        <span>{transaction.notes || "-"}</span>
                      </td>
                      <td className={Number(transaction.amount) < 0 ? styles.expense : styles.income}>
                        {toMoney(transaction.amount)}
                      </td>
                      <td>
                        <div className={styles.rowActions}>
                          <button className={styles.editIcon} type="button" aria-label="Edit transaction" onClick={(event) => { event.stopPropagation(); openEdit(transaction); }}>
                            <PencilIcon />
                          </button>
                          <button type="button" aria-label="Delete transaction" className={styles.deleteIcon} onClick={(event) => { event.stopPropagation(); setSelectedId(transaction.id); setIsDeleteOpen(true); }}>
                            <TrashIcon />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <footer className={styles.pagination}>
            <span className={styles.paginationSummary}>
              {total} transaction{total === 1 ? "" : "s"}
            </span>
            <div className={styles.pageNavigation}>
              <Button variant="secondary" disabled={filters.page <= 1} onClick={() => updateFilter({ page: filters.page - 1 })}>
                Prev
              </Button>
              <span className={styles.pageIndicator}>
                Page <strong>{filters.page}</strong> of {totalPages}
              </span>
              <Button variant="secondary" disabled={filters.page >= totalPages} onClick={() => updateFilter({ page: filters.page + 1 })}>
                Next
              </Button>
            </div>
            <div className={styles.rowsControl}>
              <span>Rows per page</span>
              <Select
                aria-label="Rows per page"
                className={styles.pageSizeSelect}
                menuPlacement="top"
                value={String(filters.pageSize)}
                options={[
                  { value: "5", label: "5" },
                  { value: "10", label: "10" },
                  { value: "25", label: "25" },
                ]}
                onValueChange={(value) => updateFilter({ pageSize: Number(value) })}
              />
            </div>
          </footer>
        </section>
      </main>

      <aside className={`${styles.details} ${selected && !isDetailsCollapsed ? styles.detailsOpen : ""}`}>
        {selected && !isDetailsCollapsed ? (
          <>
            <section className={styles.selectedSummary}>
              <span className={styles.summaryVendorMark}>{selected.vendor.slice(0, 1) || "$"}</span>
              <div>
                <span className={styles.badge}>{selected.category}</span>
                <h2>{selected.vendor || "Unknown"}</h2>
                <strong className={Number(selected.amount) < 0 ? styles.expense : styles.income}>
                  {toMoney(selected.amount)}
                </strong>
              </div>
            </section>

            <section className={styles.detailCard}>
              <header className={styles.detailsHeader}>
                <h2>Transaction Details</h2>
                <button
                  type="button"
                  aria-label="Close transaction details"
                  onClick={() => {
                    setIsDetailsCollapsed(true);
                    setSelectedId(null);
                  }}
                >
                  &times;
                </button>
              </header>
              <dl className={styles.detailList}>
                <div><dt>Date</dt><dd>{formatDate(selected.date, true)}</dd></div>
                <div><dt>Vendor</dt><dd>{selected.vendor || "Unknown"}</dd></div>
                <div><dt>Category</dt><dd><span className={styles.badge}>{selected.category}</span></dd></div>
                <div><dt>Notes</dt><dd>{selected.notes || "-"}</dd></div>
                <div><dt>Created</dt><dd>{formatDate(selected.created_at, true)}</dd></div>
                <div><dt>Updated</dt><dd>{formatDate(selected.updated_at, true)}</dd></div>
              </dl>
              <section className={styles.aiPanel}>
                <h3>AI Categorization</h3>
                <strong>{selected.ai_categorization?.category ?? "Pending"}</strong>
                <span>Confidence: {selected.ai_categorization?.confidence ?? 0}%</span>
              </section>
            </section>

            <section className={styles.historyCard}>
              <div className={styles.history}>
                <h3>Edit History</h3>
                {selected.history.length ? selected.history.map((item) => (
                  <article key={item.id}>
                    <time>{formatDate(item.timestamp, true)}</time>
                    <p>{item.event}</p>
                  </article>
                )) : <p>No edit history available</p>}
              </div>
              <div className={styles.detailActions}>
                <Button variant="secondary" onClick={() => openEdit(selected)}>Edit Transaction</Button>
                <Button variant="danger" onClick={() => setIsDeleteOpen(true)}>Delete Transaction</Button>
              </div>
            </section>
          </>
        ) : null}
      </aside>

      <Modal isOpen={isAddOpen} title="Add Transaction" onClose={() => setIsAddOpen(false)}>
        {renderModalForm("add")}
      </Modal>
      <Modal isOpen={isEditOpen} title="Edit Transaction" onClose={() => setIsEditOpen(false)}>
        {renderModalForm("edit")}
      </Modal>
      <Modal isOpen={isDeleteOpen} title="Delete Transaction" onClose={() => setIsDeleteOpen(false)}>
        <p className={styles.confirmText}>Delete this transaction? This action cannot be undone.</p>
        <div className={styles.modalActions}>
          <Button variant="secondary" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
          <Button variant="danger" onClick={() => void confirmDelete()}>Delete Transaction</Button>
        </div>
      </Modal>
      <Modal
        bodyClassName={styles.importModalBody}
        className={styles.importModal}
        isOpen={isImportOpen}
        title="Import Transactions"
        onClose={closeImportModal}
      >
        <div className={styles.importFlow}>
          <div className={styles.importTemplateAction}>
            <Button variant="secondary" onClick={downloadExcelTemplate}>
              <SpreadsheetIcon />
              Download Excel Template
            </Button>
          </div>
          <button
            className={styles.dropZone}
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDrop={(event) => {
              event.preventDefault();
              void handleFile(event.dataTransfer.files[0]);
            }}
            onDragOver={(event) => event.preventDefault()}
          >
            <span className={styles.dropIcon}><CloudUploadIcon /></span>
            <strong>Drag & drop your file here</strong>
            <span>or <em>click to browse</em></span>
            <small>Supports CSV and MoneyMate Excel template files up to 10MB</small>
          </button>
          <input ref={fileInputRef} hidden type="file" accept=".csv,.xls,.html,text/csv,text/html,application/vnd.ms-excel" onChange={(event) => void handleFile(event.target.files?.[0] ?? null)} />
          {csvHeaders.length ? (
            <>
              <div className={styles.mappingGrid}>
                {["date", "amount", "category", "vendor", "notes"].map((field) => (
                  <FormField key={field} label={field[0].toUpperCase() + field.slice(1)}>
                    <Select
                      aria-label={`Map ${field} column`}
                      value={mapping[field] ?? ""}
                      options={[
                        { value: "", label: "Do not map" },
                        ...csvHeaders.map((header) => ({ value: header, label: header })),
                      ]}
                      onValueChange={(value) => setMapping((current) => ({ ...current, [field]: value }))}
                    />
                  </FormField>
                ))}
              </div>
              <div className={styles.preview}>
                <strong>Preview</strong>
                <table>
                  <thead><tr>{csvHeaders.slice(0, 5).map((header) => <th key={header}>{header}</th>)}</tr></thead>
                  <tbody>
                    {csvRows.slice(0, 5).map((row, index) => (
                      <tr key={`${index}-${Object.values(row).join("-")}`}>
                        {csvHeaders.slice(0, 5).map((header) => <td key={header}>{row[header]}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className={styles.modalActions}>
                <Button variant="secondary" onClick={closeImportModal}>Cancel</Button>
                <Button onClick={() => void importCsv()}>Import Transactions</Button>
              </div>
            </>
          ) : null}
          {csvErrors.length ? (
            <div className={styles.importErrors}>
              {csvErrors.map((item) => <p key={`${item.row}-${item.message}`}>Row {item.row}: {item.message}</p>)}
            </div>
          ) : null}
          {!csvHeaders.length ? (
            <div className={styles.modalActions}>
              <Button variant="secondary" onClick={closeImportModal}>Cancel</Button>
            </div>
          ) : null}
        </div>
      </Modal>
    </section>
  );
}
