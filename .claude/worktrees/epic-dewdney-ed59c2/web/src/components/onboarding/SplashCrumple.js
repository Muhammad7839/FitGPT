import { useRef, useEffect, useCallback } from "react";

const GRID = 18;
const CRUMPLE_MS = 750;
const HOLD_MS = 120;
const DROP_MS = 450;
const CRUMPLE_TOTAL = CRUMPLE_MS + HOLD_MS + DROP_MS;
const AUTO_DISMISS_MS = 2500;

/* ── Easing ────────────────────────────────────────────── */

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function easeInBack(t) {
  const c1 = 1.1;
  const c3 = c1 + 1;
  return c3 * t * t * t - c1 * t * t;
}

function easeInCubic(t) {
  return t * t * t;
}

/* ── Mesh helpers ──────────────────────────────────────── */

function drawTexturedTri(ctx, tex, p0, p1, p2) {
  const { x: x0, y: y0, u: u0, v: v0 } = p0;
  const { x: x1, y: y1, u: u1, v: v1 } = p1;
  const { x: x2, y: y2, u: u2, v: v2 } = p2;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.closePath();
  ctx.clip();

  const denom = u0 * (v1 - v2) + u1 * (v2 - v0) + u2 * (v0 - v1);
  if (Math.abs(denom) < 0.001) {
    ctx.restore();
    return;
  }

  const a = (x0 * (v1 - v2) + x1 * (v2 - v0) + x2 * (v0 - v1)) / denom;
  const b = (x0 * (u2 - u1) + x1 * (u0 - u2) + x2 * (u1 - u0)) / denom;
  const cc =
    (x0 * (u1 * v2 - u2 * v1) +
      x1 * (u2 * v0 - u0 * v2) +
      x2 * (u0 * v1 - u1 * v0)) /
    denom;
  const d = (y0 * (v1 - v2) + y1 * (v2 - v0) + y2 * (v0 - v1)) / denom;
  const e = (y0 * (u2 - u1) + y1 * (u0 - u2) + y2 * (u1 - u0)) / denom;
  const f =
    (y0 * (u1 * v2 - u2 * v1) +
      y1 * (u2 * v0 - u0 * v2) +
      y2 * (u0 * v1 - u1 * v0)) /
    denom;

  ctx.setTransform(a, d, b, e, cc, f);
  ctx.drawImage(tex, 0, 0);
  ctx.restore();
}

function initNoise() {
  const rows = GRID + 1;
  const cols = GRID + 1;
  const noise = [];
  for (let i = 0; i < rows * cols; i++) {
    const angle = Math.random() * Math.PI * 2;
    const force = 0.3 + Math.random() * 0.8;
    noise.push({
      dx: Math.cos(angle) * force,
      dy: Math.sin(angle) * force,
      delay: Math.random() * 0.2,
      speed: 0.75 + Math.random() * 0.45,
    });
  }
  return noise;
}

function initCreases() {
  const creases = [];
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      if (Math.random() < 0.45) {
        creases.push({
          r,
          c,
          width: 0.5 + Math.random() * 2,
          alpha: 0.15 + Math.random() * 0.45,
          threshold: 0.08 + Math.random() * 0.35,
        });
      }
    }
  }
  return creases;
}

/* ── Layout helper ─────────────────────────────────────── */

function computeLayout(W, H, dpr) {
  const cx = W / 2;
  const cy = H / 2;
  const logoSize = 120 * dpr;
  const titleSize = 42 * dpr;
  const subSize = 16 * dpr;
  const skipSize = 13 * dpr;
  const gap = 6 * dpr;
  const titleLineH = Math.round(titleSize * 1.2);
  const subLineH = Math.round(subSize * 1.2);
  const contentH = logoSize + gap + titleLineH + gap + subLineH;
  const top = cy - contentH / 2;
  const titleTop = top + logoSize + gap;
  const titleHalfLead = (titleLineH - titleSize) / 2;
  const subTop = titleTop + titleLineH + gap;
  const subHalfLead = (subLineH - subSize) / 2;

  return {
    cx,
    cy,
    logoSize,
    titleSize,
    subSize,
    skipSize,
    gap,
    top,
    titleY: titleTop + titleHalfLead,
    subY: subTop + subHalfLead,
    skipY: H - 48 * dpr,
  };
}

/* ── Drawing ───────────────────────────────────────────── */

