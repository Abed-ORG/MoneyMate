import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button, Card, FormField, Input, Modal, Toast } from "../components";
import { goalsApi } from "../services/goals";
import { goalAiApi, type GoalProjectionPoint } from "../services/insights";
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

type ToastState = {
  title: string;
  message: string;
  variant: "success" | "error" | "warning" | "info";
};

function money(value: number | string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value));
}

function getGoalCategoryInfo(goal: Goal) {
  const name = goal.name.toLowerCase();
  if (/(vacat|trip|travel|holiday|beach)/.test(name)) {
    return { icon: "🏖️", label: "Vacation" };
  }
  if (/(car|vehicle|auto|bike)/.test(name)) {
    return { icon: "🚗", label: "Car" };
  }
  if (/(emerg|safety|buffer|rainy)/.test(name)) {
    return { icon: "🛡️", label: "Emergency fund" };
  }
  if (/(house|home|mortgage|rent)/.test(name)) {
    return { icon: "🏡", label: "House" };
  }
  if (/(educ|school|college|tuition|study)/.test(name)) {
    return { icon: "🎓", label: "Education" };
  }
  return { icon: "🎯", label: "Goal" };
}

function getDaysRemaining(goal: Goal) {
  if (!goal.deadline) {
    return null;
  }
  const deadline = new Date(goal.deadline);
  const today = new Date();
  const diff = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

function formatProjectionMonth(month: string, startDate?: string | null) {
  const match = month.trim().match(/^M(\d+)$/i);
  if (!match || !startDate) {
    return month;
  }

  const index = Number(match[1]) - 1;
  const labelDate = new Date(startDate);
  labelDate.setDate(1);
  labelDate.setMonth(labelDate.getMonth() + index);

  return new Intl.DateTimeFormat("en-US", { month: "short" }).format(labelDate);
}

function getProjectedCompletionLabel(goal: Goal, monthlyContribution: number) {
  const target = Number(goal.target_amount);
  const current = Number(goal.current_amount);
  if (target <= current) {
    return "You’ve already reached this goal.";
  }
  if (!monthlyContribution || monthlyContribution <= 0) {
    return "Start saving to build momentum toward this goal.";
  }

  const start = goal.start_date ? new Date(goal.start_date) : new Date();
  const monthsNeeded = Math.max(Math.ceil((target - current) / monthlyContribution), 1);
  const completion = new Date(start);
  completion.setMonth(completion.getMonth() + monthsNeeded);
  const formatted = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(completion);
  return `At your current rate, you’ll reach this goal by ${formatted}.`;
}

function AddIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function getGoalStatus(goal: Goal) {
  const percent = Math.min(Math.max(goal.saved_percentage, 0), 100);
  if (percent >= 100) {
    return { label: "Complete", tone: "complete" };
  }
  if (percent >= 75) {
    return { label: "Almost there", tone: "near" };
  }
  if (percent >= 50) {
    return { label: "Steady pace", tone: "mid" };
  }
  return { label: "Just getting started", tone: "early" };
}

function ProgressRing({ value, size = 76, strokeWidth = 8 }: { value: number; size?: number; strokeWidth?: number }) {
  const safeValue = Math.min(Math.max(value, 0), 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safeValue / 100) * circumference;

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
        />
      </svg>
      <span className={styles.progressRingLabel}>{safeValue.toFixed(0)}%</span>
    </div>
  );
}

