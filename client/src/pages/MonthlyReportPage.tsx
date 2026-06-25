import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button, Card, FormField, Modal, Select } from "../components";
import { getMonthlyReport, type MonthlyReport } from "../services/reports";
import styles from "./MonthlyReportPage.module.css";

function monthOptions() {
  const current = new Date();
  return Array.from({ length: 36 }, (_, index) => {
    const date = new Date(current.getFullYear(), current.getMonth() - index, 1);
    return {
      value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      label: new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(date),
    };
  });
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function percent(value: number) {
  return `${Math.round(value)}%`;
}

function downloadPdf(report: MonthlyReport) {
  const lines = [
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
  ];
  const pdf = buildSimplePdf(lines, `MoneyMate_Report_${report.monthLabel.replace(/\s+/g, "_")}.pdf`);
  triggerDownload(pdf.blob, pdf.filename);
}

function buildSimplePdf(lines: string[], filename: string) {
  const escaped = lines.map((line) => line.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)"));
  const content = [`BT`, `/F1 12 Tf`, `72 780 Td`];
  escaped.forEach((line, index) => {
    if (index > 0) content.push(`0 -16 Td`);
    content.push(`(${line}) Tj`);
  });
  content.push("ET");
  const stream = content.join("\n");
  const pdf = [
    "%PDF-1.4",
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
    '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    `5 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`,
  ];
  const body = pdf.join("\n");
  const xrefOffset = body.length + 1;
  const xref = `xref\n0 6\n0000000000 65535 f \n0000000010 00000 n \n0000000059 00000 n \n0000000114 00000 n \n0000000247 00000 n \n0000000326 00000 n \ntrailer << /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return {
    blob: new Blob([`${body}\n${xref}`], { type: "application/pdf" }),
    filename,
  };
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function MonthlyReportPage() {
  const [selection, setSelection] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const [year, month] = selection.split("-").map(Number);
    setLoading(true);
    void getMonthlyReport(month, year).then((value) => {
      setReport(value);
      setLoading(false);
    });
  }, [selection]);

  const chartData = useMemo(
    () => report?.budgetCategories.map((item) => ({ name: item.category, spent: item.spent, budgeted: item.budgeted })) ?? [],
    [report],
  );

  return (
    <section className={styles.page}>
      <Card className={styles.controls}>
        <FormField label="Report month">
          <Select
            aria-label="Select report month"
            options={monthOptions()}
            value={selection}
            onValueChange={setSelection}
          />
        </FormField>
        <div className={styles.actions}>
          <Button disabled={!report} onClick={() => report && downloadPdf(report)}>Export PDF</Button>
        </div>
      </Card>

      {loading || !report ? (
        <Card className={styles.state}>
          <p>Loading monthly report...</p>
        </Card>
      ) : (
        <>
          <div className={styles.summaryGrid}>
            <Card className={styles.summaryCard}><span>Total income</span><strong>{money(report.income)}</strong></Card>
            <Card className={styles.summaryCard}><span>Total expenses</span><strong>{money(report.expenses)}</strong></Card>
            <Card className={styles.summaryCard}><span>Net savings</span><strong>{money(report.netSavings)}</strong></Card>
          </div>

          <Card className={styles.chartCard}>
            <h3>Budget adherence</h3>
            <div className={styles.chartWrap}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(73, 197, 182, 0.18)" strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: "var(--mm-text-muted)", fontSize: 12 }} tickLine={false} />
                  <YAxis tick={{ fill: "var(--mm-text-muted)", fontSize: 12 }} tickFormatter={(value) => `$${value}`} tickLine={false} />
                  <Tooltip />
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
                <thead><tr><th>Category</th><th>Budget</th><th>Spent</th><th>Remaining</th><th>Used</th></tr></thead>
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
                <thead><tr><th>Category</th><th>Amount</th><th>% of expenses</th></tr></thead>
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
