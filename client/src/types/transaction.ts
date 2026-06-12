export type AiCategorization = {
  category: string;
  confidence: number;
};

export type TransactionHistoryEvent = {
  id: string;
  event: string;
  timestamp: string;
};

export type Transaction = {
  id: string;
  user_id: string;
  date: string;
  amount: string;
  category: string;
  vendor: string;
  notes: string;
  created_at: string;
  updated_at: string;
  ai_categorization: AiCategorization;
  history: TransactionHistoryEvent[];
};

export type TransactionPayload = {
  date: string;
  amount: number;
  category: string;
  vendor: string;
  notes: string;
};

export type TransactionListParams = {
  page: number;
  pageSize: number;
  sortBy: "date" | "amount" | "category";
  sortDir: "asc" | "desc";
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  amountMin?: string;
  amountMax?: string;
};

export type TransactionListResponse = {
  items: Transaction[];
  total: number;
  page: number;
  page_size: number;
};

export type TransactionImportError = {
  row: number;
  message: string;
};

export type TransactionImportResponse = {
  imported: number;
  failed: number;
  errors: TransactionImportError[];
  transactions: Transaction[];
};
