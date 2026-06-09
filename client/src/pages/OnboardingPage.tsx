import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Button,
  Card,
  createEmptySavingsGoal,
  FormField,
  Input,
  SavingsGoalsEditor,
  type SavingsGoalDraft,
  Select,
} from "../components";
import { useAuth, type FinancialProfile } from "../contexts/AuthContext";
import { api, getApiErrorMessage } from "../services/api";
import styles from "./ProfilePage.module.css";

const categories = [
  "Housing",
  "Food & Dining",
  "Transportation",
  "Utilities",
  "Health",
  "Shopping",
  "Entertainment",
  "Education",
  "Travel",
];

export function OnboardingPage() {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoalDraft[]>([
    createEmptySavingsGoal(),
  ]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { setProfile } = useAuth();
  const navigate = useNavigate();

  const toggleCategory = (category: string) => {
    setSelectedCategories((current) =>
      current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category],
    );
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const incompleteGoal = savingsGoals.find(
      (goal) =>
        (goal.name.trim() && Number(goal.targetAmount) <= 0) ||
        (!goal.name.trim() && Number(goal.targetAmount) > 0),
    );

    if (selectedCategories.length === 0) {
      setError("Choose at least one spending category.");
      return;
    }
    if (incompleteGoal) {
      setError("Enter both a savings goal name and a valid target amount.");
      return;
    }

    setError("");
    setIsSubmitting(true);
    try {
      const profile = await api.post<FinancialProfile>("/profile/onboarding", {
        monthly_income: Number(data.get("monthlyIncome")),
        currency: String(data.get("currency")),
        spending_categories: selectedCategories,
        savings_goals: savingsGoals
          .filter((goal) => goal.name.trim() && Number(goal.targetAmount) > 0)
          .map((goal) => ({
            name: goal.name.trim(),
            target_amount: Number(goal.targetAmount),
          })),
      });
      setProfile(profile);
      navigate("/dashboard", { replace: true });
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = async () => {
    setError("");
    setIsSubmitting(true);
    try {
      const profile = await api.post<FinancialProfile>("/profile/onboarding/skip");
      setProfile(profile);
      navigate("/dashboard", { replace: true });
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className={styles.onboardingPage}>
      <div className={styles.page}>
        <header className={styles.header}>
          <div>
            <Link className={styles.brandLink} to="/">MoneyMate</Link>
            <h1>Set up your financial profile</h1>
            <p>
              A few starting details help MoneyMate personalize budgets and insights.
              You can update everything later in Settings.
            </p>
          </div>
        </header>

        <Card className={styles.section}>
          <form className={styles.formGrid} onSubmit={handleSubmit}>
            <FormField htmlFor="monthly-income" label="Monthly income">
              <Input
                id="monthly-income"
                min="0"
                name="monthlyIncome"
                placeholder="e.g. 3500"
                required
                step="0.01"
                type="number"
              />
            </FormField>

            <FormField htmlFor="currency" label="Preferred currency">
              <Select defaultValue="USD" id="currency" name="currency">
                <option value="USD">USD - US Dollar</option>
                <option value="EUR">EUR - Euro</option>
                <option value="GBP">GBP - British Pound</option>
                <option value="LBP">LBP - Lebanese Pound</option>
                <option value="AED">AED - UAE Dirham</option>
              </Select>
            </FormField>

            <div className={styles.fullWidth}>
              <fieldset className={styles.fieldGroup}>
                <legend className={styles.fieldLabel}>Spending categories</legend>
                <div className={styles.categories}>
                  {categories.map((category) => (
                    <label className={styles.category} key={category}>
                      <input
                        checked={selectedCategories.includes(category)}
                        onChange={() => toggleCategory(category)}
                        type="checkbox"
                      />
                      {category}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>

            <div className={styles.fullWidth}>
              <SavingsGoalsEditor goals={savingsGoals} onChange={setSavingsGoals} />
            </div>

            {error ? (
              <p className={`${styles.errorText} ${styles.fullWidth}`}>{error}</p>
            ) : null}

            <div className={`${styles.actions} ${styles.fullWidth}`}>
              <Button
                disabled={isSubmitting}
                onClick={handleSkip}
                type="button"
                variant="secondary"
              >
                Skip for now
              </Button>
              <Button disabled={isSubmitting} type="submit">
                {isSubmitting ? "Saving..." : "Save and continue"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </main>
  );
}
