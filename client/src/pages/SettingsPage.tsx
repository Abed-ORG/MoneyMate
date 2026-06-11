import { type FormEvent, useEffect, useState } from "react";
import {
  Button,
  Card,
  createEmptySavingsGoal,
  FormField,
  Input,
  SavingsGoalsEditor,
  type SavingsGoalDraft,
  Select,
  Toast,
} from "../components";
import { useAuth, type AuthUser, type FinancialProfile } from "../contexts/AuthContext";
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

type Notice = {
  title: string;
  message: string;
  variant: "success" | "error";
};

export function SettingsPage() {
  const { profile, refreshAccount, setProfile, user } = useAuth();
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoalDraft[]>([
    createEmptySavingsGoal(),
  ]);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setSelectedCategories(profile?.spending_categories ?? []);
    setSavingsGoals(
      profile?.savings_goals.length
        ? profile.savings_goals.map((goal) => ({
            ...createEmptySavingsGoal(),
            name: goal.name,
            targetAmount: String(goal.target_amount),
          }))
        : [createEmptySavingsGoal()],
    );
  }, [profile]);

  const toggleCategory = (category: string) => {
    setSelectedCategories((current) =>
      current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category],
    );
  };

  const handleProfileSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const incompleteGoal = savingsGoals.find(
      (goal) =>
        (goal.name.trim() && Number(goal.targetAmount) <= 0) ||
        (!goal.name.trim() && Number(goal.targetAmount) > 0),
    );

    if (selectedCategories.length === 0) {
      setNotice({
        title: "Profile not saved",
        message: "Choose at least one spending category.",
        variant: "error",
      });
      return;
    }
    if (incompleteGoal) {
      setNotice({
        title: "Profile not saved",
        message: "Enter both a savings goal name and a valid target amount.",
        variant: "error",
      });
      return;
    }

    setIsSaving(true);
    try {
      await api.put<AuthUser>("/profile/account", {
        full_name: String(data.get("fullName")).trim(),
        email: String(data.get("email")).trim(),
      });
      const updatedProfile = await api.post<FinancialProfile>("/profile/onboarding", {
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
      setProfile(updatedProfile);
      await refreshAccount();
      setNotice({
        title: "Profile saved",
        message: "Your account and financial preferences are up to date.",
        variant: "success",
      });
    } catch (error) {
      setNotice({
        title: "Profile not saved",
        message: getApiErrorMessage(error),
        variant: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordChange = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const newPassword = String(data.get("newPassword") ?? "");
    const confirmPassword = String(data.get("confirmPassword") ?? "");

    if (newPassword !== confirmPassword) {
      setNotice({
        title: "Password not changed",
        message: "The new passwords do not match.",
        variant: "error",
      });
      return;
    }

    setIsSaving(true);
    try {
      await api.put<void>("/profile/password", {
        current_password: String(data.get("currentPassword") ?? ""),
        new_password: newPassword,
      });
      form.reset();
      setNotice({
        title: "Password changed",
        message: "Your password was updated successfully.",
        variant: "success",
      });
    } catch (error) {
      setNotice({
        title: "Password not changed",
        message: getApiErrorMessage(error),
        variant: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.page}>
      {notice ? (
        <div className={styles.toastWrap}>
          <Toast
            message={notice.message}
            onClose={() => setNotice(null)}
            title={notice.title}
            variant={notice.variant}
          />
        </div>
      ) : null}

      <header className={styles.header}>
        <div>
          <h2>Profile and preferences</h2>
          <p>
            Keep your account details and MoneyMate personalization settings current.
          </p>
        </div>
      </header>

      <Card className={styles.section}>
        <h2>Account and financial profile</h2>
        <form className={styles.formGrid} onSubmit={handleProfileSave}>
          <FormField htmlFor="settings-name" label="Full name">
            <Input
              defaultValue={user?.full_name}
              id="settings-name"
              name="fullName"
              required
            />
          </FormField>
          <FormField htmlFor="settings-email" label="Email">
            <Input
              defaultValue={user?.email}
              id="settings-email"
              name="email"
              required
              type="email"
            />
          </FormField>
          <FormField htmlFor="settings-income" label="Monthly income">
            <Input
              defaultValue={profile?.monthly_income ?? ""}
              id="settings-income"
              min="0"
              name="monthlyIncome"
              required
              step="0.01"
              type="number"
            />
          </FormField>
          <FormField htmlFor="settings-currency" label="Preferred currency">
            <Select
              defaultValue={profile?.currency ?? "USD"}
              id="settings-currency"
              name="currency"
            >
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
          <div className={`${styles.actions} ${styles.fullWidth}`}>
            <Button disabled={isSaving} type="submit">
              {isSaving ? "Saving..." : "Save profile"}
            </Button>
          </div>
        </form>
      </Card>

      <Card className={styles.section}>
        <h2>Change password</h2>
        <p>Your current password is required before MoneyMate accepts a new one.</p>
        <form className={styles.passwordForm} onSubmit={handlePasswordChange}>
          <FormField htmlFor="current-password" label="Current password">
            <Input
              autoComplete="current-password"
              id="current-password"
              name="currentPassword"
              required
              type="password"
            />
          </FormField>
          <FormField htmlFor="new-password" label="New password">
            <Input
              autoComplete="new-password"
              id="new-password"
              minLength={8}
              name="newPassword"
              required
              type="password"
            />
          </FormField>
          <FormField htmlFor="confirm-password" label="Confirm new password">
            <Input
              autoComplete="new-password"
              id="confirm-password"
              minLength={8}
              name="confirmPassword"
              required
              type="password"
            />
          </FormField>
          <div className={styles.actions}>
            <Button disabled={isSaving} type="submit">
              {isSaving ? "Updating..." : "Change password"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
