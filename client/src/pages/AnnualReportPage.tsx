import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button, Card, FormField, Select } from "../components";
import { getAnnualReport, type AnnualReport } from "../services/reports";
import styles from "./AnnualReportPage.module.css";

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function percent(value: number) {
  const rounded = Number.isFinite(value) ? value : 0;
  return `${rounded >= 0 ? "+" : ""}${rounded.toFixed(1)}%`;
}

function buildYears() {
  const current = new Date().getFullYear();
  return Array.from({ length: 5 }, (_, index) => current - index).map((year) => ({
    value: String(year),
    label: String(year),
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

function downloadPdf(report: AnnualReport) {
  const blob = buildSimplePdf([
    "MoneyMate",
    `Annual Report - ${report.year}`,
    `Generated: ${new Date().toLocaleString("en-US")}`,
    "",
    `Income: ${money(report.totals.income)}`,
    `Expenses: ${money(report.totals.expenses)}`,
    `Net Savings: ${money(report.totals.netSavings)}`,
    "",
    "Month-by-month breakdown",
    ...report.months.map(
      (item) =>
        `${item.monthLabel}: income ${money(item.income)}, expenses ${money(item.expenses)}, net savings ${money(item.netSavings)}`,
    ),
    "",
    report.previousYearComparison
      ? `YoY: income ${percent(report.previousYearComparison.incomeChange)}, expenses ${percent(report.previousYearComparison.expenseChange)}, savings ${percent(report.previousYearComparison.savingsChange)}`
      : "No previous year data available.",
  ]);
  triggerDownload(blob, `MoneyMate_Annual_Report_${report.year}.pdf`);
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
      })) ?? [],
    [report],
  );

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
        <Button disabled={!report} onClick={() => report && downloadPdf(report)}>
          Export PDF
        </Button>
      </div>

      {loading || !report ? (
        <Card className={styles.state}>
          <p>Loading annual report...</p>
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
                  <Bar dataKey="income" fill="#49c5b6" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="expenses" fill="#17635c" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className={styles.tableCard}>
            <h3>Month-by-month breakdown</h3>
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
                  <tr key={item.month}>
                    <td>{item.monthLabel}</td>
                    <td>{money(item.income)}</td>
                    <td>{money(item.expenses)}</td>
                    <td>{money(item.netSavings)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card className={styles.tableCard}>
            <h3>Year-over-year comparison</h3>
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
            ) : (
              <p>No previous year data available.</p>
            )}
          </Card>
        </>
      )}
    </section>
  );
}
