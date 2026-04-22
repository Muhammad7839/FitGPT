import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ReceiptScannerModal from "./ReceiptScannerModal";
import { scanReceipt } from "../api/receiptOcrApi";

jest.mock("../api/receiptOcrApi", () => ({
  scanReceipt: jest.fn(),
}));

function makeFile() {
  return new File(["dummy"], "receipt.jpg", { type: "image/jpeg" });
}

function selectFile() {
  const input = document.querySelector('input[type="file"]');
  expect(input).toBeTruthy();
  fireEvent.change(input, { target: { files: [makeFile()] } });
}

describe("ReceiptScannerModal", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("renders nothing when closed", () => {
    const { container } = render(
      <ReceiptScannerModal open={false} onClose={() => {}} onResult={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  test("shows the initial pick prompt when open", () => {
    render(<ReceiptScannerModal open onClose={() => {}} onResult={() => {}} />);
    expect(screen.getByText(/scan a receipt/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /choose or take a photo/i })).toBeInTheDocument();
  });

  test("calls onResult with extracted items on success", async () => {
    scanReceipt.mockResolvedValue({
      items: [
        { name: "Black Tee", category: "Top", color: "Black", price: 20 },
        { name: "Jeans", category: "Bottom", color: "Blue", price: 60 },
      ],
      source: "ai",
      warning: null,
    });

    const onResult = jest.fn();
    render(<ReceiptScannerModal open onClose={() => {}} onResult={onResult} />);

    await act(async () => {
      selectFile();
    });

    await waitFor(() => expect(onResult).toHaveBeenCalledTimes(1));
    expect(onResult.mock.calls[0][0].items).toHaveLength(2);
    expect(scanReceipt).toHaveBeenCalledTimes(1);
  });

  test("shows friendly message when no items are found", async () => {
    scanReceipt.mockResolvedValue({ items: [], source: "empty", warning: null });
    render(<ReceiptScannerModal open onClose={() => {}} onResult={() => {}} />);

    await act(async () => {
      selectFile();
    });

    await screen.findByText(/no clothing items found/i);
    expect(screen.getByRole("button", { name: /try another photo/i })).toBeInTheDocument();
  });

  test("shows provider-not-configured message when warning set", async () => {
    scanReceipt.mockResolvedValue({
      items: [],
      source: "unavailable",
      warning: "provider_not_configured",
    });
    render(<ReceiptScannerModal open onClose={() => {}} onResult={() => {}} />);

    await act(async () => {
      selectFile();
    });

    await screen.findByText(/not configured on this server/i);
  });

  test("shows sign-in message on 401", async () => {
    const error = new Error("Unauthorized");
    error.status = 401;
    scanReceipt.mockRejectedValue(error);
    render(<ReceiptScannerModal open onClose={() => {}} onResult={() => {}} />);

    await act(async () => {
      selectFile();
    });

    await screen.findByText(/sign in to scan receipts/i);
  });

  test("shows network message on offline backend", async () => {
    const error = new Error("Network error");
    error.isNetwork = true;
    scanReceipt.mockRejectedValue(error);
    render(<ReceiptScannerModal open onClose={() => {}} onResult={() => {}} />);

    await act(async () => {
      selectFile();
    });

    await screen.findByText(/network error/i);
  });

  test("shows timeout message when request times out", async () => {
    const error = new Error("timeout");
    error.isTimeout = true;
    scanReceipt.mockRejectedValue(error);
    render(<ReceiptScannerModal open onClose={() => {}} onResult={() => {}} />);

    await act(async () => {
      selectFile();
    });

    await screen.findByText(/scan took too long/i);
  });
});
