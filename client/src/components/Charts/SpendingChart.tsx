import {
  Bar,
  BarChart,
  CartesianGrid,
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
          <CartesianGrid
            stroke="rgba(220, 239, 219, 0.12)"
            strokeDasharray="4 4"
            vertical={false}
          />
          <XAxis
            axisLine={false}
            dataKey="category"
            tick={{ fill: "rgba(235, 246, 238, 0.62)", fontSize: 12 }}
            tickLine={false}
          />
          <YAxis
            axisLine={false}
            tick={{ fill: "rgba(235, 246, 238, 0.62)", fontSize: 12 }}
            tickFormatter={(value) => `$${value}`}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "rgba(9, 30, 24, 0.96)",
              border: "1px solid rgba(170, 252, 117, 0.22)",
              borderRadius: "12px",
              boxShadow: "0 16px 40px rgba(0, 0, 0, 0.32)",
              color: "#f2f7f0",
            }}
            cursor={{ fill: "rgba(170, 252, 117, 0.055)" }}
            labelStyle={{ color: "#91d46a", fontWeight: 800 }}
            formatter={(value, name) => {
              const amount = typeof value === "number" ? value : Number(value ?? 0);

              return [
                `$${amount.toLocaleString()}`,
                name === "spent" ? "Spent" : "Budget",
              ];
            }}
          />
          <Bar dataKey="budget" fill="rgba(170, 252, 117, 0.16)" radius={[6, 6, 0, 0]} />
          <Bar dataKey="spent" fill="#91d46a" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
