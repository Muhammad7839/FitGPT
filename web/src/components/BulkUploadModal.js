import React from "react";
import { CATEGORIES as ITEM_CATEGORIES, FIT_TAG_OPTIONS } from "./ItemFormFields";

function BulkUploadModal({ items, onUpdateItem, onRemoveItem, onCancel, onSave, isSaving, error }) {
  return (
    <div className="modalOverlay" role="dialog" aria-modal="true">
      <div className="modalCard" style={{ maxHeight: "85vh", overflow: "auto", width: "min(680px, 96vw)" }}>
        <div className="modalTitle">Add {items.length} item{items.length > 1 ? "s" : ""}</div>
        <div className="modalSub">Review and fill in details for each item.</div>

        <div style={{ display: "grid", gap: 14, marginTop: 12 }}>
          {items.map((entry) => (
            <div
              key={entry._key}
              style={{
                border: "1px solid rgba(0,0,0,0.08)",
                borderRadius: 16,
                padding: 14,
                display: "grid",
                gridTemplateColumns: "80px 1fr auto",
                gap: 12,
                alignItems: "start",
                background: "#fff",
              }}
            >
              <img
                src={entry.preview}
                alt={entry.name}
                style={{ width: 80, height: 80, borderRadius: 12, objectFit: "cover" }}
              />

              <div style={{ display: "grid", gap: 8 }}>
                <input
                  className="wardrobeInput"
                  placeholder="Item name"
                  value={entry.name}
                  onChange={(e) => onUpdateItem(entry._key, "name", e.target.value)}
                />
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={{ flex: 1, position: "relative" }}>
                    <select
                      className="wardrobeInput"
                      value={entry.category}
                      onChange={(e) => onUpdateItem(entry._key, "category", e.target.value)}
                      style={{ width: "100%" }}
                    >
                      {ITEM_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    {entry.classifying && <span className="classifyingHint">Detecting...</span>}
                  </div>
                  <input
                    className="wardrobeInput"
                    placeholder="Color"
                    value={entry.color}
                    onChange={(e) => onUpdateItem(entry._key, "color", e.target.value)}
                    style={{ flex: 1 }}
                  />
                </div>
                <select
                  className="wardrobeInput"
                  value={entry.fitTag}
                  onChange={(e) => onUpdateItem(entry._key, "fitTag", e.target.value)}
                >
                  {FIT_TAG_OPTIONS.map((x) => (
                    <option key={x.value} value={x.value}>{x.label}</option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                className="wardrobeIconBtn danger"
                onClick={() => onRemoveItem(entry._key)}
                title="Remove"
                aria-label="Remove item"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        {error ? <div className="wardrobeFormError" style={{ marginTop: 10 }}>{error}</div> : null}

        <div className="modalActions">
          <button type="button" className="btnSecondary" onClick={onCancel} disabled={isSaving}>
            Cancel
          </button>
          <button
            type="button"
            className="btnPrimary"
            onClick={onSave}
            disabled={isSaving || !items.length}
          >
            {isSaving ? "Saving..." : `Save ${items.length} item${items.length > 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default React.memo(BulkUploadModal);
