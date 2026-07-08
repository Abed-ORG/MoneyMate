import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "../layouts/AppShell";
import { LoadingSpinner } from "../components";
import { ProtectedRoute } from "./ProtectedRoute";

const AnnualReportPage = lazy(() =>
  import("../pages/AnnualReportPage").then((module) => ({
    default: module.AnnualReportPage,
  })),
);
const BudgetsPage = lazy(() =>
  import("../pages/BudgetsPage").then((module) => ({
    default: module.BudgetsPage,
  })),
);
const DashboardPage = lazy(() =>
  import("../pages/DashboardPage").then((module) => ({
    default: module.DashboardPage,
  })),
);
const ForgotPasswordPage = lazy(() =>
  import("../pages/ForgotPasswordPage").then((module) => ({
    default: module.ForgotPasswordPage,
  })),
);
const GoalsPage = lazy(() =>
  import("../pages/GoalsPage").then((module) => ({
    default: module.GoalsPage,
  })),
);
const LandingPage = lazy(() =>
  import("../pages/LandingPage").then((module) => ({
    default: module.LandingPage,
  })),
);
const LoginPage = lazy(() =>
  import("../pages/LoginPage").then((module) => ({
    default: module.LoginPage,
  })),
);
const MonthlyReportPage = lazy(() =>
  import("../pages/MonthlyReportPage").then((module) => ({
    default: module.MonthlyReportPage,
  })),
);
const NotFoundPage = lazy(() =>
  import("../pages/NotFoundPage").then((module) => ({
    default: module.NotFoundPage,
  })),
);
const OnboardingPage = lazy(() =>
  import("../pages/OnboardingPage").then((module) => ({
    default: module.OnboardingPage,
  })),
);
const RegisterPage = lazy(() =>
  import("../pages/RegisterPage").then((module) => ({
    default: module.RegisterPage,
  })),
);
const ResetPasswordPage = lazy(() =>
  import("../pages/ResetPasswordPage").then((module) => ({
    default: module.ResetPasswordPage,
  })),
);
const SettingsPage = lazy(() =>
  import("../pages/SettingsPage").then((module) => ({
    default: module.SettingsPage,
  })),
);
const TransactionsPage = lazy(() =>
  import("../pages/TransactionsPage").then((module) => ({
    default: module.TransactionsPage,
  })),
);

function PageLoader() {
  return <LoadingSpinner label="Loading page" />;
}

export function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              <OnboardingPage />
            </ProtectedRoute>
          }
        />
        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/budgets" element={<BudgetsPage />} />
          <Route path="/goals" element={<GoalsPage />} />
          <Route path="/reports" element={<Navigate replace to="/reports/monthly" />} />
          <Route path="/reports/monthly" element={<MonthlyReportPage />} />
          <Route path="/reports/annual" element={<AnnualReportPage />} />
          <Route path="/chat" element={<Navigate replace to="/dashboard" />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
