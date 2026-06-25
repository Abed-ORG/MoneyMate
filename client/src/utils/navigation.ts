export const protectedNavigation = [
  { label: "Dashboard", path: "/dashboard" },
  { label: "Transactions", path: "/transactions" },
  { label: "Budgets", path: "/budgets" },
  { label: "Goals", path: "/goals" },
  { label: "Reports", path: "/reports" },
  { label: "Chat", path: "/chat" },
  { label: "Settings", path: "/settings" },
] as const;

export function getPageTitle(pathname: string) {
  if (pathname.startsWith("/reports")) {
    return "Reports";
  }
  const match = protectedNavigation.find((item) => item.path === pathname);
  return match?.label ?? "MoneyMate";
}