export function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [contribution, setContribution] = useState("");
  const [projections, setProjections] = useState<GoalProjectionPoint[]>([]);
  const [requiredMonthly, setRequiredMonthly] = useState(0);
  const [aiRationale, setAiRationale] = useState("");

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isContributeOpen, setIsContributeOpen] = useState(false);
  const [actionMenuId, setActionMenuId] = useState<number | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const actionMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void goalsApi.list().then((items) => {
      setGoals(items);
      if (!selectedId && items.length > 0) {
        setSelectedId(items[0].id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!actionMenuId) {
      return undefined;
    }

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (actionMenuRef.current?.contains(event.target as Node)) {
        return;
      }
      setActionMenuId(null);
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [actionMenuId]);

  const selectedGoal = useMemo(
    () => goals.find((goal) => goal.id === selectedId) ?? goals[0],
    [goals, selectedId],
  );

  const projectedCompletionLabel = useMemo(() => {
    if (!selectedGoal) {
      return "";
    }
    return getProjectedCompletionLabel(selectedGoal, requiredMonthly);
  }, [requiredMonthly, selectedGoal]);

  // Fetch AI calculations whenever the selected goal changes
  useEffect(() => {
    if (!selectedGoal) return;
    const target = Number(selectedGoal.target_amount);
    const current = Number(selectedGoal.current_amount);
    const deadline = selectedGoal.deadline ?? null;

    const startDate = selectedGoal.start_date ?? null;

    void goalAiApi.calculateSavings({ target_amount: target, current_amount: current, start_date: startDate, deadline }).then((res) => {
      setRequiredMonthly(res.required_monthly);
      setAiRationale(res.rationale ?? "");
    });

    void goalAiApi.projection({ target_amount: target, current_amount: current, start_date: startDate, deadline }).then((res) => {
      setProjections(res.projections);
    });
  }, [selectedGoal]);

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
      setToast({ title: "Goal created", message: `${created.name} has been added.`, variant: "success" });
    } catch {
      setToast({ title: "Could not create goal", message: "Something went wrong.", variant: "error" });
    }
  }

  async function saveEdit() {
    if (!selectedGoal) return;
    try {
      await refresh(goalsApi.update(selectedGoal.id, formToUpdatePayload()));
      setIsEditOpen(false);
      setToast({ title: "Goal updated", message: "Changes saved.", variant: "success" });
    } catch {
      setToast({ title: "Could not update goal", message: "Something went wrong.", variant: "error" });
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
      setToast({ title: "Goal deleted", message: "The goal was removed.", variant: "success" });
    } catch {
      setToast({ title: "Could not delete goal", message: "Something went wrong.", variant: "error" });
    }
  }

  async function logContribution() {
    if (!selectedGoal) return;
    try {
      await refresh(
        goalsApi.contribute(selectedGoal.id, {
          amount: Number(contribution),
          note: "Manual log",
        }),
      );
      setContribution("");
      setIsContributeOpen(false);
      setToast({ title: "Contribution logged", message: "Goal progress updated.", variant: "success" });
    } catch {
      setToast({ title: "Could not log contribution", message: "Something went wrong.", variant: "error" });
    }
  }

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

  const renderCreateForm = () => (
    <form
      className={styles.verticalForm}
      onSubmit={(event) => {
        event.preventDefault();
        void createGoal();
      }}
    >
      <FormField label="Name">
        <Input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </FormField>
      <FormField label="Target amount">
        <Input
          type="number"
          value={form.targetAmount}
          onChange={(e) => setForm({ ...form, targetAmount: e.target.value })}
        />
      </FormField>
      <FormField label="Starting amount">
        <Input
          type="number"
          value={form.currentAmount}
          onChange={(e) => setForm({ ...form, currentAmount: e.target.value })}
        />
      </FormField>
      <FormField label="Start date" helperText="When you plan to start saving">
        <Input
          type="date"
          value={form.startDate}
          onChange={(e) => setForm({ ...form, startDate: e.target.value })}
        />
      </FormField>
      <FormField label="Deadline">
        <Input
          type="date"
          value={form.deadline}
          onChange={(e) => setForm({ ...form, deadline: e.target.value })}
        />
      </FormField>
      <FormField
        label="Linked account"
        helperText="e.g. Savings account, Checking account"
      >
        <Input
          value={form.linkedAccount}
          onChange={(e) => setForm({ ...form, linkedAccount: e.target.value })}
          placeholder="Savings account"
        />
      </FormField>
      <div className={styles.modalActions}>
        <Button variant="secondary" onClick={() => setIsAddOpen(false)}>Cancel</Button>
        <Button type="submit" disabled={!form.name || !form.targetAmount}>Save goal</Button>
      </div>
    </form>
  );

  const renderEditForm = () => (
    <form
      className={styles.verticalForm}
      onSubmit={(event) => {
        event.preventDefault();
        void saveEdit();
      }}
    >
      <FormField label="Name">
        <Input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </FormField>
      <FormField label="Target amount">
        <Input
          type="number"
          value={form.targetAmount}
          onChange={(e) => setForm({ ...form, targetAmount: e.target.value })}
        />
      </FormField>
      <FormField label="Starting amount">
        <Input
          type="number"
          value={form.currentAmount}
          onChange={(e) => setForm({ ...form, currentAmount: e.target.value })}
        />
      </FormField>
      <FormField label="Start date" helperText="When you plan to start saving">
        <Input
          type="date"
          value={form.startDate}
          onChange={(e) => setForm({ ...form, startDate: e.target.value })}
        />
      </FormField>
      <FormField label="Deadline">
        <Input
          type="date"
          value={form.deadline}
          onChange={(e) => setForm({ ...form, deadline: e.target.value })}
        />
      </FormField>
      <FormField
        label="Linked account"
        helperText="e.g. Savings account, Checking account"
      >
        <Input
          value={form.linkedAccount}
          onChange={(e) => setForm({ ...form, linkedAccount: e.target.value })}
          placeholder="Savings account"
        />
      </FormField>
      <div className={styles.modalActions}>
        <Button variant="secondary" onClick={() => setIsEditOpen(false)}>Cancel</Button>
        <Button type="submit">Save Changes</Button>
      </div>
    </form>
  );

  return (
    <section className={styles.page}>
      {toast ? (
        <div className={styles.toastDock}>
          <Toast {...toast} onClose={() => setToast(null)} />
        </div>
      ) : null}

      <div className={styles.actionBar}>
        <Button onClick={openAddModal}>
          <AddIcon />
          Add Goal
        </Button>
      </div>

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

      {/* Add Goal Modal */}
      <Modal isOpen={isAddOpen} title="Create goal" onClose={() => setIsAddOpen(false)}>
        {renderCreateForm()}
      </Modal>

      {/* Edit Goal Modal */}
      <Modal isOpen={isEditOpen} title="Edit goal" onClose={() => setIsEditOpen(false)}>
        {renderEditForm()}
      </Modal>

      {/* Log Contribution Modal */}
      <Modal isOpen={isContributeOpen} title="Log contribution" onClose={() => setIsContributeOpen(false)}>
        <form
          className={styles.verticalForm}
          onSubmit={(event) => {
            event.preventDefault();
            void logContribution();
          }}
        >
          <FormField label="Amount">
            <Input
              type="number"
              placeholder="Amount"
              value={contribution}
              onChange={(e) => setContribution(e.target.value)}
            />
          </FormField>
          <div className={styles.modalActions}>
            <Button variant="secondary" onClick={() => setIsContributeOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={!contribution}>Log contribution</Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={isDeleteOpen} title="Delete goal" onClose={() => setIsDeleteOpen(false)}>
        <p className={styles.confirmText}>Are you sure you want to delete this goal?</p>
        <div className={styles.modalActions}>
          <Button variant="secondary" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
          <Button variant="danger" onClick={() => void confirmDelete()}>Delete goal</Button>
        </div>
      </Modal>
    </section>
  );
}
