import { clearAuthSession, getAuthToken } from "../utils/auth";

type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: BodyInit | Record<string, unknown> | null;
};

export type ApiError = {
  status: number;
  message: string;
  details?: unknown;
};

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ??
  import.meta.env.VITE_API_URL ??
  ""
).replace(/\/$/, "");

function normalizeError(status: number, fallback: string, details?: unknown): ApiError {
  if (status >= 500) {
    return {
      status,
      message: "MoneyMate is having trouble right now. Please try again soon.",
      details,
    };
  }

  return {
    status,
    message: fallback,
    details,
  };
}

function getResponseMessage(data: unknown) {
  if (!data || typeof data !== "object") {
    return null;
  }

  const record = data as Record<string, unknown>;
  const detail = record["detail"];

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }
        const msg = (item as Record<string, unknown>)["msg"];
        return msg != null ? String(msg) : null;
      })
      .filter((value): value is string => Boolean(value));

    return messages.length ? messages.join(" ") : null;
  }

  const message = record["message"];
  if (typeof message === "string") {
    return message;
  }

  return null;
}

async function parseResponse(response: Response) {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type");

  if (contentType?.includes("application/json")) {
    return response.json();
  }

  return response.text();
}

function isJsonBody(body: ApiRequestOptions["body"]): body is Record<string, unknown> {
  return Boolean(
    body &&
      typeof body === "object" &&
      body.constructor === Object &&
      !(body instanceof FormData),
  );
}

export async function apiRequest<T>(
  endpoint: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers);

  if (!headers.has("Content-Type") && isJsonBody(options.body)) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const body = isJsonBody(options.body) ? JSON.stringify(options.body) : options.body;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
      body,
    });
  } catch (error) {
    throw {
      status: 0,
      message:
        import.meta.env.PROD && !API_BASE_URL
          ? "MoneyMate is not configured with a production API URL. Set VITE_API_URL in Vercel to your Render backend."
          : `Could not reach the MoneyMate API at ${API_BASE_URL}. Check that the backend is running and that the URL is correct.`,
      details: error,
    } satisfies ApiError;
  }

  const data = await parseResponse(response);

  if (!response.ok) {
    const error = normalizeError(
      response.status,
      getResponseMessage(data) ?? "Something went wrong while contacting MoneyMate.",
      data,
    );

    if (response.status === 401) {
      const message =
        getResponseMessage(data) ?? "Your session has expired. Please log in again.";
      clearAuthSession(message);
      window.dispatchEvent(new CustomEvent("moneymate:unauthorized"));
      const publicPaths = [
        "/",
        "/login",
        "/register",
        "/forgot-password",
        "/reset-password",
      ];
      if (!publicPaths.includes(window.location.pathname)) {
        window.location.assign("/login");
      }
    }

    throw error;
  }

  return data as T;
}

export const api = {
  get: <T>(endpoint: string, options?: ApiRequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: "GET" }),
  post: <T>(endpoint: string, body?: ApiRequestOptions["body"], options?: ApiRequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: "POST", body }),
  put: <T>(endpoint: string, body?: ApiRequestOptions["body"], options?: ApiRequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: "PUT", body }),
  patch: <T>(endpoint: string, body?: ApiRequestOptions["body"], options?: ApiRequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: "PATCH", body }),
  delete: <T>(endpoint: string, options?: ApiRequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: "DELETE" }),
};

export function getApiErrorMessage(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return "Something went wrong. Please try again.";
}
