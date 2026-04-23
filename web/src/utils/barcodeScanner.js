/**
 * Unified barcode/QR scanner that attaches to a <video> element.
 *
 * Prefers the browser's native `BarcodeDetector` (fast, zero-dep). When not
 * available (Firefox, desktop Chrome/Edge on Windows & Linux today), falls
 * back to `@zxing/browser`, dynamically imported so it ships as a separate
 * chunk that's only downloaded when the scanner is opened on an unsupported
 * browser.
 *
 * Usage:
 *   const controls = await startScanner({
 *     video: videoElement,
 *     onCode: (code) => { controls.stop(); ... },
 *     onError: (message) => { ... },
 *   });
 *   // later: controls.stop();
 */

const NATIVE_FORMATS = [
  "qr_code",
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "code_128",
  "code_39",
  "code_93",
  "codabar",
  "data_matrix",
  "itf",
  "pdf417",
  "aztec",
];

const NATIVE_SCAN_INTERVAL_MS = 300;

function hasNativeBarcodeDetector() {
  return typeof window !== "undefined" && "BarcodeDetector" in window;
}

function hasUserMedia() {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

function cameraErrorMessage(err) {
  const name = err?.name || "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Camera access was blocked. Allow it in your browser settings and try again.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No camera was found on this device.";
  }
  return "We couldn't open the camera. Please try again.";
}

async function startWithNative({ video, onCode, onError }) {
  let detector;
  try {
    const supported = await window.BarcodeDetector.getSupportedFormats();
    const formats = NATIVE_FORMATS.filter((f) => !supported.length || supported.includes(f));
    detector = new window.BarcodeDetector({ formats });
  } catch {
    return null;
  }

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: "environment" } },
    });
  } catch (err) {
    onError(cameraErrorMessage(err));
    return { stop() {} };
  }

  video.srcObject = stream;
  try {
    await video.play();
  } catch {}

  let stopped = false;
  const interval = setInterval(async () => {
    if (stopped || video.readyState < 2) return;
    let results;
    try {
      results = await detector.detect(video);
    } catch {
      return;
    }
    if (!results?.length) return;
    const raw = (results[0].rawValue || "").toString().trim();
    if (raw) onCode(raw);
  }, NATIVE_SCAN_INTERVAL_MS);

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      clearInterval(interval);
      try { stream.getTracks().forEach((t) => t.stop()); } catch {}
      try { if (video.srcObject === stream) video.srcObject = null; } catch {}
    },
  };
}

async function startWithZxing({ video, onCode, onError }) {
  let BrowserMultiFormatReader;
  try {
    ({ BrowserMultiFormatReader } = await import("@zxing/browser"));
  } catch {
    onError("We couldn't load the scanner. Please refresh and try again.");
    return { stop() {} };
  }

  const reader = new BrowserMultiFormatReader();
  let zxingControls = null;
  let stopped = false;

  try {
    zxingControls = await reader.decodeFromVideoDevice(undefined, video, (result) => {
      if (stopped) return;
      if (!result) return;
      const raw = result.getText?.() || result.text || "";
      const trimmed = raw.toString().trim();
      if (trimmed) onCode(trimmed);
    });
  } catch (err) {
    onError(cameraErrorMessage(err));
    return { stop() {} };
  }

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      try { zxingControls?.stop(); } catch {}
      try {
        const stream = video.srcObject;
        if (stream && typeof stream.getTracks === "function") {
          stream.getTracks().forEach((t) => t.stop());
        }
        video.srcObject = null;
      } catch {}
    },
  };
}

export async function startScanner({ video, onCode, onError }) {
  if (!video) {
    onError("Scanner could not initialize.");
    return { stop() {} };
  }
  if (!hasUserMedia()) {
    onError("Camera access isn't available here. Try a different browser or device.");
    return { stop() {} };
  }

  if (hasNativeBarcodeDetector()) {
    const controls = await startWithNative({ video, onCode, onError });
    if (controls) return controls;
  }

  return startWithZxing({ video, onCode, onError });
}
