import { useEffect, useMemo, useRef, useState } from "react";
import { Button, FormField, Input, Modal, Select, Toast } from "../components";
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

const categories = [
  "Food & Dining",
  "Transport",
  "Income",
  "Housing",
  "Groceries",
  "Entertainment",
  "Shopping",
  "Healthcare",
  "Utilities",
  "Other",
];

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
    notes: transaction.notes,
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
    notes: form.notes.trim(),
  };
}

export function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<TransactionListParams>(defaultFilters);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
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

  const updateFilter = (values: Partial<TransactionListParams>) => {
    setFilters((current) => ({ ...current, ...values, page: values.page ?? 1 }));
  };

  const applyDatePreset = (preset: "7" | "30" | "custom") => {
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
          value={form.category}
          error={formErrors.category}
          onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
        >
          <option value="">Select category</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Vendor">
        <Input
          placeholder="Vendor"
          value={form.vendor}
          onChange={(event) => setForm((current) => ({ ...current, vendor: event.target.value }))}
        />
      </FormField>
      <FormField label="Notes">
        <Input
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
    <section className={`${styles.page} ${selected ? styles.withDetails : ""}`}>
      {toast ? <Toast {...toast} onClose={() => setToast(null)} /> : null}

      <aside className={styles.filters}>
        <div className={styles.panelHeader}>
          <span className={styles.iconBox}>F</span>
          <h2>Filters</h2>
        </div>
        <Input placeholder="Search transactions..." onChange={() => undefined} />
        <FormField label="Category">
          <Select value={filters.category ?? ""} onChange={(event) => updateFilter({ category: event.target.value || undefined })}>
            <option value="">All Categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Date Range">
          <Select onChange={(event) => applyDatePreset(event.target.value as "7" | "30" | "custom")}>
            <option value="custom">Custom range</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
          </Select>
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
            value={`${filters.sortBy}:${filters.sortDir}`}
            onChange={(event) => {
              const [sortBy, sortDir] = event.target.value.split(":") as [TransactionListParams["sortBy"], TransactionListParams["sortDir"]];
              updateFilter({ sortBy, sortDir });
            }}
          >
            <option value="date:desc">Newest First</option>
            <option value="date:asc">Oldest First</option>
            <option value="amount:desc">Amount High to Low</option>
            <option value="amount:asc">Amount Low to High</option>
            <option value="category:asc">Category A to Z</option>
          </Select>
        </FormField>
        <Button variant="secondary" onClick={() => setFilters(defaultFilters)}>
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
          <button className={styles.importCard} type="button" onClick={() => setIsImportOpen(true)}>
            <span className={styles.largeIcon}>UP</span>
            <span>
              <strong>Import Transactions</strong>
              <small>Drag, map, preview, and import CSV bank statements.</small>
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
                      onClick={() => setSelectedId(transaction.id)}
                    >
                      <td>{formatDate(transaction.date)}</td>
                      <td>
                        <span className={styles.vendorMark}>{transaction.vendor.slice(0, 1) || "$"}</span>
                        {transaction.vendor || "Unknown"}
                      </td>
                      <td>
                        <span className={styles.badge}>{transaction.category}</span>
                      </td>
                      <td>{transaction.notes || "-"}</td>
                      <td className={Number(transaction.amount) < 0 ? styles.expense : styles.income}>
                        {toMoney(transaction.amount)}
                      </td>
                      <td>
                        <div className={styles.rowActions}>
                          <button type="button" aria-label="Edit transaction" onClick={(event) => { event.stopPropagation(); openEdit(transaction); }}>
                            E
                          </button>
                          <button type="button" aria-label="Delete transaction" className={styles.deleteIcon} onClick={(event) => { event.stopPropagation(); setSelectedId(transaction.id); setIsDeleteOpen(true); }}>
                            D
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
            <Button variant="secondary" disabled={filters.page <= 1} onClick={() => updateFilter({ page: filters.page - 1 })}>
              Prev
            </Button>
            <span>
              Page {filters.page} of {totalPages}
            </span>
            <Button variant="secondary" disabled={filters.page >= totalPages} onClick={() => updateFilter({ page: filters.page + 1 })}>
              Next
            </Button>
            <Select value={filters.pageSize} onChange={(event) => updateFilter({ pageSize: Number(event.target.value) })}>
              <option value={5}>5 per page</option>
              <option value={10}>10 per page</option>
              <option value={25}>25 per page</option>
            </Select>
          </footer>
        </section>
      </main>

      <aside className={`${styles.details} ${selected ? styles.detailsOpen : ""}`}>
        {selected ? (
          <>
            <header className={styles.detailsHeader}>
              <h2>Transaction Details</h2>
              <button type="button" aria-label="Back to list" onClick={() => setSelectedId(null)}>
                x
              </button>
            </header>
            <dl className={styles.detailList}>
              <div><dt>Date</dt><dd>{formatDate(selected.date, true)}</dd></div>
              <div><dt>Vendor</dt><dd>{selected.vendor || "Unknown"}</dd></div>
              <div><dt>Category</dt><dd><span className={styles.badge}>{selected.category}</span></dd></div>
              <div><dt>Notes</dt><dd>{selected.notes || "-"}</dd></div>
              <div><dt>Amount</dt><dd className={Number(selected.amount) < 0 ? styles.expense : styles.income}>{toMoney(selected.amount)}</dd></div>
              <div><dt>Created Date</dt><dd>{formatDate(selected.created_at, true)}</dd></div>
              <div><dt>Updated Date</dt><dd>{formatDate(selected.updated_at, true)}</dd></div>
            </dl>
            <section className={styles.aiPanel}>
              <h3>AI Categorization</h3>
              <strong>{selected.ai_categorization?.category ?? "Pending"}</strong>
              <span>Confidence: {selected.ai_categorization?.confidence ?? 0}%</span>
            </section>
            <section className={styles.history}>
              <h3>Edit History</h3>
              {selected.history.length ? selected.history.map((item) => (
                <article key={item.id}>
                  <time>{formatDate(item.timestamp, true)}</time>
                  <p>{item.event}</p>
                </article>
              )) : <p>No edit history available</p>}
            </section>
            <div className={styles.detailActions}>
              <Button variant="secondary" onClick={() => openEdit(selected)}>Edit Transaction</Button>
              <Button variant="danger" onClick={() => setIsDeleteOpen(true)}>Delete Transaction</Button>
            </div>
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
      <Modal isOpen={isImportOpen} title="Import Transactions" onClose={() => setIsImportOpen(false)}>
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
            <strong>Drop your CSV file here</strong>
            <span>or click to browse. Supports CSV files up to 10MB.</span>
          </button>
          <input ref={fileInputRef} hidden type="file" accept=".csv,text/csv" onChange={(event) => void handleFile(event.target.files?.[0] ?? null)} />
          {csvHeaders.length ? (
            <>
              <div className={styles.mappingGrid}>
                {["date", "amount", "category", "vendor", "notes"].map((field) => (
                  <FormField key={field} label={field[0].toUpperCase() + field.slice(1)}>
                    <Select value={mapping[field] ?? ""} onChange={(event) => setMapping((current) => ({ ...current, [field]: event.target.value }))}>
                      <option value="">Do not map</option>
                      {csvHeaders.map((header) => <option key={header} value={header}>{header}</option>)}
                    </Select>
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
              <Button onClick={() => void importCsv()}>Import Transactions</Button>
            </>
          ) : null}
          {csvErrors.length ? (
            <div className={styles.importErrors}>
              {csvErrors.map((item) => <p key={`${item.row}-${item.message}`}>Row {item.row}: {item.message}</p>)}
            </div>
          ) : null}
        </div>
      </Modal>
    </section>
  );
}
