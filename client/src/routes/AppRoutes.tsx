import { Navigate, Route, Routes } from "react-router-dom";
import { Suspense, lazy } from "react";
import { AppShell } from "../layouts/AppShell";
import { BudgetsPage } from "../pages/BudgetsPage";
import { DashboardPage } from "../pages/DashboardPage";
import { GoalsPage } from "../pages/GoalsPage";
import { ForgotPasswordPage } from "../pages/ForgotPasswordPage";
import { LandingPage } from "../pages/LandingPage";
import { LoginPage } from "../pages/LoginPage";
import { MonthlyReportPage } from "../pages/MonthlyReportPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { ProtectedRoute } from "./ProtectedRoute";

const BudgetsPage = lazy(() => import("../pages/BudgetsPage").then((module) => ({ default: module.BudgetsPage })));
const ChatPage = lazy(() => import("../pages/ChatPage").then((module) => ({ default: module.ChatPage })));
const DashboardPage = lazy(() => import("../pages/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const GoalsPage = lazy(() => import("../pages/GoalsPage").then((module) => ({ default: module.GoalsPage })));
const ForgotPasswordPage = lazy(() => import("../pages/ForgotPasswordPage").then((module) => ({ default: module.ForgotPasswordPage })));
const LandingPage = lazy(() => import("../pages/LandingPage").then((module) => ({ default: module.LandingPage })));
const LoginPage = lazy(() => import("../pages/LoginPage").then((module) => ({ default: module.LoginPage })));
const MonthlyReportPage = lazy(() => import("../pages/MonthlyReportPage").then((module) => ({ default: module.MonthlyReportPage })));
const OnboardingPage = lazy(() => import("../pages/OnboardingPage").then((module) => ({ default: module.OnboardingPage })));
const RegisterPage = lazy(() => import("../pages/RegisterPage").then((module) => ({ default: module.RegisterPage })));
const AnnualReportPage = lazy(() => import("../pages/AnnualReportPage").then((module) => ({ default: module.AnnualReportPage })));
const ResetPasswordPage = lazy(() => import("../pages/ResetPasswordPage").then((module) => ({ default: module.ResetPasswordPage })));
const SettingsPage = lazy(() => import("../pages/SettingsPage").then((module) => ({ default: module.SettingsPage })));
const TransactionsPage = lazy(() => import("../pages/TransactionsPage").then((module) => ({ default: module.TransactionsPage })));

function PageLoader() {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
      <div className="moneymate-loader" aria-label="Loading page" />
    </div>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <Suspense fallback={<PageLoader />}>
            <LandingPage />
          </Suspense>
        }
      />
      <Route
        path="/login"
        element={
          <Suspense fallback={<PageLoader />}>
            <LoginPage />
          </Suspense>
        }
      />
      <Route
        path="/register"
        element={
          <Suspense fallback={<PageLoader />}>
            <RegisterPage />
          </Suspense>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <Suspense fallback={<PageLoader />}>
            <ForgotPasswordPage />
          </Suspense>
        }
      />
      <Route
        path="/reset-password"
        element={
          <Suspense fallback={<PageLoader />}>
            <ResetPasswordPage />
          </Suspense>
        }
      />
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <Suspense fallback={<PageLoader />}>
              <OnboardingPage />
            </Suspense>
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
        <Route
          path="/dashboard"
          element={
            <Suspense fallback={<PageLoader />}>
              <DashboardPage />
            </Suspense>
          }
        />
        <Route
          path="/transactions"
          element={
            <Suspense fallback={<PageLoader />}>
              <TransactionsPage />
            </Suspense>
          }
        />
        <Route
          path="/budgets"
          element={
            <Suspense fallback={<PageLoader />}>
              <BudgetsPage />
            </Suspense>
          }
        />
        <Route
          path="/goals"
          element={
            <Suspense fallback={<PageLoader />}>
              <GoalsPage />
            </Suspense>
          }
        />
        <Route path="/reports" element={<Navigate replace to="/reports/monthly" />} />
        <Route path="/reports/monthly" element={<MonthlyReportPage />} />
        <Route path="/reports/annual" element={<AnnualReportPage />} />
        <Route path="/chat" element={<Navigate replace to="/dashboard" />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route
        path="*"
        element={
          <Suspense fallback={<PageLoader />}>
            <NotFoundPage />
          </Suspense>
        }
      />
    </Routes>
  );
}