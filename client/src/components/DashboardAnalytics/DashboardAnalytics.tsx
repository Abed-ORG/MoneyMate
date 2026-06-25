import { useMemo, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { FiRefreshCw } from "react-icons/fi";
import { Button, Card, CategoryIcon, Modal, Select } from "..";
import { Input } from "../Input/Input";
import { formatCurrency } from "../Budgets/BudgetComponents";
import { spendingCategories } from "../../constants/categories";
import {
  useDashboardFilters,
  type DashboardFilters as DashboardFiltersState,
} from "../../contexts/DashboardFiltersContext";
import type {
  AnalyticsFilterCategory,
  DashboardAnalyticsResponse,
  MonthlyIncomeExpense,
  SpendingCategoryAnalytics,
  SpendingTrendPoint,
  TrendAggregation,
} from "../../types/analytics";
import styles from "./DashboardAnalytics.module.css";

type StatusBlockProps = {
  state: "loading" | "error" | "empty";
  message: string;
};

type ChartCardProps = {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
};

type DashboardFiltersProps = {
  filtersMeta?: DashboardAnalyticsResponse["filters"];
  isLoading: boolean;
};

type AnalyticsProps = {
  data?: DashboardAnalyticsResponse;
  isLoading: boolean;
  error?: string;
};

type TooltipPayload<T> = {
  payload?: T;
  color?: string;
  name?: string;
  value?: number | string;
};

type CategoryFilterOption = {
  id: number;
  name: string;
  color: string;
  isDefault: boolean;
};

const categoryChartColors: Record<string, string> = {
  "Food & Dining": "#f97316",
  Transport: "#2563eb",
  Housing: "#8b5cf6",
  Groceries: "#16a34a",
  Entertainment: "#ec4899",
  Shopping: "#eab308",
  Healthcare: "#dc2626",
  Utilities: "#0891b2",
  Education: "#7c3aed",
  Travel: "#0ea5e9",
  "Personal Care": "#f43f5e",
  Other: "#64748b",
  Uncategorized: "#94a3b8",
};

const fallbackChartColors = [
  "#f97316",
  "#2563eb",
  "#8b5cf6",
  "#16a34a",
  "#ec4899",
  "#eab308",
  "#dc2626",
  "#0891b2",
  "#7c3aed",
  "#0ea5e9",
  "#f43f5e",
  "#64748b",
  "#14b8a6",
  "#a855f7",
  "#ea580c",
  "#4f46e5",
  "#65a30d",
  "#db2777",
];

function FilterIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M7 14v6" />
      <circle cx="14" cy="7" r="2" />
      <circle cx="7" cy="17" r="2" />
    </svg>
  );
}

const tooltipStyle = {
  background: "var(--mm-surface-strong)",
  border: "1px solid var(--mm-border-strong)",
  borderRadius: "var(--mm-radius-md)",
  boxShadow: "0 16px 40px rgba(0, 0, 0, 0.32)",
  color: "var(--mm-text)",
};

function toNumber(value: string | number | null | undefined) {
  return Number(value ?? 0);
}

function compactCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
    style: "currency",
  }).format(value);
}

function toggleId(list: number[], id: number) {
  return list.includes(id)
    ? list.filter((item) => item !== id)
    : [...list, id];
}

