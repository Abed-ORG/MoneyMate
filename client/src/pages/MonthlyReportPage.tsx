import { NavLink } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { Button, Card, FormField, LoadingSpinner, Select } from "../components";
import { BudgetComparisonChart } from "../components/Budgets/BudgetComponents";
import type { BudgetSummary } from "../types/budget";
import { getMonthlyReport, type MonthlyReport } from "../services/reports";
import { formatDisplayDateTime } from "../utils/dateFormat";
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
    generatedAt: `Generated ${formatDisplayDateTime(new Date())}`,
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

  const budgetComparisonData = useMemo(() => {
    if (!report) {
      return [] as BudgetSummary[];
    }

    return report.budgetCategories.map((item, index) => {
      const budgeted = item.budgeted;
      const spent = item.spent;
      const usagePercentage = item.usagePercentage;
      const progressState: "green" | "yellow" | "red" =
        usagePercentage >= 100
          ? "red"
          : usagePercentage > 90
          ? "yellow"
          : "green";

      return {
        budget_id: index,
        category_id: index,
        category_name: item.category,
        category_color: "#49c5b6",
        budgeted_amount: budgeted,
        actual_spending: spent,
        remaining_amount: item.remaining,
        usage_percentage: usagePercentage,
        variance_amount: spent - budgeted,
        variance_percentage: budgeted ? ((spent - budgeted) / budgeted) * 100 : 0,
        status:
          usagePercentage >= 100
            ? "over_budget"
            : usagePercentage > 90
            ? "close_to_budget"
            : "under_budget",
        progress_state: progressState,
      } as BudgetSummary;
    });
  }, [report]);

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
              <BudgetComparisonChart budgets={budgetComparisonData} currency="USD" />
            </div>
          </Card>

          <div className={styles.grid}>
            <Card className={styles.tableCard}>
              <h3>Budget details</h3>
              <div className={styles.tableScroll}>
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
              </div>
            </Card>
            <Card className={styles.tableCard}>
              <h3>Top spending categories</h3>
              <div className={styles.tableScroll}>
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
              </div>
            </Card>
          </div>
        </>
      )}
    </section>
  );
}
