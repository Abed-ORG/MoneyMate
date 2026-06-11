import { Button } from "../Button/Button";
import { FormField } from "../FormField/FormField";
import { Input } from "../Input/Input";
import styles from "./SavingsGoalsEditor.module.css";

export type SavingsGoalDraft = {
  id: number;
  name: string;
  targetAmount: string;
};

type SavingsGoalsEditorProps = {
  goals: SavingsGoalDraft[];
  onChange: (goals: SavingsGoalDraft[]) => void;
};

let nextGoalId = 1;

export function createEmptySavingsGoal(): SavingsGoalDraft {
  return { id: nextGoalId++, name: "", targetAmount: "" };
}

export function SavingsGoalsEditor({ goals, onChange }: SavingsGoalsEditorProps) {
  const updateGoal = (
    id: number,
    field: "name" | "targetAmount",
    value: string,
  ) => {
    onChange(
      goals.map((goal) => (goal.id === id ? { ...goal, [field]: value } : goal)),
    );
  };

  const removeGoal = (id: number) => {
    const remaining = goals.filter((goal) => goal.id !== id);
    onChange(remaining.length ? remaining : [createEmptySavingsGoal()]);
  };

  return (
    <div className={styles.editor}>
      {goals.map((goal, index) => (
        <div className={styles.goal} key={goal.id}>
          <FormField
            htmlFor={`savings-goal-name-${goal.id}`}
            label={`Savings goal ${index + 1}`}
          >
            <Input
              id={`savings-goal-name-${goal.id}`}
              onChange={(event) => updateGoal(goal.id, "name", event.target.value)}
              placeholder="Emergency fund"
              value={goal.name}
            />
          </FormField>
          <FormField
            htmlFor={`savings-goal-amount-${goal.id}`}
            label="Target amount"
          >
            <Input
              id={`savings-goal-amount-${goal.id}`}
              min="0"
              onChange={(event) =>
                updateGoal(goal.id, "targetAmount", event.target.value)
              }
              step="0.01"
              type="number"
              value={goal.targetAmount}
            />
          </FormField>
          <Button
            aria-label={`Remove savings goal ${index + 1}`}
            className={styles.remove}
            onClick={() => removeGoal(goal.id)}
            type="button"
            variant="secondary"
          >
            Remove
          </Button>
        </div>
      ))}
      <Button
        className={styles.add}
        onClick={() => onChange([...goals, createEmptySavingsGoal()])}
        type="button"
        variant="secondary"
      >
        Add another goal
      </Button>
    </div>
  );
}
