import React, { useState } from "react";
import { normalizeFitTag } from "../utils/helpers";
import { FIT_TAG_OPTIONS } from "./ItemFormFields";
import { optionLabel } from "../utils/wardrobeOptions";
import { colorToCss } from "../utils/recommendationEngine";
import { getSeasonMatch } from "../utils/seasonalWardrobe";
import { resolveImageUrl } from "../api/apiFetch";

function fitLabel(value) {
  const v = normalizeFitTag(value);
  return FIT_TAG_OPTIONS.find((x) => x.value === v)?.label || "Unknown";
}

const RATING_META = {
  great: { label: "Great Fit", cls: "bodyFitGreat" },
  good: { label: "Good Fit", cls: "bodyFitGood" },
  fair: { label: "Okay Fit", cls: "bodyFitFair" },
  poor: { label: "Not Ideal", cls: "bodyFitPoor" },
  neutral: { label: "", cls: "" },
};

function MetaBadge({ children }) {
  if (!children) return null;
  return (
    <span
      className="wardrobeFilterChip active"
      style={{ pointerEvents: "none", padding: "4px 10px", fontSize: 12 }}
    >
      {children}
    </span>
  );
}

function SeasonBadge({ match }) {
  if (!match?.label) return null;
  return <span className={`wardrobeSeasonBadge ${match.tone}`}>{match.label}</span>;
}

