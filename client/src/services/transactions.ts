import { api } from "./api";
import type {
  BulkRecategorizePayload,
  Category,
  CategoryPayload,
  CategoryUpdatePayload,
  Transaction,
  TransactionImportResponse,
  TransactionListParams,
  TransactionListResponse,
  TransactionPayload,
  TransactionCorrectionPayload,
} from "../types/transaction";

function buildQuery(params: TransactionListParams) {
  const search = new URLSearchParams({
    page: String(params.page),
    page_size: String(params.pageSize),
    sort_by: params.sortBy,
    sort_dir: params.sortDir,
  });

  if (params.category) search.set("category", params.category);
  if (params.search) search.set("search", params.search);
  if (params.dateFrom) search.set("date_from", new Date(`${params.dateFrom}T00:00:00Z`).toISOString());
  if (params.dateTo) search.set("date_to", new Date(`${params.dateTo}T23:59:59.999Z`).toISOString());
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
  deleteCategory: (id: string) => api.delete<void>(`/transactions/categories/${id}`),
  create: (payload: TransactionPayload) => api.post<Transaction>("/transactions", payload),
  update: (id: string, payload: TransactionPayload) =>
    api.patch<Transaction>(`/transactions/${id}`, payload),
  delete: (id: string) => api.delete<void>(`/transactions/${id}`),
  bulk: (transactions: TransactionPayload[]) =>
    api.post<TransactionImportResponse>("/transactions/bulk", { transactions }),
  suggest: (payload: TransactionPayload) =>
    api.post<{ category: string; confidence: number; provider: string; rationale: string }>(
      "/transactions/suggest",
      payload,
    ),
  correctCategory: (id: string, payload: TransactionCorrectionPayload) =>
    api.post<Transaction>(`/transactions/${id}/correction`, payload),
  bulkRecategorize: (payload: BulkRecategorizePayload) =>
    api.post<Transaction[]>("/transactions/bulk-recategorize", payload),
  importCsv: (csvContent: string, mapping: Record<string, string>) =>
    api.post<TransactionImportResponse>("/transactions/import", {
      csv_content: csvContent,
      mapping,
    }),
};
