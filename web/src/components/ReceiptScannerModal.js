import React, { useCallback, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { scanReceipt } from "../api/receiptOcrApi";

const MODAL_TITLE_ID = "receipt-scanner-title";

function ReceiptScannerModal({ open, onClose, onResult }) {
  const fileInputRef = useRef(null);
  const [phase, setPhase] = useState("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const reset = useCallback(() => {
    setPhase("idle");
    setErrorMessage("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleFile = useCallback(
    async (file) => {
      if (!file) return;
      setErrorMessage("");
      setPhase("uploading");
      try {
        const data = await scanReceipt(file);
        const items = Array.isArray(data?.items) ? data.items : [];
        if (!items.length) {
          const warning = data?.warning;
          if (warning === "provider_not_configured") {
            setErrorMessage("Receipt scanning is not configured on this server.");
          } else if (warning === "unsupported_mime") {
            setErrorMessage("That image format is not supported. Try JPEG or PNG.");
          } else if (warning === "provider_error" || warning === "malformed_response") {
            setErrorMessage("Couldn't read this receipt. Try a clearer photo.");
          } else {
            setErrorMessage("No clothing items found on this receipt.");
          }
          setPhase("empty");
          return;
        }
        onResult({ items });
        reset();
      } catch (err) {
        if (err?.status === 401) {
          setErrorMessage("Sign in to scan receipts.");
        } else if (err?.isNetwork) {
          setErrorMessage("Network error — backend is offline.");
        } else if (err?.isTimeout) {
          setErrorMessage("The scan took too long. Try a smaller image.");
        } else {
          setErrorMessage(err?.message || "Upload failed. Please try again.");
        }
        setPhase("error");
      }
    },
    [onResult, reset]
  );

  if (!open) return null;

  const onPick = (event) => {
    const file = event.target.files?.[0];
    handleFile(file);
  };

  const triggerPicker = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const content = (
    <div className="modalOverlay" role="dialog" aria-modal="true" aria-labelledby={MODAL_TITLE_ID}>
      <div className="modalCard" style={{ width: "min(480px, 96vw)" }}>
        <div id={MODAL_TITLE_ID} className="modalTitle">Scan a receipt</div>
        <div className="modalSub">
          Snap or upload a clothing receipt. We'll read the line items and let you review before adding.
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          onChange={onPick}
          style={{ display: "none" }}
        />

        <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
          {phase === "idle" ? (
            <button type="button" className="btnPrimary" onClick={triggerPicker}>
              Choose or take a photo
            </button>
          ) : null}

          {phase === "uploading" ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ fontSize: "0.95rem" }}>Reading receipt...</div>
              <div style={{ fontSize: "0.8rem", opacity: 0.7, marginTop: 6 }}>
                This can take up to 30 seconds.
              </div>
            </div>
          ) : null}

          {(phase === "empty" || phase === "error") && errorMessage ? (
            <div className="wardrobeFormError" role="alert">{errorMessage}</div>
          ) : null}

          {phase === "empty" || phase === "error" ? (
            <button type="button" className="btnSecondary" onClick={triggerPicker}>
              Try another photo
            </button>
          ) : null}
        </div>

        <div className="modalActions">
          <button type="button" className="btnSecondary" onClick={handleClose} disabled={phase === "uploading"}>
            {phase === "uploading" ? "Please wait..." : "Cancel"}
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
}

export default ReceiptScannerModal;
