import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Signup from "./Signup";
import { registerWithEmail, loginWithEmail } from "../api/authApi";
import { MemoryRouter } from "react-router-dom";

const mockNavigate = jest.fn();
const mockSetUser = jest.fn();

jest.mock("react-router-dom", () => {
  return {
    MemoryRouter: ({ children }) => <>{children}</>,
    NavLink: ({ children, to, className }) => (
      <a href={to} className={className}>
        {children}
      </a>
    ),
    useNavigate: () => mockNavigate,
  };
}, { virtual: true });

jest.mock("../api/authApi", () => ({
  registerWithEmail: jest.fn(),
  loginWithEmail: jest.fn(),
  getMe: jest.fn(),
}));

jest.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({ setUser: mockSetUser }),
}));

jest.mock("../utils/userStorage", () => ({
  migrateGuestData: jest.fn(),
  clearGuestData: jest.fn(),
}));

jest.mock("./GoogleSignInButton", () => function GoogleSignInButton() {
  return <div>Google Sign-In</div>;
});

function fillForm() {
  fireEvent.change(screen.getByPlaceholderText("Enter your full name"), {
    target: { value: "Fit GPT" },
  });
  fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
    target: { value: "fitgpt@example.com" },
  });
  fireEvent.change(screen.getByPlaceholderText("Min 8 characters"), {
    target: { value: "Testpass9x" },
  });
  fireEvent.change(screen.getByPlaceholderText("Re-enter password"), {
    target: { value: "Testpass9x" },
  });
}

describe("Signup", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockSetUser.mockReset();
    registerWithEmail.mockReset();
    loginWithEmail.mockReset();
  });

  test("shows a clear error when the email is already registered and does not try to log in", async () => {
    registerWithEmail.mockRejectedValue({
      status: 400,
      message: "Email already registered",
    });

    render(
      <MemoryRouter>
        <Signup />
      </MemoryRouter>
    );

    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText(
      "An account with this email already exists. Sign in or reset your password instead."
    )).toBeInTheDocument();
    expect(loginWithEmail).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test("logs in after a successful registration", async () => {
    registerWithEmail.mockResolvedValue({ id: 1, email: "fitgpt@example.com" });
    loginWithEmail.mockResolvedValue({ token: "jwt-token" });

    render(
      <MemoryRouter>
        <Signup />
      </MemoryRouter>
    );

    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => expect(registerWithEmail).toHaveBeenCalledWith("fitgpt@example.com", "Testpass9x"));
    await waitFor(() => expect(loginWithEmail).toHaveBeenCalledWith("fitgpt@example.com", "Testpass9x"));
  });
});
