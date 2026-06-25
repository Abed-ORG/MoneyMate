import { api } from "./api";
import type {
  DashboardAnalyticsParams,
  DashboardAnalyticsResponse,
} from "../types/analytics";

function buildQuery(params: DashboardAnalyticsParams) {
  const search = new URLSearchParams({
    start_date: params.startDate,
    end_date: params.endDate,
    trend_aggregation: params.trendAggregation,
    months: String(params.months ?? 12),
  });

  if (params.categoryIds.length) {
    search.set("category_ids", params.categoryIds.join(","));
  }
  if (params.accountIds.length) {
    search.set("account_ids", params.accountIds.join(","));
  }

  return search.toString();
}

export const analyticsApi = {
  dashboard: (params: DashboardAnalyticsParams) =>
    api.get<DashboardAnalyticsResponse>(
      `/analytics/dashboard?${buildQuery(params)}`,
    ),
};
