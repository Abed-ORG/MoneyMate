import { clearAuthToken, getAuthToken } from "../utils/auth";

type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: BodyInit | Record<string, unknown> | null;
};

export type ApiError = {
  status: number;
  message: string;
  details?: unknown;
};

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "";

function normalizeError(status: number, fallback: string, details?: unknown): ApiError {
  if (status === 401) {
    return {
      status,
      message: "Your session has expired. Please log in again.",
      details,
    };
  }

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

async function parseResponse(response: Response) {
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

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
    body,
  });

  const data = await parseResponse(response);

  if (!response.ok) {
    const error = normalizeError(
      response.status,
      typeof data === "object" && data && "message" in data
        ? String(data.message)
        : "Something went wrong while contacting MoneyMate.",
      data,
    );

    if (response.status === 401) {
      clearAuthToken();
      window.location.assign("/login");
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
  delete: <T>(endpoint: string, options?: ApiRequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: "DELETE" }),
};
