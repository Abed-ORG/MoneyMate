const AUTH_TOKEN_KEY = "moneymate_access_token";
const REFRESH_TOKEN_KEY = "moneymate_refresh_token";
const AUTH_NOTICE_KEY = "moneymate_auth_notice";

export type AuthTokens = {
  access_token: string;
  refresh_token: string;
  token_type: string;
};

function getTokenExpiration(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) {
      return null;
    }
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const decoded = JSON.parse(atob(padded)) as { exp?: unknown };
    return typeof decoded.exp === "number" ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function hasValidAuthToken() {
  const token = getAuthToken();
  if (!token) {
    return false;
  }
  const expiresAt = getTokenExpiration(token);
  return expiresAt !== null && expiresAt > Date.now() + 5_000;
}

export function setAuthSession(tokens: AuthTokens) {
  localStorage.setItem(AUTH_TOKEN_KEY, tokens.access_token);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
  sessionStorage.removeItem(AUTH_NOTICE_KEY);
}

export function clearAuthSession(notice?: string) {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  if (notice) {
    sessionStorage.setItem(AUTH_NOTICE_KEY, notice);
  }
}

export function consumeAuthNotice() {
  const notice = sessionStorage.getItem(AUTH_NOTICE_KEY);
  sessionStorage.removeItem(AUTH_NOTICE_KEY);
  return notice;
}
