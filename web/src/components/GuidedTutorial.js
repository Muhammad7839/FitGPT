// web/src/components/GuidedTutorial.js
import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { useNavigate, useLocation } from "react-router-dom";

import { markTutorialDone } from "../utils/userStorage";

/*
  Step types:
    "spotlight" — highlights a DOM element, user clicks Next to advance
    "navigate"  — highlights a nav link, user clicks it (or Next) to navigate and advance
    "done"      — centered completion card
*/
const TUTORIAL_STEPS = [
  // ── Dashboard ──
  {
    type: "spotlight",
    route: "/dashboard",
    selector: ".topNavInner",
    title: "Welcome to FitGPT!",
    description:
      "This is your navigation bar. Use these tabs to jump between your Dashboard, Wardrobe, Favorites, Insights, Saved Outfits, Plans, and Profile — everything you need is one tap away.",
  },
  {
    type: "spotlight",
    route: "/dashboard",
    selector: ".dashWeatherCard",
    title: "Weather Detection",
    description:
      "We detect your local weather automatically so your outfit picks always match the forecast.",
  },
  {
    type: "spotlight",
    route: "/dashboard",
    selector: ".topNavRight .themePicker",
    title: "Themes & Dark Mode",
    description:
      "Switch between Light, Dark, and other preset themes — or create your own custom theme with your favorite colors. Tap the theme pill in the top bar anytime to change your look.",
  },
  {
    type: "spotlight",
    route: "/dashboard",
    selector: ".dashQuickRow",
    title: "Quick Actions",
    description:
      "Add a new wardrobe item, plan an outfit, or jump to your history — all from these shortcuts.",
  },
  {
    type: "spotlight",
    route: "/dashboard",
    selector: ".dashRecCard",
    title: "Your Daily Outfits",
    description:
      "AI-powered outfit recommendations based on your style, the weather, and time of day. Click an option to see why it was picked, and save the ones you love!",
  },
  // ── Navigate to Wardrobe ──
  {
    type: "navigate",
    route: "/dashboard",
    navHref: "/wardrobe",
    title: "Let's Build Your Closet",
    description: "Click the Wardrobe tab to start adding your clothes.",
  },
  // ── Wardrobe page ──
  {
    type: "spotlight",
    route: "/wardrobe",
    selector: ".wardrobeUploadCard",
    title: "Upload Your Clothes",
    description:
      "Drag and drop photos here or click to browse. Add your tops, bottoms, shoes, accessories — everything you wear! The more items you add, the better your recommendations get.",
  },
  {
    type: "spotlight",
    route: "/wardrobe",
    selector: ".wardrobeTabs",
    title: "Active & Archived",
    description:
      "Switch between Active items (in rotation) and Archived items (stored away). Keep your closet organized by season or preference.",
  },
  {
    type: "spotlight",
    route: "/wardrobe",
    selector: ".wardrobeControls",
    title: "Search & Filter",
    description:
      "Search by name, filter by color or material, and toggle Body Type Fit to see how items complement your body shape.",
  },
  // ── Navigate to Favorites ──
  {
    type: "navigate",
    route: "/wardrobe",
    navHref: "/favorites",
    title: "Check Out Favorites",
    description: "Click Favorites to see how saved items work.",
  },
  // ── Favorites page ──
  {
    type: "spotlight",
    route: "/favorites",
    selector: ".wardrobeGrid",
    title: "Your Favorite Pieces",
    description:
      "This is where your favorited items live. Tap the heart icon on any wardrobe item to add it here for quick access when building outfits.",
  },
  // ── Navigate to Insights ──
  {
    type: "navigate",
    route: "/favorites",
    navHref: "/history",
    navLabel: "Insights",
    title: "See Your Insights",
    description: "Click Insights to track what you've worn.",
  },
  // ── Insights page: History tab ──
  {
    type: "spotlight",
    route: "/history",
    navigateTo: "/history",
    selector: ".historyStatsCard",
    title: "Outfit History",
    description:
      "Every outfit you wear gets logged here. Track what you've worn, when you wore it, and build a personal style timeline.",
  },
  // ── Insights page: Analytics tab ──
  {
    type: "spotlight",
    route: "/history",
    navigateTo: "/history?tab=analytics",
    selector: ".historyStatsCard",
    title: "Style Analytics",
    description:
      "Dive into your style stats — see wear frequency, color distribution, category breakdowns, and pattern insights all at a glance.",
  },
  // ── Navigate to Saved ──
  {
    type: "navigate",
    route: "/history",
    navHref: "/saved-outfits",
    title: "View Saved Outfits",
    description: "Click Saved to see your saved outfit combos.",
  },
  // ── Saved Outfits page ──
  {
    type: "spotlight",
    route: "/saved-outfits",
    selector: ".historyList",
    title: "Saved Outfits",
    description:
      "Outfit combos you save from the home page appear here. Hit \"Wear Again\" to log them to your history, or \"Plan for Later\" to schedule them for an upcoming event.",
  },
  // ── Navigate to Plans ──
  {
    type: "navigate",
    route: "/saved-outfits",
    navHref: "/plans",
    title: "Plan Ahead",
    description: "Click Plans to schedule outfits for upcoming events.",
  },
  // ── Plans page ──
  {
    type: "spotlight",
    route: "/plans",
    selector: ".profileEmpty, .plannedSection",
    title: "Outfit Plans",
    description:
      "Schedule outfits for dates, events, or trips ahead of time. Your upcoming and past plans will be organized right here so you're always prepared.",
  },
  // ── Navigate to Profile ──
  {
    type: "navigate",
    route: "/plans",
    navHref: "/profile",
    title: "Your Profile",
    description: "Click Profile to manage your account and preferences.",
  },
  // ── Profile: Sign-in card ──
  {
    type: "spotlight",
    route: "/profile",
    selector: ".profileSignInCard",
    title: "Sign In & Sync",
    description:
      "Create an account or sign in to save your wardrobe across devices, sync outfit history, and unlock your full profile.",
  },
  // ── Profile page ──
  {
    type: "spotlight",
    route: "/profile",
    selector: ".profileSection",
    title: "Style Preferences",
    description:
      "Tap the pills to set your style, comfort level, what you dress for, and body type. These preferences shape every outfit recommendation you get.",
  },
  // ── Done ──
  {
    type: "done",
    route: "/profile",
    title: "You're All Set!",
    description:
      "Head back to your Wardrobe to upload your first items, then come Home for personalized outfit picks. Enjoy!",
  },
];

