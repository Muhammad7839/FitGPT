import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import SplashCrumple from "./SplashCrumple";
import { STYLE_OPTIONS, COMFORT_OPTIONS, DRESS_FOR_OPTIONS, BODY_TYPE_OPTIONS, GENDER_OPTIONS } from "../../utils/formOptions";
import BodyTypeFigure, { BODY_TYPE_VISUALS } from "../BodyTypeFigure";

const TOTAL_STEPS = 5;

const DEFAULT_BODY_TYPE_ID = "rectangle";
const DEFAULT_COMFORT = ["Balanced"];
const HEIGHT_RANGE_START_INCHES = 4 * 12 + 8;
const HEIGHT_RANGE_END_INCHES = 7 * 12;

const HEIGHT_OPTIONS = Array.from(
  { length: HEIGHT_RANGE_END_INCHES - HEIGHT_RANGE_START_INCHES + 1 },
  (_, index) => {
    const totalInches = HEIGHT_RANGE_START_INCHES + index;
    const feet = Math.floor(totalInches / 12);
    const inches = totalInches % 12;
    const cm = Math.round(totalInches * 2.54);

    return {
      value: String(cm),
      label: `${feet}'${inches}" (${cm} cm)`,
    };
  }
);

const HEIGHT_LABEL_BY_CM = HEIGHT_OPTIONS.reduce((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {});

function normalizeAnswers(raw) {
  return {
    style: Array.isArray(raw?.style) ? raw.style : [],
    comfort: Array.isArray(raw?.comfort) ? raw.comfort : [],
    dressFor: Array.isArray(raw?.dressFor) ? raw.dressFor : [],
    bodyType: raw?.bodyType ?? null,
    gender: (raw?.gender || "").toString(),
    heightCm: (raw?.heightCm || "").toString(),
  };
}

function clampStep(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return 1;
  return Math.min(Math.max(num, 1), TOTAL_STEPS);
}

function formatHeightLabel(heightCm) {
  const value = (heightCm || "").toString().trim();
  if (!value) return "";
  return HEIGHT_LABEL_BY_CM[value] || `${value} cm`;
}

function withDefaultsOnFinish(answers) {
  const next = { ...(answers || {}) };

  if (!next.bodyType) next.bodyType = DEFAULT_BODY_TYPE_ID;
  if (!Array.isArray(next.comfort) || next.comfort.length === 0)
    next.comfort = DEFAULT_COMFORT;

  if (!Array.isArray(next.style)) next.style = [];
  if (!Array.isArray(next.dressFor)) next.dressFor = [];
  if (!next.gender) next.gender = "";
  if (!next.heightCm) next.heightCm = "";

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

  const jumpToStep = (targetStep) => {
    setStep(clampStep(targetStep));
  };

  const bodyTypeLabel = useMemo(() => {
    if (!answers.bodyType) return null;
    return BODY_TYPE_OPTIONS.find((x) => x.id === answers.bodyType)?.label ?? null;
  }, [answers.bodyType]);

  const defaultBodyTypeLabel = useMemo(() => {
    return BODY_TYPE_OPTIONS.find((x) => x.id === DEFAULT_BODY_TYPE_ID)?.label ?? "Default";
  }, []);

  const heightOptions = useMemo(() => {
    const currentValue = (answers.heightCm || "").toString().trim();
    if (!currentValue || HEIGHT_LABEL_BY_CM[currentValue]) return HEIGHT_OPTIONS;

    return [
      { value: currentValue, label: `${currentValue} cm` },
      ...HEIGHT_OPTIONS,
    ];
  }, [answers.heightCm]);

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

          <div className="bodyTypeHelper">
            <div className="bodyTypeHelperTitle">Pick the closest silhouette, not a perfect match.</div>
            <div className="bodyTypeHelperText">
              Most people are between categories. Choose the shape that feels most similar to your shoulders, waist, and hips.
            </div>
            <div className="bodyTypeHelperText bodyTypeHelperTextSoft">
              If two feel close, choose the one that matches your top-to-bottom balance best.
            </div>
          </div>

          <div className="optionGrid bodyTypeGrid">
            {BODY_TYPE_OPTIONS.map((opt) => {
              const selected = answers.bodyType === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  className={selected ? "optionCard selected bodyTypeCard" : "optionCard bodyTypeCard"}
                  onClick={() => setSingle("bodyType", opt.id)}
                >
                  <div className="bodyTypeCardHeader">
                    <span className="bodyTypeCardEyebrow">Body Shape</span>
                    {selected ? <span className="bodyTypeSelectedBadge">Selected</span> : null}
                  </div>
                  <div className="bodyTypeCardTop">
                    <BodyTypeFigure bodyTypeId={opt.id} />
                    <div className="bodyTypeCardCopy">
                      <div className="optionTitle">{opt.label}</div>
                      <div className="bodyTypeAlias">{BODY_TYPE_VISUALS[opt.id]?.plainLabel || "Balanced shape"}</div>
                      <div className="bodyTypeHint">{BODY_TYPE_VISUALS[opt.id]?.hint || "Balanced proportions."}</div>
                      <div className="bodyTypeTagRow">
                        {(BODY_TYPE_VISUALS[opt.id]?.compare || []).map((tag) => (
                          <span key={tag} className="bodyTypeTag">{tag}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="bodyTypeExplain">{BODY_TYPE_VISUALS[opt.id]?.cue || "Choose the shape that feels closest to your proportions."}</div>
                  <div className="optionNote">{opt.note}</div>
                </button>
              );
            })}
          </div>

          <div className="noteBox">
            Selected: {bodyTypeLabel ?? `Skipped (default will be ${defaultBodyTypeLabel})`}
          </div>

          <div className="noteBox" style={{ marginTop: 16 }}>
            Add any optional profile details you want FitGPT to remember for your account setup.
          </div>

          <div style={{ marginTop: 16, display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <label className="wardrobeLabel">
              Gender (optional)
              <select
                className="wardrobeInput"
                value={answers.gender || ""}
                onChange={(e) => setSingle("gender", e.target.value)}
              >
                {GENDER_OPTIONS.map((option) => (
                  <option key={option.value || "blank"} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="wardrobeLabel">
              Height (optional)
              <select
                className="wardrobeInput"
                value={answers.heightCm || ""}
                onChange={(e) => setSingle("heightCm", e.target.value)}
              >
                <option value="">Select height</option>
                {heightOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      );
    }

    return (
      <div>
        <h1 className="heroTitle">Review</h1>
        <p className="heroSub">Click any preference to jump straight back and edit it, or finish to continue.</p>

        <div className="reviewGrid">
          <button type="button" className="reviewCard reviewCardButton" onClick={() => jumpToStep(2)}>
            <div className="reviewLabel">Style</div>
            <div className="reviewValue">
              {answers.style.length ? answers.style.join(", ") : "Skipped"}
            </div>
          </button>

          <button type="button" className="reviewCard reviewCardButton" onClick={() => jumpToStep(2)}>
            <div className="reviewLabel">Comfort</div>
            <div className="reviewValue">
              {answers.comfort.length
                ? answers.comfort.join(", ")
                : "Skipped (default will be Balanced)"}
            </div>
          </button>

          <button type="button" className="reviewCard reviewCardButton" onClick={() => jumpToStep(3)}>
            <div className="reviewLabel">Dressing for</div>
            <div className="reviewValue">
              {answers.dressFor.length ? answers.dressFor.join(", ") : "Skipped"}
            </div>
          </button>

          <button type="button" className="reviewCard reviewCardButton" onClick={() => jumpToStep(4)}>
            <div className="reviewLabel">Body type</div>
            <div className="reviewValue">
              {bodyTypeLabel ?? `Skipped (default will be ${defaultBodyTypeLabel})`}
            </div>
          </button>

          <button type="button" className="reviewCard reviewCardButton" onClick={() => jumpToStep(4)}>
            <div className="reviewLabel">Gender</div>
            <div className="reviewValue">
              {answers.gender || "Skipped"}
            </div>
          </button>

          <button type="button" className="reviewCard reviewCardButton" onClick={() => jumpToStep(4)}>
            <div className="reviewLabel">Height</div>
            <div className="reviewValue">
              {answers.heightCm ? formatHeightLabel(answers.heightCm) : "Skipped"}
            </div>
          </button>
        </div>

        <div className="noteBox">
          Finish will save these preferences and take you into your dashboard.
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
