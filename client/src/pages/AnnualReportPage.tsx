import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button, Card, FormField, Select } from "../components";
import { getAnnualReport } from "../services/reports";
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

export function AnnualReportPage() {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<Awaited<ReturnType<typeof getAnnualReport>> | null>(null);

  useEffect(() => {
    setLoading(true);
    void getAnnualReport(Number(year)).then((value) => {
      setReport(value);
      setLoading(false);
    });
  }, [year]);

  const chartData = useMemo(
    () => report?.months.map((item) => ({ name: item.monthLabel, income: item.income, expenses: item.expenses })) ?? [],
    [report],
  );

  return (
    <section className={styles.page}>
      <Card className={styles.controls}>
        <FormField label="Report year">
          <Select aria-label="Select report year" options={buildYears()} value={year} onValueChange={setYear} />
        </FormField>
        <div className={styles.actions}>
          <Button disabled={!report} onClick={() => report && downloadPdf(report.year)}>Export PDF</Button>
        </div>
      </Card>

      {loading || !report ? (
        <Card className={styles.state}><p>Loading annual report...</p></Card>
      ) : (
        <>
          <div className={styles.summaryGrid}>
            <Card className={styles.summaryCard}><span>Total income</span><strong>{money(report.totals.income)}</strong></Card>
            <Card className={styles.summaryCard}><span>Total expenses</span><strong>{money(report.totals.expenses)}</strong></Card>
            <Card className={styles.summaryCard}><span>Net savings</span><strong>{money(report.totals.netSavings)}</strong></Card>
          </div>

          <Card className={styles.chartCard}>
            <h3>Monthly breakdown</h3>
            <div className={styles.chartWrap}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(73, 197, 182, 0.18)" strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: "var(--mm-text-muted)", fontSize: 12 }} tickLine={false} />
                  <YAxis tick={{ fill: "var(--mm-text-muted)", fontSize: 12 }} tickFormatter={(value) => `$${value}`} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="income" fill="#49c5b6" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="expenses" fill="#17635c" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className={styles.tableCard}>
            <h3>Month-by-month breakdown</h3>
            <table>
              <thead><tr><th>Month</th><th>Income</th><th>Expenses</th><th>Net savings</th></tr></thead>
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
                <div><span>Income change</span><strong>{percent(report.previousYearComparison.incomeChange)}</strong></div>
                <div><span>Expense change</span><strong>{percent(report.previousYearComparison.expenseChange)}</strong></div>
                <div><span>Savings change</span><strong>{percent(report.previousYearComparison.savingsChange)}</strong></div>
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

function downloadPdf(year: number) {
  const blob = new Blob([`MoneyMate annual report ${year}`], { type: "application/pdf" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `MoneyMate_Annual_Report_${year}.pdf`;
  link.click();
}
