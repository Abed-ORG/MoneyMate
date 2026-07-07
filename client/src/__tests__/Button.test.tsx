import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Button from "../components/Button/Button";

describe("Button", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders button with text", () => {
    render(<Button>Click Me</Button>);
    expect(screen.getByRole("button", { name: /click me/i })).toBeDefined();
  });

  it("calls onClick when clicked", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click Me</Button>);

    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not call onClick when disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Click Me
      </Button>
    );

    await userEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("applies primary variant styles", () => {
    const { container } = render(<Button variant="primary">Submit</Button>);
    const button = container.querySelector("button");
    expect(button?.className).toContain("primary");
  });

  it("applies secondary variant styles", () => {
    const { container } = render(<Button variant="secondary">Cancel</Button>);
    const button = container.querySelector("button");
    expect(button?.className).toContain("secondary");
  });

  it("applies danger variant styles", () => {
    const { container } = render(<Button variant="danger">Delete</Button>);
    const button = container.querySelector("button");
    expect(button?.className).toContain("danger");
  });

  it("disables button when disabled prop is true", () => {
    const { container } = render(<Button disabled>Disabled</Button>);
    const button = container.querySelector("button");
    expect(button?.hasAttribute("disabled")).toBe(true);
  });

  it("supports custom class names", () => {
    const { container } = render(<Button className="custom-class">Custom</Button>);
    const button = container.querySelector(".custom-class");
    expect(button).toBeDefined();
  });

  it("supports loading state text", () => {
    render(<Button loading>Loading</Button>);
    expect(screen.getByText(/loading/i)).toBeDefined();
  });

  it("supports aria-label for accessibility", () => {
    render(<Button aria-label="Close dialog">X</Button>);
    expect(screen.getByLabelText("Close dialog")).toBeDefined();
  });
});