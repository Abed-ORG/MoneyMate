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
          <CartesianGrid stroke="#DDE7E2" strokeDasharray="4 4" vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="category"
            tick={{ fill: "#647067", fontSize: 12 }}
            tickLine={false}
          />
          <YAxis
            axisLine={false}
            tick={{ fill: "#647067", fontSize: 12 }}
            tickFormatter={(value) => `$${value}`}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(22, 101, 52, 0.08)" }}
            formatter={(value, name) => {
              const amount = typeof value === "number" ? value : Number(value ?? 0);

              return [
                `$${amount.toLocaleString()}`,
                name === "spent" ? "Spent" : "Budget",
              ];
            }}
          />
          <Bar dataKey="budget" fill="#DDE7E2" radius={[6, 6, 0, 0]} />
          <Bar dataKey="spent" fill="#166534" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
