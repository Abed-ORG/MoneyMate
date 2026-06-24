export type GoalContribution = {
  id: number;
  goal_id: number;
  amount: string;
  contributed_at: string;
  note?: string | null;
};

export type Goal = {
  id: number;
  user_id: number;
  name: string;
  target_amount: string;
  current_amount: string;
  deadline?: string | null;
  linked_account?: string | null;
  is_active: boolean;
  contributions: GoalContribution[];
  saved_percentage: number;
  remaining_amount: string;
};

export type GoalPayload = {
  name: string;
  target_amount: number;
  deadline?: string | null;
  linked_account?: string | null;
  current_amount?: number;
};

export type GoalUpdatePayload = Partial<GoalPayload> & {
  is_active?: boolean;
};

export type GoalContributionPayload = {
  amount: number;
  contributed_at?: string;
  note?: string;
};
