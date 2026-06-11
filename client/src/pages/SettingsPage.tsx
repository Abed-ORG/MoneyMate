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
import { getProfileAvatar, saveProfileAvatar } from "../utils/profileAvatar";
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

const supportedAvatarTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);
const maxAvatarSize = 2 * 1024 * 1024;

type Notice = {
  title: string;
  message: string;
  variant: "success" | "error";
};

type SettingsSection =
  | "personal"
  | "financial"
  | "categories"
  | "goals"
  | "security";

type SectionIconName = "profile" | "wallet" | "categories" | "goal" | "security";

const settingsSections: Array<{
  id: SettingsSection;
  label: string;
  description: string;
  icon: SectionIconName;
}> = [
  {
    id: "personal",
    label: "Personal information",
    description: "Name, email, and profile photo",
    icon: "profile",
  },
  {
    id: "financial",
    label: "Financial preferences",
    description: "Income and preferred currency",
    icon: "wallet",
  },
  {
    id: "categories",
    label: "Spending categories",
    description: "Choose what MoneyMate tracks",
    icon: "categories",
  },
  {
    id: "goals",
    label: "Savings goals",
    description: "Plan for important milestones",
    icon: "goal",
  },
  {
    id: "security",
    label: "Security",
    description: "Update your account password",
    icon: "security",
  },
];

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

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("The selected image could not be read."));
    reader.onerror = () => reject(new Error("The selected image could not be read."));
    reader.readAsDataURL(file);
  });
}

