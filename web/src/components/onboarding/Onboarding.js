import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import SplashCrumple from "./SplashCrumple";
import { STYLE_OPTIONS, COMFORT_OPTIONS, DRESS_FOR_OPTIONS, BODY_TYPE_OPTIONS, GENDER_OPTIONS } from "../../utils/formOptions";

const TOTAL_STEPS = 5;

const DEFAULT_BODY_TYPE_ID = "rectangle";
const DEFAULT_COMFORT = ["Balanced"];

const BODY_TYPE_VISUALS = {
  pear: {
    plainLabel: "Wider hips",
    hint: "Smaller shoulders, fuller hips.",
    compare: ["Narrower top", "Curvier lower half"],
    cue: "Usually means your hips feel fuller than your shoulders.",
    silhouette: "M36 16 Q46 11 56 16 Q57 23 58 30 Q59 38 63 46 Q68 55 69 70 Q69 84 61 89 Q54 93 46 93 Q38 93 31 89 Q23 84 23 70 Q24 55 29 46 Q33 38 34 30 Q35 23 36 16 Z",
  },
  apple: {
    plainLabel: "Fuller middle",
    hint: "Fuller middle with softer waist definition.",
    compare: ["Soft waist", "Balanced hips"],
    cue: "Usually means your middle feels a little fuller than your hips or waist.",
    silhouette: "M34 16 Q46 11 58 16 Q64 24 66 34 Q70 44 70 55 Q70 71 64 81 Q58 92 46 92 Q34 92 28 81 Q22 71 22 55 Q22 44 26 34 Q28 24 34 16 Z",
  },
  hourglass: {
    plainLabel: "Balanced top and bottom",
    hint: "Balanced shoulders and hips with a defined waist.",
    compare: ["Balanced top", "Defined waist"],
    cue: "Usually means your shoulders and hips feel balanced with a smaller waist.",
    silhouette: "M30 16 Q46 10 62 16 Q61 24 58 31 Q54 39 54 48 Q54 57 59 66 Q65 76 65 85 Q57 92 46 92 Q35 92 27 85 Q27 76 33 66 Q38 57 38 48 Q38 39 34 31 Q31 24 30 16 Z",
  },
  rectangle: {
    plainLabel: "Straight shape",
    hint: "Shoulders, waist, and hips are fairly even.",
    compare: ["Straight frame", "Even proportions"],
    cue: "Usually means your shoulders, waist, and hips feel fairly similar in width.",
    silhouette: "M34 16 Q46 12 58 16 Q60 25 60 35 Q60 45 60 55 Q60 65 61 75 Q62 84 58 91 Q52 93 46 93 Q40 93 34 91 Q30 84 31 75 Q32 65 32 55 Q32 45 32 35 Q32 25 34 16 Z",
  },
  inverted: {
    plainLabel: "Broader shoulders",
    hint: "Broader shoulders with a narrower lower half.",
    compare: ["Broader top", "Slimmer hips"],
    cue: "Usually means your shoulders feel broader than your hips.",
    silhouette: "M24 16 Q46 8 68 16 Q66 24 62 32 Q57 41 55 50 Q53 60 54 70 Q55 80 51 89 Q49 92 46 92 Q43 92 41 89 Q37 80 38 70 Q39 60 37 50 Q35 41 30 32 Q26 24 24 16 Z",
  },
};

function ShapeFigure({ bodyTypeId }) {
  const visual = BODY_TYPE_VISUALS[bodyTypeId] || BODY_TYPE_VISUALS.rectangle;

  return (
    <div className="bodyTypeFigure" aria-hidden="true">
      <svg viewBox="0 0 92 92" className="bodyTypeSvg" role="presentation">
        <defs>
          <linearGradient id={`shape-fill-${bodyTypeId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f7f3f2" />
            <stop offset="100%" stopColor="#e9dfdc" />
          </linearGradient>
          <linearGradient id={`shape-highlight-${bodyTypeId}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.52)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>
        <ellipse cx="46" cy="47" rx="26" ry="28" className="bodyTypeAura" />
        <path
          d={visual.silhouette}
          className="bodyTypeFillModern"
          fill={`url(#shape-fill-${bodyTypeId})`}
        />
        <path d={visual.silhouette} className="bodyTypeFrameModern" />
        <path
          d={visual.silhouette}
          className="bodyTypeHighlightModern"
          fill={`url(#shape-highlight-${bodyTypeId})`}
        />
        <ellipse cx="46" cy="85" rx="15" ry="3.5" className="bodyTypeShadow" />
      </svg>
    </div>
  );
}

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
                    <ShapeFigure bodyTypeId={opt.id} />
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
              Height in centimeters (optional)
              <input
                className="wardrobeInput"
                inputMode="numeric"
                placeholder="Example: 170"
                value={answers.heightCm || ""}
                onChange={(e) => setSingle("heightCm", e.target.value.replace(/[^\d.]/g, ""))}
              />
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
              {answers.heightCm ? `${answers.heightCm} cm` : "Skipped"}
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
