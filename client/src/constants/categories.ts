export const spendingCategories = [
  "Food & Dining",
  "Transport",
  "Housing",
  "Groceries",
  "Entertainment",
  "Shopping",
  "Healthcare",
  "Utilities",
  "Education",
  "Travel",
  "Personal Care",
  "Other",
] as const;

export const transactionCategories = [
  ...spendingCategories.slice(0, 2),
  "Income",
  ...spendingCategories.slice(2),
] as const;

const categoryIcons: Record<string, string> = {
  "Food & Dining": "/category-icons/food-dining.png",
  Transport: "/category-icons/transport.png",
  Housing: "/category-icons/housing.png",
  Groceries: "/category-icons/groceries.png",
  Entertainment: "/category-icons/entertainment.png",
  Shopping: "/category-icons/shopping.png",
  Healthcare: "/category-icons/healthcare.png",
  Utilities: "/category-icons/utilities.png",
  Education: "/category-icons/education.png",
  Travel: "/category-icons/travel.png",
  "Personal Care": "/category-icons/personal-care.png",
  Other: "/category-icons/other.png",
  Income: "/category-icons/income.png",
};

const categoryAliases: Record<string, string> = {
  Transportation: "Transport",
  Health: "Healthcare",
};

export function normalizeCategory(category: string) {
  return categoryAliases[category] ?? category;
}

export function getCategoryIcon(category: string) {
  return categoryIcons[normalizeCategory(category)] ?? categoryIcons.Other;
}
