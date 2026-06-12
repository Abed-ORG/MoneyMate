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

function PencilIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="M4 20h4.3L19.1 9.2a2.1 2.1 0 0 0 0-3L17.8 5a2.1 2.1 0 0 0-3 0L4 15.7V20Zm2-3.5 10.2-10.2 1.5 1.5L7.5 18H6v-1.5Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="M8 21a2.5 2.5 0 0 1-2.5-2.5V8H4V6h4V4.8C8 3.8 8.8 3 9.8 3h4.4c1 0 1.8.8 1.8 1.8V6h4v2h-1.5v10.5A2.5 2.5 0 0 1 16 21H8Zm1.8-16v1h4.4V5H9.8ZM7.5 8v10.5c0 .3.2.5.5.5h8c.3 0 .5-.2.5-.5V8h-9Zm2.2 9h1.8v-7H9.7v7Zm2.8 0h1.8v-7h-1.8v7Z" />
    </svg>
  );
}

function CloudUploadIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="M7 19.5a5 5 0 0 1-.7-9.9A6.5 6.5 0 0 1 18.5 8a5.8 5.8 0 0 1 .3 11.5h-4.3v-2h4.3a3.8 3.8 0 0 0 0-7.5h-1.5l-.2-1.2a4.5 4.5 0 0 0-8.8 1l-.1 1.6-1.6.1A3 3 0 0 0 7 17.5h2.5v2H7Zm4-1.5v-5.2l-1.8 1.8-1.4-1.4L12 9l4.2 4.2-1.4 1.4-1.8-1.8V18h-2Z" />
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
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [csvContent, setCsvContent] = useState("");
  const [csvErrors, setCsvErrors] = useState<TransactionImportError[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
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
      ...transactionCategories.map((category) => ({ value: category, label: category })),
    ],
    [],
  );
  const expenses = transactions
    .filter((transaction) => Number(transaction.amount) < 0)
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const income = transactions
    .filter((transaction) => Number(transaction.amount) > 0)
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);

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

  const handleFile = async (file: File | null) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
      setToast({ title: "Unsupported file", message: "Please upload a CSV file.", variant: "warning" });
      return;
    }
    try {
      const content = await file.text();
      const parsed = parseCsv(content);
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
    <section className={`${styles.page} ${selected && !isDetailsCollapsed ? styles.withDetails : ""}`}>
      {toast ? (
        <div className={styles.toastDock}>
          <Toast {...toast} onClose={() => setToast(null)} />
        </div>
      ) : null}

      <aside className={styles.filters}>
        <div className={styles.panelHeader}>
          <h2>Filters</h2>
          <span className={styles.iconBox}><FilterIcon /></span>
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
        <Button variant="secondary" onClick={() => { setDatePreset("custom"); setSearchTerm(""); setFilters(defaultFilters); }}>
          Clear Filters
        </Button>

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

      <main className={styles.content}>
        <div className={styles.topCards}>
          <button className={styles.importCard} type="button" onClick={openImportModal}>
            <span className={styles.largeIcon}><CloudUploadIcon /></span>
            <span>
              <strong>Import Transactions</strong>
              <small>Drag & drop your CSV file here</small>
              <small>or <em>click to browse</em></small>
              <small>Supports CSV files up to 10MB</small>
            </span>
          </button>
          <section className={styles.quickAdd}>
            <span className={styles.plusIcon}>+</span>
            <div>
              <h2>Quick Add Transaction</h2>
              <p>Manually add spending or income in a few seconds.</p>
              <Button
                onClick={() => {
                  setForm(emptyForm);
                  setFormErrors({});
                  setIsAddOpen(true);
                }}
              >
                + Add Transaction
              </Button>
            </div>
          </section>
        </div>

        <section className={styles.tablePanel}>
          <header className={styles.tableHeader}>
            <h2>Transactions</h2>
            <span>
              Showing {transactions.length ? (filters.page - 1) * filters.pageSize + 1 : 0} to{" "}
              {Math.min(filters.page * filters.pageSize, total)} of {total}
            </span>
          </header>

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
            <strong>Drag & drop your CSV file here</strong>
            <span>or <em>click to browse</em></span>
            <small>Supports CSV files up to 10MB</small>
          </button>
          <input ref={fileInputRef} hidden type="file" accept=".csv,text/csv" onChange={(event) => void handleFile(event.target.files?.[0] ?? null)} />
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
