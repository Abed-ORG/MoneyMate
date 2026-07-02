import { useEffect, useMemo, useRef, useState } from "react";
<<<<<<< HEAD
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button, Card, FormField, Input, LoadingSpinner, Modal } from "../components";
import { useToast } from "../contexts/ToastContext";
=======
import { Button, Card, FormField, Input, Modal, Toast } from "../components";
>>>>>>> b122b4d (refactor: enhance password strength, goals grid, and transaction editing)
import { goalsApi } from "../services/goals";
import type { Goal, GoalPayload, GoalUpdatePayload } from "../types/goal";
import styles from "./GoalsPage.module.css";

const emptyForm = {
  name: "",
  targetAmount: "",
  startDate: "",
  deadline: "",
  linkedAccount: "",
  currentAmount: "",
};

<<<<<<< HEAD
=======
type ToastState = {
  title: string;
  message: string;
  variant: "success" | "error" | "warning" | "info";
};

type Milestone = 25 | 50 | 75 | 100;

const MILESTONES: Milestone[] = [25, 50, 75, 100];

>>>>>>> b122b4d (refactor: enhance password strength, goals grid, and transaction editing)
function money(value: number | string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value));
}

/* ─── Category icon map ───────────────────────────────────── */

const CATEGORY_ICONS: Record<string, { icon: string; label: string }> = {
  vacation: { icon: "🏖️", label: "Vacation" },
  car: { icon: "🚗", label: "Car" },
  emergency: { icon: "🛡️", label: "Emergency fund" },
  house: { icon: "🏡", label: "House" },
  education: { icon: "🎓", label: "Education" },
};

function getGoalCategoryInfo(name: string) {
  const lower = name.toLowerCase();
  if (/(vacat|trip|travel|holiday|beach)/.test(lower)) return CATEGORY_ICONS.vacation;
  if (/(car|vehicle|auto|bike)/.test(lower)) return CATEGORY_ICONS.car;
  if (/(emerg|safety|buffer|rainy)/.test(lower)) return CATEGORY_ICONS.emergency;
  if (/(house|home|mortgage|rent)/.test(lower)) return CATEGORY_ICONS.house;
  if (/(educ|school|college|tuition|study)/.test(lower)) return CATEGORY_ICONS.education;
  return { icon: "🎯", label: "Goal" };
}

