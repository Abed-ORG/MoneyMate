import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import LoginForm from "../pages/AuthPages";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("RegisterForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderRegister = () => {
    return render(
      <BrowserRouter>
        <LoginForm />
      </BrowserRouter>
    );
  };

  it("renders registration form with required fields", () => {
    renderRegister();
    expect(screen.getByLabelText(/full name/i)).toBeDefined();
    expect(screen.getByLabelText(/email/i)).toBeDefined();
    expect(screen.getByLabelText(/^password$/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /create account/i })).toBeDefined();
  });

  it("renders link to login page", () => {
    renderRegister();
    expect(screen.getByText(/already have an account/i)).toBeDefined();
    expect(screen.getByText(/log in/i)).toBeDefined();
  });

  it("shows validation error for short password", async () => {
    const user = userEvent.setup();
    renderRegister();

    await user.type(screen.getByLabelText(/full name/i), "Test User");
    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "123");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/at least 8 characters/i)).toBeDefined();
    });
  });

  it("shows validation error for invalid email", async () => {
    const user = userEvent.setup();
    renderRegister();

    await user.type(screen.getByLabelText(/full name/i), "Test User");
    await user.type(screen.getByLabelText(/email/i), "invalid-email");
    await user.type(screen.getByLabelText(/^password$/i), "SecurePass123!");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/enter a valid email/i)).toBeDefined();
    });
  });

  it("submits registration with valid data", async () => {
    const user = userEvent.setup();
    renderRegister();

    await user.type(screen.getByLabelText(/full name/i), "Test User");
    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "SecurePass123!");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/creating account/i)).toBeDefined();
    });
  });

  it("navigates to login page when login link is clicked", async () => {
    const user = userEvent.setup();
    renderRegister();

    const loginLink = screen.getByText(/log in/i);
    await user.click(loginLink);

    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });

  it("has accessible form labels", () => {
    renderRegister();

    const fullNameInput = screen.getByLabelText(/full name/i);
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/^password$/i);

    expect(fullNameInput.tagName).toBe("INPUT");
    expect(emailInput.tagName).toBe("INPUT");
    expect(passwordInput.tagName).toBe("INPUT");
  });

  it("password field has correct type", () => {
    renderRegister();

    const passwordInput = screen.getByLabelText(/^password$/i) as HTMLInputElement;
    expect(passwordInput.type).toBe("password");
  });
});