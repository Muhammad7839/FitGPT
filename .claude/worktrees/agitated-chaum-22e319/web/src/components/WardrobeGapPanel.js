import React, { useState } from "react";

import { gapSeverityLabel, gapSeverityTone } from "../utils/wardrobeGapInsights";

function GapSuggestionImage({ suggestion }) {
  const [hasImageError, setHasImageError] = useState(false);

  if (hasImageError || !suggestion?.imageUrl) {
    return (
      <div className="gapSuggestionFallback" aria-hidden="true">
        <span>{suggestion?.shortLabel || suggestion?.name || "Wardrobe idea"}</span>
      </div>
    );
  }

  return (
    <img
      className="gapSuggestionImage"
      src={suggestion.imageUrl}
      alt={suggestion.imageAlt || suggestion.name}
      loading="lazy"
      onError={() => setHasImageError(true)}
    />
  );
}

function LoadingCard({ index }) {
  return (
    <div className="gapCard gapCardLoading" aria-hidden="true" style={{ animationDelay: `${index * 80}ms` }}>
      <div className="gapCardTopRow">
        <div className="gapChipRow">
          <div className="gapSkeleton gapSkeletonPill" />
          <div className="gapSkeleton gapSkeletonPill short" />
        </div>
        <div className="gapSkeleton gapSkeletonCoverage" />
      </div>
      <div className="gapSkeleton gapSkeletonTitle" />
      <div className="gapSkeleton gapSkeletonText" />
      <div className="gapSkeleton gapSkeletonText short" />
      <div className="gapSuggestionGrid compact">
        <div className="gapSuggestionCard">
          <div className="gapSkeleton gapSkeletonImage compact" />
          <div className="gapSuggestionBody">
            <div className="gapSkeleton gapSkeletonText" />
            <div className="gapSkeleton gapSkeletonText short" />
            <div className="gapSkeleton gapSkeletonButton" />
          </div>
        </div>
      </div>
    </div>
  );
}

function summaryMetrics({ analysis, gaps, loading }) {
  if (loading) {
    return [
      { id: "status", label: "Status", value: "Analyzing" },
    ];
  }

  return [
    { id: "items", label: "Items reviewed", value: String(analysis?.checkedItems || 0) },
    { id: "gaps", label: "Focus areas", value: String(Array.isArray(gaps) ? gaps.length : 0) },
  ];
}

export default function WardrobeGapPanel({ analysis, loading, onOpenWardrobe = () => {} }) {
  const gaps = Array.isArray(analysis?.gaps) ? analysis.gaps : [];
  const metrics = summaryMetrics({ analysis, gaps, loading });

  return (
    <section className="card dashWide gapPanel" aria-labelledby="wardrobe-gap-heading">
      <div className="gapPanelHeader">
        <div className="gapEyebrow">Wardrobe gap check</div>
        <div className="gapPanelTopRow">
          <div className="gapHeaderCopy">
            <h2 id="wardrobe-gap-heading" className="gapTitleMain">
              {loading ? "Analyzing your wardrobe..." : analysis?.summaryTitle || "Wardrobe gap check"}
            </h2>
            <p className="gapIntro">
              {loading
                ? "Reviewing your active wardrobe, style signals, and current weather to find practical additions."
                : analysis?.summaryText || "FitGPT can highlight missing or underrepresented clothing categories."}
            </p>
            <div className="gapSummaryRow" aria-label="Wardrobe gap summary">
              {metrics.map((metric) => (
                <div key={metric.id} className="gapSummaryPill">
                  <span className="gapSummaryLabel">{metric.label}</span>
                  <span className="gapSummaryValue">{metric.value}</span>
                </div>
              ))}
            </div>
          </div>
          <button type="button" className="btn gapManageBtn" onClick={onOpenWardrobe}>
            Open wardrobe
          </button>
        </div>
      </div>

      {loading ? (
        <div className="gapGrid" aria-live="polite" aria-busy="true">
          {[0, 1].map((index) => (
            <LoadingCard key={index} index={index} />
          ))}
        </div>
      ) : gaps.length === 0 ? (
        <div className="gapEmptyState" role="status" aria-live="polite">
          <div className="gapEmptyBadge">No major gaps found</div>
          <div className="gapEmptyTitle">Your wardrobe looks balanced right now</div>
          <p className="gapEmptyText">
            FitGPT did not spot any major missing categories for your current wardrobe, weather, and style preferences.
          </p>
        </div>
      ) : (
        <div className="gapGrid">
          {gaps.map((gap, index) => (
            <article key={gap.id} className={"gapCard" + (index === 0 ? " gapCardPrimary" : "")}>
              <div className="gapCardTopRow">
                <div className="gapChipRow">
                  <span className={`gapPhrase gapTone-${gapSeverityTone(gap.severity)}`}>{gap.phrase}</span>
                  <span className={`gapSeverity gapTone-${gapSeverityTone(gap.severity)}`}>{gapSeverityLabel(gap.severity)}</span>
                </div>
                <span className="gapCoveragePill">{gap.coverage}</span>
              </div>

              <h3 className="gapCardTitle">{gap.title}</h3>
              <p className="gapCardText">{gap.summary}</p>
              {gap.note ? <p className="gapNote">{gap.note}</p> : null}

              <div className="gapSuggestionGrid compact">
                {gap.suggestions.map((suggestion) => (
                  <div key={`${gap.id}-${suggestion.id}`} className="gapSuggestionCard">
                    <div className="gapSuggestionMedia">
                      <GapSuggestionImage suggestion={suggestion} />
                    </div>
                    <div className="gapSuggestionBody">
                      <div className="gapSuggestionTopRow">
                        <div>
                          <div className="gapSuggestionTitle">{suggestion.name}</div>
                          <span className="gapRetailerLabel">{suggestion.retailerName}</span>
                        </div>
                        <a
                          className="gapSuggestionLink"
                          href={suggestion.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Open ${suggestion.retailerName} results for ${suggestion.name} in a new tab`}
                        >
                          View
                        </a>
                      </div>
                      <p className="gapSuggestionReason">{suggestion.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