function getDaysRemaining(goal: Goal) {
  if (!goal.deadline) return null;
  const diff = Math.ceil((new Date(goal.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

/* ─── Progress ring ──────────────────────────────────────── */

function ProgressRing({
  value,
  size = 76,
  strokeWidth = 8,
  animate = false,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  animate?: boolean;
}) {
  const safeValue = Math.min(Math.max(value, 0), 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const [offset, setOffset] = useState(animate ? circumference : circumference - (safeValue / 100) * circumference);

  useEffect(() => {
    if (!animate) {
      setOffset(circumference - (safeValue / 100) * circumference);
      return;
    }
    // Reset then animate
    setOffset(circumference);
    const raq = requestAnimationFrame(() => {
      setOffset(circumference - (safeValue / 100) * circumference);
    });
    return () => cancelAnimationFrame(raq);
  }, [safeValue, circumference, animate]);

  return (
    <div className={styles.progressRingWrap} style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className={styles.progressRingSvg}>
        <circle cx={size / 2} cy={size / 2} r={radius} className={styles.progressRingTrack} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className={styles.progressRingValue}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: animate ? "stroke-dashoffset 600ms cubic-bezier(0.4, 0, 0.2, 1)" : "none" }}
        />
      </svg>
      <span className={styles.progressRingLabel}>{safeValue.toFixed(0)}%</span>
    </div>
  );
}

/* ─── SVG Icons ──────────────────────────────────────────── */

function AddIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="1" />
    </svg>
  );
}

/* ─── Confetti component ─────────────────────────────────── */

type ConfettiParticle = {
  id: number;
  x: number;
  color: string;
  delay: number;
  duration: number;
  size: number;
};

function Confetti({ active }: { active: boolean }) {
  const particles = useMemo<ConfettiParticle[]>(() => {
    if (!active) return [];
    const colors = ["#49c5b6", "#66d582", "#f2b84b", "#ff6b72", "#7c6df0", "#4a9eff"];
    return Array.from({ length: 30 }, (_, index) => ({
      id: index,
      x: Math.random() * 100,
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 0.3,
      duration: 0.8 + Math.random() * 0.6,
      size: 5 + Math.random() * 7,
    }));
  }, [active]);

  if (!active) return null;

  return (
    <div className={styles.confettiLayer} aria-hidden="true">
      {particles.map((p) => (
        <span
          key={p.id}
          className={styles.confettiPiece}
          style={{
            left: `${p.x}%`,
            width: p.size,
            height: p.size,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ─── Projection helper ──────────────────────────────────── */

function getProjectionLabel(goal: Goal): string {
  const target = Number(goal.target_amount);
  const current = Number(goal.current_amount);
  if (target <= current) return "Goal reached! 🎉";

  const contributions = goal.contributions;
  // Calculate average monthly contribution from history
  if (contributions.length < 2) {
    return "Not enough data to estimate projection.";
  }

  const sorted = [...contributions].sort(
    (a, b) => new Date(a.contributed_at).getTime() - new Date(b.contributed_at).getTime(),
  );
  const firstDate = new Date(sorted[0].contributed_at);
  const lastDate = new Date(sorted[sorted.length - 1].contributed_at);
  const daysDiff = (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24);

  if (daysDiff < 7) return "Not enough data to estimate projection.";

  const totalContributed = sorted.reduce((sum, c) => sum + Number(c.amount), 0);
  const monthlyRate = (totalContributed / daysDiff) * 30.44;
  if (monthlyRate <= 0) return "Not enough data to estimate projection.";

  const remaining = target - current;
  const monthsNeeded = Math.ceil(remaining / monthlyRate);
  const projectionDate = new Date();
  projectionDate.setMonth(projectionDate.getMonth() + monthsNeeded);
  const formatted = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(projectionDate);

  return `At your savings rate, you'll reach this goal by ${formatted}.`;
}

/* ─── Milestone celebration persistence ──────────────────── */

const MILESTONE_STORAGE_KEY = "moneymate.milestones.celebrated";

function getCelebratedMilestones(goalId: number): Set<string> {
  try {
    const raw = window.localStorage.getItem(`${MILESTONE_STORAGE_KEY}.${goalId}`);
    return new Set<string>(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function persistCelebratedMilestone(goalId: number, milestone: string) {
  try {
    const set = getCelebratedMilestones(goalId);
    set.add(milestone);
    window.localStorage.setItem(`${MILESTONE_STORAGE_KEY}.${goalId}`, JSON.stringify(Array.from(set)));
  } catch {
    // ignore
  }
}

/* ─── Main component ─────────────────────────────────────── */

export function GoalsPage() {
  const toast = useToast();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoadingGoals, setIsLoadingGoals] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [contribution, setContribution] = useState("");

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isContributeOpen, setIsContributeOpen] = useState(false);
  const [actionMenuId, setActionMenuId] = useState<number | null>(null);
<<<<<<< HEAD
=======
  const [toast, setToast] = useState<ToastState | null>(null);
  const [celebratingGoalId, setCelebratingGoalId] = useState<number | null>(null);
>>>>>>> b122b4d (refactor: enhance password strength, goals grid, and transaction editing)

  const actionMenuRef = useRef<HTMLDivElement | null>(null);
  const celebrateTimer = useRef<number>();

  useEffect(() => {
    setIsLoadingGoals(true);
    void goalsApi.list()
      .then((items) => {
        setGoals(items);
        if (!selectedId && items.length > 0) {
          setSelectedId(items[0].id);
        }
      })
      .finally(() => setIsLoadingGoals(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!actionMenuId) {
      return undefined;
    }
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (actionMenuRef.current?.contains(event.target as Node)) return;
      setActionMenuId(null);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [actionMenuId]);

  useEffect(() => {
    return () => {
      if (celebrateTimer.current) window.clearTimeout(celebrateTimer.current);
    };
  }, []);

  const selectedGoal = useMemo(
    () => goals.find((g) => g.id === selectedId) ?? goals[0],
    [goals, selectedId],
  );

  async function refresh(promise: Promise<Goal>) {
    const updated = await promise;
    setGoals((current) => current.map((goal) => (goal.id === updated.id ? updated : goal)));
  }

  function formToCreatePayload(): GoalPayload {
    return {
      name: form.name,
      target_amount: Number(form.targetAmount),
      start_date: form.startDate || undefined,
      deadline: form.deadline || undefined,
      linked_account: form.linkedAccount || undefined,
      current_amount: Number(form.currentAmount || 0),
    };
  }

  function formToUpdatePayload(): GoalUpdatePayload {
    return {
      name: form.name,
      target_amount: form.targetAmount ? Number(form.targetAmount) : undefined,
      start_date: form.startDate || undefined,
      deadline: form.deadline || undefined,
      linked_account: form.linkedAccount || undefined,
      current_amount: form.currentAmount ? Number(form.currentAmount) : undefined,
    };
  }

  function goalToForm(goal: Goal) {
    return {
      name: goal.name,
      targetAmount: String(goal.target_amount),
      startDate: goal.start_date ? goal.start_date.slice(0, 10) : "",
      deadline: goal.deadline ? goal.deadline.slice(0, 10) : "",
      linkedAccount: goal.linked_account ?? "",
      currentAmount: String(goal.current_amount),
    };
  }

  async function createGoal() {
    try {
      const created = await goalsApi.create(formToCreatePayload());
      setGoals((current) => [created, ...current]);
      setSelectedId(created.id);
      setForm(emptyForm);
      setIsAddOpen(false);
      toast.success("Goal created", `${created.name} has been added.`);
    } catch {
      toast.error("Could not create goal", "Something went wrong.");
    }
  }

  async function saveEdit() {
    if (!selectedGoal) return;
    try {
      await refresh(goalsApi.update(selectedGoal.id, formToUpdatePayload()));
      setIsEditOpen(false);
      toast.success("Goal updated", "Changes saved.");
    } catch {
      toast.error("Could not update goal", "Something went wrong.");
    }
  }

  async function confirmDelete() {
    if (!selectedGoal) return;
    try {
      await goalsApi.remove(selectedGoal.id);
      setGoals((current) => current.filter((g) => g.id !== selectedGoal.id));
      if (selectedId === selectedGoal.id) {
        setSelectedId(goals.length > 1 ? goals.find((g) => g.id !== selectedGoal.id)?.id ?? null : null);
      }
      setIsDeleteOpen(false);
      toast.success("Goal deleted", "The goal was removed.");
    } catch {
      toast.error("Could not delete goal", "Something went wrong.");
    }
  }

  /* ─── Contribution ────────────────────────────────────── */

  async function logContribution(goalId: number) {
    try {
      const updated = await goalsApi.contribute(goalId, {
        amount: Number(contribution),
        note: "Manual log",
      });
      setGoals((current) => current.map((g) => (g.id === updated.id ? updated : g)));
      setContribution("");
      setIsContributeOpen(false);
<<<<<<< HEAD
      toast.success("Contribution logged", "Goal progress updated.");
=======

      // Check milestones
      const newPercent = updated.saved_percentage;
      const celebrated = getCelebratedMilestones(goalId);
      const freshMilestones = MILESTONES.filter(
        (m) => newPercent >= m && !celebrated.has(String(m)),
      );
      if (freshMilestones.length > 0) {
        freshMilestones.forEach((m) => persistCelebratedMilestone(goalId, String(m)));
        setCelebratingGoalId(goalId);
        celebrateTimer.current = window.setTimeout(() => setCelebratingGoalId(null), 1800);
      }

      setToast({ title: "Contribution logged", message: "Goal progress updated.", variant: "success" });
>>>>>>> b122b4d (refactor: enhance password strength, goals grid, and transaction editing)
    } catch {
      toast.error("Could not log contribution", "Something went wrong.");
    }
  }

  /* ─── Handlers ────────────────────────────────────────── */

  function openActionMenu(goal: Goal) {
    setSelectedId(goal.id);
    setActionMenuId((current) => (current === goal.id ? null : goal.id));
  }

  function openEditFromMenu(goal: Goal) {
    setActionMenuId(null);
    setForm(goalToForm(goal));
    setIsEditOpen(true);
  }

  function openContributeFromMenu(goal: Goal) {
    setActionMenuId(null);
    setSelectedId(goal.id);
    setContribution("");
    setIsContributeOpen(true);
  }

  function openDeleteFromMenu(goal: Goal) {
    setActionMenuId(null);
    setSelectedId(goal.id);
    setIsDeleteOpen(true);
  }

  function openAddModal() {
    setForm(emptyForm);
    setIsAddOpen(true);
  }

  /* ─── Modal form renderers ────────────────────────────── */

  const renderForm = (mode: "create" | "edit") => (
    <form
      className={styles.verticalForm}
      onSubmit={(event) => {
        event.preventDefault();
        void (mode === "create" ? createGoal() : saveEdit());
      }}
    >
      <FormField label="Name">
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </FormField>
      <FormField label="Target amount">
        <Input type="number" value={form.targetAmount} onChange={(e) => setForm({ ...form, targetAmount: e.target.value })} />
      </FormField>
      <FormField label="Starting amount">
        <Input type="number" value={form.currentAmount} onChange={(e) => setForm({ ...form, currentAmount: e.target.value })} />
      </FormField>
      <FormField label="Start date" helperText="When you plan to start saving">
        <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
      </FormField>
      <FormField label="Deadline">
        <Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
      </FormField>
      <FormField label="Linked account" helperText="e.g. Savings account, Checking account">
        <Input value={form.linkedAccount} onChange={(e) => setForm({ ...form, linkedAccount: e.target.value })} placeholder="Savings account" />
      </FormField>
      <div className={styles.modalActions}>
        <Button variant="secondary" onClick={() => (mode === "create" ? setIsAddOpen(false) : setIsEditOpen(false))}>
          Cancel
        </Button>
        <Button type="submit" disabled={mode === "create" && (!form.name || !form.targetAmount)}>
          {mode === "create" ? "Save goal" : "Save Changes"}
        </Button>
      </div>
    </form>
  );

  /* ─── Goal card renderer ──────────────────────────────── */

  const renderGoalCard = (goal: Goal) => {
    const category = getGoalCategoryInfo(goal.name);
    const daysRemaining = getDaysRemaining(goal);
    const percent = Math.min(goal.saved_percentage, 100);
    const projectionLabel = getProjectionLabel(goal);

    return (
      <Card className={styles.goalCard} key={goal.id}>
        <Confetti active={celebratingGoalId === goal.id} />

        <div className={styles.goalCardHeader}>
          <div className={styles.goalCardLeft}>
            <div className={styles.categoryBadge}>
              <span className={styles.categoryIcon}>{category.icon}</span>
              <span>{category.label}</span>
            </div>
            <h3>{goal.name}</h3>
          </div>
          <div className={styles.goalActions}>
            <button
              type="button"
              className={styles.contributeButton}
              onClick={(event) => {
                event.stopPropagation();
                openContributeFromMenu(goal);
              }}
            >
              Log Contribution
            </button>
            <div className={styles.rowActions} ref={actionMenuId === goal.id ? actionMenuRef : undefined}>
              <button
                className={styles.dotsButton}
                type="button"
                aria-expanded={actionMenuId === goal.id}
                aria-label="Open goal actions"
                onClick={(event) => {
                  event.stopPropagation();
                  openActionMenu(goal);
                }}
              >
                <svg aria-hidden="true" viewBox="0 0 24 24">
                  <circle cx="12" cy="5" r="1.8" />
                  <circle cx="12" cy="12" r="1.8" />
                  <circle cx="12" cy="19" r="1.8" />
                </svg>
              </button>
              {actionMenuId === goal.id ? (
                <div className={styles.actionMenu}>
                  <button type="button" onClick={() => { setActionMenuId(null); openEditFromMenu(goal); }}>Edit</button>
                  <button type="button" className={styles.dangerAction} onClick={() => { setActionMenuId(null); openDeleteFromMenu(goal); }}>Delete</button>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className={styles.goalCardBody}>
          <div className={styles.goalRingSection}>
            <ProgressRing value={percent} size={96} strokeWidth={9} animate />
            <span className={styles.savedAmount}>{money(goal.current_amount)}</span>
            <span className={styles.savedLabel}>saved</span>
          </div>

          <div className={styles.goalStats}>
            <div className={styles.goalStat}>
              <span className={styles.statLabel}>Target</span>
              <strong className={styles.statValue}>{money(goal.target_amount)}</strong>
            </div>
            <div className={styles.goalStat}>
              <span className={styles.statLabel}>Remaining</span>
              <strong className={styles.statValueSecondary}>{money(goal.remaining_amount)}</strong>
            </div>
            <div className={styles.goalStat}>
              <span className={styles.statLabel}>
                {daysRemaining !== null ? "Days left" : "Deadline"}
              </span>
              <strong className={styles.statValue}>
                {daysRemaining !== null ? `${daysRemaining}d` : "Flexible"}
              </strong>
            </div>
          </div>

          {/* Projection */}
          <div className={styles.projectionBox}>
            <span className={styles.projectionText}>{projectionLabel}</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className={styles.progressTrack}>
          <span style={{ width: `${percent}%` }} />
        </div>

        {/* Milestones */}
        <div className={styles.milestones}>
          {MILESTONES.map((milestone) => {
            const reached = goal.saved_percentage >= milestone;
            const celebrated = reached && getCelebratedMilestones(goal.id).has(String(milestone));
            return (
              <span
                key={milestone}
                className={`${styles.milestone} ${reached ? styles.milestoneActive : ""} ${celebrated ? styles.milestoneCelebrated : ""}`}
              >
                {reached ? `🎉 ${milestone}%` : `${milestone}%`}
              </span>
            );
          })}
        </div>

        {/* Contribution history */}
        {goal.contributions.length > 0 ? (
          <details className={styles.historyDetails}>
            <summary className={styles.historySummary}>
              Contribution history ({goal.contributions.length})
            </summary>
            <div className={styles.historyList}>
              {[...goal.contributions].reverse().map((entry) => (
                <div key={entry.id} className={styles.historyItem}>
                  <strong>{money(entry.amount)}</strong>
                  <span>{new Date(entry.contributed_at).toLocaleDateString()}</span>
                  {entry.note ? <p>{entry.note}</p> : null}
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </Card>
    );
  };

  return (
    <section className={styles.page}>
      <div className={styles.actionBar}>
        <Button onClick={openAddModal}>
          <AddIcon />
          Add Goal
        </Button>
      </div>

<<<<<<< HEAD
      {isLoadingGoals ? (
        <Card className={styles.panel}>
          <LoadingSpinner label="Loading goals" />
        </Card>
      ) : null}

      {!isLoadingGoals ? (
      <div className={styles.grid}>
        <Card className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>Goal overview</p>
              <h2>{selectedGoal ? `${selectedGoal.name} at a glance` : "No goal selected"}</h2>
            </div>
            {selectedGoal ? (
              <span className={`${styles.statusPill} ${styles[getGoalStatus(selectedGoal).tone]}`}>
                {getGoalStatus(selectedGoal).label}
              </span>
            ) : null}
          </div>
          {selectedGoal ? (
            <>
              <div className={styles.heroContent}>
                <div className={styles.heroRingCard}>
                  <ProgressRing value={Math.min(selectedGoal.saved_percentage, 100)} />
                  <div>
                    <strong>{money(selectedGoal.current_amount)}</strong>
                    <span>saved so far</span>
                  </div>
                </div>
                <div className={styles.metricsGrid}>
                  <div className={styles.metricCard}>
                    <span>Target</span>
                    <strong>{money(selectedGoal.target_amount)}</strong>
                  </div>
                  <div className={styles.metricCard}>
                    <span>Remaining</span>
                    <strong>{money(selectedGoal.remaining_amount)}</strong>
                  </div>
                  <div className={styles.metricCard}>
                    <span>Deadline</span>
                    <strong>{selectedGoal.deadline ? new Date(selectedGoal.deadline).toLocaleDateString() : "Flexible"}</strong>
                  </div>
                </div>
              </div>
              <div className={styles.chart}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={projections.map((point) => ({ ...point, month: formatProjectionMonth(point.month, selectedGoal?.start_date ?? null) }))}>
                    <CartesianGrid strokeDasharray="4 4" />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(value) => `$${value}`} />
                    <Tooltip formatter={(value) => money(Number(value))} />
                    <Area type="monotone" dataKey="projected" stroke="#49c5b6" fill="#49c5b6" fillOpacity={0.24} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className={styles.aiSavingsBox}>
                <span className={styles.aiLabel}>AI savings calculator</span>
                <strong className={styles.aiAmount}>{money(requiredMonthly)}</strong>
                <span className={styles.aiDesc}>required monthly contribution</span>
                {projectedCompletionLabel ? <p className={styles.aiProjectionText}>{projectedCompletionLabel}</p> : null}
                {aiRationale ? <p className={styles.aiRationale}>{aiRationale}</p> : null}
              </div>
            </>
          ) : (
            <div className={styles.emptyGoalCard}>
              <h3>Create your first goal</h3>
              <p>Set a target and we’ll map your momentum with a smart projection.</p>
            </div>
          )}
        </Card>
        <section className={styles.listSection}>
          {goals.length === 0 ? (
            <Card className={styles.emptyGoalCard}>
              <h3>No goals yet</h3>
              <p>Track a big purchase, trip, or emergency fund with a clear monthly target.</p>
              <div className={styles.emptyGoalActions}>
                <Button onClick={openAddModal}>Create first goal</Button>
              </div>
            </Card>
          ) : null}
          {goals.map((goal) => {
            const status = getGoalStatus(goal);
            const category = getGoalCategoryInfo(goal);
            const daysRemaining = getDaysRemaining(goal);
            return (
              <Card
                className={`${styles.goalCard} ${selectedId === goal.id ? styles.selectedCard : ""}`}
                key={goal.id}
                onClick={() => setSelectedId(goal.id)}
              >
                <div className={styles.goalHeader}>
                  <div className={styles.goalInfo}>
                    <div className={styles.goalTitleRow}>
                      <div className={styles.categoryBadge}>
                        <span className={styles.categoryIcon}>{category.icon}</span>
                        <span>{category.label}</span>
                      </div>
                      <span className={`${styles.statusPill} ${styles[status.tone]}`}>{status.label}</span>
                    </div>
                    <h3>{goal.name}</h3>
                    <p>
                      {goal.linked_account || "No linked account"}
                      {goal.deadline ? ` · due ${new Date(goal.deadline).toLocaleDateString()}` : ""}
                    </p>
                  </div>
                  <div className={styles.goalHeaderRight}>
                    <div className={styles.rowActions} ref={actionMenuId === goal.id ? actionMenuRef : undefined}>
                      <button
                        className={styles.dotsButton}
                        type="button"
                        aria-expanded={actionMenuId === goal.id}
                        aria-label="Open goal actions"
                        onClick={(event) => {
                          event.stopPropagation();
                          openActionMenu(goal);
                        }}
                      >
                        <svg aria-hidden="true" viewBox="0 0 24 24">
                          <circle cx="12" cy="5" r="1.8" />
                          <circle cx="12" cy="12" r="1.8" />
                          <circle cx="12" cy="19" r="1.8" />
                        </svg>
                      </button>
                      {actionMenuId === goal.id ? (
                        <div className={styles.actionMenu}>
                          <button type="button" onClick={() => openContributeFromMenu(goal)}>Log contribution</button>
                          <button type="button" onClick={() => openEditFromMenu(goal)}>Edit</button>
                          <button type="button" className={styles.dangerAction} onClick={() => openDeleteFromMenu(goal)}>Delete</button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className={styles.cardContent}>
                  <ProgressRing value={Math.min(goal.saved_percentage, 100)} size={70} strokeWidth={7} />
                  <div className={styles.cardSummary}>
                    <div className={styles.goalMetaRow}>
                      <span>Saved</span>
                      <strong>{money(goal.current_amount)}</strong>
                    </div>
                    <div className={styles.goalMetaRow}>
                      <span>Target</span>
                      <strong>{money(goal.target_amount)}</strong>
                    </div>
                    <div className={styles.goalMetaRow}>
                      <span>Left</span>
                      <strong>{money(goal.remaining_amount)}</strong>
                    </div>
                  </div>
                </div>

                <div className={styles.progressTrack}>
                  <span style={{ width: `${Math.min(goal.saved_percentage, 100)}%` }} />
                </div>
                <div className={styles.milestones}>
                  {[25, 50, 75, 100].map((milestone) => {
                    const reached = goal.saved_percentage >= milestone;
                    return (
                      <span
                        key={milestone}
                        className={`${styles.milestone} ${reached ? styles.milestoneActive : ""} ${reached ? styles.milestoneCelebrated : ""}`}
                      >
                        {reached ? `🎉 ${milestone}%` : `${milestone}%`}
                      </span>
                    );
                  })}
                </div>
                <div className={styles.cardFooter}>
                  <button type="button" className={styles.secondaryAction} onClick={(event) => {
                    event.stopPropagation();
                    openContributeFromMenu(goal);
                  }}>
                    Log contribution
                  </button>
                  <span>{daysRemaining !== null ? `${daysRemaining} days left` : "Keep momentum going"}</span>
                </div>
              </Card>
            );
          })}
        </section>
      </div>
      ) : null}
      {selectedGoal && selectedGoal.contributions.length > 0 ? (
        <Card className={styles.panel}>
          <h2>Contribution history</h2>
          <div className={styles.history}>
            {selectedGoal.contributions.map((entry) => (
              <div key={entry.id} className={styles.historyItem}>
                <strong>{money(entry.amount)}</strong>
                <span>{new Date(entry.contributed_at).toLocaleDateString()}</span>
                <p>{entry.note || "Manual contribution"}</p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
=======
      {goals.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyStateIllustration}>
            <TargetIcon />
          </div>
          <h2>Every big achievement starts with a goal</h2>
          <p>Create your first savings goal today and start tracking your progress.</p>
          <Button onClick={openAddModal}>
            <AddIcon />
            Create Goal
          </Button>
        </div>
      ) : (
        <div className={styles.goalGrid}>
          {goals.map(renderGoalCard)}
        </div>
      )}
>>>>>>> b122b4d (refactor: enhance password strength, goals grid, and transaction editing)

      {/* Add Goal Modal */}
      <Modal isOpen={isAddOpen} title="Create goal" onClose={() => setIsAddOpen(false)}>
        {renderForm("create")}
      </Modal>

      {/* Edit Goal Modal */}
      <Modal isOpen={isEditOpen} title="Edit goal" onClose={() => setIsEditOpen(false)}>
        {renderForm("edit")}
      </Modal>

      {/* Log Contribution Modal */}
      <Modal isOpen={isContributeOpen} title="Log contribution" onClose={() => setIsContributeOpen(false)}>
        <form
          className={styles.verticalForm}
          onSubmit={(event) => {
            event.preventDefault();
            if (selectedGoal) void logContribution(selectedGoal.id);
          }}
        >
          <FormField label="Amount" error={contribution && (Number(contribution) <= 0 || Number.isNaN(Number(contribution))) ? "Amount must be positive." : undefined}>
            <Input
              type="number"
              placeholder="Amount"
              value={contribution}
              onChange={(e) => setContribution(e.target.value)}
            />
          </FormField>
          <div className={styles.modalActions}>
            <Button variant="secondary" onClick={() => setIsContributeOpen(false)}>Cancel</Button>
            <Button
              type="submit"
              disabled={!contribution || Number(contribution) <= 0 || Number.isNaN(Number(contribution))}
            >
              Log Contribution
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={isDeleteOpen} title="Delete goal" onClose={() => setIsDeleteOpen(false)}>
        <p className={styles.confirmText}>
          Are you sure you want to delete <strong>{selectedGoal?.name}</strong>?
        </p>
        <div className={styles.modalActions}>
          <Button variant="secondary" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
          <Button variant="danger" onClick={() => void confirmDelete()}>Delete goal</Button>
        </div>
      </Modal>
    </section>
  );
}