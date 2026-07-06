import { NavLink } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button, Card, FormField, LoadingSpinner, Select } from "../components";
import { getAnnualReport, type AnnualReport } from "../services/reports";
import { buildThemedReportPdf, triggerPdfDownload } from "../utils/pdfReport";
import styles from "./AnnualReportPage.module.css";

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function compactMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
    style: "currency",
  }).format(value);
}

function percent(value: number) {
  const rounded = Number.isFinite(value) ? value : 0;
  return `${rounded >= 0 ? "+" : ""}${rounded.toFixed(1)}%`;
}

const tooltipStyle = {
  background: "var(--mm-surface-strong)",
  border: "1px solid var(--mm-border-strong)",
  borderRadius: "12px",
  boxShadow: "0 16px 40px rgba(0, 0, 0, 0.32)",
  color: "var(--mm-text)",
};

type IncomeExpensePoint = {
  income: number;
  expenses: number;
  net: number;
};

type SavingsPoint = {
  currentSavings: number;
  previousSavings: number;
};

function IncomeExpenseTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: string;
  payload?: Array<{ payload?: IncomeExpensePoint }>;
}) {
  const item = payload?.[0]?.payload;
  if (!active || !item) {
    return null;
  }
  return (
    <div className={styles.tooltip}>
      <strong>{label}</strong>
      <span>Income: {money(item.income)}</span>
      <span>Expenses: {money(item.expenses)}</span>
      <span>Net: {money(item.net)}</span>
    </div>
  );
}

function YearComparisonTooltip({
  active,
  label,
  payload,
  year,
}: {
  active?: boolean;
  label?: string;
  payload?: Array<{ payload?: SavingsPoint }>;
  year: string;
}) {
  const item = payload?.[0]?.payload;
  if (!active || !item) {
    return null;
  }
  return (
    <div className={styles.tooltip}>
      <strong>{label}</strong>
      <span>{Number(year) - 1}: {money(item.previousSavings)}</span>
      <span>{year}: {money(item.currentSavings)}</span>
    </div>
  );
}

function buildYears() {
  const current = new Date().getFullYear();
  return Array.from({ length: 5 }, (_, index) => current - index).map((year) => ({
    value: String(year),
    label: String(year),
  }));
}

async function downloadPdf(report: AnnualReport) {
  const comparisonRows = report.previousYearComparison
    ? [
        {
          metric: "Income change",
          value: percent(report.previousYearComparison.incomeChange),
        },
        {
          metric: "Expense change",
          value: percent(report.previousYearComparison.expenseChange),
        },
        {
          metric: "Savings change",
          value: percent(report.previousYearComparison.savingsChange),
        },
      ]
    : [];

  const blob = await buildThemedReportPdf({
    title: `Annual Report - ${report.year}`,
    eyebrow: "Personal finance report",
    generatedAt: `Generated ${new Date().toLocaleString("en-US")}`,
    summaryCards: [
      { label: "Total income", value: money(report.totals.income), tone: "positive" },
      { label: "Total expenses", value: money(report.totals.expenses), tone: "negative" },
      {
        label: "Net savings",
        value: money(report.totals.netSavings),
        tone: report.totals.netSavings >= 0 ? "positive" : "negative",
      },
    ],
    charts: [
      {
        title: "Income vs expense comparison",
        xKey: "monthLabel",
        data: report.months.map((item) => ({
          monthLabel: item.monthLabel,
          income: item.income,
          expenses: item.expenses,
        })),
        series: [
          { key: "income", label: "Income", color: "#22c55e" },
          { key: "expenses", label: "Expenses", color: "#ff6b72" },
        ],
      },
    ],
    tables: [
      {
        title: "Month-by-month breakdown",
        rows: report.months,
        columns: [
          { label: "Month", width: 135, value: (item) => item.monthLabel },
          { label: "Income", width: 124, value: (item) => money(item.income), align: "right" },
          { label: "Expenses", width: 124, value: (item) => money(item.expenses), align: "right" },
          { label: "Net savings", width: 124, value: (item) => money(item.netSavings), align: "right" },
        ],
      },
      {
        title: "Year-over-year comparison",
        rows: comparisonRows,
        emptyText: "No previous year data available.",
        columns: [
          { label: "Metric", width: 300, value: (item) => item.metric },
          { label: "Change", width: 207, value: (item) => item.value, align: "right" },
        ],
      },
    ],
    footerNote: "MoneyMate annual report",
  });
  triggerPdfDownload(blob, `MoneyMate_Annual_Report_${report.year}.pdf`);
}

