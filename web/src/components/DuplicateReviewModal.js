import React from "react";
import ReactDOM from "react-dom";
import { colorToCss } from "../utils/recommendationEngine";

function colorTokens(value) {
  return (value || "")
    .toString()
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function DuplicateItemCard({ item, side, onMerge, onDelete }) {
  const colors = colorTokens(item?.color);

  return (
    <article className="duplicateItemCard">
      <div className="duplicateItemEyebrow">{side}</div>
      <div className="duplicateItemMedia">
        {item?.image_url ? (
          <img className="duplicateItemImage" src={item.image_url} alt={item.name || "Wardrobe item"} />
        ) : (
          <div className="duplicateItemPlaceholder" aria-hidden="true" />
        )}
      </div>

      <div className="duplicateItemBody">
        <div className="duplicateItemName">{item?.name || "Untitled item"}</div>
        <div className="duplicateItemMeta">
          {item?.category || "Uncategorized"}
        </div>

        {colors.length ? (
          <div className="duplicateColorRow">
            {colors.map((color) => (
              <span key={`${item?.id}-${color}`} className="duplicateColorChip">
                <span className="duplicateColorSwatch" style={{ background: colorToCss(color) }} aria-hidden="true" />
                {color}
              </span>
            ))}
          </div>
        ) : null}

        <div className="duplicateItemActions">
          <button type="button" className="duplicateActionBtn primary" onClick={onMerge}>
            Merge into this
          </button>
          <button type="button" className="duplicateActionBtn danger" onClick={onDelete}>
            Delete this
          </button>
        </div>
      </div>
    </article>
  );
}

function ConfirmationPanel({ action, onCancel, onConfirm }) {
  if (!action) return null;

  const isMerge = action.mode === "merge";
  const title = isMerge ? "Merge these items?" : "Delete this item?";
  const copy = isMerge
    ? `This will keep "${action.keepName}" and remove "${action.removeName}" after combining their saved details.`
    : `This will permanently remove "${action.removeName}".`;

  return (
    <div className="duplicateConfirmBox" role="alert">
      <div>
        <div className="duplicateConfirmTitle">{title}</div>
        <div className="duplicateConfirmCopy">{copy}</div>
      </div>
      <div className="duplicateConfirmActions">
        <button type="button" className="btnSecondary" onClick={onCancel} disabled={action.isProcessing}>
          Cancel
        </button>
        <button type="button" className="btnPrimary" onClick={onConfirm} disabled={action.isProcessing}>
          {action.isProcessing ? (isMerge ? "Merging..." : "Deleting...") : (isMerge ? "Confirm merge" : "Confirm delete")}
        </button>
      </div>
    </div>
  );
}

function FindingCard({ finding, pendingAction, onStartAction, onKeepBoth }) {
  const actionForFinding = pendingAction?.pairKey === finding.pairKey ? pendingAction : null;

  return (
    <article className="duplicateFindingCard">
      <div className="duplicateFindingHeader">
        <div>
          <div className="duplicateFindingEyebrow">Possible duplicate detected</div>
          <div className="duplicateFindingTitle">These items look similar</div>
        </div>

        <div className="duplicateFindingBadges">
          <span className={`duplicateTypeBadge ${finding.duplicateType}`}>{finding.duplicateTypeLabel}</span>
          <span className={`duplicateConfidenceBadge ${finding.confidenceTone}`}>
            {finding.confidence}% match
          </span>
        </div>
      </div>

      <div className="duplicateConfidenceBar" aria-hidden="true">
        <span style={{ width: `${finding.confidence}%` }} />
      </div>

      {finding.matchHighlights?.length ? (
        <div className="duplicateHighlightRow">
          {finding.matchHighlights.map((entry) => (
            <span key={`${finding.pairKey}-${entry}`} className="duplicateHighlightChip">
              {entry}
            </span>
          ))}
        </div>
      ) : null}

      <div className="duplicateCompareGrid">
        <DuplicateItemCard
          item={finding.leftItem}
          side="Item A"
          onMerge={() => onStartAction({
            mode: "merge",
            pairKey: finding.pairKey,
            keepId: finding.leftItem.id,
            keepName: finding.leftItem.name || "Item A",
            removeId: finding.rightItem.id,
            removeName: finding.rightItem.name || "Item B",
          })}
          onDelete={() => onStartAction({
            mode: "delete",
            pairKey: finding.pairKey,
            removeId: finding.leftItem.id,
            removeName: finding.leftItem.name || "Item A",
            survivorId: finding.rightItem.id,
          })}
        />

        <DuplicateItemCard
          item={finding.rightItem}
          side="Item B"
          onMerge={() => onStartAction({
            mode: "merge",
            pairKey: finding.pairKey,
            keepId: finding.rightItem.id,
            keepName: finding.rightItem.name || "Item B",
            removeId: finding.leftItem.id,
            removeName: finding.leftItem.name || "Item A",
          })}
          onDelete={() => onStartAction({
            mode: "delete",
            pairKey: finding.pairKey,
            removeId: finding.rightItem.id,
            removeName: finding.rightItem.name || "Item B",
            survivorId: finding.leftItem.id,
          })}
        />
      </div>

      <div className="duplicateFieldGrid">
        {finding.fields.map((field) => (
          <div key={`${finding.pairKey}-${field.key}`} className={field.same ? "duplicateFieldRow same" : "duplicateFieldRow different"}>
            <div className="duplicateFieldLabel">{field.label}</div>
            <div className="duplicateFieldValue">{field.left}</div>
            <div className="duplicateFieldValue">{field.right}</div>
          </div>
        ))}
      </div>

      <div className="duplicateFindingFooter">
        <button type="button" className="duplicateActionBtn" onClick={() => onKeepBoth(finding)}>
          Keep both items
        </button>
      </div>

      <ConfirmationPanel
        action={actionForFinding}
        onCancel={() => onStartAction(null)}
        onConfirm={() => onStartAction({ ...actionForFinding, confirmNow: true })}
      />
    </article>
  );
}

export default function DuplicateReviewModal({
  open,
  findings,
  isDetecting,
  pendingAction,
  onClose,
  onStartAction,
  onKeepBoth,
  onKeepAll,
}) {
  if (!open) return null;

  const hasFindings = !isDetecting && Array.isArray(findings) && findings.length > 0;

  return ReactDOM.createPortal(
    <div className="modalOverlay" role="dialog" aria-modal="true" aria-labelledby="duplicate-review-title">
      <div className="modalCard duplicateModalCard">
        <div className="duplicateModalHeader">
          <div>
            <div id="duplicate-review-title" className="modalTitle">Duplicate Review</div>
            <div className="modalSub">
              Review similar wardrobe items and decide whether to keep, merge, or delete them.
            </div>
          </div>

          <div className="duplicateModalHeaderActions">
            {hasFindings && onKeepAll ? (
              <button
                type="button"
                className="duplicateKeepAllBtn"
                onClick={onKeepAll}
                title="Keep every flagged pair and stop showing them"
              >
                Keep all ({findings.length})
              </button>
            ) : null}
            <button type="button" className="duplicateCloseBtn" onClick={onClose} aria-label="Close duplicate review">
              {"\u00D7"}
            </button>
          </div>
        </div>

        {isDetecting ? (
          <div className="duplicateLoadingState" role="status" aria-live="polite">
            <div className="duplicateLoadingDot" aria-hidden="true" />
            Checking your latest wardrobe items for duplicates...
          </div>
        ) : null}

        {!isDetecting && !findings.length ? (
          <div className="duplicateEmptyState">
            <div className="duplicateEmptyTitle">No duplicates found</div>
            <div className="duplicateEmptyCopy">
              Your latest wardrobe scan looks clean. New uploads did not cross the similarity threshold.
            </div>
          </div>
        ) : null}

        <div className="duplicateFindingList">
          {findings.map((finding) => (
            <FindingCard
              key={finding.pairKey}
              finding={finding}
              pendingAction={pendingAction}
              onStartAction={onStartAction}
              onKeepBoth={onKeepBoth}
            />
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
