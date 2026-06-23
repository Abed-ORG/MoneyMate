import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button, Card, FormField, Input } from "../components";
import { goalsApi } from "../services/goals";
import { goalAiApi, type GoalProjectionPoint } from "../services/insights";
import type { Goal } from "../types/goal";
import styles from "./GoalsPage.module.css";

const emptyForm = {
  name: "",
  targetAmount: "",
  deadline: "",
  linkedAccount: "",
  currentAmount: "",
};

function money(value: number | string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value));
}

export function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [contribution, setContribution] = useState("");
  const [projections, setProjections] = useState<GoalProjectionPoint[]>([]);
  const [requiredMonthly, setRequiredMonthly] = useState(0);
  const [aiProvider, setAiProvider] = useState("heuristic");
  const [aiRationale, setAiRationale] = useState("");

  useEffect(() => {
    void goalsApi.list().then((items) => {
      setGoals(items);
      setSelectedId(items[0]?.id ?? null);
    });
  }, []);

  const selectedGoal = useMemo(
    () => goals.find((goal) => goal.id === selectedId) ?? goals[0],
    [goals, selectedId],
  );

  // Fetch AI calculations whenever the selected goal changes
  useEffect(() => {
    if (!selectedGoal) return;
    const target = Number(selectedGoal.target_amount);
    const current = Number(selectedGoal.current_amount);
    const deadline = selectedGoal.deadline ?? null;

    void goalAiApi.calculateSavings({ target_amount: target, current_amount: current, deadline }).then((res) => {
      setRequiredMonthly(res.required_monthly);
      setAiProvider(res.provider);
      setAiRationale(res.rationale ?? "");
    });

    void goalAiApi.projection({ target_amount: target, current_amount: current, deadline }).then((res) => {
      setProjections(res.projections);
    });
  }, [selectedGoal]);

  async function refresh(promise: Promise<Goal>) {
    const updated = await promise;
    setGoals((current) => current.map((goal) => (goal.id === updated.id ? updated : goal)));
  }

  async function createGoal() {
    const created = await goalsApi.create({
      name: form.name,
      target_amount: Number(form.targetAmount),
      deadline: form.deadline || undefined,
      linked_account: form.linkedAccount || undefined,
      current_amount: Number(form.currentAmount || 0),
    });
    setGoals((current) => [created, ...current]);
    setSelectedId(created.id);
    setForm(emptyForm);
  }

  async function logContribution() {
    if (!selectedGoal) return;
    await refresh(
      goalsApi.contribute(selectedGoal.id, {
        amount: Number(contribution),
        note: "Manual log",
      }),
    );
    setContribution("");
  }

  return (
    <div className={styles.page}>
      <section className={styles.grid}>
        <Card className={styles.panel}>
          <h2>Create goal</h2>
          <div className={styles.formGrid}>
            <FormField label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></FormField>
            <FormField label="Target amount"><Input type="number" value={form.targetAmount} onChange={(e) => setForm({ ...form, targetAmount: e.target.value })} /></FormField>
            <FormField label="Deadline"><Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></FormField>
            <FormField label="Linked account"><Input value={form.linkedAccount} onChange={(e) => setForm({ ...form, linkedAccount: e.target.value })} /></FormField>
            <FormField label="Starting amount"><Input type="number" value={form.currentAmount} onChange={(e) => setForm({ ...form, currentAmount: e.target.value })} /></FormField>
          </div>
          <Button onClick={() => void createGoal()} disabled={!form.name || !form.targetAmount}>Save goal</Button>
        </Card>

        <Card className={styles.panel}>
          <h2>Goal timeline</h2>
          {selectedGoal ? (
            <>
              <p>{selectedGoal.name} projected savings curve.</p>
              <div className={styles.chart}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={projections}>
                    <CartesianGrid strokeDasharray="4 4" />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(value) => `$${value}`} />
                    <Tooltip formatter={(value) => money(Number(value))} />
                    <Area type="monotone" dataKey="projected" stroke="#49c5b6" fill="#49c5b6" fillOpacity={0.24} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p>AI monthly contribution: {money(requiredMonthly)}</p>
            </>
          ) : (
            <p>Create a goal to see the projection.</p>
          )}
        </Card>
      </section>

      <section className={styles.listSection}>
        {goals.map((goal) => (
          <Card className={styles.goalCard} key={goal.id} onClick={() => setSelectedId(goal.id)}>
            <div className={styles.goalHeader}>
              <div>
                <h3>{goal.name}</h3>
                <p>{goal.linked_account || "No linked account"} · due {goal.deadline ? new Date(goal.deadline).toLocaleDateString() : "no deadline"}</p>
              </div>
              <strong>{goal.saved_percentage.toFixed(0)}%</strong>
            </div>
            <div className={styles.progressTrack}><span style={{ width: `${Math.min(goal.saved_percentage, 100)}%` }} /></div>
            <div className={styles.goalMeta}>
              <span>Saved {money(goal.current_amount)}</span>
              <span>Remaining {money(goal.remaining_amount)}</span>
            </div>
          </Card>
        ))}
      </section>

      {selectedGoal && (
        <Card className={styles.panel}>
          <h2>Contribution history</h2>
          <div className={styles.contributionRow}>
            <Input type="number" placeholder="Amount" value={contribution} onChange={(e) => setContribution(e.target.value)} />
            <Button onClick={() => void logContribution()} disabled={!contribution}>Log contribution</Button>
          </div>
          <div className={styles.history}>
            {selectedGoal.contributions.length ? selectedGoal.contributions.map((entry) => (
              <div key={entry.id} className={styles.historyItem}>
                <strong>{money(entry.amount)}</strong>
                <span>{new Date(entry.contributed_at).toLocaleDateString()}</span>
                <p>{entry.note || "Manual contribution"}</p>
              </div>
            )) : <p>No contributions logged yet.</p>}
          </div>
        </Card>
      )}
    </div>
  );
}
