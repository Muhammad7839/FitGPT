import React, { useMemo, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { wardrobeApi } from "../api/wardrobeApi";

const CATEGORIES = ["All Items", "Tops", "Bottoms", "Outerwear", "Shoes", "Accessories"];

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function fileIsOk(file) {
  const isImage = file.type === "image/jpeg" || file.type === "image/png" || file.type === "image/webp";
  const under10mb = file.size <= 10 * 1024 * 1024;
  return isImage && under10mb;
}

function fileToObjectUrl(file) {
  return URL.createObjectURL(file);
}

export default function Wardrobe() {
  const fileInputRef = useRef(null);

  const [items, setItems] = useState([]);
  const [activeCategory, setActiveCategory] = useState("All Items");
  const [query, setQuery] = useState("");
  const [bodyFitOn, setBodyFitOn] = useState(true);
  const [view, setView] = useState("grid");
  const [toast, setToast] = useState("");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [pendingPreview, setPendingPreview] = useState("");
  const [pendingFile, setPendingFile] = useState(null);

  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("Tops");
  const [formColor, setFormColor] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [addError, setAddError] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("Tops");
  const [editColor, setEditColor] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [editError, setEditError] = useState("");

  React.useEffect(() => {
    let alive = true;
    wardrobeApi.getItems().then((data) => {
      if (!alive) return;
      const list = Array.isArray(data) ? data : [];
      setItems(list);
    }).catch(() => {
      // if API is not configured, local mode still works via wardrobeApi fallback
      wardrobeApi.getItems().then((data) => {
        if (!alive) return;
        setItems(Array.isArray(data) ? data : []);
      }).catch(() => {});
    });

    return () => { alive = false; };
  }, []);

  const counts = useMemo(() => {
    const map = {
      "All Items": items.filter((x) => x.is_active !== false).length,
      Tops: 0,
      Bottoms: 0,
      Outerwear: 0,
      Shoes: 0,
      Accessories: 0,
    };

    for (const it of items) {
      if (it.is_active === false) continue;
      const cat = it.category;
      if (map[cat] !== undefined) map[cat] += 1;
    }
    return map;
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return items.filter((it) => {
      if (it.is_active === false) return false;

      const catOk = activeCategory === "All Items" ? true : it.category === activeCategory;

      const qOk = !q ? true : `${it.name} ${it.color} ${it.category}`.toLowerCase().includes(q);

      return catOk && qOk;
    });
  }, [items, activeCategory, query]);

  const openPicker = () => fileInputRef.current?.click();

  const resetAddForm = () => {
    setPendingPreview("");
    setPendingFile(null);
    setFormName("");
    setFormCategory("Tops");
    setFormColor("");
    setAddError("");
  };

  const openAddModalForFile = (file) => {
    if (!file) return;

    if (!fileIsOk(file)) {
      setToast("Only JPG/PNG/WEBP up to 10MB are supported.");
      window.setTimeout(() => setToast(""), 2500);
      return;
    }

    try {
      const preview = fileToObjectUrl(file);
      setPendingPreview(preview);
      setPendingFile(file);

      const niceName = file.name.replace(/\.[^/.]+$/, "");
      setFormName(niceName);
      setFormCategory(guessCategoryFromName(file.name));
      setFormColor("");
      setAddError("");

      setAddOpen(true);
    } catch {
      setToast("Upload failed. Try again.");
      window.setTimeout(() => setToast(""), 2500);
    }
  };

  const onPickFile = (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    if (files.length > 1) {
      setToast("Add one item at a time so you can fill the details.");
      window.setTimeout(() => setToast(""), 2500);
    }

    openAddModalForFile(files[0]);

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onPickFile(e.dataTransfer.files);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const saveNewItem = async () => {
    setAddError("");

    const name = formName.trim();
    const color = formColor.trim();

    if (!pendingFile) {
      setAddError("Please pick an image again.");
      return;
    }
    if (!name) {
      setAddError("Please enter an item name.");
      return;
    }
    if (!color) {
      setAddError("Please enter a color.");
      return;
    }

    setIsSaving(true);

    try {
      const created = await wardrobeApi.createItem({
        name,
        category: formCategory,
        color,
        imageFile: pendingFile,
      });

      // Update UI immediately
      const localShadow = {
        id: created?.id || uid(),
        name,
        category: formCategory,
        color,
        image_url: created?.image_url || "",
        is_active: created?.is_active ?? true,
        is_favorite: created?.is_favorite ?? false,
      };

      setItems((prev) => [localShadow, ...prev]);

      setIsSaving(false);
      setAddOpen(false);
      resetAddForm();

      setToast("Item added.");
      window.setTimeout(() => setToast(""), 2000);
    } catch (e) {
      setIsSaving(false);
      setAddError(e?.message || "Upload failed. Please try again.");
    }
  };

  const cancelAdd = () => {
    if (isSaving) return;
    setAddOpen(false);
    resetAddForm();
  };

  const askDelete = (id) => {
    setPendingDeleteId(id);
    setConfirmOpen(true);
  };

  const cancelDelete = () => {
    if (isDeleting) return;
    setConfirmOpen(false);
    setPendingDeleteId(null);
  };

  const confirmDelete = async () => {
    if (!pendingDeleteId) return;

    setIsDeleting(true);

    try {
      await wardrobeApi.deleteItem(pendingDeleteId);

      setItems((prev) =>
        prev.map((x) => (x.id === pendingDeleteId ? { ...x, is_active: false } : x))
      );

      setIsDeleting(false);
      setConfirmOpen(false);
      setPendingDeleteId(null);

      setToast("Moved to trash.");
      window.setTimeout(() => setToast(""), 2000);
    } catch (e) {
      setIsDeleting(false);
      setToast(e?.message || "Delete failed.");
      window.setTimeout(() => setToast(""), 2500);
    }
  };

  const openEdit = (item) => {
    if (!item) return;
    setEditId(item.id);
    setEditName(item.name || "");
    setEditCategory(item.category || "Tops");
    setEditColor(item.color || "");
    setEditError("");
    setEditOpen(true);
  };

  const cancelEdit = () => {
    if (isUpdating) return;
    setEditOpen(false);
    setEditId(null);
    setEditName("");
    setEditCategory("Tops");
    setEditColor("");
    setEditError("");
  };

  const saveEdit = async () => {
    setEditError("");
    if (!editId) return;

    const name = editName.trim();
    const color = editColor.trim();

    if (!name) {
      setEditError("Please enter an item name.");
      return;
    }
    if (!color) {
      setEditError("Please enter a color.");
      return;
    }

    setIsUpdating(true);

    try {
      await wardrobeApi.updateItem(editId, { name, category: editCategory, color });

      setItems((prev) =>
        prev.map((it) => (it.id === editId ? { ...it, name, category: editCategory, color } : it))
      );

      setIsUpdating(false);
      setEditOpen(false);

      setToast("Changes saved.");
      window.setTimeout(() => setToast(""), 2000);
    } catch (e) {
      setIsUpdating(false);
      setEditError(e?.message || "Could not save changes.");
    }
  };

  const toggleFavorite = (id) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, is_favorite: !(it.is_favorite === true) } : it))
    );
  };

  return (
    <div className="onboarding onboardingPage">
      <div className="wardrobeHeader">
        <div>
          <div className="wardrobeTitleRow">
            <div className="wardrobeTitle">Wardrobe</div>
          </div>
          <div className="wardrobeSub">Upload and manage your clothing items</div>
        </div>

        <button type="button" className="wardrobeAddBtn" onClick={openPicker}>
          + Add Items
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          style={{ display: "none" }}
          onChange={(e) => onPickFile(e.target.files)}
        />
      </div>

      <section
        className="card wardrobeUploadCard"
        onDrop={onDrop}
        onDragOver={onDragOver}
        role="button"
        tabIndex={0}
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") openPicker();
        }}
      >
        <div className="wardrobeUploadInner">
          <div className="wardrobeUploadIcon" aria-hidden="true" />
          <div className="wardrobeUploadTitle">Upload Wardrobe Items</div>
          <div className="wardrobeUploadSub">Drag and drop photos or click to browse</div>
          <button
            type="button"
            className="wardrobeChooseBtn"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              openPicker();
            }}
          >
            Choose Files
          </button>
          <div className="wardrobeUploadHint">Supports JPG, PNG, WEBP up to 10MB each</div>
        </div>
      </section>

      <section className="wardrobeControls">
        <div className="wardrobeSearchWrap">
          <input
            className="wardrobeSearch"
            placeholder="Search your wardrobe..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="wardrobeControlRight">
          <button
            type="button"
            className={bodyFitOn ? "wardrobeChipBtn active" : "wardrobeChipBtn"}
            onClick={() => setBodyFitOn((v) => !v)}
          >
            Body Type Fit
          </button>

          <button
            type="button"
            className="wardrobeChipBtn"
            onClick={() => setToast("Filter UI coming next.")}
          >
            Filter
          </button>

          <div className="wardrobeViewToggle">
            <button
              type="button"
              className={view === "grid" ? "wardrobeViewBtn active" : "wardrobeViewBtn"}
              onClick={() => setView("grid")}
              aria-label="Grid view"
            >
              ▦
            </button>
            <button
              type="button"
              className={view === "list" ? "wardrobeViewBtn active" : "wardrobeViewBtn"}
              onClick={() => setView("list")}
              aria-label="List view"
            >
              ≡
            </button>
          </div>
        </div>
      </section>

      <section className="wardrobeTabs">
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat;
          const label =
            cat === "All Items"
              ? `All Items (${counts["All Items"]})`
              : `${cat} (${counts[cat] || 0})`;

          return (
            <button
              key={cat}
              type="button"
              className={isActive ? "wardrobeTab active" : "wardrobeTab"}
              onClick={() => setActiveCategory(cat)}
            >
              {label}
            </button>
          );
        })}
      </section>

      <section className={view === "grid" ? "wardrobeGrid" : "wardrobeList"}>
        {filtered.map((it) =>
          view === "grid" ? (
            <div key={it.id} className="wardrobeCard">
              <div className="wardrobeThumbWrap">
                {it.image_url ? (
                  <img className="wardrobeThumbImg" src={it.image_url} alt={it.name} />
                ) : (
                  <div className="wardrobeThumb" aria-hidden="true" />
                )}
              </div>

              {bodyFitOn ? (
                <div className="wardrobeBadge good">
                  {Math.random() < 0.45 ? "Great Fit" : "Good Fit"}
                </div>
              ) : null}

              <div className="wardrobeCardBody">
                <div className="wardrobeItemName">{it.name}</div>
                <div className="wardrobeItemMeta">
                  {it.category} · {it.color}
                </div>

                <div className="wardrobeCardActions">
                  <button
                    type="button"
                    className={it.is_favorite ? "wardrobeIconBtn fav active" : "wardrobeIconBtn fav"}
                    onClick={() => toggleFavorite(it.id)}
                    aria-label="Toggle favorite"
                    title="Favorite"
                  >
                    {it.is_favorite ? "♥" : "♡"}
                  </button>

                  <button
                    type="button"
                    className="wardrobeIconBtn"
                    onClick={() => openEdit(it)}
                    aria-label="Edit item"
                    title="Edit"
                  >
                    ✎
                  </button>

                  <button
                    type="button"
                    className="wardrobeIconBtn danger"
                    onClick={() => askDelete(it.id)}
                    aria-label="Move to trash"
                    title="Trash"
                  >
                    🗑
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div key={it.id} className="wardrobeRowItem">
              <div className="wardrobeRowLeft">
                <div className="wardrobeThumbWrap sm">
                  {it.image_url ? (
                    <img className="wardrobeThumbImg sm" src={it.image_url} alt={it.name} />
                  ) : (
                    <div className="wardrobeThumb sm" aria-hidden="true" />
                  )}
                </div>

                <div className="wardrobeRowText">
                  <div className="wardrobeItemName">{it.name}</div>
                  <div className="wardrobeItemMeta">
                    {it.category} · {it.color}
                  </div>
                </div>
              </div>

              <div className="wardrobeRowActions">
                <button
                  type="button"
                  className={it.is_favorite ? "wardrobeIconBtn fav active" : "wardrobeIconBtn fav"}
                  onClick={() => toggleFavorite(it.id)}
                  aria-label="Toggle favorite"
                  title="Favorite"
                >
                  {it.is_favorite ? "♥" : "♡"}
                </button>

                <button
                  type="button"
                  className="wardrobeIconBtn"
                  onClick={() => openEdit(it)}
                  aria-label="Edit item"
                  title="Edit"
                >
                  ✎
                </button>

                <button
                  type="button"
                  className="wardrobeIconBtn danger"
                  onClick={() => askDelete(it.id)}
                  aria-label="Move to trash"
                  title="Trash"
                >
                  🗑
                </button>
              </div>
            </div>
          )
        )}

        {!filtered.length ? (
          <div className="wardrobeEmpty">
            <div className="wardrobeEmptyTitle">No items found</div>
            <div className="wardrobeEmptySub">Try a different category or search term.</div>
          </div>
        ) : null}
      </section>

      {addOpen ? (
        <div className="modalOverlay" role="dialog" aria-modal="true">
          <div className="modalCard">
            <div className="modalTitle">Add wardrobe item</div>
            <div className="modalSub">Fill in the details before saving.</div>

            <div className="wardrobeAddPreview">
              {pendingPreview ? (
                <img className="wardrobeAddPreviewImg" src={pendingPreview} alt="Preview" />
              ) : null}
            </div>

            <div className="wardrobeAddForm">
              <label className="wardrobeLabel">
                Item name
                <input
                  className="wardrobeInput"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Example: White tee"
                />
              </label>

              <label className="wardrobeLabel">
                Category
                <select
                  className="wardrobeInput"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                >
                  {CATEGORIES.filter((c) => c !== "All Items").map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>

              <label className="wardrobeLabel">
                Color
                <input
                  className="wardrobeInput"
                  value={formColor}
                  onChange={(e) => setFormColor(e.target.value)}
                  placeholder="Example: Black"
                />
              </label>

              {addError ? <div className="wardrobeFormError">{addError}</div> : null}
            </div>

            <div className="modalActions">
              <button type="button" className="btnSecondary" onClick={cancelAdd} disabled={isSaving}>
                Cancel
              </button>
              <button type="button" className="btnPrimary" onClick={saveNewItem} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save item"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editOpen ? (
        <div className="modalOverlay" role="dialog" aria-modal="true">
          <div className="modalCard">
            <div className="modalTitle">Edit item</div>
            <div className="modalSub">Update the details and save changes.</div>

            <div className="wardrobeAddForm">
              <label className="wardrobeLabel">
                Item name
                <input
                  className="wardrobeInput"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Example: White tee"
                />
              </label>

              <label className="wardrobeLabel">
                Category
                <select
                  className="wardrobeInput"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                >
                  {CATEGORIES.filter((c) => c !== "All Items").map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>

              <label className="wardrobeLabel">
                Color
                <input
                  className="wardrobeInput"
                  value={editColor}
                  onChange={(e) => setEditColor(e.target.value)}
                  placeholder="Example: Black"
                />
              </label>

              {editError ? <div className="wardrobeFormError">{editError}</div> : null}
            </div>

            <div className="modalActions">
              <button type="button" className="btnSecondary" onClick={cancelEdit} disabled={isUpdating}>
                Cancel
              </button>
              <button type="button" className="btnPrimary" onClick={saveEdit} disabled={isUpdating}>
                {isUpdating ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmOpen ? (
        <div className="modalOverlay" role="dialog" aria-modal="true">
          <div className="modalCard">
            <div className="modalTitle">Move item to trash?</div>
            <div className="modalSub">This will hide the item from your wardrobe (soft delete).</div>

            <div className="modalActions">
              <button type="button" className="btnSecondary" onClick={cancelDelete} disabled={isDeleting}>
                Cancel
              </button>
              <button type="button" className="btnPrimary" onClick={confirmDelete} disabled={isDeleting}>
                {isDeleting ? "Moving..." : "Move to trash"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? <div className="wardrobeToast">{toast}</div> : null}

      <nav className="dashBottomNav" aria-label="Dashboard navigation">
        <NavLink to="/dashboard" className={({ isActive }) => `dashNavItem ${isActive ? "dashNavActive" : ""}`}>
          Today
        </NavLink>
        <NavLink to="/wardrobe" className={({ isActive }) => `dashNavItem ${isActive ? "dashNavActive" : ""}`}>
          Wardrobe
        </NavLink>
        <NavLink to="/favorites" className={({ isActive }) => `dashNavItem ${isActive ? "dashNavActive" : ""}`}>
          Favorites
        </NavLink>
        <NavLink to="/profile" className={({ isActive }) => `dashNavItem ${isActive ? "dashNavActive" : ""}`}>
          Profile
        </NavLink>
      </nav>
    </div>
  );
}

function guessCategoryFromName(name) {
  const n = (name || "").toLowerCase();

  if (n.includes("shoe") || n.includes("sneaker") || n.includes("heel") || n.includes("boot")) return "Shoes";
  if (n.includes("jacket") || n.includes("coat") || n.includes("blazer") || n.includes("hoodie")) return "Outerwear";
  if (n.includes("pant") || n.includes("jean") || n.includes("trouser") || n.includes("skirt") || n.includes("short")) return "Bottoms";
  if (n.includes("bag") || n.includes("hat") || n.includes("belt") || n.includes("scarf") || n.includes("watch")) return "Accessories";

  return "Tops";
}