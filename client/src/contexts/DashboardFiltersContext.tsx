import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { TrendAggregation } from "../types/analytics";

export type DashboardFilters = {
  startDate: string;
  endDate: string;
  categoryIds: number[];
  accountIds: number[];
  trendAggregation: TrendAggregation;
};

type DashboardFiltersContextValue = {
  filters: DashboardFilters;
  setFilters: Dispatch<SetStateAction<DashboardFilters>>;
  resetFilters: () => void;
};

const DashboardFiltersContext = createContext<
  DashboardFiltersContextValue | undefined
>(undefined);

function toInputDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getDefaultDashboardFilters(): DashboardFilters {
  const now = new Date();
  return {
    startDate: toInputDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    endDate: toInputDate(now),
    categoryIds: [],
    accountIds: [],
    trendAggregation: "daily",
  };
}

export function DashboardFiltersProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [filters, setFilters] = useState<DashboardFilters>(
    getDefaultDashboardFilters,
  );

  const value = useMemo(
    () => ({
      filters,
      setFilters,
      resetFilters: () => setFilters(getDefaultDashboardFilters()),
    }),
    [filters],
  );

  return (
    <DashboardFiltersContext.Provider value={value}>
      {children}
    </DashboardFiltersContext.Provider>
  );
}

export function useDashboardFilters() {
  const value = useContext(DashboardFiltersContext);
  if (!value) {
    throw new Error(
      "useDashboardFilters must be used within DashboardFiltersProvider",
    );
  }
  return value;
}
