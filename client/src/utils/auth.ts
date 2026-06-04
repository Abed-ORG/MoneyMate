const AUTH_TOKEN_KEY = "moneymate_mock_token";

export function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function isAuthenticated() {
  return Boolean(getAuthToken());
}

export function setMockAuthToken() {
  localStorage.setItem(AUTH_TOKEN_KEY, "mock-token");
}

export function clearAuthToken() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}
