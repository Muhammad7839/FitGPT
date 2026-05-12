// Manual outfit builder for experimenting with wardrobe combinations.
import React, { useMemo, useState } from "react";
import ReactDOM from "react-dom";
import { savedOutfitsApi } from "../api/savedOutfitsApi";
import { trackRecommendationPersonalization, PERSONALIZATION_ACTIONS } from "../utils/recommendationPersonalization";

const SLOT_META = [
  { key: "top", label: "Top" },
  { key: "outerwear", label: "Outerwear" },
  { key: "bottom", label: "Bottom" },
  { key: "shoes", label: "Shoes" },
  { key: "onePiece", label: "One-piece" },
];

function normalizeText(value) {
  return (value || "").toString().trim().toLowerCase();
}

function builderRole(item) {
  const category = normalizeText(item?.category);
  const clothingType = normalizeText(item?.clothing_type || item?.clothingType || item?.type || item?.name);
  const layerType = normalizeText(item?.layer_type || item?.layerType);

  if (clothingType.includes("dress") || clothingType.includes("jumpsuit") || clothingType.includes("romper")) return "onePiece";
  if (category === "outerwear" || layerType === "outer" || clothingType.includes("jacket") || clothingType.includes("coat") || clothingType.includes("blazer")) return "outerwear";
  if (category === "shoes" || clothingType.includes("shoe") || clothingType.includes("boot") || clothingType.includes("sneaker")) return "shoes";
  if (category === "bottoms" || clothingType.includes("pants") || clothingType.includes("jeans") || clothingType.includes("skirt") || clothingType.includes("shorts")) return "bottom";
  if (category === "tops") return "top";
  return "";
}

function itemSummary(item) {
  return item?.name || item?.clothing_type || item?.category || "Wardrobe item";
}

function applySlotChange(prev, item, nextRole) {
  const next = { ...prev };
  let notice = "";

  if (nextRole === "onePiece") {
    next.onePiece = item;
    next.top = null;
    next.bottom = null;
    notice = "One-piece styling replaced the separate top and bottom.";
  } else {
    next[nextRole] = item;
    if (next.onePiece && (nextRole === "top" || nextRole === "bottom")) {
      next.onePiece = null;
      notice = "Adding separate pieces replaced the one-piece layer.";
    }
  }

  return { next, notice };
}

function slotItems(slots) {
  return [slots.onePiece, slots.top, slots.outerwear, slots.bottom, slots.shoes].filter(Boolean);
}

