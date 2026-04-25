import React, { useEffect, useId, useRef, useState } from "react";
import { ROTATION_REMINDER_OPTIONS } from "../utils/rotationAlertPreferences";

function RotationItemImage({ item }) {
  const [imgFailed, setImgFailed] = useState(false);

  if (imgFailed || !item?.imageUrl) {
    return (
      <div className="rotationItemFallback" aria-hidden="true">
        <span>{item?.category || "Item"}</span>
      </div>
    );
  }

  return (
    <img
      className="rotationItemImage"
      src={item.imageUrl}
      alt={item?.name || "Wardrobe item"}
      loading="lazy"
      onError={() => setImgFailed(true)}
    />
  );
}

function RotationSuggestionList({
  item,
  loadingSuggestions = false,
  onWearSuggestion = () => {},
}) {
  const suggestions = Array.isArray(item?.suggestions) ? item.suggestions : [];

  if (loadingSuggestions) {
    return (
      <div className="rotationSuggestionBox" role="status" aria-live="polite">
        <div className="rotationSuggestionLoading">Building style suggestions...</div>
      </div>
    );
  }

  if (!suggestions.length) {
    return (
      <div className="rotationSuggestionBox" role="status" aria-live="polite">
        <div className="rotationSuggestionEmptyTitle">No outfit suggestion yet</div>
        <div className="rotationSuggestionEmptyText">
          FitGPT is still looking for a clean combination for this piece. Refresh recommendations or open your wardrobe to style it manually.
        </div>
      </div>
    );
  }

  return (
    <div className="rotationSuggestionList" aria-label={`Suggestions for ${item?.name || "this item"}`}>
      {suggestions.map((suggestion) => (
        <div key={`${item?.id}-${suggestion.index}`} className="rotationSuggestionCard">
          <div className="rotationSuggestionTopRow">
            <div>
              <div className="rotationSuggestionLabel">{suggestion.optionLabel}</div>
              <div className="rotationSuggestionNames">{suggestion.itemNames.join(" | ")}</div>
            </div>

            <button
              type="button"
              className="btn rotationWearBtn"
              onClick={() => onWearSuggestion(item, suggestion)}
            >
              Wear this
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function WardrobeRotationPanel({
  analysis,
  preferences,
  loadingSuggestions = false,
  onOpenWardrobe = () => {},
  onDismissAlert = () => {},
  onWearSuggestion = () => {},
  onManagePreferences = () => {},
}) {
  const [expandedItemId, setExpandedItemId] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef(null);
  const dialogId = useId();

  const stats = Array.isArray(analysis?.stats) ? analysis.stats : [];
  const items = Array.isArray(analysis?.items) ? analysis.items : [];
  const reminderLabel = ROTATION_REMINDER_OPTIONS.find(
    (option) => option.key === (preferences?.reminderPace || "balanced")
  )?.label || "Balanced";
  const attentionCount = Number(stats[0]?.value || items.length || 0);
  const compactSummary = items.slice(0, 2).map((item) => item.name).filter(Boolean).join(", ");

  useEffect(() => {
    if (analysis?.state !== "alert" || !items.length) {
      setIsOpen(false);
      setExpandedItemId("");
    }
  }, [analysis?.state, items.length]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event) => {
      const node = rootRef.current;
      if (!node || node.contains(event.target)) return;
      setIsOpen(false);
      setExpandedItemId("");
    };

    const handleKeyDown = (event) => {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      setExpandedItemId("");
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  if (analysis?.state !== "alert" || !items.length) {
    return null;
  }

  const toggleExpanded = (itemId) => {
    setExpandedItemId((current) => (current === itemId ? "" : itemId));
  };

  const closePanel = () => {
    setIsOpen(false);
    setExpandedItemId("");
  };

  return (
    <div ref={rootRef} className={`rotationFloatingWrap${isOpen ? " open" : ""}`}>
      <button
        type="button"
        className={`rotationFloatingChip${isOpen ? " active" : ""}`}
        aria-expanded={isOpen}
        aria-controls={dialogId}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="rotationFloatingDot" aria-hidden="true" />
        <span className="rotationFloatingCount">{attentionCount}</span>
        <span className="rotationFloatingText">
          {attentionCount === 1 ? "item to rotate" : "items to rotate"}
        </span>
      </button>

      {isOpen ? <div className="rotationFloatingBackdrop" aria-hidden="true" onClick={closePanel} /> : null}

      {isOpen ? (
        <section
          id={dialogId}
          className="rotationPopover"
          role="dialog"
          aria-modal="false"
          aria-labelledby={`${dialogId}-title`}
        >
          <div className="rotationPopoverHeader">
            <div className="rotationPopoverHeaderCopy">
              <div className="rotationEyebrow">{analysis?.badge || "Rotation alerts"}</div>
              <h2 id={`${dialogId}-title`} className="rotationPopoverTitle">
                Underused pieces worth revisiting
              </h2>
              <p className="rotationPopoverIntro">
                {compactSummary
                  ? `${compactSummary} could use another turn. Open an idea when you want a quick styling nudge.`
                  : "A few pieces could use another turn. Open an idea when you want a quick styling nudge."}
              </p>
            </div>

            <div className="rotationPopoverHeaderActions">
              <div className="rotationSettingsSummary">
                <div className="rotationSettingsSummaryLabel">Smart alerts</div>
                <div className="rotationSettingsSummaryValue">{`On | ${reminderLabel}`}</div>
              </div>

              <button type="button" className="btn rotationPanelButton" onClick={onManagePreferences}>
                Manage alerts
              </button>
              <button type="button" className="btn rotationPanelButton" onClick={closePanel}>
                Close
              </button>
            </div>
          </div>

          {stats.length > 0 ? (
            <div className="rotationSummaryRow rotationSummaryRowCompact">
              {stats.map((stat) => (
                <div key={stat.label} className="rotationSummaryPill">
                  <span className="rotationSummaryValue">{stat.value}</span>
                  <span className="rotationSummaryLabel">{stat.label}</span>
                </div>
              ))}
            </div>
          ) : null}

          <div className="rotationPopoverBody">
            <div className="rotationGrid rotationGridPopover">
              {items.map((item) => {
                const isExpanded = expandedItemId === item.id;
                const suggestionRegionId = `rotation-suggestions-${item.id}`;
                const pills = [item.triggerLabel];

                if (item.wearCount > 0) pills.push(item.wearCountLabel);
                pills.push(item.lastWornLabel);

                return (
                  <article key={item.id} className="rotationItemCard rotationItemCardPopover">
                    <RotationItemImage item={item} />

                    <div className="rotationItemBody">
                      <div className="rotationItemTopRow">
                        <div>
                          <div className="rotationItemName">{item.name}</div>
                          <div className="rotationItemMeta">
                            {[item.category, item.color].filter(Boolean).join(" | ")}
                          </div>
                        </div>
                        <span className={`rotationTone rotationTone-${item.urgencyTone}`}>
                          {item.urgencyTone === "high" ? "Rediscover" : "Rotate soon"}
                        </span>
                      </div>

                      <div className="rotationPills">
                        {pills.map((pill) => (
                          <span key={`${item.id}-${pill}`} className="rotationPill">
                            {pill}
                          </span>
                        ))}
                      </div>

                      <p className="rotationReason">{item.reason}</p>

                      <div className="rotationActions">
                        <button
                          type="button"
                          className="btn primary"
                          aria-expanded={isExpanded}
                          aria-controls={suggestionRegionId}
                          onClick={() => toggleExpanded(item.id)}
                        >
                          {isExpanded ? "Hide ideas" : "Style this"}
                        </button>
                        <button
                          type="button"
                          className="btn rotationDismissBtn"
                          onClick={() => onDismissAlert(item)}
                        >
                          Dismiss
                        </button>
                      </div>

                      {isExpanded ? (
                        <div id={suggestionRegionId} className="rotationSuggestionsWrap">
                          <RotationSuggestionList
                            item={item}
                            loadingSuggestions={loadingSuggestions}
                            onWearSuggestion={onWearSuggestion}
                          />
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="rotationPopoverFooter">
              <button type="button" className="btn" onClick={onOpenWardrobe}>
                Open wardrobe
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
