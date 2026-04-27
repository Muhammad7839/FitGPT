import React, { useCallback, useMemo, useState } from "react";

import { savedOutfitsApi } from "../api/savedOutfitsApi";
import { useAuth } from "../auth/AuthProvider";
import useWardrobe from "../hooks/useWardrobe";
import { colorToCss, normalizeCategory } from "../utils/recommendationEngine";
import { getItemSlot, layerOrdered, slotLabel, validateOutfit } from "../utils/outfitLayering";
import ErrorBoundary from "./ErrorBoundary";
import MannequinViewer from "./MannequinViewer";

const CATEGORY_ORDER = ["Tops", "Bottoms", "Outerwear", "Shoes", "Accessories"];

function groupByCategory(items) {
  const groups = Object.fromEntries(CATEGORY_ORDER.map((category) => [category, []]));

  for (const item of Array.isArray(items) ? items : []) {
    const category = normalizeCategory(item?.category) || "Accessories";
    if (!groups[category]) groups[category] = [];
    groups[category].push(item);
  }

  return groups;
}

export default function OutfitBuilder() {
  const { user } = useAuth();
  const wardrobe = useWardrobe(user);
  const [selectedIds, setSelectedIds] = useState([]);
  const [previewMode, setPreviewMode] = useState("grid");
  const [dragOver, setDragOver] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const itemsById = useMemo(() => {
    const next = new Map();
    for (const item of wardrobe) {
      next.set(String(item.id), item);
    }
    return next;
  }, [wardrobe]);

  const groupedWardrobe = useMemo(() => groupByCategory(wardrobe), [wardrobe]);

  const selectedItems = useMemo(
    () => selectedIds.map((id) => itemsById.get(String(id))).filter(Boolean),
    [itemsById, selectedIds]
  );
  const layeredItems = useMemo(() => layerOrdered(selectedItems), [selectedItems]);
  const validation = useMemo(() => validateOutfit(selectedItems), [selectedItems]);
  const bodyType = user?.body_type || user?.bodyType || "rectangle";

  const toggleItem = useCallback((item) => {
    if (!item) return;

    const itemId = String(item.id);
    setSelectedIds((current) => (
      current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId]
    ));
  }, []);

  const handleDrop = useCallback((event) => {
    event.preventDefault();
    setDragOver(false);

    const rawId = event.dataTransfer.getData("text/plain");
    const item = itemsById.get(String(rawId));
    if (item) toggleItem(item);
  }, [itemsById, toggleItem]);

  const handleSave = useCallback(async () => {
    if (!selectedItems.length) {
      setSaveMessage("Add at least one item first.");
      return;
    }

    if (!validation.valid) {
      setSaveMessage("Resolve layering conflicts before saving.");
      return;
    }

    setSaving(true);
    setSaveMessage("");

    try {
      const result = await savedOutfitsApi.saveOutfit(
        {
          items: selectedIds,
          source: "user_built",
          context: { builder: true },
          item_details: selectedItems.map((item) => ({
            id: item.id,
            name: item.name,
            category: item.category,
            color: item.color,
          })),
        },
        user
      );

      setSaveMessage(result?.message || (result?.created ? "Saved." : "Already saved."));
    } catch (error) {
      setSaveMessage(error?.message || "Could not save outfit.");
    } finally {
      setSaving(false);
    }
  }, [selectedIds, selectedItems, user, validation.valid]);

  return (
    <div className="outfitBuilder">
      <div className="outfitBuilderHeader">
        <div>
          <h1 className="outfitBuilderTitle">Outfit Builder</h1>
          <p className="outfitBuilderSub">
            Drag pieces from your wardrobe into the canvas, check layering conflicts, and save a presentation-ready look.
          </p>
        </div>
        <div className="outfitBuilderActions">
          <button type="button" className="btn" onClick={() => { setSelectedIds([]); setSaveMessage(""); }} disabled={selectedIds.length === 0}>
            Clear
          </button>
          <button type="button" className="btn primary" onClick={handleSave} disabled={saving || selectedIds.length === 0 || !validation.valid}>
            {saving ? "Saving..." : "Save outfit"}
          </button>
        </div>
      </div>

      {saveMessage ? <div className="outfitBuilderMsg">{saveMessage}</div> : null}

      <div className="outfitBuilderGrid">
        <aside className="outfitBuilderWardrobe" aria-label="Wardrobe items">
          {wardrobe.length === 0 ? (
            <div className="outfitBuilderEmpty">Your wardrobe is empty. Add items in the wardrobe screen first.</div>
          ) : (
            CATEGORY_ORDER.map((category) => {
              const items = groupedWardrobe[category] || [];
              if (!items.length) return null;

              return (
                <section key={category} className="outfitBuilderGroup">
                  <h2 className="outfitBuilderGroupTitle">{category}</h2>
                  <div className="outfitBuilderGroupItems">
                    {items.map((item) => {
                      const isSelected = selectedIds.includes(String(item.id));
                      return (
                        <button
                          key={item.id}
                          type="button"
                          className={`outfitBuilderItem${isSelected ? " selected" : ""}`}
                          draggable
                          onClick={() => toggleItem(item)}
                          onDragStart={(event) => {
                            event.dataTransfer.setData("text/plain", String(item.id));
                            event.dataTransfer.effectAllowed = "copy";
                          }}
                        >
                          {item.image_url ? (
                            <img className="outfitBuilderItemImg" src={item.image_url} alt={item.name || "Wardrobe item"} />
                          ) : (
                            <div className="outfitBuilderItemImg outfitBuilderItemPlaceholder" />
                          )}
                          <div className="outfitBuilderItemInfo">
                            <span className="outfitBuilderItemName">{item.name || [item.color, item.category].filter(Boolean).join(" ") || "Item"}</span>
                            <span className="outfitBuilderItemColor" style={{ background: colorToCss(item.color) }} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })
          )}
        </aside>

        <section className="outfitBuilderCanvas" aria-label="Current outfit preview">
          <div className="outfitBuilderCanvasHead">
            <span className="outfitBuilderCanvasLabel">
              Your outfit · {selectedItems.length} item{selectedItems.length === 1 ? "" : "s"}
            </span>
            <div className="dashViewToggle">
              <button
                type="button"
                className={`dashViewToggleBtn${previewMode === "grid" ? " active" : ""}`}
                onClick={() => setPreviewMode("grid")}
              >
                Grid
              </button>
              <button
                type="button"
                className={`dashViewToggleBtn${previewMode === "mannequin" ? " active" : ""}`}
                onClick={() => setPreviewMode("mannequin")}
              >
                3D
              </button>
            </div>
          </div>

          {validation.conflicts.length > 0 ? (
            <div className="outfitBuilderConflicts" role="status">
              <div className="outfitBuilderConflictTitle">Layering conflicts</div>
              <ul className="outfitBuilderConflictList">
                {validation.conflicts.map((conflict, index) => (
                  <li key={`${conflict.type}-${index}`}>{conflict.message}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div
            className={`outfitBuilderDropZone${dragOver ? " dragOver" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "copy";
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            {!selectedItems.length ? (
              <div className="outfitBuilderDropHint">
                Drag clothing here or click items on the left to build an outfit.
              </div>
            ) : previewMode === "mannequin" ? (
              <ErrorBoundary fallback={<div className="outfitBuilderDropHint">3D preview unavailable.</div>}>
                <MannequinViewer outfit={selectedItems} bodyType={bodyType} />
              </ErrorBoundary>
            ) : (
              <div className="outfitBuilderSelectedGrid">
                {layeredItems.map((item) => (
                  <div key={item.id} className="outfitBuilderSelectedTile">
                    <button
                      type="button"
                      className="outfitBuilderSelectedRemove"
                      onClick={() => toggleItem(item)}
                      aria-label={`Remove ${item.name || "item"}`}
                    >
                      ×
                    </button>
                    {item.image_url ? (
                      <img className="outfitBuilderSelectedImg" src={item.image_url} alt={item.name || "Selected item"} />
                    ) : (
                      <div className="outfitBuilderSelectedImg outfitBuilderItemPlaceholder" />
                    )}
                    <div className="outfitBuilderSelectedMeta">
                      <div className="outfitBuilderSelectedName">{item.name || [item.color, item.category].filter(Boolean).join(" ") || "Item"}</div>
                      <div className="outfitBuilderSelectedSlot">{slotLabel(getItemSlot(item)) || "item"}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
