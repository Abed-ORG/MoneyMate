import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Button, Card, CategoryIcon, FormField, Input, Modal, Select } from "../index";
import { transactionCategories } from "../../constants/categories";
import type {
  BudgetCategory,
  BudgetHistoryMonth,
  BudgetOverview,
  BudgetPayload,
  BudgetSummary,
  MoneyValue,
} from "../../types/budget";
import styles from "./BudgetComponents.module.css";

type BudgetFormState = {
  categoryId: string;
  categoryName: string;
  amount: string;
  month: number;
  year: number;
};

type BudgetFormErrors = Partial<Record<keyof BudgetFormState, string>>;

type BudgetFormModalProps = {
  categories: BudgetCategory[];
  currency: string;
  initialBudget?: BudgetSummary | null;
  isOpen: boolean;
  month: number;
  year: number;
  onClose: () => void;
  onSubmit: (payload: BudgetPayload) => Promise<void>;
};

type DeleteConfirmationModalProps = {
  budget?: BudgetSummary | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
};

type BudgetAllocationSlice = {
  name: string;
  value: number;
  color: string;
};

type TooltipPayload<T> = {
  payload?: T;
};

const monthOptions = Array.from({ length: 12 }, (_, index) => ({
  value: String(index + 1),
  label: new Intl.DateTimeFormat("en-US", { month: "long" }).format(new Date(2026, index, 1)),
}));

export function toNumber(value: MoneyValue | null | undefined) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

export function formatCurrency(value: MoneyValue, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(toNumber(value));
}

export function formatPercent(value: MoneyValue) {
  return `${toNumber(value).toFixed(2)}%`;
}

export function monthLabel(month: number, year: number) {
  return `${monthOptions[month - 1]?.label ?? "Month"} ${year}`;
}

function validateForm(form: BudgetFormState) {
  const errors: BudgetFormErrors = {};
  const amount = Number(form.amount);
  if (!form.categoryId) errors.categoryId = "Choose a category.";
  if (!form.amount.trim()) errors.amount = "Amount is required.";
  if (form.amount && !Number.isFinite(amount)) errors.amount = "Amount must be numeric.";
  if (Number.isFinite(amount) && amount <= 0) errors.amount = "Amount must be greater than zero.";
  if (!form.month) errors.month = "Month is required.";
  if (!form.year) errors.year = "Year is required.";
  return errors;
}

function statusLabel(status: BudgetSummary["status"]) {
  if (status === "over_budget") return "Over budget";
  if (status === "close_to_budget") return "Close to budget";
  if (status === "on_budget") return "Exactly on budget";
  return "Under budget";
}

function budgetCardToneClass(budget: BudgetSummary) {
  if (budget.status === "under_budget") {
    return "";
  }
  if (budget.progress_state === "red") {
    return styles.budgetCard_red;
  }
  if (budget.progress_state === "yellow") {
    return styles.budgetCard_yellow;
  }
  return styles.budgetCard_green;
}

function usageContextLabel(daysRemaining: number) {
  if (daysRemaining === 0) return "month ended";
  if (daysRemaining === 1) return "1 day left";
  return `${daysRemaining} days left`;
}

function getDonutCategoryName(entry: unknown) {
  if (entry && typeof entry === "object" && "name" in entry) {
    return String((entry as BudgetAllocationSlice).name);
  }
  return null;
}

function BudgetAllocationTooltip({
  active,
  currency,
  payload,
  total,
}: {
  active?: boolean;
  currency: string;
  payload?: TooltipPayload<BudgetAllocationSlice>[];
  total: number;
}) {
  const item = payload?.[0]?.payload;
  if (!active || !item) {
    return null;
  }
  return (
    <div className={styles.tooltip}>
      <strong>{item.name}</strong>
      <span>{formatCurrency(item.value, currency)}</span>
      <span>{formatPercent((item.value / total) * 100)} of budget</span>
    </div>
  );
}

function DotsIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <circle cx="12" cy="5" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="12" cy="19" r="1.8" />
    </svg>
  );
}

