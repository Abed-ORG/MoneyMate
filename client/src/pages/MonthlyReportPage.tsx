import { NavLink } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button, Card, FormField, Select } from "../components";
import { getMonthlyReport, type MonthlyReport } from "../services/reports";
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

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildSimplePdf(lines: string[]) {
  const escapedLines = lines.map(escapePdfText);
  const contentLines = ["BT", "/F1 12 Tf", "72 780 Td"];

  escapedLines.forEach((line, index) => {
    if (index > 0) {
      contentLines.push("0 -16 Td");
    }
    contentLines.push(`(${line}) Tj`);
  });

  contentLines.push("ET");
  const stream = contentLines.join("\n");
  const streamLength = stream.length;
  const objects = [
    "%PDF-1.4",
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    `5 0 obj << /Length ${streamLength} >> stream\n${stream}\nendstream endobj`,
  ];
  const body = objects.join("\n");
  const startXref = body.length + 1;
  const xref = [
    "xref",
    "0 6",
    "0000000000 65535 f ",
    "0000000010 00000 n ",
    "0000000059 00000 n ",
    "0000000114 00000 n ",
    "0000000247 00000 n ",
    "0000000326 00000 n ",
    "trailer << /Size 6 /Root 1 0 R >>",
    "startxref",
    String(startXref),
    "%%EOF",
  ].join("\n");

  return new Blob([`${body}\n${xref}`], { type: "application/pdf" });
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadPdf(report: MonthlyReport) {
  const blob = buildSimplePdf([
    "MoneyMate",
    `Monthly Report - ${report.monthLabel}`,
    `Generated: ${new Date().toLocaleString("en-US")}`,
    "",
    `Income: ${money(report.income)}`,
    `Expenses: ${money(report.expenses)}`,
    `Net Savings: ${money(report.netSavings)}`,
    "",
    "Budget Summary",
    ...report.budgetCategories.map(
      (item) =>
        `${item.category}: budget ${money(item.budgeted)}, spent ${money(item.spent)}, remaining ${money(item.remaining)}`,
    ),
    "",
    "Top Spending",
    ...report.topSpendingCategories.map(
      (item) => `${item.category}: ${money(item.spent)} (${percent(item.percentageOfExpenses)})`,
    ),
  ]);
  triggerDownload(blob, `MoneyMate_Report_${report.monthLabel.replace(/\s+/g, "_")}.pdf`);
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
          <Button disabled={!report} onClick={() => report && downloadPdf(report)}>
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
          <p>Loading monthly report...</p>
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
