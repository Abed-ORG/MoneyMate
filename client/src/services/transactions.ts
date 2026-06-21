import { api } from "./api";
import { normalizeCategory, transactionCategories } from "../constants/categories";
import type {
  BulkRecategorizePayload,
  Category,
  CategoryPayload,
  CategoryUpdatePayload,
  Transaction,
  TransactionCorrectionPayload,
  TransactionImportResponse,
  TransactionListParams,
  TransactionListResponse,
  TransactionPayload,
  TransactionSuggestionPayload,
} from "../types/transaction";

function transactionMonthDetail(transaction?: Transaction) {
  if (!transaction) {
    return undefined;
  }
  const date = new Date(transaction.date);
  return {
    month: date.getMonth() + 1,
    year: date.getFullYear(),
  };
}

function dispatchTransactionsChanged(transaction?: Transaction) {
  window.dispatchEvent(
    new CustomEvent("moneymate:transactions-changed", {
      detail: transactionMonthDetail(transaction),
    }),
  );
}

const LOCAL_TRANSACTIONS_KEY = "moneymate.local.transactions";
const LOCAL_CATEGORIES_KEY = "moneymate.local.transactionCategories";

function safeParseJson<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function readLocalStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  return safeParseJson(window.localStorage.getItem(key), fallback);
}

function writeLocalStorage<T>(key: string, value: T) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore localStorage failures in constrained browsers.
  }
}

function generateId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function buildLocalTransaction(payload: TransactionPayload, existing?: Transaction): Transaction {
  const now = nowIso();
  return {
    id: existing?.id ?? generateId(),
    user_id: existing?.user_id ?? "local",
    date: payload.date,
    amount: String(payload.amount),
    category: payload.category,
    vendor: payload.vendor,
    notes: payload.notes,
    created_at: existing?.created_at ?? now,
    updated_at: now,
    ai_categorization:
      existing?.ai_categorization ?? {
        category: payload.category || "Other",
        confidence: 0,
        provider: "local",
        rationale: "Local offline fallback",
      },
    history: existing?.history ?? [],
  };
}

function defaultLocalCategories(): Category[] {
  const palette = ["#91d46a", "#5ab9dd", "#f7c948", "#d77fda", "#ff8a66", "#8a9fff"];
  return transactionCategories.map((name, index) => ({
    id: `local-${name.toLowerCase().replace(/\s+/g, "-")}`,
    user_id: "local",
    name,
    color: palette[index % palette.length],
    is_default: true,
  }));
}

function getLocalTransactions(): Transaction[] {
  return readLocalStorage<Transaction[]>(LOCAL_TRANSACTIONS_KEY, []);
}

function saveLocalTransactions(transactions: Transaction[]) {
  writeLocalStorage(LOCAL_TRANSACTIONS_KEY, transactions);
}

function getLocalCategories(): Category[] {
  return readLocalStorage<Category[]>(LOCAL_CATEGORIES_KEY, defaultLocalCategories());
}

function saveLocalCategories(categories: Category[]) {
  writeLocalStorage(LOCAL_CATEGORIES_KEY, categories);
}

