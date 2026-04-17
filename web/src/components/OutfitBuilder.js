import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { loadWardrobe } from "../utils/userStorage";
import { savedOutfitsApi } from "../api/savedOutfitsApi";
import { EVT_WARDROBE_CHANGED } from "../utils/constants";
import { normalizeCategory, colorToCss } from "../utils/recommendationEngine";
import { validateOutfit, layerOrdered, getItemSlot, SLOTS, slotLabel } from "../utils/outfitLayering";
import MannequinViewer from "./MannequinViewer";
import ErrorBoundary from "./ErrorBoundary";

const CATEGORY_ORDER = ["Tops", "Bottoms", "Outerwear", "Shoes", "Accessories"];

function groupByCategory(items) {
  const groups = Object.fromEntries(CATEGORY_ORDER.map((c) => [c, []]));
  for (const item of items) {
    const cat = normalizeCategory(item?.category) || "Other";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
  }
  return groups;
}

export default function OutfitBuilder() {
  const { user } = useAuth();
  const [wardrobe, setWardrobe] = useState(() => loadWardrobe(user));
  const [selectedIds, setSelectedIds] = useState([]);
  const [previewMode, setPreviewMode] = useState("grid");
  const [dragOver, setDragOver] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const refresh = () => setWardrobe(loadWardrobe(user));
    window.addEventListener(EVT_WARDROBE_CHANGED, refresh);
    return () => window.removeEventListener(EVT_WARDROBE_CHANGED, refresh);
  }, [user]);

  useEffect(() => {
    setWardrobe(loadWardrobe(user));
  }, [user]);

  const itemsById = useMemo(() => {
    const map = new Map();
    for (const item of wardrobe) map.set(String(item.id), item);
    return map;
  }, [wardrobe]);

  const selectedItems = useMemo(
    () => selectedIds.map((id) => itemsById.get(String(id))).filter(Boolean),
    [selectedIds, itemsById]
  );

  const groups = useMemo(() => groupByCategory(wardrobe), [wardrobe]);
  const validation = useMemo(() => validateOutfit(selectedItems), [selectedItems]);

  const bodyTypeId = useMemo(() => "rectangle", []);

  const addItem = useCallback((item) => {
    if (!item) return;
    setSelectedIds((prev) => {
      const idStr = String(item.id);
      if (prev.includes(idStr)) return prev;
      return [...prev, idStr];
    });
  }, []);

  const removeItem = useCallback((id) => {
    setSelectedIds((prev) => prev.filter((x) => x !== String(id)));
  }, []);

  const clearAll = useCallback(() => {
    setSelectedIds([]);
    setSaveMsg("");
  }, []);

  const onDragStart = (e, item) => {
    e.dataTransfer.setData("text/plain", String(item.id));
    e.dataTransfer.effectAllowed = "copy";
  };

  const onDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (!dragOver) setDragOver(true);
  };

  const onDragLeave = () => setDragOver(false);

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;
    const item = itemsById.get(String(id));
    if (item) addItem(item);
  };

  const handleSave = useCallback(async () => {
    if (!selectedIds.length) {
      setSaveMsg("Add at least one item first.");
      return;
    }
    if (!validation.valid) {
      setSaveMsg("Resolve layering conflicts before saving.");
      return;
    }
    setSaving(true);
    setSaveMsg("");
    try {
      const res = await savedOutfitsApi.saveOutfit(
        {
          items: selectedIds,
          source: "user_built",
          context: { builder: true, built_at: new Date().toISOString() },
          item_details: selectedItems.map((i) => ({
            id: i.id, name: i.name, category: i.category, color: i.color,
          })),
        },
        user
      );
      setSaveMsg(res?.message || (res?.created ? "Saved." : "Already saved."));
    } catch (e) {
      setSaveMsg(e?.message || "Could not save outfit.");
    } finally {
      setSaving(false);
    }
  }, [selectedIds, selectedItems, validation.valid, user]);

  const layeredPreview = useMemo(() => layerOrdered(selectedItems), [selectedItems]);

  return (
    <div className="outfitBuilder">
      <div className="outfitBuilderHeader">
        <div>
          <h1 className="outfitBuilderTitle">Outfit Builder</h1>
          <p className="outfitBuilderSub">
            Drag items from your wardrobe onto the canvas to compose an outfit. Conflicts are flagged live.
          </p>
        </div>
        <div className="outfitBuilderActions">
          <button type="button" className="btn" onClick={clearAll} disabled={selectedIds.length === 0}>
            Clear
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={handleSave}
            disabled={saving || selectedIds.length === 0 || !validation.valid}
          >
            {saving ? "Saving..." : "Save outfit"}
          </button>
        </div>
      </div>

      {saveMsg && <div className="outfitBuilderMsg">{saveMsg}</div>}

      <div className="outfitBuilderGrid">
        <aside className="outfitBuilderWardrobe" aria-label="Wardrobe items">
          {wardrobe.length === 0 ? (
            <div className="outfitBuilderEmpty">
              Your wardrobe is empty. Add items in the Wardrobe tab first.
            </div>
          ) : (
            CATEGORY_ORDER.map((cat) => {
              const group = groups[cat] || [];
              if (group.length === 0) return null;
              return (
                <section key={cat} className="outfitBuilderGroup">
                  <h2 className="outfitBuilderGroupTitle">{cat}</h2>
                  <div className="outfitBuilderGroupItems">
                    {group.map((item) => {
                      const selected = selectedIds.includes(String(item.id));
                      return (
                        <button
                          key={item.id}
                          type="button"
                          className={"outfitBuilderItem" + (selected ? " selected" : "")}
                          draggable
                          onDragStart={(e) => onDragStart(e, item)}
                          onClick={() => (selected ? removeItem(item.id) : addItem(item))}
                          title={selected ? "Click to remove from outfit" : "Click or drag to add"}
                        >
                          {item.image_url ? (
                            <img src={item.image_url} alt={item.name} className="outfitBuilderItemImg" />
                          ) : (
                            <div className="outfitBuilderItemImg outfitBuilderItemPlaceholder" />
                          )}
                          <div className="outfitBuilderItemInfo">
                            <span className="outfitBuilderItemName">{item.name}</span>
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

        <section className="outfitBuilderCanvas" aria-label="Current outfit">
          <div className="outfitBuilderCanvasHead">
            <span className="outfitBuilderCanvasLabel">Your outfit · {selectedIds.length} item{selectedIds.length === 1 ? "" : "s"}</span>
            <div className="dashViewToggle">
              <button
                type="button"
                className={"dashViewToggleBtn" + (previewMode === "grid" ? " active" : "")}
                onClick={() => setPreviewMode("grid")}
              >
                Grid
              </button>
              <button
                type="button"
                className={"dashViewToggleBtn" + (previewMode === "mannequin" ? " active" : "")}
                onClick={() => setPreviewMode("mannequin")}
              >
                3D
              </button>
            </div>
          </div>

          {!validation.valid && validation.conflicts.length > 0 && (
            <div className="outfitBuilderConflicts" role="status">
              <div className="outfitBuilderConflictTitle">Layering conflicts</div>
              <ul className="outfitBuilderConflictList">
                {validation.conflicts.map((c, i) => (
                  <li key={i}>{c.message}</li>
                ))}
              </ul>
            </div>
          )}

          <div
            className={"outfitBuilderDropZone" + (dragOver ? " dragOver" : "")}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            {selectedIds.length === 0 ? (
              <div className="outfitBuilderDropHint">
                Drag clothing here or click items on the left to build an outfit.
              </div>
            ) : previewMode === "mannequin" ? (
              <ErrorBoundary fallback={<div style={{ padding: 24, textAlign: "center" }}>3D view unavailable</div>}>
                <MannequinViewer outfit={selectedItems} bodyType={bodyTypeId} />
              </ErrorBoundary>
            ) : (
              <div className="outfitBuilderSelectedGrid">
                {layeredPreview.map((item) => {
                  const slot = getItemSlot(item);
                  return (
                    <div key={item.id} className="outfitBuilderSelectedTile">
                      <button
                        type="button"
                        className="outfitBuilderSelectedRemove"
                        onClick={() => removeItem(item.id)}
                        aria-label={`Remove ${item.name}`}
                      >
                        &times;
                      </button>
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className="outfitBuilderSelectedImg" />
                      ) : (
                        <div className="outfitBuilderSelectedImg outfitBuilderItemPlaceholder" />
                      )}
                      <div className="outfitBuilderSelectedMeta">
                        <span className="outfitBuilderSelectedName">{item.name}</span>
                        <span className="outfitBuilderSelectedSlot">{slotLabel(slot) || normalizeCategory(item.category)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export { SLOTS };
