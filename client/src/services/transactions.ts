import { api } from "./api";
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
    api.get<TransactionListResponse>(`/transactions?${buildQuery(params)}`),

  categories: () => api.get<Category[]>("/transactions/categories"),

  createCategory: (payload: CategoryPayload) =>
    api.post<Category>("/transactions/categories", payload),

  updateCategory: (id: string, payload: CategoryUpdatePayload) =>
    api.patch<Category>(`/transactions/categories/${id}`, payload),

  deleteCategory: (id: string) =>
    api.delete<void>(`/transactions/categories/${id}`),

  create: async (payload: TransactionPayload) => {
    const transaction = await api.post<Transaction>("/transactions", payload);
    dispatchTransactionsChanged(transaction);
    return transaction;
  },

  update: async (id: string, payload: TransactionPayload) => {
    const transaction = await api.patch<Transaction>(
      `/transactions/${id}`,
      payload,
    );
    dispatchTransactionsChanged(transaction);
    return transaction;
  },

  delete: async (id: string) => {
    await api.delete<void>(`/transactions/${id}`);
    dispatchTransactionsChanged();
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
    const transactions = await api.post<Transaction[]>(
      "/transactions/bulk-recategorize",
      payload,
    );
    dispatchTransactionsChanged(transactions[0]);
    return transactions;
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