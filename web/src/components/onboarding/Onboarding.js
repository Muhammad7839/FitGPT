import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import SplashCrumple from "./SplashCrumple";

const TOTAL_STEPS = 5;

const DEFAULT_BODY_TYPE_ID = "rectangle";
const DEFAULT_COMFORT = ["Balanced"];

const STYLE_OPTIONS = [
  "Casual",
  "Professional",
  "Streetwear",
  "Athletic",
  "Minimalist",
  "Formal",
];

const COMFORT_OPTIONS = ["Balanced", "Relaxed", "Fitted", "Stretchy", "Layered"];

const DRESS_FOR_OPTIONS = [
  "Class / Campus",
  "Work",
  "Gym",
  "Date Night",
  "Errands",
  "Party / Event",
  "Travel",
];

const BODY_TYPE_OPTIONS = [
  { id: "pear", label: "Pear", note: "Balance with structure on top." },
  { id: "apple", label: "Apple", note: "Comfort + clean lines through the middle." },
  { id: "hourglass", label: "Hourglass", note: "Highlight waist, keep proportions balanced." },
  { id: "rectangle", label: "Rectangle", note: "Add shape with layers and contrast." },
  { id: "inverted", label: "Inverted Triangle", note: "Balance shoulders with volume below." },
];

function normalizeAnswers(raw) {
  return {
    style: Array.isArray(raw?.style) ? raw.style : [],
    comfort: Array.isArray(raw?.comfort) ? raw.comfort : [],
    dressFor: Array.isArray(raw?.dressFor) ? raw.dressFor : [],
    bodyType: raw?.bodyType ?? null,
  };
}

function clampStep(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return 1;
  return Math.min(Math.max(num, 1), TOTAL_STEPS);
}

function withDefaultsOnFinish(answers) {
  const next = { ...(answers || {}) };

  if (!next.bodyType) next.bodyType = DEFAULT_BODY_TYPE_ID;
  if (!Array.isArray(next.comfort) || next.comfort.length === 0)
    next.comfort = DEFAULT_COMFORT;

  if (!Array.isArray(next.style)) next.style = [];
  if (!Array.isArray(next.dressFor)) next.dressFor = [];

  return next;
}

