import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import LoginForm from "../pages/AuthPages";

// Mock the auth functions
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    login: vi.fn(),
    isLoading: false,
    error: null,
    isAuthenticated: false,
  }),
}));

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderLogin = () => {
    return render(
      <BrowserRouter>
        <LoginForm />
      </BrowserRouter>
    );
  };

  it("renders login form with email and password fields", () => {
    renderLogin();
    expect(screen.getByLabelText(/email/i)).toBeDefined();
    expect(screen.getByLabelText(/password/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /log in/i })).toBeDefined();
  });

  it("renders link to register page", () => {
    renderLogin();
    expect(screen.getByText(/don't have an account/i)).toBeDefined();
    expect(screen.getByText(/register/i)).toBeDefined();
  });

  it("shows validation errors for empty fields", async () => {
    const user = userEvent.setup();
    renderLogin();

    const submitButton = screen.getByRole("button", { name: /log in/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/email is required/i)).toBeDefined();
    });
  });

  it("submits form with valid credentials", async () => {
    const user = userEvent.setup();
    renderLogin();

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole("button", { name: /log in/i });

    await user.type(emailInput, "test@example.com");
    await user.type(passwordInput, "SecurePass123!");
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/logging in/i)).toBeDefined();
    });
  });

  it("displays error message on login failure", async () => {
    const mockLogin = vi.fn().mockRejectedValue(new Error("Invalid credentials"));
    vi.mocked(await import("../contexts/AuthContext")).useAuth = () => ({
      login: mockLogin,
      isLoading: false,
      error: "Invalid email or password",
      isAuthenticated: false,
    });

    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(screen.getByLabelText(/password/i), "WrongPass1!");
    await user.click(screen.getByRole("button", { name: /log in/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid email or password/i)).toBeDefined();
    });
  });

  it("navigates to register page when register link is clicked", async () => {
    const user = userEvent.setup();
    renderLogin();

    const registerLink = screen.getByText(/register/i);
    await user.click(registerLink);

    expect(mockNavigate).toHaveBeenCalledWith("/register");
  });

  it("has accessible form labels", () => {
    renderLogin();

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);

    expect(emailInput.tagName).toBe("INPUT");
    expect(passwordInput.tagName).toBe("INPUT");
  });

  it("password field has correct type", () => {
    renderLogin();

    const passwordInput = screen.getByLabelText(/password/i) as HTMLInputElement;
    expect(passwordInput.type).toBe("password");
  });
});