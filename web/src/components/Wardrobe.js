// web/src/components/Wardrobe.js
import React, { useCallback, useEffect, useMemo, useState } from "react";

const WARDROBE_KEY = "fitgpt_wardrobe_v1";

const CATEGORIES = ["Tops", "Bottoms", "Shoes", "Outerwear", "Dresses", "Accessories", "Activewear"];
const SEASONS = ["All Seasons", "Winter", "Spring", "Summer", "Fall"];
const COMMON_COLORS = [
  "Black",
  "White",
  "Navy",
  "Gray",
  "Beige",
  "Brown",
  "Red",
  "Blue",
  "Green",
  "Pink",
  "Olive",
  "Burgundy",
];

function loadWardrobe() {
  try {
    const raw = localStorage.getItem(WARDROBE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveWardrobe(items) {
  localStorage.setItem(WARDROBE_KEY, JSON.stringify(items));
}

let nextId = Date.now();
function genId() {
  return String(nextId++);
}

export default function Wardrobe() {
  const [items, setItems] = useState(() => loadWardrobe());
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("Tops");
  const [formColor, setFormColor] = useState("");
  const [formSeason, setFormSeason] = useState("All Seasons");
  const [formNotes, setFormNotes] = useState("");

  useEffect(() => {
    saveWardrobe(items);
  }, [items]);

  const filtered = useMemo(() => {
    let result = items;
    if (filter !== "All") {
      result = result.filter((i) => i.category === filter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (i) =>
          i.name?.toLowerCase().includes(q) ||
          i.category?.toLowerCase().includes(q) ||
          i.color?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [items, filter, search]);

  const resetForm = useCallback(() => {
    setFormName("");
    setFormCategory("Tops");
    setFormColor("");
    setFormSeason("All Seasons");
    setFormNotes("");
    setEditingItem(null);
    setShowForm(false);
  }, []);

  const openAdd = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (item) => {
    setFormName(item.name || "");
    setFormCategory(item.category || "Tops");
    setFormColor(item.color || "");
    setFormSeason(item.season || "All Seasons");
    setFormNotes(item.notes || "");
    setEditingItem(item);
    setShowForm(true);
  };

  const handleSave = () => {
    if (!formName.trim()) return;

    const itemData = {
      name: formName.trim(),
      category: formCategory,
      color: formColor.trim(),
      season: formSeason,
      notes: formNotes.trim(),
    };

    if (editingItem) {
      setItems((prev) => prev.map((i) => (i.id === editingItem.id ? { ...i, ...itemData } : i)));
    } else {
      setItems((prev) => [...prev, { id: genId(), ...itemData, dateAdded: Date.now() }]);
    }

    resetForm();
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    setItems((prev) => prev.filter((i) => i.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  const categoryCount = useMemo(() => {
    const counts = { All: items.length };
    CATEGORIES.forEach((c) => {
      counts[c] = items.filter((i) => i.category === c).length;
    });
    return counts;
  }, [items]);

  return (
    <div>
      <div className="wdHeader">
        <div>
          <h2 className="wdTitle">My Wardrobe</h2>
          <div className="dashSubText">
            {items.length} item{items.length !== 1 ? "s" : ""}
          </div>
        </div>
        <button type="button" className="btn primary" onClick={openAdd}>
          + Add item
        </button>
      </div>

      <div className="wdSearch">
        <input
          className="textInput"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search your wardrobe..."
        />
      </div>

      <div className="wdFilterRow">
        {["All", ...CATEGORIES].map((cat) => (
          <button
            key={cat}
            type="button"
            className={`pill wdFilterPill ${filter === cat ? "selected" : ""}`}
            onClick={() => setFilter(cat)}
          >
            {cat}
            {categoryCount[cat] > 0 ? ` (${categoryCount[cat]})` : ""}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card wdEmpty">
          <div className="wdEmptyIcon">
            {items.length === 0 ? "\uD83D\uDC55" : "\uD83D\uDD0D"}
          </div>
          <div className="wdEmptyTitle">
            {items.length === 0 ? "Your wardrobe is empty" : "No items match"}
          </div>
          <div className="dashSubText">
            {items.length === 0
              ? "Add your first clothing item to get started with outfit recommendations."
              : "Try a different search or category filter."}
          </div>
          {items.length === 0 && (
            <div className="buttonRow" style={{ justifyContent: "center" }}>
              <button type="button" className="btn primary" onClick={openAdd}>
                + Add your first item
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="wdGrid">
          {filtered.map((item) => (
            <div key={item.id} className="card wdItem">
              <div className="wdItemThumb">
                {item.color && (
                  <div
                    className="wdColorDot"
                    style={{ background: item.color.toLowerCase() }}
                    title={item.color}
                  />
                )}
              </div>
              <div className="wdItemName">{item.name}</div>
              <div className="wdItemMeta">
                {item.category}
                {item.color ? ` \u00B7 ${item.color}` : ""}
              </div>
              <div className="wdItemMeta">{item.season}</div>
              {item.notes && <div className="wdItemNotes">{item.notes}</div>}
              <div className="wdItemActions">
                <button type="button" className="linkBtn" onClick={() => openEdit(item)}>
                  Edit
                </button>
                <button
                  type="button"
                  className="linkBtn wdDeleteBtn"
                  onClick={() => setDeleteTarget(item)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {showForm && (
        <div className="modalOverlay" onClick={resetForm}>
          <div className="modalContent card" onClick={(e) => e.stopPropagation()}>
            <h2 className="wdTitle">{editingItem ? "Edit item" : "Add new item"}</h2>

            <div className="loginForm">
              <div>
                <div className="fieldLabel">Item name *</div>
                <input
                  className="textInput"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Blue Oxford Shirt"
                  autoFocus
                />
              </div>

              <div>
                <div className="fieldLabel">Category</div>
                <div className="pillGrid wdFormPills">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      className={`pill ${formCategory === cat ? "selected" : ""}`}
                      onClick={() => setFormCategory(cat)}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="fieldLabel">Color</div>
                <div className="pillGrid wdFormPills">
                  {COMMON_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`pill ${formColor === c ? "selected" : ""}`}
                      onClick={() => setFormColor(formColor === c ? "" : c)}
                    >
                      <span
                        className="wdColorDotSm"
                        style={{ background: c.toLowerCase() }}
                      />
                      {c}
                    </button>
                  ))}
                </div>
                <input
                  className="textInput wdColorInput"
                  value={formColor}
                  onChange={(e) => setFormColor(e.target.value)}
                  placeholder="Or type a custom color"
                />
              </div>

              <div>
                <div className="fieldLabel">Season</div>
                <div className="pillGrid wdFormPills">
                  {SEASONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`pill ${formSeason === s ? "selected" : ""}`}
                      onClick={() => setFormSeason(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="fieldLabel">Notes (optional)</div>
                <textarea
                  className="textInput wdTextarea"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Any notes about fit, occasion, etc."
                  rows={3}
                />
              </div>

              <div className="buttonRow">
                <button type="button" className="btn" onClick={resetForm}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn primary"
                  onClick={handleSave}
                  disabled={!formName.trim()}
                >
                  {editingItem ? "Save changes" : "Add to wardrobe"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="modalOverlay" onClick={() => setDeleteTarget(null)}>
          <div className="modalContent card modalSmall" onClick={(e) => e.stopPropagation()}>
            <h2 className="wdTitle">Delete item?</h2>
            <p className="dashSubText">
              Remove &ldquo;{deleteTarget.name}&rdquo; from your wardrobe? This can&rsquo;t be
              undone.
            </p>
            <div className="buttonRow">
              <button type="button" className="btn" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button type="button" className="btn wdDeleteConfirm" onClick={handleDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
