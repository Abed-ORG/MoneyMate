const AUTH_TOKEN_KEY = "moneymate_mock_token";
const AUTH_USER_KEY = "moneymate_mock_user";

export type MockUser = {
  name: string;
  email: string;
};

export function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function isAuthenticated() {
  return Boolean(getAuthToken());
}

export function getMockUser(): MockUser | null {
  const storedUser = localStorage.getItem(AUTH_USER_KEY);

  if (!storedUser) {
    return null;
  }

  try {
    const user = JSON.parse(storedUser) as Partial<MockUser>;

    if (typeof user.name === "string" && typeof user.email === "string") {
      return { name: user.name, email: user.email };
    }
  } catch {
    localStorage.removeItem(AUTH_USER_KEY);
  }

  return null;
}

export function setMockAuthSession(user: MockUser) {
  localStorage.setItem(AUTH_TOKEN_KEY, "mock-token");
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

export function clearAuthToken() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
}