export function AnnualReportPage() {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<AnnualReport | null>(null);

  useEffect(() => {
    setLoading(true);
    void getAnnualReport(Number(year)).then((value) => {
      setReport(value);
      setLoading(false);
    });
  }, [year]);

  const chartData = useMemo(
    () =>
      report?.months.map((item) => ({
        name: item.monthLabel,
        income: item.income,
        expenses: item.expenses,
        net: item.netSavings,
      })) ?? [],
    [report],
  );

  const yearOverYearLineData = useMemo(() => {
    if (!report) return [];
    return report.months.map((month, index) => ({
      monthLabel: month.monthLabel,
      currentSavings: month.netSavings,
      previousSavings: report.previousYearMonths?.[index]?.netSavings ?? 0,
    }));
  }, [report]);

  return (
    <section className={styles.page}>
      <div className={styles.controlsBar}>
        <FormField label="Year">
          <Select
            aria-label="Select report year"
            options={buildYears()}
            value={year}
            onValueChange={setYear}
          />
        </FormField>
        <div className={styles.controlActions}>
          <Button disabled={!report} onClick={() => report && void downloadPdf(report)}>
            Export PDF
          </Button>
          <div className={styles.viewSwitcher} role="group" aria-label="Report view mode">
            <NavLink className={({ isActive }) => `${styles.viewSwitcherButton} ${isActive ? styles.viewSwitcherActive : ""}`} to="/reports/monthly">
              Monthly
            </NavLink>
            <NavLink className={({ isActive }) => `${styles.viewSwitcherButton} ${isActive ? styles.viewSwitcherActive : ""}`} to="/reports/annual">
              Annual
            </NavLink>
          </div>
        </div>
      </div>

      {loading || !report ? (
        <Card className={styles.state}>
          <LoadingSpinner label="Loading annual report" />
        </Card>
      ) : (
        <>
          <div className={styles.summaryGrid}>
            <Card className={styles.summaryCard}>
              <span>Total income</span>
              <strong className={styles.positive}>{money(report.totals.income)}</strong>
            </Card>
            <Card className={styles.summaryCard}>
              <span>Total expenses</span>
              <strong className={styles.negative}>{money(report.totals.expenses)}</strong>
            </Card>
            <Card className={styles.summaryCard}>
              <span>Net savings</span>
              <strong className={report.totals.netSavings >= 0 ? styles.positive : styles.negative}>
                {money(report.totals.netSavings)}
              </strong>
            </Card>
          </div>

          <Card className={styles.chartCard}>
            <h3>Monthly breakdown</h3>
            <div className={styles.chartWrap}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(127, 225, 212, 0.22)" strokeDasharray="4 4" vertical={false} />
                  <XAxis axisLine={false} dataKey="name" tick={{ fill: "var(--mm-text-muted)", fontSize: 12 }} tickLine={false} />
                  <YAxis
                    axisLine={false}
                    tick={{ fill: "var(--mm-text-muted)", fontSize: 12 }}
                    tickFormatter={(value) => compactMoney(Number(value))}
                    tickLine={false}
                    width={70}
                  />
                  <Tooltip
                    content={<IncomeExpenseTooltip />}
                    cursor={{ fill: "rgba(127, 225, 212, 0.055)" }}
                    contentStyle={tooltipStyle}
                    wrapperStyle={{ outline: "none" }}
                  />
                  <Legend wrapperStyle={{ color: "var(--mm-text-soft)" }} />
                  <Bar dataKey="income" fill="#22c55e" radius={[6, 6, 0, 0]} name="Income" />
                  <Bar dataKey="expenses" fill="#ff6b72" radius={[6, 6, 0, 0]} name="Expenses" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className={styles.tableCard}>
            <h3>Month-by-month breakdown</h3>
            <div className={styles.tableScroll}>
              <table>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Income</th>
                    <th>Expenses</th>
                    <th>Net savings</th>
                  </tr>
                </thead>
                <tbody>
                  {report.months.map((item) => (
                    <tr
                      className={item.netSavings >= 0 ? styles.savingsPositive : styles.savingsNegative}
                      key={item.month}
                    >
                      <td>{item.monthLabel}</td>
                      <td>{money(item.income)}</td>
                      <td>{money(item.expenses)}</td>
                      <td>{money(item.netSavings)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className={styles.chartCard}>
            <h3>Year-over-year comparison</h3>
            {report.previousYearMonths.length ? (
              <div className={styles.chartWrap}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={yearOverYearLineData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(127, 225, 212, 0.22)" strokeDasharray="4 4" vertical={false} />
                    <XAxis axisLine={false} dataKey="monthLabel" tick={{ fill: "var(--mm-text-muted)", fontSize: 12 }} tickLine={false} />
                    <YAxis
                      axisLine={false}
                      tick={{ fill: "var(--mm-text-muted)", fontSize: 12 }}
                      tickFormatter={(value) => compactMoney(Number(value))}
                      tickLine={false}
                      width={70}
                    />
                    <Tooltip
                      content={<YearComparisonTooltip year={year} />}
                      cursor={{ fill: "rgba(127, 225, 212, 0.055)" }}
                      contentStyle={tooltipStyle}
                      wrapperStyle={{ outline: "none" }}
                    />
                    <Legend wrapperStyle={{ color: "var(--mm-text-soft)" }} />
                    <Line type="monotone" dataKey="previousSavings" stroke="#5ab9dd" strokeWidth={3} dot={false} name={`${Number(year) - 1} net savings`} />
                    <Line type="monotone" dataKey="currentSavings" stroke="#facc15" strokeWidth={3} dot={false} name={`${year} net savings`} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p>No previous year data available.</p>
            )}
            {report.previousYearComparison ? (
              <div className={styles.comparisonGrid}>
                <div>
                  <span>Income change</span>
                  <strong>{percent(report.previousYearComparison.incomeChange)}</strong>
                </div>
                <div>
                  <span>Expense change</span>
                  <strong>{percent(report.previousYearComparison.expenseChange)}</strong>
                </div>
                <div>
                  <span>Savings change</span>
                  <strong>{percent(report.previousYearComparison.savingsChange)}</strong>
                </div>
              </div>
            ) : null}
          </Card>
        </>
      )}
    </section>
  );
}
