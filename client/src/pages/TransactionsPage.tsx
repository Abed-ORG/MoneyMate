import { type CSSProperties, useCallback, useEffect, useMemo, type MouseEvent as ReactMouseEvent, useRef, useState } from "react";
import {
  Button,
  CategoryIcon,
  FormField,
  Input,
  LoadingSpinner,
  Modal,
  Select,
  type SelectOption,
} from "../components";
import { useToast } from "../contexts/ToastContext";
import { transactionCategories } from "../constants/categories";
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

type FormState = {
  date: string;
  amount: string;
  category: string;
  vendor: string;
  notes: string;
  type: "expense" | "income";
};

type CsvRow = Record<string, string>;
type AiReviewState = {
  transaction: Transaction;
  suggestion: {
    category: string;
    confidence: number;
    provider: string;
    rationale: string;
  };
} | null;

type ExportPreset = "last30" | "last90" | "currentMonth" | "currentYear" | "custom";
type ExportColumn = "date" | "vendor" | "category" | "amount" | "notes" | "transactionType";
type ExportState = {
  preset: ExportPreset;
  dateFrom: string;
  dateTo: string;
  columns: ExportColumn[];
};

const noteMaxLength = 160;
const templateHeaders = ["date", "amount", "category", "vendor", "notes"];
const exportColumns: Array<{ value: ExportColumn; label: string }> = [
  { value: "date", label: "Date" },
  { value: "vendor", label: "Vendor" },
  { value: "category", label: "Category" },
  { value: "amount", label: "Amount" },
  { value: "notes", label: "Notes" },
  { value: "transactionType", label: "Transaction Type" },
];

const emptyForm: FormState = {
  date: new Date().toISOString().slice(0, 10),
  amount: "",
  category: "",
  vendor: "",
  notes: "",
  type: "expense",
};

const defaultFilters: TransactionListParams = {
  page: 1,
  pageSize: 10,
  sortBy: "date",
  sortDir: "desc",
};

const defaultExportState: ExportState = {
  preset: "last30",
  dateFrom: "",
  dateTo: "",
  columns: ["date", "vendor", "category", "amount", "notes", "transactionType"],
};

function toMoney(value: string | number) {
  const amount = Number(value);
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Math.abs(amount));
  return amount < 0 ? `-${formatted}` : formatted;
}

