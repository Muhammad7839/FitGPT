import React from "react";
import { normalizeFitTag } from "../utils/helpers";
import { FIT_TAG_OPTIONS } from "./ItemFormFields";

function fitLabel(value) {
  const v = normalizeFitTag(value);
  return FIT_TAG_OPTIONS.find((x) => x.value === v)?.label || "Unknown";
}

const RATING_META = {
  great: { label: "Great Fit", cls: "bodyFitGreat" },
  good:  { label: "Good Fit",  cls: "bodyFitGood" },
  fair:  { label: "Okay Fit",  cls: "bodyFitFair" },
  poor:  { label: "Not Ideal", cls: "bodyFitPoor" },
  neutral: { label: "", cls: "" },
};

function ItemActions({ item, tab, onToggleFavorite, onEdit, onArchive, onUnarchive, onDelete, isBusy }) {
  return (
    <>
      <button
        type="button"
        className={item.is_favorite ? "wardrobeIconBtn fav active" : "wardrobeIconBtn fav"}
        onClick={() => onToggleFavorite(item.id)}
        aria-label="Toggle favorite"
        title="Favorite"
      >
        {item.is_favorite ? "♥" : "♡"}
      </button>

      <button
        type="button"
        className="wardrobeIconBtn"
        onClick={() => onEdit(item)}
        aria-label="Edit item"
        title="Edit"
      >
        ✎
      </button>

      {tab === "active" ? (
        <button
          type="button"
          className="wardrobeIconBtn"
          onClick={() => onArchive(item.id)}
          aria-label="Archive item"
          title="Archive"
          disabled={isBusy}
        >
          {isBusy ? "…" : "⤓"}
        </button>
      ) : (
        <button
          type="button"
          className="wardrobeIconBtn"
          onClick={() => onUnarchive(item.id)}
          aria-label="Unarchive item"
          title="Unarchive"
          disabled={isBusy}
        >
          {isBusy ? "…" : "⤒"}
        </button>
      )}

      <button
        type="button"
        className="wardrobeIconBtn danger"
        onClick={() => onDelete(item.id)}
        aria-label="Delete item"
        title="Delete"
      >
        🗑
      </button>
    </>
  );
}

function BodyFitBadge({ item, bodyFitOn, userBodyType, bodyFitRating, inline }) {
  if (!bodyFitOn) return null;
  const r = bodyFitRating(item.fit_tag || item.fitTag || item.fit, userBodyType, item.category);
  const meta = RATING_META[r];
  if (!meta?.label) return null;
  return <span className={`wardrobeBodyFitBadge${inline ? " inline" : ""} ${meta.cls}`}>{meta.label}</span>;
}

function WardrobeItemCard({
  item, view, tab, bodyFitOn, userBodyType, bodyFitRating,
  onToggleFavorite, onEdit, onArchive, onUnarchive, onDelete, isItemBusy,
  onTiltMove, onTiltLeave,
}) {
  const fitText = fitLabel(item.fit_tag || item.fitTag || item.fit);
  const isBusy = isItemBusy(item.id);
  const actionProps = { item, tab, onToggleFavorite, onEdit, onArchive, onUnarchive, onDelete, isBusy };

  if (view === "list") {
    return (
      <div className="wardrobeRowItem">
        <div className="wardrobeRowLeft">
          <div className="wardrobeThumbWrap sm">
            {item.image_url ? (
              <img className="wardrobeThumbImg sm" src={item.image_url} alt={item.name} />
            ) : (
              <div className="wardrobeThumb sm" aria-hidden="true" />
            )}
          </div>

          <div className="wardrobeRowText">
            <div className="wardrobeItemName">{item.name}</div>
            <div className="wardrobeItemMeta">
              {item.category} · {item.color} · Fit: {fitText}
              <BodyFitBadge item={item} bodyFitOn={bodyFitOn} userBodyType={userBodyType} bodyFitRating={bodyFitRating} inline />
            </div>
          </div>
        </div>

        <div className="wardrobeRowActions">
          <ItemActions {...actionProps} />
        </div>
      </div>
    );
  }

  return (
    <div className="wardrobeCard" onPointerMove={onTiltMove} onPointerLeave={onTiltLeave}>
      <div className="wardrobeThumbWrap">
        {item.image_url ? (
          <img className="wardrobeThumbImg" src={item.image_url} alt={item.name} />
        ) : (
          <div className="wardrobeThumb" aria-hidden="true" />
        )}
      </div>

      <div className="wardrobeCardBody">
        <div className="wardrobeItemName">{item.name}</div>
        <div className="wardrobeItemMeta">
          {item.category} · {item.color} · Fit: {fitText}
        </div>
        <BodyFitBadge item={item} bodyFitOn={bodyFitOn} userBodyType={userBodyType} bodyFitRating={bodyFitRating} />

        <div className="wardrobeCardActions">
          <ItemActions {...actionProps} />
        </div>
      </div>
    </div>
  );
}

export default React.memo(WardrobeItemCard);
