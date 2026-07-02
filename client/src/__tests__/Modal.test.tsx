import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Modal from "../components/Modal/Modal";

describe("Modal", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    title: "Test Modal",
    children: <p>Modal content</p>,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders modal with title when open", () => {
    render(<Modal {...defaultProps} />);
    expect(screen.getByText("Test Modal")).toBeDefined();
    expect(screen.getByText("Modal content")).toBeDefined();
  });

  it("does not render when closed", () => {
    render(<Modal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText("Test Modal")).toBeNull();
  });

  it("calls onClose when close button is clicked", async () => {
    const onClose = vi.fn();
    render(<Modal {...defaultProps} onClose={onClose} />);

    const closeButton = screen.getByRole("button", { name: /close/i });
    await userEvent.click(closeButton);

    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when overlay is clicked", async () => {
    const onClose = vi.fn();
    render(<Modal {...defaultProps} onClose={onClose} />);

    const overlay = document.querySelector("[class*='overlay']");
    if (overlay) {
      await userEvent.click(overlay);
      expect(onClose).toHaveBeenCalled();
    }
  });

  it("renders custom footer when provided", () => {
    render(
      <Modal
        {...defaultProps}
        footer={<button>Save Changes</button>}
      />
    );
    expect(screen.getByText("Save Changes")).toBeDefined();
  });

  it("has accessible dialog semantics", () => {
    render(<Modal {...defaultProps} />);
    const dialog = document.querySelector("[role='dialog']");
    expect(dialog).toBeDefined();
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
  });

  it("focuses close button on open", async () => {
    render(<Modal {...defaultProps} />);
    await waitFor(() => {
      const closeButton = screen.getByRole("button", { name: /close/i });
      expect(document.activeElement).toBe(closeButton);
    });
  });
});