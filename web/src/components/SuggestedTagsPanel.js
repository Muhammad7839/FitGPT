import React from "react";
import { optionLabel } from "../utils/wardrobeOptions";
import { colorToCss } from "../utils/recommendationEngine";

function colorParts(value) {
  return (value || "")
    .toString()
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function buildGroups(suggestions) {
  if (!suggestions) return [];

  const groups = [
    {
      label: "Color",
      tone: "color",
      values: colorParts(suggestions.color),
    },
    {
      label: "Clothing type",
      values: suggestions.clothingType ? [optionLabel(suggestions.clothingType)] : [],
    },
    {
      label: "Style",
      values: Array.isArray(suggestions.styleTags) ? suggestions.styleTags.map(optionLabel) : [],
    },
    {
      label: "Occasion",
      values: Array.isArray(suggestions.occasionTags) ? suggestions.occasionTags.map(optionLabel) : [],
    },
    {
      label: "Season",
      values: Array.isArray(suggestions.seasonTags) ? suggestions.seasonTags.map(optionLabel) : [],
    },
  ];

  return groups.filter((group) => group.values.length > 0);
}

function SuggestedTagsPanel({
  status = "idle",
  message = "",
  suggestions = null,
  compact = false,
}) {
  if (status === "idle" && !suggestions) return null;

  const groups = buildGroups(suggestions);
  const cardClassName = [
    "suggestedTagsCard",
    compact ? "compact" : "",
    status === "error" ? "error" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section
      className={cardClassName}
      aria-live="polite"
      aria-label="Suggested tags"
    >
      <div className="suggestedTagsHeader">
        <div>
          <div className="suggestedTagsEyebrow">Suggested</div>
          <div className="suggestedTagsTitle">Suggested Tags</div>
        </div>
        {status === "loading" ? <span className="suggestedTagsBadge">Generating</span> : null}
      </div>

      {status === "loading" ? (
        <div className="suggestedTagsMessage" role="status">
          Generating suggested tags from your item photo...
        </div>
      ) : null}

      {status !== "loading" && message ? (
        <div className="suggestedTagsMessage" role={status === "error" ? "alert" : "status"}>
          {message}
        </div>
      ) : null}

      {groups.length ? (
        <div className="suggestedTagsGroups">
          {groups.map((group) => (
            <div key={group.label} className="suggestedTagsGroup">
              <div className="suggestedTagsGroupLabel">{group.label}</div>
              <div className="suggestedTagsChipRow">
                {group.values.map((value) => (
                  <span key={`${group.label}-${value}`} className="suggestedTagsChip">
                    {group.tone === "color" ? (
                      <span
                        className="suggestedTagsColorSwatch"
                        style={{ background: colorToCss(value) }}
                        aria-hidden="true"
                      />
                    ) : null}
                    {value}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export default React.memo(SuggestedTagsPanel);
