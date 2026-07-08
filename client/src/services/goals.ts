import { api } from "./api";
import type {
  Goal,
  GoalContributionPayload,
  GoalPayload,
  GoalUpdatePayload,
} from "../types/goal";

const LOCAL_GOALS_KEY = "moneymate.local.goals";

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function readLocalGoals(): Goal[] {
  if (typeof window === "undefined") return [];
  return safeParse<Goal[]>(window.localStorage.getItem(LOCAL_GOALS_KEY), []);
}

function saveLocalGoals(goals: Goal[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_GOALS_KEY, JSON.stringify(goals));
}

type ApiGoal = Goal & {
  target_date?: string | null;
};

function toGoal(goal: ApiGoal): Goal {
  return {
    ...goal,
    deadline: goal.deadline ?? goal.target_date ?? null,
  };
}

export const goalsApi = {
  list: async () => {
    try {
      const response = await api.get<{ items: ApiGoal[] }>("/goals");
      return response.items.map(toGoal);
    } catch {
      return readLocalGoals();
    }
  },
  create: async (payload: GoalPayload) => {
    try {
      return toGoal(await api.post<ApiGoal>("/goals", payload));
    } catch {
      const goal: Goal = {
        id: Date.now(),
        user_id: 0,
        name: payload.name,
        target_amount: String(payload.target_amount),
        current_amount: String(payload.current_amount ?? 0),
        deadline: payload.deadline ?? null,
        linked_account: payload.linked_account ?? null,
        is_active: true,
        contributions: [],
        saved_percentage:
          payload.target_amount > 0
            ? Number((((payload.current_amount ?? 0) / payload.target_amount) * 100).toFixed(2))
            : 0,
        remaining_amount: String(Math.max(payload.target_amount - (payload.current_amount ?? 0), 0)),
      };
      const all = readLocalGoals();
      saveLocalGoals([goal, ...all]);
      return goal;
    }
  },
  update: async (id: number, payload: GoalUpdatePayload) => {
    try {
      return toGoal(await api.patch<ApiGoal>(`/goals/${id}`, payload));
    } catch {
      const all = readLocalGoals();
      const updated: Goal[] = all.map((goal) =>
        goal.id === id
          ? {
              ...goal,
              ...payload,
              target_amount: String(payload.target_amount ?? goal.target_amount),
              current_amount: String(payload.current_amount ?? goal.current_amount),
            }
          : goal,
      );
      saveLocalGoals(updated);
      return updated.find((goal) => goal.id === id) ?? all[0];
    }
  },
  remove: async (id: number) => {
    try {
      await api.delete<void>(`/goals/${id}`);
      saveLocalGoals(readLocalGoals().filter((goal) => goal.id !== id));
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "status" in error &&
        (error.status === 0 || error.status === 404)
      ) {
        saveLocalGoals(readLocalGoals().filter((goal) => goal.id !== id));
        return;
      }
      throw error;
    }
  },
  contribute: async (id: number, payload: GoalContributionPayload) => {
    try {
      return toGoal(await api.post<ApiGoal>(`/goals/${id}/contributions`, payload));
    } catch {
      const all = readLocalGoals();
      const updated = all.map((goal) =>
        goal.id === id
          ? {
              ...goal,
              current_amount: String(Number(goal.current_amount) + payload.amount),
              remaining_amount: String(Math.max(Number(goal.target_amount) - (Number(goal.current_amount) + payload.amount), 0)),
              saved_percentage: Number(
                ((Number(goal.current_amount) + payload.amount) / Number(goal.target_amount) * 100).toFixed(2),
              ),
              contributions: [
                {
                  id: Date.now(),
                  goal_id: goal.id,
                  amount: String(payload.amount),
                  contributed_at: payload.contributed_at ?? new Date().toISOString(),
                  note: payload.note ?? null,
                },
                ...goal.contributions,
              ],
            }
          : goal,
      );
      saveLocalGoals(updated);
      return updated.find((goal) => goal.id === id) ?? all[0];
    }
  },
};
