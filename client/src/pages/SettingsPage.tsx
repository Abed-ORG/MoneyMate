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
  CategoryIcon,
  FormField,
  Input,
  Modal,
  Select,
  Toast,
} from "../components";
import {
  normalizeCategory,
  spendingCategories,
} from "../constants/categories";
import { useAuth, type AuthUser, type FinancialProfile } from "../contexts/AuthContext";
import { api, getApiErrorMessage } from "../services/api";
import { getProfileAvatar, saveProfileAvatar } from "../utils/profileAvatar";
import { transactionsApi } from "../services/transactions";
import type { Category } from "../types/transaction";
import styles from "./SettingsPage.module.css";

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
  | "security";

type SectionIconName = "profile" | "wallet" | "categories" | "security";

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
    security: (
      <>
        <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />
        <path d="M12 2v3" />
        <path d="M12 19v3" />
        <path d="M2 12h3" />
        <path d="M19 12h3" />
        <path d="M5.6 5.6 8 8" />
        <path d="M16 16l2.4 2.4" />
        <path d="M5.6 18.4 8 16" />
        <path d="M16 8l2.4-2.4" />
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
  const [customCategories, setCustomCategories] = useState<Category[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState("#91d46a");
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
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
    setSelectedCategories(
      Array.from(
        new Set((profile?.spending_categories ?? []).map(normalizeCategory)),
      ),
    );
  }, [profile]);

  useEffect(() => {
    void transactionsApi.categories().then(setCustomCategories).catch(() => setCustomCategories([]));
  }, []);

  const toggleCategory = (category: string) => {
    setSelectedCategories((current) =>
      current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category],
    );
  };

  const addCustomCategory = async () => {
    if (!newCategoryName.trim()) return false;
    const created = await transactionsApi.createCategory({
      name: newCategoryName.trim(),
      color: newCategoryColor,
      is_default: false,
    });
    setCustomCategories((current) => [...current, created]);
    setNewCategoryName("");
    setNewCategoryColor("#91d46a");
    return true;
  };

  const deleteCustomCategory = async (id: string) => {
    await transactionsApi.deleteCategory(id);
    setCustomCategories((current) => current.filter((item) => item.id !== id));
    setCategoryToDelete(null);
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
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
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

    if (!fullName.trim() || !email.trim()) {
      setActiveSection("personal");
      setNotice({
        title: "Profile not saved",
        message: "Enter your full name and email address.",
        variant: "error",
      });
      return;
    }
    if (
      monthlyIncome.trim() === "" ||
      !Number.isFinite(Number(monthlyIncome)) ||
      Number(monthlyIncome) < 0
    ) {
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
        savings_goals: profile?.savings_goals ?? [],
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
  const activeSectionDetails = settingsSections.find(
    (section) => section.id === activeSection,
  );
  const editableCategories = customCategories.filter((category) => !category.is_default);

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

      <div className={styles.savePanel}>
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
              <section className={styles.sectionCard}>
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
                  <div className={styles.categoriesSection}>
                    <fieldset className={styles.fieldGroup}>
                      <legend className={styles.visuallyHidden}>
                        Spending categories
                      </legend>
                      <div className={styles.categories}>
                        {spendingCategories.map((category) => {
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
                              <span className={styles.categoryIcon} aria-hidden="true">
                                <CategoryIcon category={category} />
                              </span>
                              <span>{category}</span>
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                    <div className={styles.customCategoryControls}>
                      <Button type="button" onClick={() => setIsCustomizeOpen(true)}>
                        Customize
                      </Button>
                    </div>
                    {editableCategories.length ? (
                      <div className={styles.customCategoryList}>
                        {editableCategories.map((category) => (
                          <div key={category.id} className={styles.customCategoryRow}>
                            <span className={styles.categoryColor} style={{ background: category.color }} />
                            <strong>{category.name}</strong>
                            <Button type="button" variant="danger" onClick={() => setCategoryToDelete(category)}>
                              Delete
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}

              </section>
            </div>
          ) : (
            <section className={styles.sectionCard}>
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
            </section>
          )}
        </div>
      </div>

      <Modal
        isOpen={isCustomizeOpen}
        title="Customize category"
        onClose={() => {
          setIsCustomizeOpen(false);
          setNewCategoryName("");
          setNewCategoryColor("#91d46a");
        }}
      >
        <div className={styles.categoryModalBody}>
          <FormField label="Name">
            <Input
              value={newCategoryName}
              onChange={(event) => setNewCategoryName(event.target.value)}
            />
          </FormField>
          <FormField label="Color">
            <Input
              type="color"
              value={newCategoryColor}
              onChange={(event) => setNewCategoryColor(event.target.value)}
            />
          </FormField>
          <div className={styles.modalActions}>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsCustomizeOpen(false);
                setNewCategoryName("");
                setNewCategoryColor("#91d46a");
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={async () => {
                if (await addCustomCategory()) {
                  setIsCustomizeOpen(false);
                }
              }}
            >
              Save
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(categoryToDelete)}
        title="Delete category"
        onClose={() => setCategoryToDelete(null)}
      >
        <div className={styles.categoryModalBody}>
          <p>
            Are you sure you want to delete {categoryToDelete?.name}? This cannot be undone.
          </p>
          <div className={styles.modalActions}>
            <Button type="button" variant="secondary" onClick={() => setCategoryToDelete(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => {
                if (categoryToDelete) {
                  void deleteCustomCategory(categoryToDelete.id);
                }
              }}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
