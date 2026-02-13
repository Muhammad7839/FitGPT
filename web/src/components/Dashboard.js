import React, { useMemo } from "react";

function titleCase(text) {
  if (!text) return "";
  return text
    .toString()
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ");
}

function joinNice(list) {
  if (!Array.isArray(list) || list.length === 0) return "Not set";
  if (list.length === 1) return titleCase(list[0]);
  if (list.length === 2) return `${titleCase(list[0])} and ${titleCase(list[1])}`;
  const allButLast = list.slice(0, -1).map(titleCase).join(", ");
  return `${allButLast}, and ${titleCase(list[list.length - 1])}`;
}

export default function Dashboard({ answers, onResetOnboarding }) {
  const summary = useMemo(() => {
    const styleCount = answers?.style?.length ?? 0;
    const dressForCount = answers?.dressFor?.length ?? 0;

    if (styleCount === 0 && dressForCount === 0 && !answers?.bodyType) {
      return "You skipped preferences. That’s fine. Add a few wardrobe items to start getting outfit ideas.";
    }

    if (dressForCount > 0) {
      return `Focus today: ${titleCase(answers.dressFor[0])}. Add 2 tops and 1 bottom for faster outfits.`;
    }

    if (styleCount > 0) {
      return `Your vibe leans ${titleCase(answers.style[0])}. Add one go-to jacket or accessory to level up outfits.`;
    }

    return "Add a few wardrobe staples to get stronger recommendations.";
  }, [answers]);

  return (
    <div className="dashboard">
      <div className="dashboardHeader">
        <div className="brandBar">
          <div className="brandLeft">
            <img className="brandLogo" src="/officialLogo.png" alt="FitGPT official logo" />
          </div>
        </div>

        <button type="button" className="btn" onClick={onResetOnboarding}>
          Reset onboarding
        </button>
      </div>

      <div className="dashCard">
        <div className="dashTitle">Your style profile</div>

        <div className="profileRow">
          <div className="label">Style</div>
          <div className="value">{joinNice(answers?.style)}</div>
        </div>

        <div className="profileRow">
          <div className="label">Dress for</div>
          <div className="value">{joinNice(answers?.dressFor)}</div>
        </div>

        <div className="profileRow">
          <div className="label">Body type</div>
          <div className="value">{answers?.bodyType ? titleCase(answers.bodyType) : "Not set"}</div>
        </div>
      </div>

      <div className="dashCard">
        <div className="dashTitle">Next best step</div>
        <div className="mutedText">{summary}</div>

        <div className="quickActions">
          <button type="button" className="btn primary">
            Add wardrobe item
          </button>
          <button type="button" className="btn">
            Get an outfit
          </button>
          <button type="button" className="btn">
            Plan a week
          </button>
        </div>

        <div className="mutedNote">
          Placeholders until Wardrobe Upload and Recommendations are built.
        </div>
      </div>
    </div>
  );
}