function csvEscape(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function csvDate(value: string) {
  const isoDate = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(isoDate) ? `\t${isoDate}` : value;
}

function downloadTextFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportDateWindow(preset: ExportPreset, dateFrom: string, dateTo: string) {
  const end = new Date();
  const start = new Date();
  if (preset === "last30") start.setDate(end.getDate() - 30);
  if (preset === "last90") start.setDate(end.getDate() - 90);
  if (preset === "currentMonth") {
    start.setDate(1);
  }
  if (preset === "currentYear") {
    start.setMonth(0, 1);
  }
  return preset === "custom"
    ? { dateFrom, dateTo }
    : { dateFrom: start.toISOString().slice(0, 10), dateTo: end.toISOString().slice(0, 10) };
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
    amount: String(Math.abs(Number(transaction.amount))),
    category: transaction.category,
    vendor: transaction.vendor,
    notes: transaction.notes.slice(0, noteMaxLength),
    type: Number(transaction.amount) >= 0 ? "income" : "expense",
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
    th { background: #020504; color: #ffffff; }
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
  const amount = Number(form.amount);
  return {
    date: new Date(`${form.date}T12:00:00`).toISOString(),
    amount: form.type === "expense" ? -Math.abs(amount) : Math.abs(amount),
    category: form.category.trim(),
    vendor: form.vendor.trim(),
    notes: form.notes.trim().slice(0, noteMaxLength),
  };
}

type EditValues = {
  date: string;
  vendor: string;
  category: string;
  notes: string;
  amount: string;
};

function AddIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="M12 5v14M5 12h14" />
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

function ArrowLeftIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="M15 18 9 12l6-6" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="m9 18 6-6-6-6" />
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

function SparklesIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3Z" />
      <path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14Z" />
      <path d="M5 13l.7 1.8L7.5 15.5l-1.8.7L5 18l-.7-1.8-1.8-.7 1.8-.7L5 13Z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function TransactionsPage() {
  const toast = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<TransactionListParams>(defaultFilters);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState("custom");
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [actionMenuPosition, setActionMenuPosition] = useState<CSSProperties>({});
  const [historyTransaction, setHistoryTransaction] = useState<Transaction | null>(null);
  const [aiReview, setAiReview] = useState<AiReviewState>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [csvErrors, setCsvErrors] = useState<TransactionImportError[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<string[]>([]);
  const [exportState, setExportState] = useState<ExportState>(defaultExportState);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<EditValues | null>(null);
  const [editErrors, setEditErrors] = useState<Partial<Record<keyof EditValues, string>>>({});
  const [savingEditId, setSavingEditId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(
    () => transactions.find((transaction) => transaction.id === selectedId) ?? null,
    [selectedId, transactions],
  );

  const totalPages = Math.max(1, Math.ceil(total / filters.pageSize));
  const categoryNames = useMemo(
    () =>
      Array.from(
        new Set([
          ...categories.map((category) => category.name),
          ...transactionCategories,
        ]),
      ).sort(),
    [categories],
  );
  const categoryByName = useMemo(
    () => new Map(categories.map((category) => [category.name, category])),
    [categories],
  );
  const categoryIconStyle = (category: string): CSSProperties | undefined => {
    const color = categoryByName.get(category)?.color;
    if (!color) {
      return undefined;
    }
    return {
      backgroundColor: color,
      borderColor: `${color}66`,
      boxShadow: `0 0 0.85rem ${color}33`,
      color,
    };
  };

  const categoryOptions = useMemo(
    () => [
      { value: "", label: "All Categories" },
      ...categoryNames.map((category) => ({ value: category, label: category })),
    ],
    [categoryNames],
  );

  const formCategoryOptions = useMemo(
    () => [
      { value: "", label: "Select category" },
      ...categoryNames.map((category) => ({ value: category, label: category })),
    ],
    [categoryNames],
  );
  const expenses = useMemo(
    () => transactions
      .filter((transaction) => Number(transaction.amount) < 0)
      .reduce((sum, transaction) => sum + Number(transaction.amount), 0),
    [transactions]
  );
  const income = useMemo(
    () => transactions
      .filter((transaction) => Number(transaction.amount) > 0)
      .reduce((sum, transaction) => sum + Number(transaction.amount), 0),
    [transactions]
  );
  const selectedCount = selectedTransactionIds.length;
  const allVisibleSelected =
    transactions.length > 0 &&
    transactions.every((transaction) => selectedTransactionIds.includes(transaction.id));
  const activeFilterCount = [
    filters.search?.trim(),
    filters.category,
    filters.dateFrom || filters.dateTo,
    filters.amountMin || filters.amountMax,
  ].filter(Boolean).length;

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
    if (!actionMenuId) {
      return undefined;
    }

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (actionMenuRef.current?.contains(event.target as Node)) {
        return;
      }
      setActionMenuId(null);
    };
    const closeOnViewportChange = () => setActionMenuId(null);

    document.addEventListener("mousedown", closeOnOutsideClick);
    window.addEventListener("resize", closeOnViewportChange);
    window.addEventListener("scroll", closeOnViewportChange, true);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      window.removeEventListener("resize", closeOnViewportChange);
      window.removeEventListener("scroll", closeOnViewportChange, true);
    };
  }, [actionMenuId]);

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

  const toggleVisibleTransactionSelection = () => {
    if (allVisibleSelected) {
      setSelectedTransactionIds((current) =>
        current.filter((id) => !transactions.some((transaction) => transaction.id === id)),
      );
      return;
    }
    setSelectedTransactionIds((current) =>
      Array.from(new Set([...current, ...transactions.map((transaction) => transaction.id)])),
    );
  };

  const openExportModal = () => {
    setExportState(defaultExportState);
    setIsExportOpen(true);
  };

  const exportCsv = async () => {
    const { dateFrom, dateTo } = exportDateWindow(
      exportState.preset,
      exportState.dateFrom,
      exportState.dateTo,
    );
    const response = await transactionsApi.list({
      ...defaultFilters,
      pageSize: 10000,
      dateFrom,
      dateTo,
      sortBy: "date",
      sortDir: "desc",
    });
    const headers = exportState.columns.map((column) => exportColumns.find((item) => item.value === column)?.label ?? column);
    const rows = response.items.map((transaction) =>
      exportState.columns.map((column) => {
        if (column === "date") return csvDate(transaction.date);
        if (column === "vendor") return transaction.vendor;
        if (column === "category") return transaction.category;
        if (column === "amount") return toMoney(transaction.amount);
        if (column === "notes") return transaction.notes;
        return Number(transaction.amount) >= 0 ? "Income" : "Expense";
      }),
    );
    const csv = [headers, ...rows]
      .map((row) => row.map((value) => csvEscape(String(value ?? ""))).join(","))
      .join("\n");
    const filename = `MoneyMate_Transactions_${new Date(dateTo || new Date().toISOString()).toISOString().slice(0, 7)}.csv`;
    downloadTextFile(filename, `\ufeff${csv}`, "text/csv;charset=utf-8");
    setIsExportOpen(false);
  };

  const resetImportState = () => {
    setCsvHeaders([]);
    setCsvRows([]);
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
      toast.showToast({
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
      toast.error("Could not save transaction", getApiErrorMessage(err));
    }
  };

  const startEditing = useCallback((transaction: Transaction) => {
    setActionMenuId(null);
    setEditingId(transaction.id);
    setEditValues({
      date: transaction.date.slice(0, 10),
      vendor: transaction.vendor,
      category: transaction.category,
      notes: transaction.notes,
      amount: String(Math.abs(Number(transaction.amount))),
    });
    setEditErrors({});
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingId(null);
    setEditValues(null);
    setEditErrors({});
  }, []);

  const saveEditing = useCallback(async (transaction: Transaction) => {
    if (!editValues) return;

    const errors: Partial<Record<keyof EditValues, string>> = {};
    if (!editValues.date) {
      errors.date = "Date is required.";
    } else if (Number.isNaN(new Date(editValues.date).getTime())) {
      errors.date = "Enter a valid date.";
    }
    if (!editValues.vendor.trim()) {
      errors.vendor = "Vendor is required.";
    }
    if (!editValues.category) {
      errors.category = "Category is required.";
    }
    const amountNum = Number(editValues.amount);
    if (!editValues.amount) {
      errors.amount = "Amount is required.";
    } else if (Number.isNaN(amountNum) || amountNum <= 0) {
      errors.amount = "Amount must be a positive number.";
    }

    setEditErrors(errors);
    if (Object.keys(errors).length) return;

    const signedAmount = Number(transaction.amount) < 0 ? -amountNum : amountNum;

    setSavingEditId(transaction.id);
    try {
      const updated = await transactionsApi.update(transaction.id, {
        date: editValues.date,
        amount: Number.isFinite(signedAmount) ? signedAmount : Number(transaction.amount),
        category: editValues.category,
        vendor: editValues.vendor.trim(),
        notes: editValues.notes.trim().slice(0, noteMaxLength),
      });
      setTransactions((current) =>
        current.map((item) => (item.id === transaction.id ? updated : item)),
      );
      toast.showToast({
        title: "Transaction updated",
        message: "Your changes were saved.",
        variant: "success",
      });
      cancelEditing();
    } catch (err) {
      toast.error("Could not save changes", getApiErrorMessage(err));
    } finally {
      setSavingEditId(null);
    }
  }, [editValues, cancelEditing]);

  const confirmDelete = async () => {
    const idsToDelete = selectedTransactionIds.length ? selectedTransactionIds : (selected ? [selected.id] : []);
    if (!idsToDelete.length) return;

    try {
      await Promise.all(idsToDelete.map((id) => transactionsApi.delete(id)));
      toast.showToast({
        title: idsToDelete.length > 1 ? "Transactions deleted" : "Transaction deleted",
        message: idsToDelete.length > 1
          ? `${idsToDelete.length} transactions were removed.`
          : "The transaction was removed.",
        variant: "success",
      });
      setSelectedId(null);
      setSelectedTransactionIds([]);
      setIsDeleteOpen(false);
      cancelEditing();
      await loadTransactions();
    } catch (err) {
      toast.error("Could not delete", getApiErrorMessage(err));
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
      toast.showToast({
        title: "AI suggestion ready",
        message: `MoneyMate suggested ${suggestion.category}.`,
        variant: "info",
      });
    } catch (err) {
      toast.showToast({
        title: "AI suggestion failed",
        message: getApiErrorMessage(err),
        variant: "warning",
      });
    }
  };

  const recategorizeSelected = async () => {
    if (!selectedTransactionIds.length) {
      return;
    }
    await transactionsApi.bulkRecategorize({
      transaction_ids: selectedTransactionIds,
    });
    toast.success(
      "Selected transactions recategorized",
      "AI suggestions were refreshed for the selected transactions.",
    );
    setSelectedTransactionIds([]);
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
      toast.warning("Unsupported file", "Please upload a CSV or MoneyMate Excel template file.");
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
      setCsvHeaders(parsed.headers);
      setCsvRows(parsed.rows);
      setMapping(guessed);
      setCsvErrors([]);
    } catch (err) {
      setCsvHeaders([]);
      setCsvRows([]);
      setCsvErrors([{ row: 0, message: err instanceof Error ? err.message : "Malformed CSV file." }]);
    }
  };

  const importCsv = async () => {
    const errors: TransactionImportError[] = [];
    const transactions = csvRows
      .map((row, index) => {
        const rowNumber = index + 2;
        const dateValue = row[mapping.date] ?? "";
        const amountValue = row[mapping.amount] ?? "";
        const categoryValue = row[mapping.category] ?? "";
        const vendorValue = row[mapping.vendor] ?? "";
        const notesValue = row[mapping.notes] ?? "";

        if (![dateValue, amountValue, categoryValue, vendorValue, notesValue].some((value) => value.trim())) {
          return null;
        }

        const amount = Number(amountValue);
        const date = new Date(`${dateValue.trim()}T12:00:00`);

        if (!dateValue.trim() || Number.isNaN(date.getTime())) {
          errors.push({ row: rowNumber, message: "Date is required." });
          return null;
        }
        if (!Number.isFinite(amount) || amount === 0) {
          errors.push({ row: rowNumber, message: "Amount must be a non-zero number." });
          return null;
        }
        if (!categoryValue.trim()) {
          errors.push({ row: rowNumber, message: "Category is required." });
          return null;
        }

        return {
          date: date.toISOString(),
          amount,
          category: categoryValue.trim(),
          vendor: vendorValue.trim(),
          notes: notesValue.trim(),
        };
      })
      .filter((transaction): transaction is TransactionPayload => Boolean(transaction));

    if (errors.length || !transactions.length) {
      setCsvErrors(errors.length ? errors : [{ row: 0, message: "No valid transactions found." }]);
      return;
    }

    try {
      const response = await transactionsApi.bulk(transactions);
      setCsvErrors(response.errors);
      toast.showToast({
        title: "Upload finished",
        message: `Imported: ${response.imported}. Failed: ${response.failed}.`,
        variant: response.failed ? "warning" : "success",
      });
      if (response.imported > 0) {
        resetImportState();
        setIsImportOpen(false);
        await loadTransactions();
      }
    } catch (err) {
      toast.error("Upload failed", getApiErrorMessage(err));
    }
  };

  const openActionMenu = (
    transaction: Transaction,
    event: ReactMouseEvent<HTMLButtonElement>,
  ) => {
    setSelectedId(transaction.id);

    if (actionMenuId === transaction.id) {
      setActionMenuId(null);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 208;
    const menuHeight = 220;
    setActionMenuPosition({
      top: Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - menuHeight)),
      left: Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8)),
    });
    setActionMenuId(transaction.id);
  };

  const openEditFromMenu = (transaction: Transaction) => {
    setActionMenuId(null);
    startEditing(transaction);
  };

  const openHistoryFromMenu = (transaction: Transaction) => {
    setActionMenuId(null);
    setHistoryTransaction(transaction);
  };

  const openDeleteFromMenu = (transaction: Transaction) => {
    setActionMenuId(null);
    setSelectedTransactionIds([transaction.id]);
    setIsDeleteOpen(true);
  };

  const openAiReviewFromMenu = async (transaction: Transaction) => {
    setActionMenuId(null);
    try {
      const suggestion = await transactionsApi.suggest({
        amount: Number(transaction.amount),
        vendor: transaction.vendor,
        notes: transaction.notes,
      });
      setAiReview({ transaction, suggestion });
    } catch (err) {
      toast.warning("AI suggestion failed", getApiErrorMessage(err));
    }
  };

  const applyAiReview = async () => {
    if (!aiReview) return;
    try {
      await transactionsApi.correctCategory(aiReview.transaction.id, {
        category: aiReview.suggestion.category,
      });
      toast.showToast({
        title: "Category updated",
        message: `AI category ${aiReview.suggestion.category} was applied.`,
        variant: "success",
      });
      setAiReview(null);
      await loadTransactions();
    } catch (err) {
      toast.error("Could not apply category", getApiErrorMessage(err));
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
      <FormField label="Type">
        <div className={styles.typeToggle}>
          <button className={`${styles.typeButton} ${form.type === "expense" ? styles.activeType : ""}`} onClick={() => setForm((current) => ({ ...current, type: "expense" }))} type="button">Expense</button>
          <button className={`${styles.typeButton} ${form.type === "income" ? styles.activeType : ""}`} onClick={() => setForm((current) => ({ ...current, type: "income" }))} type="button">Income</button>
        </div>
      </FormField>
      <FormField label="Amount" error={formErrors.amount}>
        <Input
          inputMode="decimal"
          placeholder="24.50"
          value={form.amount}
          error={formErrors.amount}
          onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
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
      <FormField label="Category" error={formErrors.category}>
        <div className={styles.categoryAiRow}>
          <Select
            aria-label="Transaction category"
            menuPlacement="top"
            value={form.category}
            options={formCategoryOptions}
            onValueChange={(value) => setForm((current) => ({ ...current, category: value }))}
          />
          <button
            aria-label="Let AI choose the category"
            className={styles.aiCategoryButton}
            onClick={() => void applyAiSuggestion()}
            title="Let AI choose the category"
            type="button"
          >
            <SparklesIcon />
          </button>
        </div>
      </FormField>
      <div className={styles.modalActions}>
        <Button variant="secondary" onClick={() => (mode === "add" ? setIsAddOpen(false) : setIsEditOpen(false))}>
          Cancel
        </Button>
        <Button type="submit">{mode === "add" ? "Add Transaction" : "Save Changes"}</Button>
      </div>
    </form>
  );

  const renderInlineEditRow = (transaction: Transaction) => {
    if (!editValues) return null;

    return (
      <tr key={transaction.id} className={styles.editingRow}>
        <td>
          <input
            checked={selectedTransactionIds.includes(transaction.id)}
            onChange={() => toggleTransactionSelection(transaction.id)}
            type="checkbox"
          />
        </td>
        <td>
          <div className={styles.inlineField}>
            <input
              className={`${styles.inlineInput} ${editErrors.date ? styles.inlineInputError : ""}`}
              type="date"
              value={editValues.date}
              onChange={(event) => setEditValues((current) => current ? { ...current, date: event.target.value } : current)}
            />
            {editErrors.date ? <span className={styles.inlineError}>{editErrors.date}</span> : null}
          </div>
        </td>
        <td>
          <div className={styles.inlineField}>
            <input
              className={`${styles.inlineInput} ${editErrors.vendor ? styles.inlineInputError : ""}`}
              value={editValues.vendor}
              onChange={(event) => setEditValues((current) => current ? { ...current, vendor: event.target.value } : current)}
              placeholder="Vendor name"
            />
            {editErrors.vendor ? <span className={styles.inlineError}>{editErrors.vendor}</span> : null}
          </div>
        </td>
        <td>
          <div className={styles.inlineField}>
            <Select
              aria-label="Edit transaction category"
              className={styles.inlineSelect}
              error={editErrors.category}
              menuPlacement="top"
              options={formCategoryOptions}
              searchable
              searchPlaceholder="Search categories..."
              value={editValues.category}
              onValueChange={(value) => setEditValues((current) => current ? { ...current, category: value } : current)}
            />
            {editErrors.category ? <span className={styles.inlineError}>{editErrors.category}</span> : null}
          </div>
        </td>
        <td>
          <input
            className={styles.inlineInput}
            value={editValues.notes}
            onChange={(event) => setEditValues((current) => current ? { ...current, notes: event.target.value } : current)}
            placeholder="Optional note"
            maxLength={noteMaxLength}
          />
        </td>
        <td>
          <div className={styles.inlineField}>
            <input
              className={`${styles.inlineInput} ${editErrors.amount ? styles.inlineInputError : ""}`}
              value={editValues.amount}
              inputMode="decimal"
              onChange={(event) => setEditValues((current) => current ? { ...current, amount: event.target.value } : current)}
              placeholder="0.00"
            />
            {editErrors.amount ? <span className={styles.inlineError}>{editErrors.amount}</span> : null}
          </div>
        </td>
        <td>
          <div className={styles.inlineActions}>
            <button
              className={styles.saveInlineButton}
              disabled={savingEditId === transaction.id}
              onClick={() => void saveEditing(transaction)}
              type="button"
              aria-label="Save changes"
              title="Save changes"
            >
              {savingEditId === transaction.id ? (
                <span className={styles.inlineSpinner} aria-hidden="true" />
              ) : (
                <CheckIcon />
              )}
            </button>
            <button
              className={styles.cancelInlineButton}
              disabled={savingEditId === transaction.id}
              onClick={cancelEditing}
              type="button"
              aria-label="Cancel editing"
              title="Cancel editing"
            >
              <XIcon />
            </button>
          </div>
        </td>
      </tr>
    );
  };

  const isEditing = editingId !== null;

  return (
    <section className={styles.page}>
      <TransactionStats transactions={transactions} />
      <div className={styles.actionBar}>
        <Button variant="secondary" onClick={openImportModal}>
          <CloudUploadIcon />
          Upload Transactions
        </Button>
        <Button variant="secondary" onClick={openExportModal}>
          <SpreadsheetIcon />
          Export CSV
        </Button>
        <Button
          className={activeFilterCount ? styles.filterButtonActive : ""}
          variant="secondary"
          onClick={() => setIsFiltersOpen(true)}
        >
          <FilterIcon />
          Filters
          {activeFilterCount ? (
            <span className={styles.filterCount}>{activeFilterCount}</span>
          ) : null}
        </Button>
        <Button variant="secondary" onClick={() => setIsSummaryOpen(true)}>
          Summary
        </Button>
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

      <Modal
        bodyClassName={styles.filters}
        isOpen={isFiltersOpen}
        title="Filters"
        onClose={() => setIsFiltersOpen(false)}
      >
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
            <Button variant="secondary" onClick={() => { setDatePreset("custom"); setSearchTerm(""); setFilters(defaultFilters); }}>
              Reset Filters
            </Button>
          </div>
      </Modal>

      <Modal
        bodyClassName={styles.summaryModal}
        isOpen={isSummaryOpen}
        title="Summary"
        onClose={() => setIsSummaryOpen(false)}
      >
        <section className={styles.stats}>
          <h3>Quick Stats</h3>
          <strong>{total}</strong>
          <span>Transactions</span>
          <strong className={styles.expense}>{toMoney(expenses)}</strong>
          <span>Total Expenses</span>
          <strong className={styles.income}>{toMoney(income)}</strong>
          <span>Total Income</span>
        </section>
      </Modal>

      <Modal
        bodyClassName={styles.exportModal}
        isOpen={isExportOpen}
        title="Export CSV"
        onClose={() => setIsExportOpen(false)}
      >
        <div className={styles.exportForm}>
          <FormField label="Date Range">
            <Select
              aria-label="Export date range"
              value={exportState.preset}
              options={[
                { value: "last30", label: "Last 30 days" },
                { value: "last90", label: "Last 90 days" },
                { value: "currentMonth", label: "Current month" },
                { value: "currentYear", label: "Current year" },
                { value: "custom", label: "Custom range" },
              ]}
              onValueChange={(value) => setExportState((current) => ({ ...current, preset: value as ExportPreset }))}
            />
          </FormField>
          {exportState.preset === "custom" ? (
            <div className={styles.splitFields}>
              <Input type="date" value={exportState.dateFrom} onChange={(event) => setExportState((current) => ({ ...current, dateFrom: event.target.value }))} />
              <Input type="date" value={exportState.dateTo} onChange={(event) => setExportState((current) => ({ ...current, dateTo: event.target.value }))} />
            </div>
          ) : null}
          <div className={styles.exportColumnGrid}>
            {exportColumns.map((column) => (
              <label key={column.value} className={styles.checkboxRow}>
                <input
                  checked={exportState.columns.includes(column.value)}
                  type="checkbox"
                  onChange={(event) =>
                    setExportState((current) => ({
                      ...current,
                      columns: event.target.checked
                        ? Array.from(new Set([...current.columns, column.value]))
                        : current.columns.filter((item) => item !== column.value),
                    }))
                  }
                />
                <span>{column.label}</span>
              </label>
            ))}
          </div>
          <div className={styles.modalActions}>
            <Button variant="secondary" onClick={() => setExportState((current) => ({ ...current, columns: exportColumns.map((item) => item.value) }))}>
              Select All
            </Button>
            <Button variant="secondary" onClick={() => setExportState((current) => ({ ...current, columns: [] }))}>
              Deselect All
            </Button>
          </div>
          <div className={styles.modalActions}>
            <Button variant="secondary" onClick={() => setIsExportOpen(false)}>Cancel</Button>
            <Button onClick={() => void exportCsv()}>Download CSV</Button>
          </div>
        </div>
      </Modal>

      <main className={styles.content}>
        <section className={styles.tablePanel}>
          <header className={styles.tableHeader}>
            <div className={styles.tableActions}>
              <span className={styles.selectionSummary}>
                {selectedCount ? `${selectedCount} selected` : "No selection"}
              </span>
              <div className={styles.tableActionButtons}>
                <Button
                  disabled={!selectedCount || isEditing}
                  onClick={() => setIsDeleteOpen(true)}
                >
                  Delete Selected
                </Button>
                <Button
                  disabled={!selectedCount || isEditing}
                  onClick={() => void recategorizeSelected()}
                >
                  Re-categorize Selected
                </Button>
              </div>
            </div>
          </header>

          {isLoading ? (
            <div className={styles.state}>
              <LoadingSpinner label="Loading transactions" />
            </div>
          ) : null}
          {error ? <div className={styles.stateError}>{error}</div> : null}
          {!isLoading && !error && transactions.length === 0 ? (
            <div className={styles.emptyStateCard}>
              <div className={styles.emptyStateIcon}><SpreadsheetIcon /></div>
              <h3>No transactions yet</h3>
              <p>Start by adding a transaction or uploading a file to build your money story.</p>
              <div className={styles.emptyStateActions}>
                <Button onClick={() => {
                  setForm(emptyForm);
                  setFormErrors({});
                  setIsAddOpen(true);
                }}>Add Transaction</Button>
                <Button variant="secondary" onClick={openImportModal}>Upload File</Button>
              </div>
            </div>
          ) : null}

          {!isLoading && !error && transactions.length > 0 ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>
                      <label className={styles.selectAllLabel}>
                        <input
                          aria-label="Select all transactions on this page"
                          checked={allVisibleSelected}
                          disabled={isEditing}
                          onChange={toggleVisibleTransactionSelection}
                          type="checkbox"
                        />
                      </label>
                    </th>
                    <th>Date</th>
                    <th>Vendor</th>
                    <th>Category</th>
                    <th>Notes</th>
                    <th>Amount</th>
                    <th aria-label="Transaction actions" />
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => {
                    if (editingId === transaction.id) {
                      return renderInlineEditRow(transaction);
                    }

                    return (
                      <tr key={transaction.id} className={styles.clickableRow}>
                        <td>
                          <input
                            checked={selectedTransactionIds.includes(transaction.id)}
                            disabled={isEditing}
                            onChange={() => toggleTransactionSelection(transaction.id)}
                            type="checkbox"
                          />
                        </td>
                        <td>{formatDate(transaction.date)}</td>
                        <td className={styles.vendorCell}>
                          <span>{transaction.vendor || "Unknown"}</span>
                        </td>
                        <td>
                          <span className={styles.categoryCell}>
                            {categoryByName.get(transaction.category)?.is_default === false ? (
                              <span
                                className={styles.customCategoryDot}
                                style={categoryIconStyle(transaction.category)}
                              />
                            ) : (
                              <span className={styles.categoryIcon}>
                                <CategoryIcon category={transaction.category} />
                              </span>
                            )}
                            {transaction.category}
                          </span>
                        </td>
                        <td className={styles.notesCell} title={transaction.notes || undefined}>
                          <span>{transaction.notes || "—"}</span>
                        </td>
                        <td className={Number(transaction.amount) < 0 ? styles.expense : styles.income}>
                          {toMoney(transaction.amount)}
                        </td>
                        <td>
                          {isEditing ? (
                            <span className={styles.readonlyAction} title="Finish editing first">—</span>
                          ) : (
                            <div
                              className={styles.rowActions}
                              ref={actionMenuId === transaction.id ? actionMenuRef : undefined}
                            >
                              <button
                                className={styles.dotsButton}
                                type="button"
                                aria-expanded={actionMenuId === transaction.id}
                                aria-label="Open transaction actions"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openActionMenu(transaction, event);
                                }}
                              >
                                <svg aria-hidden="true" viewBox="0 0 24 24">
                                  <circle cx="12" cy="5" r="1.8" />
                                  <circle cx="12" cy="12" r="1.8" />
                                  <circle cx="12" cy="19" r="1.8" />
                                </svg>
                              </button>
                              {actionMenuId === transaction.id ? (
                                <div className={styles.actionMenu} style={actionMenuPosition}>
                                  <button type="button" onClick={() => openEditFromMenu(transaction)}>Edit</button>
                                  <button type="button" onClick={() => openHistoryFromMenu(transaction)}>Show edit history</button>
                                  <button type="button" onClick={() => void openAiReviewFromMenu(transaction)}>Recategorize with AI</button>
                                  <button type="button" className={styles.dangerAction} onClick={() => openDeleteFromMenu(transaction)}>Delete</button>
                                </div>
                              ) : null}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}

          <footer className={styles.pagination}>
            <span className={styles.paginationSummary}>
              {total} transaction{total === 1 ? "" : "s"}
            </span>
            <div className={styles.pageNavigation}>
              <Button
                aria-label="Previous page"
                className={styles.paginationArrow}
                variant="secondary"
                disabled={filters.page <= 1}
                onClick={() => updateFilter({ page: filters.page - 1 })}
                title="Previous page"
              >
                <ArrowLeftIcon />
              </Button>
              <span className={styles.pageIndicator}>
                Page <strong>{filters.page}</strong> of {totalPages}
              </span>
              <Button
                aria-label="Next page"
                className={styles.paginationArrow}
                variant="secondary"
                disabled={filters.page >= totalPages}
                onClick={() => updateFilter({ page: filters.page + 1 })}
                title="Next page"
              >
                <ArrowRightIcon />
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

      <Modal
        bodyClassName={styles.transactionFormModal}
        className={styles.transactionModal}
        isOpen={isAddOpen}
        title="Add Transaction"
        onClose={() => setIsAddOpen(false)}
      >
        {renderModalForm("add")}
      </Modal>
      <Modal
        bodyClassName={styles.transactionFormModal}
        className={styles.transactionModal}
        isOpen={isEditOpen}
        title="Edit Transaction"
        onClose={() => setIsEditOpen(false)}
      >
        {renderModalForm("edit")}
      </Modal>
      <Modal isOpen={isDeleteOpen} title={selectedTransactionIds.length > 1 ? "Delete Transactions" : "Delete Transaction"} onClose={() => setIsDeleteOpen(false)}>
        <p className={styles.confirmText}>
          {selectedTransactionIds.length > 1
            ? `Are you sure you want to delete ${selectedTransactionIds.length} transactions?`
            : "Are you sure you want to delete this transaction?"}
        </p>
        <div className={styles.modalActions}>
          <Button variant="secondary" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
          <Button variant="danger" onClick={() => void confirmDelete()}>
            {selectedTransactionIds.length > 1 ? `Delete ${selectedTransactionIds.length} Transactions` : "Delete Transaction"}
          </Button>
        </div>
      </Modal>
      <Modal
        isOpen={Boolean(historyTransaction)}
        title="Edit History"
        onClose={() => setHistoryTransaction(null)}
      >
        <div className={styles.history}>
          {historyTransaction?.history.length ? historyTransaction.history.map((item) => (
            <article key={item.id}>
              <time>{formatDate(item.timestamp, true)}</time>
              <p>{item.event}</p>
            </article>
          )) : <p>No edit history available.</p>}
        </div>
      </Modal>
      <Modal
        isOpen={Boolean(aiReview)}
        title="AI category suggestion"
        onClose={() => setAiReview(null)}
      >
        <div className={styles.aiSuggestion}>
          <p>
            AI suggests <strong>{aiReview?.suggestion.category}</strong> for this transaction.
          </p>
          <span>Confidence: {aiReview?.suggestion.confidence ?? 0}%</span>
          {aiReview?.suggestion.rationale ? <small>{aiReview.suggestion.rationale}</small> : null}
        </div>
        <div className={styles.modalActions}>
          <Button variant="secondary" onClick={() => setAiReview(null)}>Ignore</Button>
          <Button onClick={() => void applyAiReview()}>Apply</Button>
        </div>
      </Modal>
      <Modal
        bodyClassName={styles.importModalBody}
        className={styles.importModal}
        isOpen={isImportOpen}
        title="Upload Transactions"
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
                <Button onClick={() => void importCsv()}>Upload Transactions</Button>
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
