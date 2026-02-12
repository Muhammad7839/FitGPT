import React, { useState } from "react";

const TOTAL_STEPS = 5;

const STYLE_OPTIONS = [
  "Casual",
  "Professional",
  "Streetwear",
  "Athletic",
  "Minimalist",
  "Formal",
];

export default function Onboarding({ onComplete }) {
  const [step, setStep] = useState(1);

  // All onboarding answers live here
  const [answers, setAnswers] = useState({
    style: [],
    dressFor: [],
    bodyType: null,
  });

  const goNext = () => {
    if (step < TOTAL_STEPS) setStep(step + 1);
    else onComplete();
  };

  const goBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const goSkip = () => {
    // skip still moves forward (does not block progress)
    goNext();
  };

  // Toggle helper for multi-select lists like "style"
  const toggleMulti = (key, value) => {
    setAnswers((prev) => {
      const exists = prev[key].includes(value);
      const updated = exists
        ? prev[key].filter((v) => v !== value)
        : [...prev[key], value];
      return { ...prev, [key]: updated };
    });
  };

  const renderStepContent = () => {
    // Step 1: Welcome screen (matches your Figma)
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

    // Step 2: Style selection (multi-select)
    if (step === 2) {
      return (
        <div>
          <h1 className="heroTitle">Your Style Preferences</h1>
          <p className="heroSub">Pick as many as you want. This helps FitGPT tailor recommendations.</p>

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
            Selected: {answers.style.length ? answers.style.join(", ") : "None yet"}
          </div>
        </div>
      );
    }

    // Placeholder for remaining steps for now
    return <div>Step {step} content will be added next.</div>;
  };

  return (
    <div className="onboarding">
      <div className="topRow">
        <button type="button" className="linkBtn" onClick={goBack} disabled={step === 1}>
          Back
        </button>

        {step === 4 ? (
          <button type="button" className="linkBtn" onClick={goSkip}>
            Skip
          </button>
        ) : (
          <span />
        )}
      </div>

      <div className="card">
        {renderStepContent()}

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