function buildCategoryOptions(
  categories: AnalyticsFilterCategory[],
): CategoryFilterOption[] {
  const byName = new Map(
    categories
      .filter((category) => category.name !== "Income")
      .map((category) => [category.name, category]),
  );
  const options: CategoryFilterOption[] = [];

  for (const categoryName of spendingCategories) {
    const category = byName.get(categoryName);
    if (!category) {
      continue;
    }
    options.push({ ...category, isDefault: true });
    byName.delete(categoryName);
  }

  for (const category of Array.from(byName.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    options.push({ ...category, isDefault: false });
  }

  return options;
}

function getUniqueChartColor(
  categoryName: string,
  index: number,
  usedColors: Set<string>,
) {
  const preferred = categoryChartColors[categoryName];
  if (preferred && !usedColors.has(preferred)) {
    usedColors.add(preferred);
    return preferred;
  }

  for (let offset = 0; offset < fallbackChartColors.length; offset += 1) {
    const color =
      fallbackChartColors[(index + offset) % fallbackChartColors.length];
    if (!usedColors.has(color)) {
      usedColors.add(color);
      return color;
    }
  }

  const hue = (index * 47) % 360;
  const color = `hsl(${hue} 72% 54%)`;
  usedColors.add(color);
  return color;
}

function getPieCategoryName(entry: unknown) {
  if (entry && typeof entry === "object" && "category_name" in entry) {
    return String((entry as SpendingCategoryAnalytics).category_name);
  }
  return null;
}

function setQuickRange(
  range: "thisMonth" | "lastMonth" | "last3" | "last6" | "last12",
  setFilters: Dispatch<SetStateAction<DashboardFiltersState>>,
) {
  const now = new Date();
  let start = new Date(now.getFullYear(), now.getMonth(), 1);
  let end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  if (range === "lastMonth") {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    end = new Date(now.getFullYear(), now.getMonth(), 0);
  }

  if (range === "last3" || range === "last6" || range === "last12") {
    const monthsBack = range === "last3" ? 2 : range === "last6" ? 5 : 11;
    start = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
  }

  const toInputDate = (value: Date) => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  setFilters((current) => ({
    ...current,
    startDate: toInputDate(start),
    endDate: toInputDate(end),
  }));
}

function StatusBlock({ state, message }: StatusBlockProps) {
  return (
    <div className={`${styles.statusBlock} ${styles[state]}`} role="status">
      <strong>{state === "error" ? "Could not load this section" : "No data yet"}</strong>
      <span>{message}</span>
    </div>
  );
}

function ChartCard({ title, children, actions }: ChartCardProps) {
  return (
    <Card className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <div>
          <h3>{title}</h3>
        </div>
        {actions ? <div className={styles.chartActions}>{actions}</div> : null}
      </div>
      {children}
    </Card>
  );
}

export function DashboardFilters({
  filtersMeta,
  isLoading,
}: DashboardFiltersProps) {
  const { filters, setFilters, resetFilters } = useDashboardFilters();
  const [dateError, setDateError] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [quickRange, setQuickRangeValue] = useState("thisMonth");
  const categories = useMemo(
    () => buildCategoryOptions(filtersMeta?.categories ?? []),
    [filtersMeta],
  );
  const disabled = isLoading && !filtersMeta;
  const allCategoryIds = categories.map((category) => category.id);
  const allCategoriesSelected =
    allCategoryIds.length > 0 &&
    allCategoryIds.every((id) => filters.categoryIds.includes(id));
  const activeCategoryCount = filters.categoryIds.length;

  const updateDates = (field: "startDate" | "endDate", value: string) => {
    const next = { ...filters, [field]: value };
    if (next.startDate && next.endDate && next.startDate > next.endDate) {
      setDateError("Start date must be before the end date.");
    } else {
      setDateError("");
    }
    setFilters(next);
  };

  return (
    <>
      <div className={styles.filtersBar}>
        <div />
        <div className={styles.topControls}>
          <label className={styles.dateControl}>
            <span>Start</span>
            <Input
              aria-describedby={dateError ? "dashboard-date-error" : undefined}
              aria-label="Dashboard start date"
              disabled={disabled}
              error={dateError}
              max={filters.endDate}
              onChange={(event) => updateDates("startDate", event.target.value)}
              type="date"
              value={filters.startDate}
            />
          </label>
          <label className={styles.dateControl}>
            <span>End</span>
            <Input
              aria-describedby={dateError ? "dashboard-date-error" : undefined}
              aria-label="Dashboard end date"
              disabled={disabled}
              error={dateError}
              min={filters.startDate}
              onChange={(event) => updateDates("endDate", event.target.value)}
              type="date"
              value={filters.endDate}
            />
          </label>
          <Button
            disabled={disabled}
            onClick={() => setIsFilterOpen(true)}
            variant="secondary"
          >
            <FilterIcon />
            Filters
            {activeCategoryCount ? (
              <span className={styles.filterCount}>{activeCategoryCount}</span>
            ) : null}
          </Button>
        </div>
      </div>

      {dateError ? (
        <p className={styles.filterError} id="dashboard-date-error">
          {dateError}
        </p>
      ) : null}

      <Modal
        bodyClassName={styles.filterModalBody}
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        title="Filters"
      >
        <div className={styles.modalSection}>
          <label className={styles.modalLabel} htmlFor="dashboard-date-range">
            Date range
          </label>
          <Select
            id="dashboard-date-range"
            onValueChange={(value) => {
              setDateError("");
              setQuickRangeValue(value);
              setQuickRange(
                value as Parameters<typeof setQuickRange>[0],
                setFilters,
              );
            }}
            options={[
              { value: "thisMonth", label: "This month" },
              { value: "lastMonth", label: "Last month" },
              { value: "last3", label: "Last 3 months" },
              { value: "last6", label: "Last 6 months" },
              { value: "last12", label: "Last 12 months" },
            ]}
            value={quickRange}
          />
        </div>

        <fieldset className={styles.modalSection}>
          <legend className={styles.modalLabel}>Categories</legend>
          <label className={`${styles.categoryFilterRow} ${styles.allCategoriesRow}`}>
            <input
              checked={allCategoriesSelected}
              onChange={() => {
                setFilters((current) => ({
                  ...current,
                  categoryIds: allCategoriesSelected ? [] : allCategoryIds,
                }));
              }}
              type="checkbox"
            />
            <span className={styles.categoryCheck} aria-hidden="true">
              {allCategoriesSelected ? (
                <svg viewBox="0 0 16 16">
                  <path d="m3 8.2 3 3L13 4.8" />
                </svg>
              ) : null}
            </span>
            <strong>All categories</strong>
          </label>

          <div className={styles.categoryChecklist}>
            {categories.map((category) => {
              const isSelected = filters.categoryIds.includes(category.id);
              return (
                <label className={styles.categoryFilterRow} key={category.id}>
                  <input
                    checked={isSelected}
                    onChange={() =>
                      setFilters((current) => ({
                        ...current,
                        categoryIds: toggleId(current.categoryIds, category.id),
                      }))
                    }
                    type="checkbox"
                  />
                  <span className={styles.categoryCheck} aria-hidden="true">
                    {isSelected ? (
                      <svg viewBox="0 0 16 16">
                        <path d="m3 8.2 3 3L13 4.8" />
                      </svg>
                    ) : null}
                  </span>
                  {category.isDefault ? (
                    <span className={styles.categoryIcon} aria-hidden="true">
                      <CategoryIcon category={category.name} />
                    </span>
                  ) : (
                    <span
                      aria-hidden="true"
                      className={styles.categoryColor}
                      style={{
                        background: category.color,
                        boxShadow: `0 0 0.75rem ${category.color}55`,
                      }}
                    />
                  )}
                  <span>{category.name}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className={styles.modalActions}>
          <Button
            aria-label="Reset dashboard filters"
            disabled={disabled}
            onClick={() => {
              setDateError("");
              setQuickRangeValue("thisMonth");
              resetFilters();
            }}
            variant="secondary"
          >
            <FiRefreshCw aria-hidden="true" />
            Reset Filters
          </Button>
          <Button onClick={() => setIsFilterOpen(false)}>Apply</Button>
        </div>
      </Modal>
    </>
  );
}

export function NetPositionSummary({ data, isLoading, error }: AnalyticsProps) {
  if (isLoading && !data) {
    return (
      <section className={styles.summaryGrid} aria-label="Financial summary">
        {[0, 1, 2, 3].map((item) => (
          <Card className={styles.summaryCard} key={item}>
            <span className={styles.skeletonLine} />
            <span className={styles.skeletonValue} />
            <span className={styles.skeletonLine} />
          </Card>
        ))}
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className={styles.summaryGrid} aria-label="Financial summary">
        <Card className={styles.summaryCardWide}>
          <StatusBlock
            message={error ?? "No analytics response is available yet."}
            state="error"
          />
        </Card>
      </section>
    );
  }

  const { currency, summary } = data;
  const net = toNumber(summary.current.net_amount);
  const netClass = net > 0 ? styles.positive : net < 0 ? styles.negative : styles.neutral;
  const change = summary.net_change.value
    ? `${summary.net_change.value}%`
    : summary.net_change.label;

  return (
    <section className={styles.summaryGrid} aria-label="Financial summary">
      <Card className={styles.summaryCard}>
        <span>Total income</span>
        <strong className={styles.positive}>
          {formatCurrency(summary.current.total_income, currency)}
        </strong>
      </Card>
      <Card className={styles.summaryCard}>
        <span>Total expenses</span>
        <strong className={styles.negative}>
          {formatCurrency(summary.current.total_expenses, currency)}
        </strong>
      </Card>
      <Card className={styles.summaryCard}>
        <span>Net amount</span>
        <strong className={netClass}>
          {formatCurrency(summary.current.net_amount, currency)}
        </strong>
      </Card>
      <Card className={styles.summaryCard}>
        <span>Net change</span>
        <strong className={netClass}>{change}</strong>
      </Card>
    </section>
  );
}

function DistributionTooltip({
  active,
  payload,
  currency,
}: {
  active?: boolean;
  payload?: TooltipPayload<SpendingCategoryAnalytics>[];
  currency: string;
}) {
  const item = payload?.[0]?.payload;
  if (!active || !item) {
    return null;
  }
  return (
    <div className={styles.tooltip}>
      <strong>{item.category_name}</strong>
      <span>{formatCurrency(item.amount, currency)}</span>
      <span>{item.percentage}% of spending</span>
    </div>
  );
}

export function SpendingDistributionChart({
  data,
  isLoading,
  error,
}: AnalyticsProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const chartData = useMemo(
    () => {
      const usedColors = new Set<string>();
      return (data?.spending_by_category ?? []).map((item, index) => ({
        ...item,
        amountValue: toNumber(item.amount),
        displayColor: getUniqueChartColor(
          item.category_name,
          index,
          usedColors,
        ),
      }));
    },
    [data],
  );

  return (
    <ChartCard
      title="Spending distribution"
    >
      {isLoading && !data ? (
        <StatusBlock message="Loading category spending..." state="loading" />
      ) : error ? (
        <StatusBlock message={error} state="error" />
      ) : chartData.length === 0 || !data ? (
        <StatusBlock
          message="No expenses match the selected filters."
          state="empty"
        />
      ) : (
        <div className={styles.distributionGrid}>
          <div className={styles.donutWrap}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="amountValue"
                  innerRadius="58%"
                  outerRadius="82%"
                  isAnimationActive={false}
                  paddingAngle={2}
                  onClick={(entry) => {
                    const categoryName = getPieCategoryName(entry);
                    if (categoryName) {
                      setSelected((current) =>
                        current === categoryName ? null : categoryName,
                      );
                    }
                  }}
                  nameKey="category_name"
                >
                  {chartData.map((item) => (
                    <Cell
                      fill={item.displayColor}
                      key={item.category_name}
                      opacity={
                        selected && selected !== item.category_name ? 0.42 : 1
                      }
                      stroke={
                        selected === item.category_name
                          ? "var(--mm-text)"
                          : "var(--mm-bg-deep)"
                      }
                      strokeWidth={selected === item.category_name ? 3 : 1}
                    />
                  ))}
                </Pie>
                <Tooltip
                  content={
                    <DistributionTooltip currency={data.currency} />
                  }
                  wrapperStyle={{ outline: "none" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className={styles.legendList} aria-label="Spending categories">
            {chartData.map((item) => (
              <button
                className={`${styles.legendItem} ${
                  selected === item.category_name ? styles.legendItemActive : ""
                }`}
                key={item.category_name}
                onClick={() =>
                  setSelected((current) =>
                    current === item.category_name ? null : item.category_name,
                  )
                }
                type="button"
              >
                <span
                  aria-hidden="true"
                  className={styles.swatch}
                  style={{ backgroundColor: item.displayColor }}
                />
                <span>{item.category_name}</span>
                <strong>{item.percentage}%</strong>
                <em>{formatCurrency(item.amount, data.currency)}</em>
              </button>
            ))}
          </div>
        </div>
      )}
    </ChartCard>
  );
}

function FlowTooltip({
  active,
  payload,
  label,
  currency,
}: {
  active?: boolean;
  payload?: TooltipPayload<MonthlyIncomeExpense>[];
  label?: string;
  currency: string;
}) {
  const item = payload?.[0]?.payload;
  if (!active || !item) {
    return null;
  }
  return (
    <div className={styles.tooltip}>
      <strong>{label}</strong>
      <span>Income: {formatCurrency(item.income, currency)}</span>
      <span>Expenses: {formatCurrency(item.expenses, currency)}</span>
      <span>Net: {formatCurrency(item.net, currency)}</span>
    </div>
  );
}

export function IncomeExpenseChart({ data, isLoading, error }: AnalyticsProps) {
  const chartData = useMemo(
    () =>
      (data?.monthly_income_expenses ?? []).map((item) => ({
        ...item,
        incomeValue: toNumber(item.income),
        expenseValue: toNumber(item.expenses),
      })),
    [data],
  );

  return (
    <ChartCard
      title="Income vs. expenses"
    >
      {isLoading && !data ? (
        <StatusBlock message="Loading monthly flow..." state="loading" />
      ) : error ? (
        <StatusBlock message={error} state="error" />
      ) : !data || chartData.every((item) => !item.incomeValue && !item.expenseValue) ? (
        <StatusBlock
          message="No income or expenses match the selected filters."
          state="empty"
        />
      ) : (
        <div className={styles.chartWrap}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                stroke="rgba(127, 225, 212, 0.22)"
                strokeDasharray="4 4"
                vertical={false}
              />
              <XAxis
                axisLine={false}
                dataKey="month_label"
                minTickGap={18}
                tick={{ fill: "var(--mm-text-muted)", fontSize: 12 }}
                tickLine={false}
              />
              <YAxis
                axisLine={false}
                tick={{ fill: "var(--mm-text-muted)", fontSize: 12 }}
                tickFormatter={(value) => compactCurrency(Number(value), data.currency)}
                tickLine={false}
                width={70}
              />
              <Tooltip
                content={<FlowTooltip currency={data.currency} />}
                contentStyle={tooltipStyle}
                cursor={{ fill: "rgba(127, 225, 212, 0.055)" }}
                wrapperStyle={{ outline: "none" }}
              />
              <Legend wrapperStyle={{ color: "var(--mm-text-soft)" }} />
              <Bar
                dataKey="incomeValue"
                fill="#22c55e"
                name="Income"
                radius={[6, 6, 0, 0]}
              />
              <Bar
                dataKey="expenseValue"
                fill="#ff6b72"
                name="Expenses"
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}

function TrendTooltip({
  active,
  payload,
  currency,
}: {
  active?: boolean;
  payload?: TooltipPayload<SpendingTrendPoint>[];
  currency: string;
}) {
  const item = payload?.[0]?.payload;
  if (!active || !item) {
    return null;
  }
  return (
    <div className={styles.tooltip}>
      <strong>{item.label}</strong>
      <span>Spending: {formatCurrency(item.spending, currency)}</span>
      <span>Moving average: {formatCurrency(item.moving_average, currency)}</span>
    </div>
  );
}

export function SpendingTrendChart({ data, isLoading, error }: AnalyticsProps) {
  const { filters, setFilters } = useDashboardFilters();
  const chartData = useMemo(
    () =>
      (data?.spending_trend ?? []).map((item) => ({
        ...item,
        spendingValue: toNumber(item.spending),
        movingAverageValue: toNumber(item.moving_average),
      })),
    [data],
  );

  const setAggregation = (trendAggregation: TrendAggregation) => {
    setFilters((current) => ({ ...current, trendAggregation }));
  };

  return (
    <ChartCard
      actions={
        <div className={styles.viewSwitcher} role="group" aria-label="Trend aggregation">
          {(["daily", "weekly"] as const).map((item) => (
            <button
              aria-pressed={filters.trendAggregation === item}
              className={filters.trendAggregation === item ? styles.viewSwitcherActive : ""}
              key={item}
              onClick={() => setAggregation(item)}
              type="button"
            >
              {item === "daily" ? "Daily" : "Weekly"}
            </button>
          ))}
        </div>
      }
      title="Spending trend"
    >
      {isLoading && !data ? (
        <StatusBlock message="Loading spending trend..." state="loading" />
      ) : error ? (
        <StatusBlock message={error} state="error" />
      ) : !data || chartData.every((item) => !item.spendingValue) ? (
        <StatusBlock
          message="No expense trend is available for the selected filters."
          state="empty"
        />
      ) : (
        <div className={styles.chartWrap}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                stroke="rgba(127, 225, 212, 0.22)"
                strokeDasharray="4 4"
                vertical={false}
              />
              <XAxis
                axisLine={false}
                dataKey="label"
                minTickGap={24}
                tick={{ fill: "var(--mm-text-muted)", fontSize: 12 }}
                tickLine={false}
              />
              <YAxis
                axisLine={false}
                tick={{ fill: "var(--mm-text-muted)", fontSize: 12 }}
                tickFormatter={(value) => compactCurrency(Number(value), data.currency)}
                tickLine={false}
                width={70}
              />
              <Tooltip
                content={<TrendTooltip currency={data.currency} />}
                contentStyle={tooltipStyle}
                wrapperStyle={{ outline: "none" }}
              />
              <Legend wrapperStyle={{ color: "var(--mm-text-soft)" }} />
              <Line
                dataKey="spendingValue"
                dot={false}
                name="Spending"
                stroke="#ff8a66"
                strokeWidth={3}
                type="monotone"
              />
              <Line
                dataKey="movingAverageValue"
                dot={false}
                name="Moving average"
                stroke="#7fe1d4"
                strokeDasharray="5 5"
                strokeWidth={2.5}
                type="monotone"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