export function SettingsPage() {
  const { profile, refreshAccount, setProfile, user } = useAuth();
  const [activeSection, setActiveSection] = useState<SettingsSection>("personal");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [monthlyIncome, setMonthlyIncome] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoalDraft[]>([
    createEmptySavingsGoal(),
  ]);
  const [savedAvatar, setSavedAvatar] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFullName(user?.full_name ?? "");
    setEmail(user?.email ?? "");
    const persistedAvatar = getProfileAvatar(user?.id);
    setSavedAvatar(persistedAvatar);
    setAvatarPreview(persistedAvatar);
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

  const toggleCategory = (category: string) => {
    setSelectedCategories((current) =>
      current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category],
    );
  };

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!supportedAvatarTypes.has(file.type)) {
      setNotice({
        title: "Photo not selected",
        message: "Choose a PNG, JPG, JPEG, or WEBP image.",
        variant: "error",
      });
      event.target.value = "";
      return;
    }

    if (file.size > maxAvatarSize) {
      setNotice({
        title: "Photo is too large",
        message: "Choose an image smaller than 2 MB.",
        variant: "error",
      });
      event.target.value = "";
      return;
    }

    try {
      setAvatarPreview(await fileToDataUrl(file));
      setNotice(null);
    } catch (error) {
      setNotice({
        title: "Photo not selected",
        message:
          error instanceof Error
            ? error.message
            : "The selected image could not be read.",
        variant: "error",
      });
    }
  };

  const handleProfileSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const incompleteGoal = savingsGoals.find(
      (goal) =>
        (goal.name.trim() && Number(goal.targetAmount) <= 0) ||
        (!goal.name.trim() && Number(goal.targetAmount) > 0),
    );

    if (!fullName.trim() || !email.trim()) {
      setActiveSection("personal");
      setNotice({
        title: "Profile not saved",
        message: "Enter your full name and email address.",
        variant: "error",
      });
      return;
    }
    if (!monthlyIncome || Number(monthlyIncome) < 0) {
      setActiveSection("financial");
      setNotice({
        title: "Profile not saved",
        message: "Enter a valid monthly income.",
        variant: "error",
      });
      return;
    }
    if (selectedCategories.length === 0) {
      setActiveSection("categories");
      setNotice({
        title: "Profile not saved",
        message: "Choose at least one spending category.",
        variant: "error",
      });
      return;
    }
    if (incompleteGoal) {
      setActiveSection("goals");
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

      if (user?.id && avatarPreview !== savedAvatar) {
        saveProfileAvatar(user.id, avatarPreview);
        setSavedAvatar(avatarPreview);
      }

      setProfile(updatedProfile);
      await refreshAccount();
      setNotice({
        title: "Profile saved",
        message: "Your account, photo, and financial preferences are up to date.",
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
  const activeSectionDetails = settingsSections.find(
    (section) => section.id === activeSection,
  );

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

      <div className={styles.profileOverview}>
        <section className={styles.profileCardWrap} aria-label="Profile card">
          <div className={styles.profileCard}>
            <div className={styles.cardTop}>
              <div className={styles.cardBrand}>
                <img src="/moneymate-logo.png" alt="" />
                <strong>
                  Money<span>Mate</span>
                </strong>
              </div>
              <svg className={styles.contactless} aria-label="Contactless" viewBox="0 0 46 46">
                <path d="M14 16c5 4 5 10 0 14M20 11c9 7 9 17 0 24M27 7c13 10 13 22 0 32" />
              </svg>
            </div>

            <div className={styles.cardMiddle}>
              <div className={styles.chip} aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
              </div>
              <div className={styles.cardAvatarWrap}>
                <div className={styles.cardAvatar}>
                  {avatarPreview ? (
                    <img src={avatarPreview} alt={`${displayName} profile preview`} />
                  ) : (
                    <span>{initials}</span>
                  )}
                </div>
                <button
                  aria-label="Choose profile picture"
                  className={styles.avatarEdit}
                  onClick={() => fileInputRef.current?.click()}
                  type="button"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24">
                    <path d="M7 7.5 8.5 5h7L17 7.5h2A2 2 0 0 1 21 9.5v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2Z" />
                    <circle cx="12" cy="13" r="3.5" />
                  </svg>
                </button>
                <input
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  className={styles.avatarInput}
                  id="profile-avatar"
                  onChange={handleAvatarChange}
                  ref={fileInputRef}
                  type="file"
                />
              </div>
            </div>

            <div className={styles.cardDetails}>
              <div className={styles.cardIdentity}>
                <span>Cardholder</span>
                <strong>{displayName}</strong>
                <small>{displayEmail}</small>
              </div>
              <div className={styles.cardMetric}>
                <span>Monthly income</span>
                <strong>{incomeLabel}</strong>
              </div>
              <div className={styles.cardMetric}>
                <span>Currency</span>
                <strong>{currency}</strong>
              </div>
            </div>
          </div>
        </section>

        <nav className={styles.sectionNav} aria-label="Settings sections">
          {settingsSections.map((section) => (
            <button
              aria-current={activeSection === section.id ? "page" : undefined}
              className={`${styles.sectionNavItem} ${
                activeSection === section.id ? styles.sectionNavItemActive : ""
              }`}
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              type="button"
            >
              <SectionIcon name={section.icon} />
              <span>
                <strong>{section.label}</strong>
                <small>{section.description}</small>
              </span>
            </button>
          ))}
        </nav>
      </div>

      <form
        className={styles.hiddenProfileForm}
        id="profile-settings-form"
        onSubmit={handleProfileSave}
      />

      <div className={styles.stickySave}>
        <Button
          disabled={isSaving}
          form="profile-settings-form"
          type="submit"
        >
          {isSaving ? "Saving..." : "Save changes"}
        </Button>
      </div>

      <div className={styles.settingsLayout}>
        <div className={styles.sectionContent}>
          {activeSection !== "security" ? (
            <div className={styles.profileForm}>
              <Card className={styles.sectionCard}>
                <div className={styles.sectionHeading}>
                  <SectionIcon name={activeSectionDetails?.icon ?? "profile"} />
                  <div>
                    <h2>{activeSectionDetails?.label}</h2>
                    <p>{activeSectionDetails?.description}</p>
                  </div>
                </div>

                {activeSection === "personal" ? (
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
                    <div className={styles.photoNote}>
                      <span>Profile photo</span>
                      <p>
                        Use the camera button on your MoneyMate card. PNG, JPG, and
                        WEBP images up to 2 MB are supported.
                      </p>
                    </div>
                  </div>
                ) : null}

                {activeSection === "financial" ? (
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
                ) : null}

                {activeSection === "categories" ? (
                  <fieldset className={styles.fieldGroup}>
                    <legend className={styles.visuallyHidden}>
                      Spending categories
                    </legend>
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
                ) : null}

                {activeSection === "goals" ? (
                  <SavingsGoalsEditor
                    goals={savingsGoals}
                    onChange={setSavingsGoals}
                  />
                ) : null}
              </Card>
            </div>
          ) : (
            <Card className={styles.sectionCard}>
              <div className={styles.sectionHeading}>
                <SectionIcon name="security" />
                <div>
                  <h2>Security</h2>
                  <p>Your current password is required before setting a new one.</p>
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
                <div className={styles.securityActions}>
                  <Button disabled={isSaving} type="submit">
                    {isSaving ? "Updating..." : "Change password"}
                  </Button>
                </div>
              </form>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
