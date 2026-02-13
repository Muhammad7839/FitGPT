import React, { useEffect, useMemo, useState } from "react";

const TOTAL_STEPS = 5;

const STYLE_OPTIONS = [
  "Casual",
  "Professional",
  "Streetwear",
  "Athletic",
  "Minimalist",
  "Formal",
];

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
    dressFor: Array.isArray(raw?.dressFor) ? raw.dressFor : [],
    bodyType: raw?.bodyType ?? null,
  };
}

function clampStep(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return 1;
  return Math.min(Math.max(num, 1), TOTAL_STEPS);
}

export default function Onboarding({ onComplete, initialStep = 1, initialAnswers, onProgress }) {
  const [step, setStep] = useState(() => clampStep(initialStep));

  const [answers, setAnswers] = useState(() => normalizeAnswers(initialAnswers));

  const isSkippableStep = step >= 2 && step <= 4;

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
    onComplete(answers);
  };

  const goBack = () => {
    if (step > 1) setStep((s) => s - 1);
  };

  const goSkip = () => {
    setAnswers((prev) => {
      if (step === 2) return { ...prev, style: [] };
      if (step === 3) return { ...prev, dressFor: [] };
      if (step === 4) return { ...prev, bodyType: null };
      return prev;
    });

    if (step < TOTAL_STEPS) setStep((s) => s + 1);
  };

  const toggleMulti = (key, value) => {
    setAnswers((prev) => {
      const list = prev[key];
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
          <h1 className="heroTitle">What’s your style?</h1>
          <p className="heroSub">Select all that apply. You can also skip.</p>

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

          <div className="noteBox">
            Selected: {answers.style.length ? answers.style.join(", ") : "Skipped / None"}
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
            Optional. If you choose one, FitGPT can improve fit-based suggestions. You can also
            skip.
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

          <div className="noteBox">Selected: {bodyTypeLabel ?? "Skipped / None"}</div>
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
            <div className="reviewLabel">Dressing for</div>
            <div className="reviewValue">
              {answers.dressFor.length ? answers.dressFor.join(", ") : "Skipped"}
            </div>
          </div>

          <div className="reviewCard">
            <div className="reviewLabel">Body type</div>
            <div className="reviewValue">{bodyTypeLabel ?? "Skipped"}</div>
          </div>
        </div>

        <div className="noteBox">
          Finish will complete onboarding (mock). Next sprint we’ll save this in the backend.
        </div>
      </div>
    );
  };

  return (
    <div className="onboarding">
      <div className="brandBar">
        <div className="brandLeft">
          <img className="brandLogo" src="/officialLogo.png" alt="FitGPT official logo" />
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
          <button className="btn primary" onClick={goNext}>
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
