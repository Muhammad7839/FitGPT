import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "./AuthProvider";

function AuthProbe() {
  const { isChecking, user } = useAuth();
  return (
    <div>
      <span data-testid="checking">{isChecking ? "checking" : "ready"}</span>
      <span data-testid="user">{user ? "user" : "guest"}</span>
    </div>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    localStorage.clear();
    delete global.fetch;
    jest.resetAllMocks();
  });

  test("does not block public routes on startup when token auth has no stored token", async () => {
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId("checking")).toHaveTextContent("ready"));

    expect(screen.getByTestId("user")).toHaveTextContent("guest");
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