const PAD = 8;

function queryTarget(selector) {
  if (!selector) return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  // Center the element so there's room for the tooltip above or below
  el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
  return el;
}

function getRect(el) {
  if (!el) return null;
  return el.getBoundingClientRect();
}

export default function GuidedTutorial({ show, onDismiss }) {
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const tooltipRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  const current = TUTORIAL_STEPS[step];
  const isFinal = current.type === "done";
  const isNav = current.type === "navigate";

  // Navigate when a step has navigateTo (e.g. switching tabs)
  useEffect(() => {
    if (!show || !current.navigateTo) return;
    navigate(current.navigateTo);
  }, [show, step]); // eslint-disable-line react-hooks/exhaustive-deps

  // Measure the target element
  const measure = useCallback(() => {
    if (!show) return;
    const sel = current.type === "navigate"
      ? `.topNavLinks a[href="${current.navHref}"]`
      : current.selector;
    // Delay slightly to let page render
    const id = setTimeout(() => {
      const el = queryTarget(sel);
      setTargetRect(getRect(el));
    }, current.navigateTo ? 300 : 120);
    return () => clearTimeout(id);
  }, [show, current, step]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!show) return;
    const cleanup = measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      if (cleanup) cleanup();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [show, measure]);

  // When location changes, check if we're on the expected route for a navigate step
  useEffect(() => {
    if (!show || current.type !== "navigate") return;
    if (location.pathname === current.navHref) {
      // User navigated — advance to next step
      setStep((s) => s + 1);
    }
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = useCallback(() => {
    markTutorialDone();
    onDismiss();
  }, [onDismiss]);

  const handleNext = () => {
    if (isFinal) {
      finish();
      navigate("/wardrobe");
      return;
    }
    if (isNav) {
      // Navigate for the user if they click Next instead of the nav link
      navigate(current.navHref);
      // The location effect will advance the step
      return;
    }
    setStep((s) => s + 1);
  };

  const handleBack = () => {
    if (step <= 0) return;
    const prevStep = TUTORIAL_STEPS[step - 1];
    // Use navigateTo if the previous step has one, otherwise fall back to route
    if (prevStep.navigateTo) {
      navigate(prevStep.navigateTo);
    } else if (prevStep.route && prevStep.route !== location.pathname) {
      navigate(prevStep.route);
    }
    setStep((s) => s - 1);
  };

  const handleSkip = () => finish();

  // Measure actual tooltip height after render
  const [tooltipHeight, setTooltipHeight] = useState(0);
  useEffect(() => {
    if (tooltipRef.current) {
      setTooltipHeight(tooltipRef.current.offsetHeight);
    }
  }, [step]);

  if (!show) return null;

  // Tooltip positioning
  let tooltipStyle = {};
  let arrowDir = "up";
  const measuredH = tooltipHeight || 200;

  if (isFinal || !targetRect) {
    tooltipStyle = {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
    };
    arrowDir = null;
  } else {
    const tooltipWidth = 440;
    let left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - tooltipWidth - 12));

    // Prefer below target
    let top = targetRect.bottom + PAD + 14;
    arrowDir = "up";

    // If tooltip would go off-bottom, position above
    if (top + measuredH > window.innerHeight - 12) {
      top = targetRect.top - PAD - 14 - measuredH;
      arrowDir = "down";
    }

    // If above doesn't work either, clamp to bottom of viewport
    if (top < 10) {
      top = Math.min(targetRect.bottom + PAD + 14, window.innerHeight - measuredH - 12);
      arrowDir = "up";
    }

    tooltipStyle = { position: "fixed", top, left, width: tooltipWidth };
  }

  // SVG mask cutout
  const cutX = targetRect ? targetRect.left - PAD : 0;
  const cutY = targetRect ? targetRect.top - PAD : 0;
  const cutW = targetRect ? targetRect.width + PAD * 2 : 0;
  const cutH = targetRect ? targetRect.height + PAD * 2 : 0;

  // Arrow position
  const arrowLeft =
    targetRect && !isFinal
      ? targetRect.left + targetRect.width / 2 - (tooltipStyle.left || 0)
      : 0;

  const totalNavSteps = TUTORIAL_STEPS.length - 1; // exclude "done"
  const stepLabel = `${step + 1} / ${totalNavSteps}`;

  return ReactDOM.createPortal(
    <div className="tutorialOverlay">
      {/* Backdrop: 4 rects around the cutout so the highlighted element stays clickable */}
      {targetRect && !isFinal ? (
        <>
          {/* Top */}
          <div className="tutorialBackdropPane" style={{ top: 0, left: 0, right: 0, height: cutY }} />
          {/* Bottom */}
          <div className="tutorialBackdropPane" style={{ top: cutY + cutH, left: 0, right: 0, bottom: 0 }} />
          {/* Left */}
          <div className="tutorialBackdropPane" style={{ top: cutY, left: 0, width: cutX, height: cutH }} />
          {/* Right */}
          <div className="tutorialBackdropPane" style={{ top: cutY, left: cutX + cutW, right: 0, height: cutH }} />
        </>
      ) : (
        <div className="tutorialBackdropSolid" />
      )}

      {/* Spotlight ring */}
      {targetRect && !isFinal && (
        <div
          className="tutorialSpotlightRing"
          style={{
            top: targetRect.top - PAD,
            left: targetRect.left - PAD,
            width: targetRect.width + PAD * 2,
            height: targetRect.height + PAD * 2,
          }}
        />
      )}

      {/* Tooltip */}
      <div
        key={step}
        ref={tooltipRef}
        className={"tutorialTooltip" + (isFinal ? " tutorialTooltipCenter" : "")}
        style={tooltipStyle}
      >
        {arrowDir === "up" && (
          <div className="tutorialArrow tutorialArrow--up" style={{ left: arrowLeft }} />
        )}

        {isFinal && <div className="tutorialDoneIcon">&#10024;</div>}

        <div className="tutorialTooltipTitle">{current.title}</div>
        <div className="tutorialTooltipDesc">{current.description}</div>

        <div className="tutorialTooltipFooter">
          {!isFinal ? (
            <button className="tutorialSkipBtn" onClick={handleSkip}>
              Skip Tour
            </button>
          ) : (
            <button className="tutorialBackBtn" onClick={handleBack}>
              ← Previous
            </button>
          )}
          {step > 0 && !isFinal && (
            <button className="tutorialBackBtn" onClick={handleBack}>
              ← Previous
            </button>
          )}
          <span className="tutorialStepCount">
            {isFinal ? "" : stepLabel}
          </span>
          <button className="tutorialNextBtn" onClick={handleNext}>
            {isFinal ? "Get Started" : isNav ? (current.navLabel || current.navHref.replace("/", "").replace("-", " ").replace(/\b\w/g, c => c.toUpperCase())) + " →" : "Next"}
          </button>
        </div>

        {arrowDir === "down" && (
          <div className="tutorialArrow tutorialArrow--down" style={{ left: arrowLeft }} />
        )}
      </div>
    </div>,
    document.body
  );
}