function ItemActions({ item, tab, onToggleFavorite, onEdit, onArchive, onUnarchive, onDelete, isBusy, allowFavorites, allowArchive }) {
  return (
    <>
      {allowFavorites ? (
        <button
          type="button"
          className={item.is_favorite ? "wardrobeIconBtn fav active" : "wardrobeIconBtn fav"}
          onClick={() => onToggleFavorite(item.id)}
          aria-label="Toggle favorite"
          title="Favorite"
        >
          {item.is_favorite ? "\u2665" : "\u2661"}
        </button>
      ) : null}

      <button
        type="button"
        className="wardrobeIconBtn"
        onClick={() => onEdit(item)}
        aria-label="Edit item"
        title="Edit"
      >
        {"\u270E"}
      </button>

      {allowArchive ? (
        tab === "active" ? (
          <button
            type="button"
            className="wardrobeIconBtn"
            onClick={() => onArchive(item.id)}
            aria-label="Archive item"
            title="Archive"
            disabled={isBusy}
          >
            {isBusy ? "..." : "\u21E7"}
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
            {isBusy ? "..." : "\u21BA"}
          </button>
        )
      ) : null}

      <button
        type="button"
        className="wardrobeIconBtn danger"
        onClick={() => onDelete(item.id)}
        aria-label="Delete item"
        title="Delete"
      >
        {"\u2715"}
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

function metadataSummary(item) {
  const tags = [];
  if (item.clothing_type) tags.push(optionLabel(item.clothing_type));
  if (item.layer_type) tags.push(`${optionLabel(item.layer_type)} layer`);
  if (item.is_one_piece) tags.push("One-piece");
  if (item.set_id) tags.push(`Set: ${item.set_id}`);
  for (const tag of Array.isArray(item.style_tags) ? item.style_tags.slice(0, 2) : []) tags.push(optionLabel(tag));
  for (const tag of Array.isArray(item.occasion_tags) ? item.occasion_tags.slice(0, 1) : []) tags.push(`${optionLabel(tag)} ready`);
  for (const tag of Array.isArray(item.season_tags) ? item.season_tags.slice(0, 2) : []) tags.push(optionLabel(tag));
  return tags.slice(0, 6);
}

function colorList(raw) {
  return (raw || "").toString().split(",").map((part) => part.trim()).filter(Boolean);
}

function SelectionCheckbox({ isSelected }) {
  return (
    <span className={"wardrobeSelectCheck" + (isSelected ? " on" : "")} aria-hidden="true">
      {isSelected ? "\u2713" : ""}
    </span>
  );
}

function WardrobeItemCard({
  item,
  view,
  tab,
  bodyFitOn,
  userBodyType,
  bodyFitRating,
  onToggleFavorite,
  onEdit,
  onArchive,
  onUnarchive,
  onDelete,
  isItemBusy,
  allowFavorites = true,
  allowArchive = true,
  onTiltMove,
  onTiltLeave,
  seasonalModeEnabled = false,
  currentSeason = "",
  selectionMode = false,
  isSelected = false,
  onToggleSelect,
}) {
  const fitText = fitLabel(item.fit_tag || item.fitTag || item.fit);
  const isBusy = isItemBusy(item.id);
  const actionProps = { item, tab, onToggleFavorite, onEdit, onArchive, onUnarchive, onDelete, isBusy, allowFavorites, allowArchive };
  const badges = metadataSummary(item);
  const [imgError, setImgError] = useState(false);
  const colors = colorList(item.color);
  const seasonMatch = seasonalModeEnabled ? getSeasonMatch(item, currentSeason) : null;
  const seasonToneClass = seasonMatch ? `wardrobeSeasonTone-${seasonMatch.tone}` : "";
  const selectionClass = selectionMode ? ` wardrobeSelectable${isSelected ? " wardrobeSelected" : ""}` : "";
  const handleSelectionClick = (e) => {
    if (!selectionMode) return;
    e.preventDefault();
    e.stopPropagation();
    if (typeof onToggleSelect === "function") onToggleSelect(item.id);
  };

  if (view === "list") {
    return (
      <div
        className={`wardrobeRowItem ${seasonToneClass}${selectionClass}`.trim()}
        onClick={selectionMode ? handleSelectionClick : undefined}
        role={selectionMode ? "button" : undefined}
        aria-pressed={selectionMode ? isSelected : undefined}
      >
        <div className="wardrobeRowLeft">
          <div className="wardrobeThumbWrap sm">
            {item.image_url && !imgError ? (
              <img className="wardrobeThumbImg sm" src={resolveImageUrl(item.image_url)} alt={item.name} onError={() => setImgError(true)} />
            ) : (
              <div className="wardrobeThumb sm" aria-hidden="true" />
            )}
            {selectionMode ? <SelectionCheckbox isSelected={isSelected} /> : null}
          </div>

          <div className="wardrobeRowText">
            <div className="wardrobeItemName">{item.name}</div>
            <div className="wardrobeMetaRow">
              <div className="wardrobeItemMeta">
                {item.category} | Fit: {fitText}
                <BodyFitBadge item={item} bodyFitOn={bodyFitOn} userBodyType={userBodyType} bodyFitRating={bodyFitRating} inline />
              </div>
              <SeasonBadge match={seasonMatch} />
            </div>
            {colors.length ? (
              <div className="wardrobeColorRow">
                {colors.map((color) => (
                  <span key={`${item.id}-${color}`} className="wardrobeColorChip">
                    <span className="wardrobeColorSwatch" style={{ background: colorToCss(color) }} aria-hidden="true" />
                    {color}
                  </span>
                ))}
              </div>
            ) : null}
            {badges.length ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {badges.map((badge) => <MetaBadge key={badge}>{badge}</MetaBadge>)}
              </div>
            ) : null}
          </div>
        </div>

        {selectionMode ? null : (
          <div className="wardrobeRowActions">
            <ItemActions {...actionProps} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`wardrobeCard ${seasonToneClass}${selectionClass}`.trim()}
      onPointerMove={selectionMode ? undefined : onTiltMove}
      onPointerLeave={selectionMode ? undefined : onTiltLeave}
      onClick={selectionMode ? handleSelectionClick : undefined}
      role={selectionMode ? "button" : undefined}
      aria-pressed={selectionMode ? isSelected : undefined}
    >
      <div className="wardrobeThumbWrap">
        {item.image_url && !imgError ? (
          <img className="wardrobeThumbImg" src={resolveImageUrl(item.image_url)} alt={item.name} onError={() => setImgError(true)} />
        ) : (
          <div className="wardrobeThumb" aria-hidden="true" />
        )}
        {selectionMode ? <SelectionCheckbox isSelected={isSelected} /> : null}
      </div>

      <div className="wardrobeCardBody">
        <div className="wardrobeItemName">{item.name}</div>
        <div className="wardrobeMetaRow">
          <div className="wardrobeItemMeta">
            {item.category} | Fit: {fitText}
          </div>
          <SeasonBadge match={seasonMatch} />
        </div>
        {colors.length ? (
          <div className="wardrobeColorRow">
            {colors.map((color) => (
              <span key={`${item.id}-${color}`} className="wardrobeColorChip">
                <span className="wardrobeColorSwatch" style={{ background: colorToCss(color) }} aria-hidden="true" />
                {color}
              </span>
            ))}
          </div>
        ) : null}
        <BodyFitBadge item={item} bodyFitOn={bodyFitOn} userBodyType={userBodyType} bodyFitRating={bodyFitRating} />

        {badges.length ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            {badges.map((badge) => <MetaBadge key={badge}>{badge}</MetaBadge>)}
          </div>
        ) : null}

        {selectionMode ? null : (
          <div className="wardrobeCardActions">
            <ItemActions {...actionProps} />
          </div>
        )}
      </div>
    </div>
  );
}

export default React.memo(WardrobeItemCard);
