import { api } from "./api";
import type {
  Budget,
  BudgetAlert,
  BudgetCategory,
  BudgetHistoryResponse,
  BudgetOverview,
  BudgetPayload,
  BudgetSummary,
} from "../types/budget";

type BudgetListParams = {
  month?: number;
  year?: number;
  categoryId?: number;
};

function buildQuery(params: BudgetListParams) {
  const search = new URLSearchParams();
  if (params.month) search.set("month", String(params.month));
  if (params.year) search.set("year", String(params.year));
  if (params.categoryId) search.set("category_id", String(params.categoryId));
  return search.toString();
}

function monthQuery(month: number, year: number) {
  return new URLSearchParams({
    month: String(month),
    year: String(year),
  }).toString();
}

export const budgetsApi = {
  categories: () => api.get<BudgetCategory[]>("/budgets/categories"),
  list: (params: BudgetListParams = {}) => {
    const query = buildQuery(params);
    return api.get<Budget[]>(query ? `/budgets?${query}` : "/budgets");
  },
  get: (id: number) => api.get<Budget>(`/budgets/${id}`),
  create: (payload: BudgetPayload) => api.post<Budget>("/budgets", payload),
  update: (id: number, payload: Partial<BudgetPayload>) =>
    api.patch<Budget>(`/budgets/${id}`, payload),
  delete: (id: number) => api.delete<void>(`/budgets/${id}`),
  overview: (month: number, year: number) =>
    api.get<BudgetOverview>(`/budgets/overview?${monthQuery(month, year)}`),
  comparison: (month: number, year: number) =>
    api.get<BudgetSummary[]>(`/budgets/comparison?${monthQuery(month, year)}`),
  alerts: (month: number, year: number) =>
    api.get<BudgetAlert[]>(`/budgets/alerts?${monthQuery(month, year)}`),
  history: () => api.get<BudgetHistoryResponse>("/budgets/history"),
  historyMonth: (month: number, year: number) =>
    api.get<BudgetOverview>(`/budgets/history/${year}/${month}`),
};

