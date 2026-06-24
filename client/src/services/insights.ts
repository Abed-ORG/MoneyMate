import { api } from "./api";

export type SpendingInsightItem = {
  category: string;
  total: number;
  transaction_count: number;
  percentage: number;
  insight: string;
};

export type SpendingInsightResponse = {
  summary: string;
  top_category: string;
  top_category_spend: number;
  insights: SpendingInsightItem[];
  provider: string;
  rationale?: string;
};

export type RecurringTransaction = {
  vendor: string;
  category: string;
  amount: number;
  frequency: string;
  confidence: number;
  last_detected: string | null;
  transaction_ids: string[];
};

export type RecurringDetectionResponse = {
  recurring: RecurringTransaction[];
  provider: string;
  rationale?: string;
};

export type AnomalyTransaction = {
  transaction_id: string;
  vendor: string;
  amount: number;
  category: string;
  date: string;
  reason: string;
  severity: string;
};

export type AnomalyDetectionResponse = {
  anomalies: AnomalyTransaction[];
  provider: string;
  rationale?: string;
};

export type MonthlySummaryResponse = {
  summary: string;
  provider: string;
  rationale?: string;
};

export type GoalAICalculationResponse = {
  required_monthly: number;
  provider: string;
  rationale?: string;
};

export type GoalProjectionPoint = {
  month: string;
  projected: number;
};

export type GoalProjectionResponse = {
  projections: GoalProjectionPoint[];
  provider: string;
  rationale?: string;
};

export const insightsApi = {
  spending: async (): Promise<SpendingInsightResponse> => {
    try {
      return await api.post<SpendingInsightResponse>("/api/insights/spending");
    } catch {
      return {
        summary: "Add transactions to generate spending insights.",
        top_category: "n/a",
        top_category_spend: 0,
        insights: [],
        provider: "heuristic",
        rationale: "Backend unavailable; using local fallback.",
      };
    }
  },

  recurring: async (): Promise<RecurringDetectionResponse> => {
    try {
      return await api.post<RecurringDetectionResponse>("/api/insights/recurring");
    } catch {
      return { recurring: [], provider: "heuristic", rationale: "Backend unavailable." };
    }
  },

  anomalies: async (): Promise<AnomalyDetectionResponse> => {
    try {
      return await api.post<AnomalyDetectionResponse>("/api/insights/anomalies");
    } catch {
      return { anomalies: [], provider: "heuristic", rationale: "Backend unavailable." };
    }
  },

  monthlySummary: async (): Promise<MonthlySummaryResponse> => {
    try {
      return await api.post<MonthlySummaryResponse>("/api/insights/monthly-summary");
    } catch {
      return {
        summary: "No transaction data available for this period.",
        provider: "heuristic",
        rationale: "Backend unavailable.",
      };
    }
  },
};

export const goalAiApi = {
  calculateSavings: async (payload: {
    target_amount: number;
    current_amount: number;
    deadline: string | null;
  }): Promise<GoalAICalculationResponse> => {
    try {
      return await api.post<GoalAICalculationResponse>("/goals/ai/calculate", {
        target_amount: payload.target_amount,
        current_amount: payload.current_amount,
        deadline: payload.deadline,
      });
    } catch {
      // Client-side fallback
      const remaining = Math.max(payload.target_amount - payload.current_amount, 0);
      const months = payload.deadline
        ? Math.max(Math.ceil((new Date(payload.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30)), 1)
        : 1;
      return {
        required_monthly: remaining / months,
        provider: "heuristic",
        rationale: "Backend unavailable; calculated locally.",
      };
    }
  },

  projection: async (payload: {
    target_amount: number;
    current_amount: number;
    deadline: string | null;
  }): Promise<GoalProjectionResponse> => {
    try {
      return await api.post<GoalProjectionResponse>("/goals/ai/projection", {
        target_amount: payload.target_amount,
        current_amount: payload.current_amount,
        deadline: payload.deadline,
      });
    } catch {
      // Client-side fallback
      const remaining = Math.max(payload.target_amount - payload.current_amount, 0);
      const months = payload.deadline
        ? Math.max(Math.ceil((new Date(payload.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30)), 1)
        : 1;
      const monthly = remaining / months;
      const projections: GoalProjectionPoint[] = [];
      let running = payload.current_amount;
      const points = 6;
      for (let i = 0; i < points; i++) {
        running += monthly;
        projections.push({ month: `M${i + 1}`, projected: Math.min(running, payload.target_amount) });
        if (running >= payload.target_amount) break;
      }
      return {
        projections,
        provider: "heuristic",
        rationale: "Backend unavailable; calculated locally.",
      };
    }
  },
};