export default function Onboarding({
  onComplete,
  initialStep = 1,
  initialAnswers,
  onProgress,
}) {
  const navigate = useNavigate();

  const [showSplash, setShowSplash] = useState(true);
  const [step, setStep] = useState(() => clampStep(initialStep));
  const [answers, setAnswers] = useState(() => normalizeAnswers(initialAnswers));

  const handleSplashComplete = useCallback(() => {
    setShowSplash(false);
  }, []);

  const isSkippableStep = step >= 2 && step <= 4;

  const safeComplete = typeof onComplete === "function" ? onComplete : null;

  const progressWidth = useMemo(() => {
    return `${(step / TOTAL_STEPS) * 100}%`;
  }, [step]);

  useEffect(() => {
    if (typeof onProgress !== "function") return;
    onProgress({ step, answers });
  }, [step, answers, onProgress]);

  const goNext = () => {
    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1);
      return;
    }

    const finalAnswers = withDefaultsOnFinish(answers);

    // Fix: if onComplete wasn't passed, don't crash — just go to dashboard.
    if (safeComplete) {
      safeComplete(finalAnswers);
      return;
    }

    navigate("/dashboard", { replace: true });
  };

  const goBack = () => {
    if (step > 1) setStep((s) => s - 1);
  };

  const goSkip = () => {
    setAnswers((prev) => {
      if (step === 2) return { ...prev, style: [], comfort: [] };
      if (step === 3) return { ...prev, dressFor: [] };
      if (step === 4) return { ...prev, bodyType: null };
      return prev;
    });

    if (step < TOTAL_STEPS) setStep((s) => s + 1);
  };

  const toggleMulti = (key, value) => {
    setAnswers((prev) => {
      const list = Array.isArray(prev[key]) ? prev[key] : [];
      const exists = list.includes(value);
      const updated = exists ? list.filter((v) => v !== value) : [...list, value];
      return { ...prev, [key]: updated };
    });
  };

  const setSingle = (key, value) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const bodyTypeLabel = useMemo(() => {
    if (!answers.bodyType) return null;
    return BODY_TYPE_OPTIONS.find((x) => x.id === answers.bodyType)?.label ?? null;
  }, [answers.bodyType]);

  const defaultBodyTypeLabel = useMemo(() => {
    return BODY_TYPE_OPTIONS.find((x) => x.id === DEFAULT_BODY_TYPE_ID)?.label ?? "Default";
  }, []);

  const renderStepContent = () => {
    if (step === 1) {
      return (
        <div>
          <h1 className="heroTitle">Welcome to FitGPT</h1>
          <p className="heroSub">
            Your AI-powered outfit assistant that helps you look your best every day
          </p>

          <div className="featureGrid">
            <div className="featureCard">
              <h3>Upload Your Wardrobe</h3>
              <p>Add photos of your clothes to build your digital closet</p>
            </div>
            <div className="featureCard">
              <h3>Get Daily Suggestions</h3>
              <p>Receive personalized outfit recommendations</p>
            </div>
            <div className="featureCard">
              <h3>Save Favorites</h3>
              <p>Keep track of outfits you love</p>
            </div>
          </div>
        </div>
      );
    }

    if (step === 2) {
      return (
        <div>
          <h1 className="heroTitle">Quick preferences</h1>
          <p className="heroSub">Optional. Pick anything that fits you. You can also skip.</p>

          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 14, marginBottom: 8 }}>Style</div>
            <div className="pillGrid">
              {STYLE_OPTIONS.map((opt) => {
                const selected = answers.style.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    className={selected ? "pill selected" : "pill"}
                    onClick={() => toggleMulti("style", opt)}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>

            <div className="noteBox" style={{ marginTop: 10 }}>
              Style: {answers.style.length ? answers.style.join(", ") : "Skipped / None"}
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 14, marginBottom: 8 }}>Comfort</div>
            <div className="pillGrid">
              {COMFORT_OPTIONS.map((opt) => {
                const selected = answers.comfort.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    className={selected ? "pill selected" : "pill"}
                    onClick={() => toggleMulti("comfort", opt)}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>

            <div className="noteBox" style={{ marginTop: 10 }}>
              Comfort: {answers.comfort.length ? answers.comfort.join(", ") : "Skipped / None"}
            </div>
          </div>
        </div>
      );
    }

    if (step === 3) {
      return (
        <div>
          <h1 className="heroTitle">What do you dress for?</h1>
          <p className="heroSub">Choose anything that matches your routine. You can also skip.</p>

          <div className="pillGrid">
            {DRESS_FOR_OPTIONS.map((opt) => {
              const selected = answers.dressFor.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  className={selected ? "pill selected" : "pill"}
                  onClick={() => toggleMulti("dressFor", opt)}
                >
                  {opt}
                </button>
              );
            })}
          </div>

          <div className="noteBox">
            Selected: {answers.dressFor.length ? answers.dressFor.join(", ") : "Skipped / None"}
          </div>
        </div>
      );
    }

    if (step === 4) {
      return (
        <div>
          <h1 className="heroTitle">Body type</h1>
          <p className="heroSub">
            Optional. If you choose one, FitGPT can improve fit-based suggestions. You can also skip.
          </p>

          <div className="optionGrid">
            {BODY_TYPE_OPTIONS.map((opt) => {
              const selected = answers.bodyType === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  className={selected ? "optionCard selected" : "optionCard"}
                  onClick={() => setSingle("bodyType", opt.id)}
                >
                  <div className="optionTitle">{opt.label}</div>
                  <div className="optionNote">{opt.note}</div>
                </button>
              );
            })}
          </div>

          <div className="noteBox">
            Selected: {bodyTypeLabel ?? `Skipped (default will be ${defaultBodyTypeLabel})`}
          </div>
        </div>
      );
    }

    return (
      <div>
        <h1 className="heroTitle">Review</h1>
        <p className="heroSub">Go back to change anything, or finish to continue.</p>

        <div className="reviewGrid">
          <div className="reviewCard">
            <div className="reviewLabel">Style</div>
            <div className="reviewValue">
              {answers.style.length ? answers.style.join(", ") : "Skipped"}
            </div>
          </div>

          <div className="reviewCard">
            <div className="reviewLabel">Comfort</div>
            <div className="reviewValue">
              {answers.comfort.length
                ? answers.comfort.join(", ")
                : "Skipped (default will be Balanced)"}
            </div>
          </div>

          <div className="reviewCard">
            <div className="reviewLabel">Dressing for</div>
            <div className="reviewValue">
              {answers.dressFor.length ? answers.dressFor.join(", ") : "Skipped"}
            </div>
          </div>

          <div className="reviewCard">
            <div className="reviewLabel">Body type</div>
            <div className="reviewValue">
              {bodyTypeLabel ?? `Skipped (default will be ${defaultBodyTypeLabel})`}
            </div>
          </div>
        </div>

        <div className="noteBox">
          Finish will complete onboarding (mock). Next sprint we’ll save this in the backend.
        </div>
      </div>
    );
  };

  return (
    <div className="onboarding onboardingPage">
      {showSplash && <SplashCrumple onComplete={handleSplashComplete} />}
      <div className="brandBar">
        <div className="brandLeft">
          <div className="brandMark">
            <img className="brandLogo" src="/officialLogo.png" alt="FitGPT official logo" />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="topRow">
          <button type="button" className="linkBtn" onClick={goBack} disabled={step === 1}>
            Back
          </button>

          {isSkippableStep ? (
            <button type="button" className="linkBtn" onClick={goSkip}>
              Skip
            </button>
          ) : (
            <span />
          )}
        </div>

        <div className="progressWrap">
          <div className="progressBar" style={{ width: progressWidth }} />
        </div>

        <div style={{ marginTop: 18 }}>{renderStepContent()}</div>

        <div className="buttonRow">
          <button type="button" className="btn primary" onClick={goNext}>
            {step === TOTAL_STEPS ? "Finish" : "Continue"}
          </button>
        </div>

        <p className="stepText">
          Step {step} of {TOTAL_STEPS}
        </p>
      </div>
    </div>
  );
}