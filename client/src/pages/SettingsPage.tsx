import {
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
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
import styles from "./SettingsPage.module.css";

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

type SectionIconName = "profile" | "wallet" | "categories" | "goal" | "security";

function SectionIcon({ name }: { name: SectionIconName }) {
  const paths: Record<SectionIconName, ReactNode> = {
    profile: (
      <>
        <circle cx="12" cy="8" r="3.25" />
        <path d="M5.5 19c.7-3.3 3-5 6.5-5s5.8 1.7 6.5 5" />
      </>
    ),
    wallet: (
      <>
        <path d="M4 7.5h14.5A1.5 1.5 0 0 1 20 9v9H5.5A1.5 1.5 0 0 1 4 16.5v-11A1.5 1.5 0 0 1 5.5 4H17" />
        <path d="M15 11h5v4h-5a2 2 0 0 1 0-4Z" />
      </>
    ),
    categories: (
      <>
        <rect x="4" y="4" width="6" height="6" rx="1.5" />
        <rect x="14" y="4" width="6" height="6" rx="1.5" />
        <rect x="4" y="14" width="6" height="6" rx="1.5" />
        <path d="m14.5 17 1.7 1.7 3.5-4" />
      </>
    ),
    goal: (
      <>
        <circle cx="11" cy="13" r="7" />
        <circle cx="11" cy="13" r="3" />
        <path d="m13 11 7-7M16 4h4v4" />
      </>
    ),
    security: (
      <>
        <path d="M12 3.5c2.7 2 5.4 2.6 7.5 3.2v5.1c0 4.4-2.7 7.2-7.5 9.2-4.8-2-7.5-4.8-7.5-9.2V6.7C6.6 6.1 9.3 5.5 12 3.5Z" />
        <path d="M9.5 12.2 11.2 14l3.6-4" />
      </>
    ),
  };

  return (
    <span className={styles.sectionIcon} aria-hidden="true">
      <svg viewBox="0 0 24 24">{paths[name]}</svg>
    </span>
  );
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function SettingsPage() {
  const { profile, refreshAccount, setProfile, user } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [monthlyIncome, setMonthlyIncome] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoalDraft[]>([
    createEmptySavingsGoal(),
  ]);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const avatarUrlRef = useRef("");

  useEffect(() => {
    setFullName(user?.full_name ?? "");
    setEmail(user?.email ?? "");
  }, [user]);

  useEffect(() => {
    setMonthlyIncome(
      profile?.monthly_income == null ? "" : String(profile.monthly_income),
    );
    setCurrency(profile?.currency ?? "USD");
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

  useEffect(
    () => () => {
      if (avatarUrlRef.current) {
        URL.revokeObjectURL(avatarUrlRef.current);
      }
    },
    [],
  );

  const toggleCategory = (category: string) => {
    setSelectedCategories((current) =>
      current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category],
    );
  };

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (avatarUrlRef.current) {
      URL.revokeObjectURL(avatarUrlRef.current);
    }
    const nextUrl = URL.createObjectURL(file);
    avatarUrlRef.current = nextUrl;
    setAvatarPreview(nextUrl);
  };

  const handleProfileSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
        full_name: fullName.trim(),
        email: email.trim(),
      });
      const updatedProfile = await api.post<FinancialProfile>("/profile/onboarding", {
        monthly_income: Number(monthlyIncome),
        currency,
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

  const displayName = fullName.trim() || user?.full_name || "MoneyMate user";
  const displayEmail = email.trim() || user?.email || "No email available";
  const initials = getInitials(displayName) || "MM";
  const incomeLabel = monthlyIncome
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(Number(monthlyIncome))
    : "Not set";

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
          <p>Manage your account, financial setup, and security.</p>
        </div>
      </header>

      <form className={styles.profileForm} id="profile-settings-form" onSubmit={handleProfileSave}>
        <Card className={styles.summaryCard}>
          <div className={styles.avatarArea}>
            <div className={styles.avatar}>
              {avatarPreview ? (
                <img src={avatarPreview} alt={`${displayName} profile preview`} />
              ) : (
                <span>{initials}</span>
              )}
            </div>
            <label className={styles.avatarButton} htmlFor="profile-avatar">
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="M7 7.5 8.5 5h7L17 7.5h2A2 2 0 0 1 21 9.5v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2Z" />
                <circle cx="12" cy="13" r="3.5" />
              </svg>
              <span>Upload photo</span>
            </label>
            <input
              accept="image/*"
              className={styles.avatarInput}
              id="profile-avatar"
              onChange={handleAvatarChange}
              type="file"
            />
          </div>

          <div className={styles.summaryIdentity}>
            <span className={styles.summaryLabel}>MoneyMate profile</span>
            <h3>{displayName}</h3>
            <p>{displayEmail}</p>
          </div>

          <dl className={styles.summaryDetails}>
            <div>
              <dt>Monthly income</dt>
              <dd>{incomeLabel}</dd>
            </div>
            <div>
              <dt>Currency</dt>
              <dd>{currency}</dd>
            </div>
          </dl>

          <div className={styles.summaryAction}>
            <Button disabled={isSaving} type="submit">
              {isSaving ? "Saving..." : "Save changes"}
            </Button>
            <span>Photo preview stays on this device.</span>
          </div>
        </Card>

        <div className={styles.sectionGrid}>
          <Card className={styles.sectionCard}>
            <div className={styles.sectionHeading}>
              <SectionIcon name="profile" />
              <div>
                <h3>Personal information</h3>
                <p>Update the details connected to your account.</p>
              </div>
            </div>
            <div className={styles.formGrid}>
              <FormField htmlFor="settings-name" label="Full name">
                <Input
                  id="settings-name"
                  name="fullName"
                  onChange={(event) => setFullName(event.target.value)}
                  required
                  value={fullName}
                />
              </FormField>
              <FormField htmlFor="settings-email" label="Email">
                <Input
                  id="settings-email"
                  name="email"
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  type="email"
                  value={email}
                />
              </FormField>
            </div>
          </Card>

          <Card className={styles.sectionCard}>
            <div className={styles.sectionHeading}>
              <SectionIcon name="wallet" />
              <div>
                <h3>Financial preferences</h3>
                <p>Set the defaults MoneyMate uses for planning.</p>
              </div>
            </div>
            <div className={styles.formGrid}>
              <FormField htmlFor="settings-income" label="Monthly income">
                <Input
                  id="settings-income"
                  min="0"
                  name="monthlyIncome"
                  onChange={(event) => setMonthlyIncome(event.target.value)}
                  required
                  step="0.01"
                  type="number"
                  value={monthlyIncome}
                />
              </FormField>
              <FormField htmlFor="settings-currency" label="Preferred currency">
                <Select
                  id="settings-currency"
                  name="currency"
                  onChange={(event) => setCurrency(event.target.value)}
                  value={currency}
                >
                  <option value="USD">USD - US Dollar</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="GBP">GBP - British Pound</option>
                  <option value="LBP">LBP - Lebanese Pound</option>
                  <option value="AED">AED - UAE Dirham</option>
                </Select>
              </FormField>
            </div>
          </Card>
        </div>

        <Card className={styles.sectionCard}>
          <div className={styles.sectionHeading}>
            <SectionIcon name="categories" />
            <div>
              <h3>Spending categories</h3>
              <p>Choose the areas you want to track most closely.</p>
            </div>
          </div>
          <fieldset className={styles.fieldGroup}>
            <legend className={styles.visuallyHidden}>Spending categories</legend>
            <div className={styles.categories}>
              {categories.map((category) => {
                const isSelected = selectedCategories.includes(category);
                return (
                  <label className={styles.category} key={category}>
                    <input
                      checked={isSelected}
                      onChange={() => toggleCategory(category)}
                      type="checkbox"
                    />
                    <span className={styles.categoryCheck} aria-hidden="true">
                      {isSelected ? (
                        <svg viewBox="0 0 16 16">
                          <path d="m3 8.2 3 3L13 4.8" />
                        </svg>
                      ) : null}
                    </span>
                    <span>{category}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </Card>

        <Card className={styles.sectionCard}>
          <div className={styles.sectionHeading}>
            <SectionIcon name="goal" />
            <div>
              <h3>Savings goals</h3>
              <p>Create clear targets for the milestones that matter.</p>
            </div>
          </div>
          <SavingsGoalsEditor goals={savingsGoals} onChange={setSavingsGoals} />
        </Card>
      </form>

      <Card className={`${styles.sectionCard} ${styles.securityCard}`}>
        <div className={styles.sectionHeading}>
          <SectionIcon name="security" />
          <div>
            <h3>Security</h3>
            <p>Your current password is required before MoneyMate accepts a new one.</p>
          </div>
        </div>
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
