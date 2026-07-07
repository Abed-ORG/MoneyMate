import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import styles from "./SpendingChart.module.css";

const spendingData = [
  { category: "Housing", budget: 1200, spent: 1120 },
  { category: "Food", budget: 550, spent: 430 },
  { category: "Transit", budget: 260, spent: 210 },
  { category: "Savings", budget: 700, spent: 680 },
  { category: "Fun", budget: 300, spent: 245 },
];

export function SpendingChart() {
  return (
    <div className={styles.chartWrap}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={spendingData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
          <XAxis
            axisLine={false}
            dataKey="category"
            tick={{ fill: "var(--mm-text-muted)", fontSize: 12 }}
            tickLine={false}
          />
          <YAxis
            axisLine={false}
            tick={{ fill: "var(--mm-text-muted)", fontSize: 12 }}
            tickFormatter={(value) => `$${value}`}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "var(--mm-surface-strong)",
              border: "1px solid var(--mm-border-strong)",
              borderRadius: "12px",
              boxShadow: "0 16px 40px rgba(0, 0, 0, 0.32)",
              color: "var(--mm-text)",
            }}
            cursor={{ fill: "var(--mm-chart-cursor)" }}
            labelStyle={{ color: "var(--mm-accent)", fontWeight: 800 }}
            formatter={(value, name) => {
              const amount = typeof value === "number" ? value : Number(value ?? 0);

              return [
                `$${amount.toLocaleString()}`,
                name === "spent" ? "Spent" : "Budget",
              ];
            }}
          />
          <Bar dataKey="budget" fill="var(--mm-accent-deep)" minPointSize={4} radius={[6, 6, 0, 0]} />
          <Bar dataKey="spent" fill="var(--mm-accent)" minPointSize={4} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}


