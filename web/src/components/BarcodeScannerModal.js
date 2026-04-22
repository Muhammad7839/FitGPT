import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { startScanner } from "../utils/barcodeScanner";
import { lookupProduct } from "../api/productLookupApi";

const MODAL_TITLE_ID = "barcode-scanner-title";

function BarcodeScannerModal({ open, onClose, onResult }) {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const isMountedRef = useRef(true);
  const detectedRef = useRef(false);

  const [phase, setPhase] = useState("requesting");
  const [errorMessage, setErrorMessage] = useState("");
  const [detectedCode, setDetectedCode] = useState("");

  const cleanup = useCallback(() => {
    const controls = controlsRef.current;
    controlsRef.current = null;
    if (controls?.stop) {
      try { controls.stop(); } catch {}
    }
  }, []);

  const finishWithResult = useCallback(
    async (code) => {
      if (detectedRef.current) return;
      detectedRef.current = true;
      cleanup();
      setDetectedCode(code);
      setPhase("resolving");
      const lookup = await lookupProduct(code);
      if (!isMountedRef.current) return;
      onResult({
        code,
        name: lookup?.name || "",
        imageUrl: lookup?.image_url || "",
        description: lookup?.description || "",
        source: lookup?.source || "raw",
      });
    },
    [cleanup, onResult]
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, [cleanup]);

  useEffect(() => {
    if (!open) {
      cleanup();
      return undefined;
    }

    let cancelled = false;
    setErrorMessage("");
    setDetectedCode("");
    setPhase("requesting");
    detectedRef.current = false;

    const startup = async () => {
      const video = videoRef.current;
      if (!video) return;
      const controls = await startScanner({
        video,
        onCode: (code) => {
          if (cancelled) return;
          finishWithResult(code);
        },
        onError: (message) => {
          if (cancelled) return;
          setErrorMessage(message);
          setPhase("error");
        },
      });
      if (cancelled) {
        try { controls?.stop?.(); } catch {}
        return;
      }
      controlsRef.current = controls;
      if (!detectedRef.current) setPhase("scanning");
    };

    startup();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [open, cleanup, finishWithResult]);

  if (!open) return null;

  const handleClose = () => {
    cleanup();
    onClose();
  };

  const content = (
    <div className="modalOverlay" role="dialog" aria-modal="true" aria-labelledby={MODAL_TITLE_ID}>
      <div className="modalCard" style={{ width: "min(520px, 96vw)" }}>
        <div id={MODAL_TITLE_ID} className="modalTitle">Scan a tag</div>
        <div className="modalSub">
          Point the camera at the barcode or QR code on a clothing tag or receipt.
        </div>

        <div
          style={{
            position: "relative",
            marginTop: 12,
            borderRadius: 12,
            overflow: "hidden",
            background: "#000",
            aspectRatio: "4 / 3",
          }}
        >
          <video
            ref={videoRef}
            playsInline
            muted
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              display: "grid",
              placeItems: "center",
            }}
          >
            <div
              style={{
                width: "70%",
                aspectRatio: "4 / 1",
                border: "2px solid rgba(255,255,255,0.85)",
                borderRadius: 10,
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.35)",
              }}
            />
          </div>
        </div>

        <div style={{ marginTop: 10, fontSize: "0.9rem", minHeight: 24 }}>
          {phase === "requesting" && "Requesting camera access..."}
          {phase === "scanning" && "Scanning... hold steady and align the code inside the frame."}
          {phase === "resolving" && `Looking up ${detectedCode.slice(0, 60)}...`}
          {phase === "error" && (
            <span className="wardrobeFormError" role="alert">{errorMessage}</span>
          )}
        </div>

        <div className="modalActions">
          <button type="button" className="btnSecondary" onClick={handleClose}>
            {phase === "resolving" ? "Cancel lookup" : "Cancel"}
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
}

export default BarcodeScannerModal;