function TrendIcon({ trend }: { trend: BudgetHistoryMonth["trend"] }) {
  if (trend === "improvement") return <span aria-hidden="true">↑</span>;
  if (trend === "decline") return <span aria-hidden="true">↓</span>;
  return <span aria-hidden="true">→</span>;
}

export function MonthSelector({
  month,
  onChange,
  year,
}: {
  month: number;
  year: number;
  onChange: (month: number, year: number) => void;
}) {
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 9 }, (_, index) => currentYear - 4 + index).map((value) => ({
    value: String(value),
    label: String(value),
  }));

  return (
    <div className={styles.monthSelector} aria-label="Budget month selector">
      <FormField label="Month">
        <Select
          aria-label="Budget month"
          value={String(month)}
          options={monthOptions}
          onValueChange={(value) => onChange(Number(value), year)}
        />
      </FormField>
      <FormField label="Year">
        <Select
          aria-label="Budget year"
          value={String(year)}
          options={yearOptions}
          onValueChange={(value) => onChange(month, Number(value))}
        />
      </FormField>
    </div>
  );
}

export function BudgetSummaryCard({
  historyItem,
  overview,
}: {
  historyItem?: BudgetHistoryMonth;
  overview: BudgetOverview;
}) {
  const { currency, totals } = overview;
  const items = [
    { label: "Total budgeted", value: formatCurrency(totals.total_budgeted_amount, currency) },
    { label: "Actual spending", value: formatCurrency(totals.total_actual_spending, currency) },
    { label: "Remaining", value: formatCurrency(totals.total_remaining_amount, currency) },
    { label: "Usage", value: formatPercent(totals.overall_usage_percentage) },
  ];

  return (
    <Card className={styles.summaryCard}>
      <div>
        <span className={styles.kicker}>Monthly overview</span>
      </div>
      <div className={styles.summaryMetrics}>
        {items.map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
      {historyItem ? (
        <div className={styles.adherenceStrip}>
          <span className={`${styles.trend} ${styles[historyItem.trend]}`}>
            <TrendIcon trend={historyItem.trend} />
            {historyItem.trend === "improvement" ? "Improvement" : historyItem.trend === "decline" ? "Decline" : "No change"}
          </span>
          <p>{historyItem.trend_message}</p>
          <dl>
            <div><dt>Adherence</dt><dd>{formatPercent(historyItem.adherence_percentage)}</dd></div>
            <div><dt>Within budget</dt><dd>{historyItem.categories_within_budget}</dd></div>
            <div><dt>Over budget</dt><dd>{historyItem.categories_over_budget}</dd></div>
          </dl>
        </div>
      ) : null}
    </Card>
  );
}

export function BudgetProgressBar({ budget }: { budget: BudgetSummary }) {
  const capped = Math.min(100, Math.max(0, toNumber(budget.usage_percentage)));
  return (
    <div
      className={`${styles.progressTrack} ${styles[budget.progress_state]}`}
      aria-label={`${budget.category_name} budget usage ${formatPercent(budget.usage_percentage)}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.min(100, toNumber(budget.usage_percentage))}
    >
      <span style={{ width: `${capped}%` }} />
    </div>
  );
}

export function BudgetCategoryCard({
  budget,
  currency,
  daysRemaining,
  onDelete,
  onEdit,
}: {
  budget: BudgetSummary;
  currency: string;
  daysRemaining: number;
  onDelete: (budget: BudgetSummary) => void;
  onEdit: (budget: BudgetSummary) => void;
}) {
  const exceeded = toNumber(budget.remaining_amount) < 0;
  const [isActionOpen, setIsActionOpen] = useState(false);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isActionOpen) {
      return undefined;
    }

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (actionMenuRef.current?.contains(event.target as Node)) {
        return;
      }
      setIsActionOpen(false);
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [isActionOpen]);

  return (
    <article className={`${styles.budgetCard} ${budgetCardToneClass(budget)}`}>
      <header>
        <span className={styles.categoryIcon}>
          <CategoryIcon category={budget.category_name} />
        </span>
        <div className={styles.budgetCardTitle}>
          <h3>{budget.category_name}</h3>
          <p>
            <strong>{formatPercent(budget.usage_percentage)}</strong>
            {" of "}
            {formatCurrency(budget.budgeted_amount, currency)}
          </p>
        </div>
        <div className={styles.cardActions} ref={actionMenuRef}>
          <span className={`${styles.statusBadge} ${styles[budget.status]}`}>
            {statusLabel(budget.status)}
          </span>
          <button
            aria-expanded={isActionOpen}
            aria-label={`Open ${budget.category_name} budget actions`}
            className={styles.dotsButton}
            onClick={() => setIsActionOpen((current) => !current)}
            title="Budget actions"
            type="button"
          >
            <DotsIcon />
          </button>
          {isActionOpen ? (
            <div className={styles.actionMenu}>
              <button
                type="button"
                onClick={() => {
                  setIsActionOpen(false);
                  onEdit(budget);
                }}
              >
                Edit
              </button>
              <button
                className={styles.dangerAction}
                type="button"
                onClick={() => {
                  setIsActionOpen(false);
                  onDelete(budget);
                }}
              >
                Delete
              </button>
            </div>
          ) : null}
        </div>
      </header>
      <BudgetProgressBar budget={budget} />
      <dl className={styles.budgetStats}>
        <div>
          <dt>Spent</dt>
          <dd>{formatCurrency(budget.actual_spending, currency)}</dd>
        </div>
        <div>
          <dt>{exceeded ? "Over by" : "Remaining"}</dt>
          <dd className={exceeded ? styles.negative : styles.positive}>
            {formatCurrency(Math.abs(toNumber(budget.remaining_amount)), currency)}
          </dd>
        </div>
        <div>
          <dt>Context</dt>
          <dd>
            {usageContextLabel(daysRemaining)}
          </dd>
        </div>
      </dl>
    </article>
  );
}

export function BudgetComparisonChart({
  budgets,
  currency,
}: {
  budgets: BudgetSummary[];
  currency: string;
}) {
  if (!budgets.length) {
    return <div className={styles.chartEmpty}>Create a budget to see budget versus actual spending.</div>;
  }

  const maxBudgeted = Math.max(
    ...budgets.map((budget) => toNumber(budget.budgeted_amount)),
    1,
  );

  return (
    <div className={styles.verticalBarFrame}>
      <div className={styles.verticalValueLegend} aria-hidden="true">
        <span className={styles.spentLegend}>Spent</span>
        <span className={styles.budgetLegend}>Budget</span>
      </div>
      <div className={styles.verticalBars}>
        {budgets.map((budget) => {
          const budgeted = toNumber(budget.budgeted_amount);
          const actual = toNumber(budget.actual_spending);
          const trackHeight = Math.max(12, Math.min(100, (budgeted / maxBudgeted) * 100));
          const fillHeight = budgeted > 0 ? Math.min(100, (actual / budgeted) * 100) : 0;
          const isOverBudget = actual > budgeted;
          return (
            <article className={styles.verticalBarItem} key={budget.budget_id}>
              <div className={styles.verticalBarValues}>
                <strong>{formatCurrency(actual, currency)}</strong>
                <span>{formatCurrency(budgeted, currency)}</span>
              </div>
              <div className={styles.verticalBarPlot}>
                <div
                  aria-label={`${budget.category_name}: ${formatCurrency(actual, currency)} actual of ${formatCurrency(budgeted, currency)} budgeted`}
                  className={`${styles.verticalBarTrack} ${styles[budget.progress_state]} ${
                    isOverBudget ? styles.overBudgetBar : ""
                  }`}
                  role="img"
                  style={{ height: `${trackHeight}%` }}
                >
                  <span style={{ height: `${Math.max(2, fillHeight)}%` }} />
                  {isOverBudget ? <em>{formatPercent(budget.usage_percentage)}</em> : null}
                </div>
              </div>
              <div className={styles.verticalBarLabel}>
                <span className={styles.tableCategoryIcon}>
                  <CategoryIcon category={budget.category_name} />
                </span>
                <strong>{budget.category_name}</strong>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function BudgetAllocationDonut({
  budgets,
  currency,
}: {
  budgets: BudgetSummary[];
  currency: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const data = budgets
    .map((budget) => ({
      name: budget.category_name,
      value: toNumber(budget.budgeted_amount),
      color: budget.category_color || "#49c5b6",
    }))
    .filter((item) => item.value > 0);
  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (!data.length) {
    return null;
  }

  return (
    <section className={styles.allocationPanel}>
      <h2>Budget mix</h2>
      <div className={styles.donutLayout}>
        <div className={styles.donutWrap}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                innerRadius="58%"
                isAnimationActive={false}
                nameKey="name"
                onClick={(entry) => {
                  const categoryName = getDonutCategoryName(entry);
                  if (categoryName) {
                    setSelected((current) =>
                      current === categoryName ? null : categoryName,
                    );
                  }
                }}
                outerRadius="82%"
                paddingAngle={2}
              >
                {data.map((entry) => (
                  <Cell
                    fill={entry.color}
                    key={entry.name}
                    opacity={selected && selected !== entry.name ? 0.42 : 1}
                    stroke={
                      selected === entry.name
                        ? "var(--mm-text)"
                        : "var(--mm-bg-deep)"
                    }
                    strokeWidth={selected === entry.name ? 3 : 1}
                  />
                ))}
              </Pie>
              <Tooltip
                content={<BudgetAllocationTooltip currency={currency} total={total} />}
                wrapperStyle={{ outline: "none", zIndex: 20 }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className={styles.donutTotal}>
            <span>Total</span>
            <strong>{formatCurrency(total, currency)}</strong>
          </div>
        </div>
        <div className={styles.allocationLegend}>
          {data.map((item) => (
            <button
              className={
                selected === item.name ? styles.allocationLegendActive : ""
              }
              key={item.name}
              onClick={() =>
                setSelected((current) =>
                  current === item.name ? null : item.name,
                )
              }
              type="button"
            >
              <span style={{ backgroundColor: item.color }} />
              <strong>{item.name}</strong>
              <em>{formatPercent((item.value / total) * 100)}</em>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

export function BudgetHistoryList({
  currency,
  history,
  onSelectMonth,
}: {
  currency: string;
  history: BudgetHistoryMonth[];
  onSelectMonth: (month: number, year: number) => void;
}) {
  if (!history.length) {
    return <p className={styles.emptyText}>No historical budget months yet.</p>;
  }

  return (
    <div className={styles.historyList}>
      {history.map((item) => (
        <button
          className={styles.historyItem}
          key={`${item.year}-${item.month}`}
          onClick={() => onSelectMonth(item.month, item.year)}
          type="button"
        >
          <span className={`${styles.trend} ${styles[item.trend]}`}>
            <TrendIcon trend={item.trend} />
            {item.trend === "improvement" ? "Improvement" : item.trend === "decline" ? "Decline" : "No change"}
          </span>
          <strong>{item.month_label}</strong>
          <span>{item.trend_message}</span>
          <dl>
            <div><dt>Budgeted</dt><dd>{formatCurrency(item.total_budgeted_amount, currency)}</dd></div>
            <div><dt>Spent</dt><dd>{formatCurrency(item.total_actual_spending, currency)}</dd></div>
            <div><dt>Usage</dt><dd>{formatPercent(item.overall_usage_percentage)}</dd></div>
            <div><dt>Adherence</dt><dd>{formatPercent(item.adherence_percentage)}</dd></div>
            <div><dt>Within</dt><dd>{item.categories_within_budget}</dd></div>
            <div><dt>Over</dt><dd>{item.categories_over_budget}</dd></div>
          </dl>
        </button>
      ))}
    </div>
  );
}

export function BudgetFormModal({
  categories,
  currency,
  initialBudget,
  isOpen,
  month,
  year,
  onClose,
  onSubmit,
}: BudgetFormModalProps) {
  const [form, setForm] = useState<BudgetFormState>({
    categoryId: "",
    categoryName: "",
    amount: "",
    month,
    year,
  });
  const [errors, setErrors] = useState<BudgetFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const categoryOptions = useMemo(() => {
    const realCategories = categories.map((category) => ({
      value: String(category.id),
      label: category.name,
    }));
    if (realCategories.length) {
      return [{ value: "", label: "Select category" }, ...realCategories];
    }
    return [
      { value: "", label: "Select category" },
      ...transactionCategories
        .filter((name) => name !== "Income")
        .map((name) => ({ value: `pending:${name}`, label: name })),
    ];
  }, [categories]);

  useEffect(() => {
    setForm({
      categoryId: initialBudget ? String(initialBudget.category_id) : "",
      categoryName: initialBudget ? initialBudget.category_name : "",
      amount: initialBudget ? String(initialBudget.budgeted_amount) : "",
      month,
      year,
    });
    setErrors({});
  }, [initialBudget, isOpen, month, year]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setIsSubmitting(true);
    try {
      const payload =
        form.categoryId.startsWith("pending:")
          ? {
              category_name: form.categoryId.replace("pending:", ""),
              amount: Number(form.amount),
              month: form.month,
              year: form.year,
            }
          : {
              category_id: Number(form.categoryId),
              amount: Number(form.amount),
              month: form.month,
              year: form.year,
            };
      await onSubmit({
        ...payload,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} title={initialBudget ? "Edit Budget" : "Create Budget"} onClose={onClose}>
      <form className={styles.formGrid} onSubmit={submit}>
        <FormField label="Category" error={errors.categoryId}>
          <Select
            aria-label="Budget category"
            error={errors.categoryId}
            value={form.categoryId}
            options={categoryOptions}
            onValueChange={(value) => setForm((current) => ({ ...current, categoryId: value }))}
          />
        </FormField>
        {!categories.length ? (
          <p className={styles.emptyText}>
            Budget categories are loading. This picker needs real backend category IDs before you can create a budget.
          </p>
        ) : null}
        {!categories.length ? (
          <p className={styles.emptyText}>
            If the list stays empty after a refresh, the /budgets/categories API is not returning the expected data for your session yet.
          </p>
        ) : null}
        <div className={styles.formSplit}>
          <FormField label="Month" error={errors.month}>
            <Select
              aria-label="Budget month"
              value={String(form.month)}
              options={monthOptions}
              onValueChange={(value) => setForm((current) => ({ ...current, month: Number(value) }))}
            />
          </FormField>
          <FormField label="Year" error={errors.year}>
            <Input
              min="1900"
              max="2200"
              type="number"
              value={form.year}
              error={errors.year}
              onChange={(event) => setForm((current) => ({ ...current, year: Number(event.target.value) }))}
            />
          </FormField>
        </div>
        <FormField label={`Monthly amount (${currency})`} error={errors.amount}>
          <Input
            inputMode="decimal"
            min="0.01"
            placeholder="500.00"
            step="0.01"
            type="number"
            value={form.amount}
            error={errors.amount}
            onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
          />
        </FormField>
        <div className={styles.modalActions}>
          <Button disabled={isSubmitting} variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={isSubmitting} type="submit">
            {isSubmitting ? "Saving..." : initialBudget ? "Save Changes" : "Create Budget"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function DeleteConfirmationModal({
  budget,
  isOpen,
  onClose,
  onConfirm,
}: DeleteConfirmationModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const confirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} title="Delete Budget" onClose={onClose}>
      <p className={styles.confirmText}>
        Delete the {budget?.category_name ?? "selected"} budget? This will not delete transactions or categories.
      </p>
      <div className={styles.modalActions}>
        <Button disabled={isDeleting} variant="secondary" onClick={onClose}>Cancel</Button>
        <Button disabled={isDeleting} variant="danger" onClick={() => void confirm()}>
          {isDeleting ? "Deleting..." : "Delete Budget"}
        </Button>
      </div>
    </Modal>
  );
}



