import React from "react";

export const BODY_TYPE_VISUALS = {
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

export default function BodyTypeFigure({ bodyTypeId, compact = false }) {
  const visual = BODY_TYPE_VISUALS[bodyTypeId] || BODY_TYPE_VISUALS.rectangle;

  return (
    <div className={`bodyTypeFigure${compact ? " bodyTypeFigureCompact" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 92 92" className={`bodyTypeSvg${compact ? " bodyTypeSvgCompact" : ""}`} role="presentation">
        <defs>
          <linearGradient id={`shape-fill-${bodyTypeId}-${compact ? "compact" : "full"}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f7f3f2" />
            <stop offset="100%" stopColor="#e9dfdc" />
          </linearGradient>
          <linearGradient id={`shape-highlight-${bodyTypeId}-${compact ? "compact" : "full"}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.52)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>
        <ellipse cx="46" cy="47" rx="26" ry="28" className="bodyTypeAura" />
        <path
          d={visual.silhouette}
          className="bodyTypeFillModern"
          fill={`url(#shape-fill-${bodyTypeId}-${compact ? "compact" : "full"})`}
        />
        <path d={visual.silhouette} className="bodyTypeFrameModern" />
        <path
          d={visual.silhouette}
          className="bodyTypeHighlightModern"
          fill={`url(#shape-highlight-${bodyTypeId}-${compact ? "compact" : "full"})`}
        />
        <ellipse cx="46" cy="85" rx="15" ry="3.5" className="bodyTypeShadow" />
      </svg>
    </div>
  );
}