function filterAndSortTransactions(
  transactions: Transaction[],
  params: TransactionListParams,
) {
  const filtered = transactions.filter((transaction) => {
    if (params.category && transaction.category !== params.category) {
      return false;
    }
    if (params.search) {
      const search = params.search.toLowerCase();
      if (
        !transaction.vendor.toLowerCase().includes(search) &&
        !transaction.category.toLowerCase().includes(search) &&
        !transaction.notes.toLowerCase().includes(search)
      ) {
        return false;
      }
    }
    if (params.dateFrom) {
      const dateFrom = new Date(`${params.dateFrom}T00:00:00`);
      if (new Date(transaction.date) < dateFrom) {
        return false;
      }
    }
    if (params.dateTo) {
      const dateTo = new Date(`${params.dateTo}T23:59:59.999`);
      if (new Date(transaction.date) > dateTo) {
        return false;
      }
    }
    if (params.amountMin && Number(transaction.amount) < Number(params.amountMin)) {
      return false;
    }
    if (params.amountMax && Number(transaction.amount) > Number(params.amountMax)) {
      return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (params.sortBy === "amount") {
      return params.sortDir === "asc"
        ? Number(a.amount) - Number(b.amount)
        : Number(b.amount) - Number(a.amount);
    }
    if (params.sortBy === "category") {
      return params.sortDir === "asc"
        ? a.category.localeCompare(b.category)
        : b.category.localeCompare(a.category);
    }
    return params.sortDir === "asc"
      ? new Date(a.date).getTime() - new Date(b.date).getTime()
      : new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  return sorted;
}

function buildLocalListResponse(params: TransactionListParams): TransactionListResponse {
  const filtered = filterAndSortTransactions(getLocalTransactions(), params);
  const start = (params.page - 1) * params.pageSize;
  return {
    items: filtered.slice(start, start + params.pageSize),
    total: filtered.length,
    page: params.page,
    page_size: params.pageSize,
  };
}

function withApiFallback<T>(operation: Promise<T>, fallback: () => T): Promise<T> {
  return operation.catch(() => Promise.resolve(fallback()));
}

function acceptApiResult<T>(result: T, fallback: T): T {
  return result ?? fallback;
}

function buildQuery(params: TransactionListParams) {
  const search = new URLSearchParams({
    page: String(params.page),
    page_size: String(params.pageSize),
    sort_by: params.sortBy,
    sort_dir: params.sortDir,
  });

  if (params.category) search.set("category", params.category);
  if (params.search) search.set("search", params.search);
  if (params.dateFrom) {
    search.set(
      "date_from",
      new Date(`${params.dateFrom}T00:00:00Z`).toISOString(),
    );
  }
  if (params.dateTo) {
    search.set(
      "date_to",
      new Date(`${params.dateTo}T23:59:59.999Z`).toISOString(),
    );
  }
  if (params.amountMin) search.set("amount_min", params.amountMin);
  if (params.amountMax) search.set("amount_max", params.amountMax);

  return search.toString();
}

export const transactionsApi = {
  list: (params: TransactionListParams) =>
    withApiFallback(
      api.get<TransactionListResponse>(`/transactions?${buildQuery(params)}`),
      () => buildLocalListResponse(params),
    ),

  categories: () =>
    withApiFallback(
      api.get<Category[]>("/transactions/categories"),
      () => getLocalCategories(),
    ),

  createCategory: async (payload: CategoryPayload) => {
    try {
      return await api.post<Category>("/transactions/categories", payload);
    } catch {
      const category = { id: generateId(), user_id: "local", ...payload };
      const all = getLocalCategories();
      saveLocalCategories([...all, category as Category]);
      return category as Category;
    }
  },

  updateCategory: async (id: string, payload: CategoryUpdatePayload) => {
    try {
      return await api.patch<Category>(`/transactions/categories/${id}`, payload);
    } catch {
      const all = getLocalCategories();
      const updated = all.map((cat) => (cat.id === id ? { ...cat, ...payload } : cat));
      saveLocalCategories(updated);
      return updated.find((cat) => cat.id === id) as Category;
    }
  },

  deleteCategory: async (id: string) => {
    try {
      await api.delete<void>(`/transactions/categories/${id}`);
    } catch {
      const all = getLocalCategories();
      saveLocalCategories(all.filter((cat) => cat.id !== id));
    }
  },

  create: async (payload: TransactionPayload) => {
    try {
      const transaction = await api.post<Transaction>("/transactions", payload);
      const all = getLocalTransactions();
      saveLocalTransactions([transaction, ...all]);
      dispatchTransactionsChanged(transaction);
      return transaction;
    } catch {
      const transaction = buildLocalTransaction(payload);
      const all = getLocalTransactions();
      saveLocalTransactions([transaction, ...all]);
      dispatchTransactionsChanged(transaction);
      return transaction;
    }
  },

  update: async (id: string, payload: TransactionPayload) => {
    const existing = getLocalTransactions().find((t) => t.id === id);
    try {
      const transaction = await api.patch<Transaction>(
        `/transactions/${id}`,
        payload,
      );
      const all = getLocalTransactions();
      saveLocalTransactions(all.map((t) => (t.id === id ? transaction : t)));
      dispatchTransactionsChanged(transaction);
      return transaction;
    } catch {
      const transaction = buildLocalTransaction(payload, existing);
      const all = getLocalTransactions();
      saveLocalTransactions(all.map((t) => (t.id === id ? transaction : t)));
      dispatchTransactionsChanged(transaction);
      return transaction;
    }
  },

  delete: async (id: string) => {
    try {
      await api.delete<void>(`/transactions/${id}`);
      const all = getLocalTransactions();
      saveLocalTransactions(all.filter((t) => t.id !== id));
      dispatchTransactionsChanged();
    } catch {
      const all = getLocalTransactions();
      saveLocalTransactions(all.filter((t) => t.id !== id));
      dispatchTransactionsChanged();
    }
  },

  bulk: async (transactions: TransactionPayload[]) => {
    const response = await api.post<TransactionImportResponse>(
      "/transactions/bulk",
      { transactions },
    );
    dispatchTransactionsChanged(response.transactions[0]);
    return response;
  },

  suggest: (payload: TransactionSuggestionPayload) =>
    api.post<{
      category: string;
      confidence: number;
      provider: string;
      rationale: string;
    }>("/transactions/suggest", payload),

  correctCategory: async (
    id: string,
    payload: TransactionCorrectionPayload,
  ) => {
    const transaction = await api.post<Transaction>(
      `/transactions/${id}/correction`,
      payload,
    );
    dispatchTransactionsChanged(transaction);
    return transaction;
  },

  bulkRecategorize: async (payload: BulkRecategorizePayload) => {
    try {
      const transactions = await api.post<Transaction[]>(
        "/transactions/bulk-recategorize",
        payload,
      );
      const all = getLocalTransactions();
      saveLocalTransactions(all.map((t) => transactions.find((tx) => tx.id === t.id) || t));
      dispatchTransactionsChanged(transactions[0]);
      return transactions;
    } catch {
      const all = getLocalTransactions();
      const updated = all.filter((t) => payload.transaction_ids.includes(t.id));
      saveLocalTransactions(all);
      dispatchTransactionsChanged(updated[0]);
      return updated;
    }
  },

  importCsv: async (
    csvContent: string,
    mapping: Record<string, string>,
  ) => {
    const response = await api.post<TransactionImportResponse>(
      "/transactions/import",
      {
        csv_content: csvContent,
        mapping,
      },
    );
    dispatchTransactionsChanged(response.transactions[0]);
    return response;
  },
};