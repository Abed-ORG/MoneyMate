import { NavLink } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button, Card, FormField, LoadingSpinner, Select } from "../components";
import { getMonthlyReport, type MonthlyReport } from "../services/reports";
import { buildThemedReportPdf, triggerPdfDownload } from "../utils/pdfReport";
import styles from "./MonthlyReportPage.module.css";

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function percent(value: number) {
  return `${Math.round(value)}%`;
}

function buildMonths() {
  return Array.from({ length: 12 }, (_, index) => ({
    value: String(index + 1),
    label: new Intl.DateTimeFormat("en-US", { month: "long" }).format(new Date(2026, index, 1)),
  }));
}

function buildYears() {
  const current = new Date().getFullYear();
  return Array.from({ length: 5 }, (_, index) => ({
    value: String(current - index),
    label: String(current - index),
  }));
}

async function downloadPdf(report: MonthlyReport) {
  const blob = await buildThemedReportPdf({
    title: `Monthly Report - ${report.monthLabel}`,
    eyebrow: "Personal finance report",
    generatedAt: `Generated ${new Date().toLocaleString("en-US")}`,
    summaryCards: [
      { label: "Total income", value: money(report.income), tone: "positive" },
      { label: "Total expenses", value: money(report.expenses), tone: "negative" },
      {
        label: "Net savings",
        value: money(report.netSavings),
        tone: report.netSavings >= 0 ? "positive" : "negative",
      },
    ],
    tables: [
      {
        title: "Budget details",
        rows: report.budgetCategories,
        emptyText: "No budget categories were found for this month.",
        columns: [
          { label: "Category", width: 160, value: (item) => item.category },
          { label: "Budget", width: 86, value: (item) => money(item.budgeted), align: "right" },
          { label: "Spent", width: 86, value: (item) => money(item.spent), align: "right" },
          { label: "Remaining", width: 86, value: (item) => money(item.remaining), align: "right" },
          { label: "Used", width: 89, value: (item) => percent(item.usagePercentage), align: "right" },
        ],
      },
      {
        title: "Top spending categories",
        rows: report.topSpendingCategories,
        emptyText: "No spending categories were found for this month.",
        columns: [
          { label: "Category", width: 240, value: (item) => item.category },
          { label: "Amount", width: 140, value: (item) => money(item.spent), align: "right" },
          {
            label: "% of expenses",
            width: 127,
            value: (item) => percent(item.percentageOfExpenses),
            align: "right",
          },
        ],
      },
    ],
    footerNote: "MoneyMate monthly report",
  });
  triggerPdfDownload(blob, `MoneyMate_Report_${report.monthLabel.replace(/\s+/g, "_")}.pdf`);
}

export function MonthlyReportPage() {
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void getMonthlyReport(Number(month), Number(year)).then((value) => {
      setReport(value);
      setLoading(false);
    });
  }, [month, year]);

  const chartData = useMemo(
    () =>
      report?.budgetCategories.map((item) => ({
        name: item.category,
        spent: item.spent,
        budgeted: item.budgeted,
      })) ?? [],
    [report],
  );

  return (
    <section className={styles.page}>
      <div className={styles.controlsBar}>
        <div className={styles.controlGroup}>
          <FormField label="Month">
            <Select
              aria-label="Select report month"
              className={styles.wideSelect}
              options={buildMonths()}
              value={month}
              onValueChange={setMonth}
            />
          </FormField>
          <FormField label="Year">
            <Select
              aria-label="Select report year"
              className={styles.wideSelect}
              options={buildYears()}
              value={year}
              onValueChange={setYear}
            />
          </FormField>
        </div>
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
          <LoadingSpinner label="Loading monthly report" />
        </Card>
      ) : (
        <>
          <div className={styles.summaryGrid}>
            <Card className={styles.summaryCard}>
              <span>Total income</span>
              <strong className={styles.positive}>{money(report.income)}</strong>
            </Card>
            <Card className={styles.summaryCard}>
              <span>Total expenses</span>
              <strong className={styles.negative}>{money(report.expenses)}</strong>
            </Card>
            <Card className={styles.summaryCard}>
              <span>Net savings</span>
              <strong className={report.netSavings >= 0 ? styles.positive : styles.negative}>
                {money(report.netSavings)}
              </strong>
            </Card>
          </div>

          <Card className={styles.chartCard}>
            <h3>Budget adherence</h3>
            <div className={styles.chartWrap}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(73, 197, 182, 0.18)" strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: "var(--mm-text-muted)", fontSize: 12 }} tickLine={false} />
                  <YAxis tick={{ fill: "var(--mm-text-muted)", fontSize: 12 }} tickFormatter={(value) => `$${value}`} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: "rgba(73, 197, 182, 0.055)" }}
                    contentStyle={{
                      background: "var(--mm-surface-strong)",
                      border: "1px solid var(--mm-border-strong)",
                      borderRadius: "12px",
                      boxShadow: "0 16px 40px rgba(0, 0, 0, 0.32)",
                      color: "var(--mm-text)",
                    }}
                    labelStyle={{ color: "var(--mm-accent)", fontWeight: 800 }}
                  />
                  <Bar dataKey="budgeted" fill="#17635c" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="spent" fill="#49c5b6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className={styles.grid}>
            <Card className={styles.tableCard}>
              <h3>Budget details</h3>
              <table>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Budget</th>
                    <th>Spent</th>
                    <th>Remaining</th>
                    <th>Used</th>
                  </tr>
                </thead>
                <tbody>
                  {report.budgetCategories.map((item) => (
                    <tr key={item.category}>
                      <td>{item.category}</td>
                      <td>{money(item.budgeted)}</td>
                      <td>{money(item.spent)}</td>
                      <td>{money(item.remaining)}</td>
                      <td>{percent(item.usagePercentage)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <Card className={styles.tableCard}>
              <h3>Top spending categories</h3>
              <table>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Amount</th>
                    <th>% of expenses</th>
                  </tr>
                </thead>
                <tbody>
                  {report.topSpendingCategories.map((item) => (
                    <tr key={item.category}>
                      <td>{item.category}</td>
                      <td>{money(item.spent)}</td>
                      <td>{percent(item.percentageOfExpenses)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        </>
      )}
    </section>
  );
}