export default function ManualOutfitBuilder({ items = [], user, open = false, onClose }) {
  const [activeShelf, setActiveShelf] = useState("all");
  const [draggingId, setDraggingId] = useState("");
  const [dropTarget, setDropTarget] = useState("");
  const [slots, setSlots] = useState({
    top: null,
    outerwear: null,
    bottom: null,
    shoes: null,
    onePiece: null,
  });
  const [builderMsg, setBuilderMsg] = useState("");
  const [saveMsg, setSaveMsg] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const availableItems = useMemo(
    () => (Array.isArray(items) ? items : []).filter((item) => item && item.is_active !== false && builderRole(item)),
    [items]
  );

  const shelfGroups = useMemo(() => {
    return {
      all: availableItems,
      tops: availableItems.filter((item) => {
        const role = builderRole(item);
        return role === "top" || role === "onePiece";
      }),
      layers: availableItems.filter((item) => builderRole(item) === "outerwear"),
      bottoms: availableItems.filter((item) => builderRole(item) === "bottom"),
      shoes: availableItems.filter((item) => builderRole(item) === "shoes"),
    };
  }, [availableItems]);

  const shelfItems = shelfGroups[activeShelf] || shelfGroups.all;
  const builtItems = slotItems(slots);

  function addItemToBuilder(item) {
    const role = builderRole(item);
    if (!role) {
      setBuilderMsg("That category is not in the builder yet.");
      return;
    }
    const { next, notice } = applySlotChange(slots, item, role);
    setSlots(next);
    setBuilderMsg(notice || `${itemSummary(item)} added to your outfit.`);
  }

  function handleDragStart(event, item) {
    event.dataTransfer.setData("text/plain", (item?.id ?? "").toString());
    event.dataTransfer.effectAllowed = "move";
    setDraggingId((item?.id ?? "").toString());
  }

  function handleDrop(event, explicitRole = "") {
    event.preventDefault();
    const itemId = event.dataTransfer.getData("text/plain") || draggingId;
    const item = availableItems.find((entry) => String(entry?.id) === String(itemId));
    setDropTarget("");
    setDraggingId("");
    if (!item) return;

    const role = explicitRole || builderRole(item);
    if (!role) {
      setBuilderMsg("That item is not supported in the builder yet.");
      return;
    }
    const { next, notice } = applySlotChange(slots, item, role);
    setSlots(next);
    setBuilderMsg(notice || `${itemSummary(item)} dropped into your outfit.`);
  }

  function removeSlot(role) {
    setSlots((prev) => ({ ...prev, [role]: null }));
    setBuilderMsg(`${SLOT_META.find((entry) => entry.key === role)?.label || "Layer"} removed.`);
  }

  async function saveBuilderOutfit() {
    const itemIds = builtItems.map((item) => item?.id).filter(Boolean);
    if (!itemIds.length) {
      setSaveMsg("Add a few pieces before saving.");
      return;
    }
    setIsSaving(true);
    try {
      const res = await savedOutfitsApi.saveOutfit(
        {
          items: itemIds,
          item_details: builtItems.map((item) => ({
            id: (item?.id ?? "").toString(),
            name: item?.name || "",
            category: item?.category || "",
            color: item?.color || "",
            image_url: item?.image_url || "",
          })),
          source: "manual-builder",
          context: { occasion: "Manual outfit builder" },
        },
        user
      );
      trackRecommendationPersonalization({ user, outfit: builtItems, action: PERSONALIZATION_ACTIONS.SELECT });
      setSaveMsg(res?.message || (res?.created ? "Saved to outfits." : "Saved."));
    } catch {
      setSaveMsg("Could not save that outfit right now.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!open) return null;

  return ReactDOM.createPortal(
    <div className="modalOverlay" role="dialog" aria-modal="true" aria-labelledby="manual-builder-title" onClick={onClose}>
      <div className="modalCard manualBuilderModalCard" onClick={(event) => event.stopPropagation()}>
        <section className="manualBuilderSection">
          <div className="manualBuilderHeader">
            <div>
              <div id="manual-builder-title" className="manualBuilderTitle">Build your outfit</div>
            </div>

            <div className="manualBuilderActions">
              <button type="button" className="btn" onClick={onClose}>
                Close
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setSlots({ top: null, outerwear: null, bottom: null, shoes: null, onePiece: null });
                  setBuilderMsg("Builder reset.");
                }}
              >
                Reset
              </button>
              <button type="button" className="btn primary" onClick={saveBuilderOutfit} disabled={isSaving || !builtItems.length}>
                {isSaving ? "Saving..." : "Save outfit"}
              </button>
            </div>
          </div>

          {builderMsg ? <div className="manualBuilderNote">{builderMsg}</div> : null}
          {saveMsg ? <div className="manualBuilderNote subtle">{saveMsg}</div> : null}

          <div className="manualBuilderLayout">
            <div className="manualBuilderShelf">
              <div className="manualBuilderShelfTabs">
                {[
                  { key: "all", label: "All pieces" },
                  { key: "tops", label: "Tops" },
                  { key: "layers", label: "Outerwear" },
                  { key: "bottoms", label: "Bottoms" },
                  { key: "shoes", label: "Shoes" },
                ].map((entry) => (
                  <button
                    key={entry.key}
                    type="button"
                    className={activeShelf === entry.key ? "manualBuilderTab active" : "manualBuilderTab"}
                    onClick={() => setActiveShelf(entry.key)}
                  >
                    {entry.label}
                  </button>
                ))}
              </div>

              <div className="manualBuilderShelfList">
                {shelfItems.map((item) => (
                  <div
                    key={item.id}
                    className={"manualBuilderShelfItem" + (draggingId === String(item.id) ? " dragging" : "")}
                    draggable
                    onDragStart={(event) => handleDragStart(event, item)}
                    onDragEnd={() => {
                      setDraggingId("");
                      setDropTarget("");
                    }}
                  >
                    {item.image_url ? (
                      <img className="manualBuilderShelfImg" src={item.image_url} alt={item.name || "Wardrobe item"} />
                    ) : (
                      <div className="manualBuilderShelfPh" aria-hidden="true" />
                    )}
                    <div className="manualBuilderShelfBody">
                      <div className="manualBuilderShelfName">{itemSummary(item)}</div>
                      <div className="manualBuilderShelfMeta">
                        {[item.category, SLOT_META.find((entry) => entry.key === builderRole(item))?.label || "Builder"]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </div>
                    <button type="button" className="manualBuilderAddBtn" onClick={() => addItemToBuilder(item)}>
                      Add
                    </button>
                  </div>
                ))}
                {!shelfItems.length ? <div className="manualBuilderEmpty">No builder-ready items in this filter yet.</div> : null}
              </div>
            </div>

            <div
              className={"manualBuilderStage" + (dropTarget ? " isActive" : "")}
              onDragOver={(event) => {
                event.preventDefault();
                setDropTarget("stage");
              }}
              onDragLeave={() => setDropTarget("")}
              onDrop={(event) => handleDrop(event)}
            >
              <div className="manualBuilderStageHeader">
                <div className="manualBuilderStageTitle">Outfit builder</div>
              </div>

              <div className="manualBuilderFigure">
                <div className="manualBuilderFigureHead" />
                <div className="manualBuilderFigureTorso" />
                <div className="manualBuilderFigureHip" />
                <div className="manualBuilderFigureLeg left" />
                <div className="manualBuilderFigureLeg right" />
                <div className="manualBuilderFigureFoot left" />
                <div className="manualBuilderFigureFoot right" />

                {slots.onePiece ? (
                  <div className="manualBuilderLayer onePiece">
                    {slots.onePiece.image_url ? <img src={slots.onePiece.image_url} alt={slots.onePiece.name || "One-piece"} /> : <div className="manualBuilderLayerPh" />}
                  </div>
                ) : null}
                {slots.top ? (
                  <div className="manualBuilderLayer top">
                    {slots.top.image_url ? <img src={slots.top.image_url} alt={slots.top.name || "Top"} /> : <div className="manualBuilderLayerPh" />}
                  </div>
                ) : null}
                {slots.outerwear ? (
                  <div className="manualBuilderLayer outerwear">
                    {slots.outerwear.image_url ? <img src={slots.outerwear.image_url} alt={slots.outerwear.name || "Outerwear"} /> : <div className="manualBuilderLayerPh" />}
                  </div>
                ) : null}
                {slots.bottom ? (
                  <div className="manualBuilderLayer bottom">
                    {slots.bottom.image_url ? <img src={slots.bottom.image_url} alt={slots.bottom.name || "Bottom"} /> : <div className="manualBuilderLayerPh" />}
                  </div>
                ) : null}
                {slots.shoes ? (
                  <div className="manualBuilderLayer shoes">
                    {slots.shoes.image_url ? <img src={slots.shoes.image_url} alt={slots.shoes.name || "Shoes"} /> : <div className="manualBuilderLayerPh" />}
                  </div>
                ) : null}
              </div>

              <div className="manualBuilderSlots">
                {SLOT_META.map((slot) => {
                  const item = slots[slot.key];
                  const isActive = dropTarget === slot.key;
                  return (
                    <div
                      key={slot.key}
                      className={"manualBuilderSlot" + (isActive ? " isActive" : "")}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setDropTarget(slot.key);
                      }}
                      onDragLeave={() => setDropTarget("")}
                      onDrop={(event) => handleDrop(event, slot.key)}
                    >
                      <div className="manualBuilderSlotLabel">{slot.label}</div>
                      {item ? (
                        <div className="manualBuilderSlotCard">
                          {item.image_url ? <img className="manualBuilderSlotImg" src={item.image_url} alt={item.name || slot.label} /> : <div className="manualBuilderSlotPh" />}
                          <div className="manualBuilderSlotText">{itemSummary(item)}</div>
                          <button type="button" className="manualBuilderRemoveBtn" onClick={() => removeSlot(slot.key)}>
                            Remove
                          </button>
                        </div>
                      ) : (
                        <div className="manualBuilderSlotEmpty" aria-hidden="true" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>,
    document.body
  );
}