function drawBackground(ctx, W, H) {
  const cx = W / 2;
  const cy = H / 2;
  const angle = ((160 - 90) * Math.PI) / 180;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const grad = ctx.createLinearGradient(
    cx - dx * W * 0.6,
    cy - dy * H * 0.6,
    cx + dx * W * 0.6,
    cy + dy * H * 0.6
  );
  grad.addColorStop(0, "#1a0a0a");
  grad.addColorStop(0.4, "#2a1010");
  grad.addColorStop(1, "#0e0e12");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

/** Draw the splash with entry animations based on elapsed time */
function drawIntroFrame(ctx, W, H, layout, logoImg, elapsed) {
  const { cx, logoSize, titleSize, subSize, top, titleY, subY } = layout;

  drawBackground(ctx, W, H);

  // Logo: scale 0.6→1, fade in, 0–600ms
  const logoT = Math.min(1, Math.max(0, elapsed / 600));
  const logoE = easeOutCubic(logoT);
  if (logoE > 0.01 && logoImg && logoImg.complete && logoImg.naturalWidth > 0) {
    ctx.save();
    ctx.globalAlpha = logoE;
    const s = logoSize * (0.6 + 0.4 * logoE);
    ctx.drawImage(logoImg, cx - s / 2, top + (logoSize - s) / 2, s, s);
    ctx.restore();
  }

  // Title: slide up + fade, 500–1100ms
  const titleT = Math.min(1, Math.max(0, (elapsed - 500) / 600));
  const titleE = easeOutCubic(titleT);
  if (titleE > 0.01) {
    ctx.save();
    ctx.globalAlpha = titleE;
    ctx.font = `900 ${titleSize}px 'Segoe UI', 'Arial Black', sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#fff";
    ctx.fillText("FitGPT", cx, titleY + 12 * (1 - titleE));
    ctx.restore();
  }

  // Subtitle: slide up + fade, 900–1500ms
  const subT = Math.min(1, Math.max(0, (elapsed - 900) / 600));
  const subE = easeOutCubic(subT);
  if (subE > 0.01) {
    ctx.save();
    ctx.globalAlpha = subE;
    ctx.font = `500 ${subSize}px 'Segoe UI', sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
    ctx.fillText("Your AI outfit assistant", cx, subY + 12 * (1 - subE));
    ctx.restore();
  }

}

/** Render the fully-visible splash to an offscreen buffer (crumple texture) */
function renderFullSplash(buf, W, H, layout, logoImg) {
  buf.width = W;
  buf.height = H;
  const ctx = buf.getContext("2d");
  const { cx, logoSize, titleSize, subSize, top, titleY, subY } = layout;

  drawBackground(ctx, W, H);

  if (logoImg && logoImg.complete && logoImg.naturalWidth > 0) {
    ctx.drawImage(logoImg, cx - logoSize / 2, top, logoSize, logoSize);
  }

  ctx.font = `900 ${titleSize}px 'Segoe UI', 'Arial Black', sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#fff";
  ctx.fillText("FitGPT", cx, titleY);

  ctx.font = `500 ${subSize}px 'Segoe UI', sans-serif`;
  ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
  ctx.fillText("Your AI outfit assistant", cx, subY);

}

/* ── Component ─────────────────────────────────────────── */

/**
 * Full-lifecycle splash: canvas entry animations → idle → mesh crumple → done.
 * One canvas the whole time, no DOM-to-canvas swap.
 */
export default function SplashCrumple({ onComplete }) {
  const canvasRef = useRef(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const phaseRef = useRef("intro"); // 'intro' | 'crumple'
  const crumpleStartRef = useRef(0);

  const handleClick = useCallback(() => {
    if (phaseRef.current === "intro") {
      phaseRef.current = "crumple";
      crumpleStartRef.current = performance.now();
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const W = Math.round(window.innerWidth * dpr);
    const H = Math.round(window.innerHeight * dpr);
    canvas.width = W;
    canvas.height = H;

    const layout = computeLayout(W, H, dpr);
    let animId;

    const logo = new Image();
    logo.src = "/officialLogo.png";

    const run = () => {
      // Pre-render full splash for crumple texture
      const buf = document.createElement("canvas");
      renderFullSplash(buf, W, H, layout, logo);

      const noise = initNoise();
      const creases = initCreases();
      const cols = GRID + 1;
      const cellW = W / GRID;
      const cellH = H / GRID;
      const { cx, cy } = layout;
      const ctx = canvas.getContext("2d");

      // Pre-allocate points
      const points = new Array((GRID + 1) * (GRID + 1));
      for (let i = 0; i < points.length; i++) {
        points[i] = { x: 0, y: 0, u: 0, v: 0 };
      }

      const start = performance.now();

      // Auto-dismiss timer
      const autoId = setTimeout(() => {
        if (phaseRef.current === "intro") {
          phaseRef.current = "crumple";
          crumpleStartRef.current = performance.now();
        }
      }, AUTO_DISMISS_MS);

      const animate = (now) => {
        ctx.clearRect(0, 0, W, H);

        /* ── Intro phase: entry animations ── */
        if (phaseRef.current === "intro") {
          drawIntroFrame(ctx, W, H, layout, logo, now - start);
          animId = requestAnimationFrame(animate);
          return;
        }

        /* ── Crumple phase ── */
        const elapsed = now - crumpleStartRef.current;

        // Dark background that fades out to reveal onboarding underneath
        const bgFadeT = Math.min(1, elapsed / (CRUMPLE_MS * 0.7));
        const bgAlpha = 1 - easeOutCubic(bgFadeT);
        if (bgAlpha > 0.005) {
          ctx.fillStyle = `rgba(14, 14, 18, ${bgAlpha})`;
          ctx.fillRect(0, 0, W, H);
        }

        let crumpleAmt, dropOffset, rotSpin;
        if (elapsed < CRUMPLE_MS) {
          crumpleAmt = elapsed / CRUMPLE_MS;
          dropOffset = 0;
          rotSpin = 0;
        } else if (elapsed < CRUMPLE_MS + HOLD_MS) {
          crumpleAmt = 1;
          dropOffset = 0;
          rotSpin = 0;
        } else {
          crumpleAmt = 1;
          const dropT = (elapsed - CRUMPLE_MS - HOLD_MS) / DROP_MS;
          const eased = easeInCubic(Math.min(dropT, 1));
          dropOffset = eased * H * 1.5;
          rotSpin = eased * 0.8;
        }

        const globalScale = 1 - crumpleAmt * 0.88;
        const rotation = crumpleAmt * 0.2 + rotSpin;
        const cosR = Math.cos(rotation);
        const sinR = Math.sin(rotation);

        for (let r = 0; r < GRID + 1; r++) {
          for (let c = 0; c < GRID + 1; c++) {
            const idx = r * cols + c;
            const n = noise[idx];
            const baseX = c * cellW;
            const baseY = r * cellH;

            const t = Math.max(
              0,
              Math.min(1, ((crumpleAmt - n.delay) / (1 - n.delay)) * n.speed)
            );
            const ease = easeInBack(Math.min(t, 1));

            const relX = baseX - cx;
            const relY = baseY - cy;
            const scaledX = (relX * cosR - relY * sinR) * globalScale;
            const scaledY = (relX * sinR + relY * cosR) * globalScale;
            const crumpleForce = ease * 55;

            const p = points[idx];
            p.x = cx + scaledX * (1 - ease * 0.92) + n.dx * crumpleForce;
            p.y =
              cy +
              scaledY * (1 - ease * 0.92) +
              n.dy * crumpleForce +
              dropOffset;
            p.u = baseX;
            p.v = baseY;
          }
        }

        for (let r = 0; r < GRID; r++) {
          for (let c = 0; c < GRID; c++) {
            const i00 = r * cols + c;
            const i10 = r * cols + c + 1;
            const i01 = (r + 1) * cols + c;
            const i11 = (r + 1) * cols + c + 1;
            drawTexturedTri(ctx, buf, points[i00], points[i10], points[i01]);
            drawTexturedTri(ctx, buf, points[i10], points[i11], points[i01]);
          }
        }

        // Crease lines
        if (crumpleAmt > 0.08) {
          const fadeBase = Math.min(1, (crumpleAmt - 0.08) / 0.5);
          for (let i = 0; i < creases.length; i++) {
            const cr = creases[i];
            if (crumpleAmt < cr.threshold) continue;
            const fade =
              fadeBase * Math.min(1, (crumpleAmt - cr.threshold) / 0.2);
            const p1 = points[cr.r * cols + cr.c];
            const p2 = points[(cr.r + 1) * cols + cr.c + 1];
            ctx.strokeStyle = `rgba(0,0,0,${fade * cr.alpha})`;
            ctx.lineWidth = cr.width;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }

        if (elapsed < CRUMPLE_TOTAL) {
          animId = requestAnimationFrame(animate);
        } else {
          if (onCompleteRef.current) onCompleteRef.current();
        }
      };

      animId = requestAnimationFrame(animate);

      return () => clearTimeout(autoId);
    };

    let cleanupTimer;
    if (logo.complete) {
      cleanupTimer = run();
    } else {
      logo.onload = () => {
        cleanupTimer = run();
      };
      logo.onerror = () => {
        cleanupTimer = run();
      };
    }

    return () => {
      cancelAnimationFrame(animId);
      if (cleanupTimer) cleanupTimer();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 9999,
        cursor: "pointer",
        background: "#0e0e12",
      }}
    />
  );
}
