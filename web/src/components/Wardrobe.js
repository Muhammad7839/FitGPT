import React, { useMemo, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { wardrobeApi } from "../api/wardrobeApi";
import { useAuth } from "../auth/AuthProvider";

const CATEGORIES = ["All Items", "Tops", "Bottoms", "Outerwear", "Shoes", "Accessories"];

const FIT_TAG_OPTIONS = [
  { value: "unknown", label: "Unknown" },
  { value: "slim", label: "Slim" },
  { value: "regular", label: "Regular" },
  { value: "relaxed", label: "Relaxed" },
  { value: "oversized", label: "Oversized" },
  { value: "tailored", label: "Tailored" },
  { value: "athletic", label: "Athletic" },
  { value: "petite", label: "Petite" },
  { value: "plus", label: "Plus" },
];

const GUEST_WARDROBE_KEY = "fitgpt_guest_wardrobe_v1";
const OPEN_ADD_ITEM_FLAG = "fitgpt_open_add_item";

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function loadGuestItems() {
  const raw = sessionStorage.getItem(GUEST_WARDROBE_KEY);
  const parsed = raw ? safeParse(raw) : null;
  return Array.isArray(parsed) ? parsed : [];
}

function saveGuestItems(items) {
  sessionStorage.setItem(GUEST_WARDROBE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("fitgpt:guest-wardrobe-changed"));
}

function fileIsOk(file) {
  const isImage = file.type === "image/jpeg" || file.type === "image/png" || file.type === "image/webp";
  const under10mb = file.size <= 10 * 1024 * 1024;
  return isImage && under10mb;
}

function fileToObjectUrl(file) {
  return URL.createObjectURL(file);
}

function normalizeFitTag(raw) {
  const v = (raw || "").toString().trim().toLowerCase();
  if (!v) return "unknown";
  const allowed = new Set(FIT_TAG_OPTIONS.map((x) => x.value));
  return allowed.has(v) ? v : "unknown";
}

function fitLabel(value) {
  const v = normalizeFitTag(value);
  return FIT_TAG_OPTIONS.find((x) => x.value === v)?.label || "Unknown";
}

function isNetworkError(e) {
  const msg = (e?.message || "").toString().toLowerCase();
  return msg.includes("failed to fetch") || msg.includes("networkerror") || msg.includes("load failed");
}

function guessCategoryFromName(name) {
  const n = (name || "").toLowerCase();
  if (n.includes("shoe") || n.includes("sneaker") || n.includes("heel") || n.includes("boot")) return "Shoes";
  if (n.includes("jacket") || n.includes("coat") || n.includes("blazer") || n.includes("hoodie")) return "Outerwear";
  if (n.includes("pant") || n.includes("jean") || n.includes("trouser") || n.includes("skirt") || n.includes("short")) return "Bottoms";
  if (n.includes("bag") || n.includes("hat") || n.includes("belt") || n.includes("scarf") || n.includes("watch")) return "Accessories";
  return "Tops";
}

export default function Wardrobe() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const fileInputRef = useRef(null);

  const [backendOffline, setBackendOffline] = useState(false);
  const effectiveSignedIn = !!user && !backendOffline;

  const [items, setItems] = useState(() => (effectiveSignedIn ? [] : loadGuestItems()));
  const [activeCategory, setActiveCategory] = useState("All Items");
  const [query, setQuery] = useState("");
  const [bodyFitOn, setBodyFitOn] = useState(true);
  const [view, setView] = useState("grid");
  const [toast, setToast] = useState("");

  const [tab, setTab] = useState("active");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [pendingPreview, setPendingPreview] = useState("");
  const [pendingFile, setPendingFile] = useState(null);

  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("Tops");
  const [formColor, setFormColor] = useState("");
  const [formFitTag, setFormFitTag] = useState("unknown");
  const [isSaving, setIsSaving] = useState(false);
  const [addError, setAddError] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("Tops");
  const [editColor, setEditColor] = useState("");
  const [editFitTag, setEditFitTag] = useState("unknown");
  const [isUpdating, setIsUpdating] = useState(false);
  const [editError, setEditError] = useState("");

  const [isArchiving, setIsArchiving] = useState(false);
  const [pendingArchiveId, setPendingArchiveId] = useState(null);

  React.useEffect(() => {
    let alive = true;

    async function load() {
      try {
        if (effectiveSignedIn) {
          const data = await wardrobeApi.getItems();
          if (!alive) return;
          setItems(Array.isArray(data) ? data : []);
        } else {
          const local = loadGuestItems();
          if (!alive) return;
          setItems(Array.isArray(local) ? local : []);
        }
      } catch (e) {
        if (!alive) return;

        if (effectiveSignedIn && isNetworkError(e)) {
          setBackendOffline(true);
          const local = loadGuestItems();
          setItems(Array.isArray(local) ? local : []);
          setToast("Backend offline. Using local demo data.");
          window.setTimeout(() => setToast(""), 2200);
          return;
        }

        if (!effectiveSignedIn) setItems(loadGuestItems());
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [effectiveSignedIn]);

  React.useEffect(() => {
    if (!effectiveSignedIn) {
      saveGuestItems(items);
    }
  }, [items, effectiveSignedIn]);

  const activeItems = useMemo(() => items.filter((x) => x && x.is_active !== false), [items]);
  const archivedItems = useMemo(() => items.filter((x) => x && x.is_active === false), [items]);

  const counts = useMemo(() => {
    const source = tab === "archived" ? archivedItems : activeItems;

    const map = {
      "All Items": source.length,
      Tops: 0,
      Bottoms: 0,
      Outerwear: 0,
      Shoes: 0,
      Accessories: 0,
    };

    for (const it of source) {
      const cat = it.category;
      if (map[cat] !== undefined) map[cat] += 1;
    }
    return map;
  }, [activeItems, archivedItems, tab]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = tab === "archived" ? archivedItems : activeItems;

    return base.filter((it) => {
      const catOk = activeCategory === "All Items" ? true : it.category === activeCategory;
      const fit = fitLabel(it.fit_tag || it.fitTag || it.fit);
      const qOk = !q ? true : `${it.name} ${it.color} ${it.category} ${fit}`.toLowerCase().includes(q);
      return catOk && qOk;
    });
  }, [activeItems, archivedItems, tab, activeCategory, query]);

  const openPicker = () => fileInputRef.current?.click();

  React.useEffect(() => {
    const flag = sessionStorage.getItem(OPEN_ADD_ITEM_FLAG);
    if (flag === "1") {
      sessionStorage.removeItem(OPEN_ADD_ITEM_FLAG);
      window.setTimeout(() => openPicker(), 50);
    }
  }, [user]);

  const resetAddForm = () => {
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingPreview("");
    setPendingFile(null);
    setFormName("");
    setFormCategory("Tops");
    setFormColor("");
    setFormFitTag("unknown");
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
      setFormFitTag("unknown");
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
    const fit_tag = normalizeFitTag(formFitTag);

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
      if (!effectiveSignedIn) {
        const localItem = {
          id: uid(),
          name,
          category: formCategory,
          color,
          fit_tag,
          image_url: pendingPreview || "",
          is_active: true,
          is_favorite: false,
        };

        setItems((prev) => [localItem, ...prev]);

        setIsSaving(false);
        setAddOpen(false);
        resetAddForm();

        setToast(backendOffline ? "Saved locally for demo." : "Item added (guest mode).");
        window.setTimeout(() => setToast(""), 2000);
        return;
      }

      const created = await wardrobeApi.createItem({
        name,
        category: formCategory,
        color,
        fit_tag,
        imageFile: pendingFile,
      });

      const localShadow = {
        id: created?.id || uid(),
        name,
        category: formCategory,
        color,
        fit_tag: created?.fit_tag ?? fit_tag,
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
      if (effectiveSignedIn && isNetworkError(e)) {
        setBackendOffline(true);

        const localItem = {
          id: uid(),
          name,
          category: formCategory,
          color,
          fit_tag,
          image_url: pendingPreview || "",
          is_active: true,
          is_favorite: false,
        };

        setItems((prev) => [localItem, ...prev]);

        setIsSaving(false);
        setAddOpen(false);
        resetAddForm();

        setToast("Backend offline. Saved locally for demo.");
        window.setTimeout(() => setToast(""), 2200);
        return;
      }

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
      if (!effectiveSignedIn) {
        setItems((prev) => prev.filter((x) => x.id !== pendingDeleteId));
        setIsDeleting(false);
        setConfirmOpen(false);
        setPendingDeleteId(null);
        setToast(backendOffline ? "Deleted (demo)." : "Deleted (guest mode).");
        window.setTimeout(() => setToast(""), 2000);
        return;
      }

      await wardrobeApi.deleteItem(pendingDeleteId);
      setItems((prev) => prev.filter((x) => x.id !== pendingDeleteId));

      setIsDeleting(false);
      setConfirmOpen(false);
      setPendingDeleteId(null);

      setToast("Deleted.");
      window.setTimeout(() => setToast(""), 2000);
    } catch (e) {
      if (effectiveSignedIn && isNetworkError(e)) {
        setBackendOffline(true);

        setItems((prev) => prev.filter((x) => x.id !== pendingDeleteId));
        setIsDeleting(false);
        setConfirmOpen(false);
        setPendingDeleteId(null);

        setToast("Backend offline. Deleted locally for demo.");
        window.setTimeout(() => setToast(""), 2200);
        return;
      }

      setIsDeleting(false);
      setToast(e?.message || "Delete failed.");
      window.setTimeout(() => setToast(""), 2500);
    }
  };

  const archiveItem = async (id) => {
    const current = items.find((x) => x.id === id);
    if (!current) return;

    setIsArchiving(true);
    setPendingArchiveId(id);

    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, is_active: false } : x)));

    try {
      if (effectiveSignedIn) {
        await wardrobeApi.archiveItem(id);
      }
      setToast("Archived.");
      window.setTimeout(() => setToast(""), 2000);
      if (tab === "active" && activeCategory !== "All Items") {
        const stillHas = items.some((x) => x.is_active !== false && x.category === activeCategory);
        if (!stillHas) setActiveCategory("All Items");
      }
    } catch (e) {
      if (effectiveSignedIn && isNetworkError(e)) {
        setBackendOffline(true);
        setToast("Backend offline. Archived locally for demo.");
        window.setTimeout(() => setToast(""), 2200);
      } else {
        setItems((prev) => prev.map((x) => (x.id === id ? { ...x, is_active: true } : x)));
        setToast(e?.message || "Could not archive item.");
        window.setTimeout(() => setToast(""), 2500);
      }
    } finally {
      setIsArchiving(false);
      setPendingArchiveId(null);
    }
  };

  const unarchiveItem = async (id) => {
    const current = items.find((x) => x.id === id);
    if (!current) return;

    setIsArchiving(true);
    setPendingArchiveId(id);

    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, is_active: true } : x)));

    try {
      if (effectiveSignedIn) {
        await wardrobeApi.unarchiveItem(id);
      }
      setToast("Unarchived.");
      window.setTimeout(() => setToast(""), 2000);
    } catch (e) {
      if (effectiveSignedIn && isNetworkError(e)) {
        setBackendOffline(true);
        setToast("Backend offline. Unarchived locally for demo.");
        window.setTimeout(() => setToast(""), 2200);
      } else {
        setItems((prev) => prev.map((x) => (x.id === id ? { ...x, is_active: false } : x)));
        setToast(e?.message || "Could not unarchive item.");
        window.setTimeout(() => setToast(""), 2500);
      }
    } finally {
      setIsArchiving(false);
      setPendingArchiveId(null);
    }
  };

  const openEdit = (item) => {
    if (!item) return;
    setEditId(item.id);
    setEditName(item.name || "");
    setEditCategory(item.category || "Tops");
    setEditColor(item.color || "");
    setEditFitTag(normalizeFitTag(item.fit_tag || item.fitTag || item.fit));
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
    setEditFitTag("unknown");
    setEditError("");
  };

  const saveEdit = async () => {
    setEditError("");
    if (!editId) return;

    const name = editName.trim();
    const color = editColor.trim();
    const fit_tag = normalizeFitTag(editFitTag);

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
      if (!effectiveSignedIn) {
        setItems((prev) =>
          prev.map((it) => (it.id === editId ? { ...it, name, category: editCategory, color, fit_tag } : it))
        );

        setIsUpdating(false);
        setEditOpen(false);

        setToast(backendOffline ? "Changes saved (demo)." : "Changes saved (guest mode).");
        window.setTimeout(() => setToast(""), 2000);
        return;
      }

      await wardrobeApi.updateItem(editId, { name, category: editCategory, color, fit_tag });

      setItems((prev) =>
        prev.map((it) => (it.id === editId ? { ...it, name, category: editCategory, color, fit_tag } : it))
      );

      setIsUpdating(false);
      setEditOpen(false);

      setToast("Changes saved.");
      window.setTimeout(() => setToast(""), 2000);
    } catch (e) {
      if (effectiveSignedIn && isNetworkError(e)) {
        setBackendOffline(true);

        setItems((prev) =>
          prev.map((it) => (it.id === editId ? { ...it, name, category: editCategory, color, fit_tag } : it))
        );

        setIsUpdating(false);
        setEditOpen(false);

        setToast("Backend offline. Changes saved locally for demo.");
        window.setTimeout(() => setToast(""), 2200);
        return;
      }

      setIsUpdating(false);
      setEditError(e?.message || "Could not save changes.");
    }
  };

  const toggleFavorite = async (id) => {
    const current = items.find((x) => x.id === id);
    const nextVal = !(current?.is_favorite === true);

    if (!effectiveSignedIn && !backendOffline) {
      setToast("Favorites require an account.");
      window.setTimeout(() => setToast(""), 2000);
      return;
    }

    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, is_favorite: nextVal } : it)));

    try {
      if (effectiveSignedIn) {
        await wardrobeApi.setFavorite(id, nextVal);
      }
    } catch (e) {
      if (effectiveSignedIn && isNetworkError(e)) {
        setBackendOffline(true);
        setToast("Backend offline. Favorite saved locally for demo.");
        window.setTimeout(() => setToast(""), 2200);
        return;
      }

      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, is_favorite: !nextVal } : it)));
      setToast(e?.message || "Could not update favorite.");
      window.setTimeout(() => setToast(""), 2500);
    }
  };

  const isItemBusy = (id) => isArchiving && pendingArchiveId === id;

  return (
    <div className="onboarding onboardingPage">
      <div className="wardrobeHeader">
        <div>
          <div className="wardrobeTitleRow">
            <div className="wardrobeTitle">Wardrobe</div>
          </div>
          <div className="wardrobeSub">
            Upload and manage your clothing items
            {!effectiveSignedIn ? " (demo/guest mode: saved in this browser session)" : ""}
          </div>
        </div>

        {!effectiveSignedIn && !backendOffline ? (
          <button type="button" className="btn primary" onClick={() => navigate("/auth")}>
            Sign in to save
          </button>
        ) : null}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          style={{ display: "none" }}
          onChange={(e) => onPickFile(e.target.files)}
        />
      </div>

      <section className="wardrobeTabs" style={{ marginTop: 10 }}>
        <button
          type="button"
          className={tab === "active" ? "wardrobeTab active" : "wardrobeTab"}
          onClick={() => {
            setTab("active");
            setActiveCategory("All Items");
          }}
          aria-pressed={tab === "active" ? "true" : "false"}
        >
          Active ({activeItems.length})
        </button>
        <button
          type="button"
          className={tab === "archived" ? "wardrobeTab active" : "wardrobeTab"}
          onClick={() => {
            setTab("archived");
            setActiveCategory("All Items");
          }}
          aria-pressed={tab === "archived" ? "true" : "false"}
        >
          Archived ({archivedItems.length})
        </button>
      </section>

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
            placeholder={tab === "archived" ? "Search archived items..." : "Search your wardrobe..."}
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

          <button type="button" className="wardrobeChipBtn" onClick={() => setToast("Filter UI coming next.")}>
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
          const label = cat === "All Items" ? `All Items (${counts["All Items"]})` : `${cat} (${counts[cat] || 0})`;

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

              {tab === "active" && bodyFitOn ? (
                <div className="wardrobeBadge good">{Math.random() < 0.45 ? "Great Fit" : "Good Fit"}</div>
              ) : null}

              <div className="wardrobeCardBody">
                <div className="wardrobeItemName">{it.name}</div>
                <div className="wardrobeItemMeta">
                  {it.category} · {it.color} · Fit: {fitLabel(it.fit_tag || it.fitTag || it.fit)}
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

                  {tab === "active" ? (
                    <button
                      type="button"
                      className="wardrobeIconBtn"
                      onClick={() => archiveItem(it.id)}
                      aria-label="Archive item"
                      title="Archive"
                      disabled={isItemBusy(it.id)}
                    >
                      {isItemBusy(it.id) ? "…" : "⤓"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="wardrobeIconBtn"
                      onClick={() => unarchiveItem(it.id)}
                      aria-label="Unarchive item"
                      title="Unarchive"
                      disabled={isItemBusy(it.id)}
                    >
                      {isItemBusy(it.id) ? "…" : "⤒"}
                    </button>
                  )}

                  <button
                    type="button"
                    className="wardrobeIconBtn danger"
                    onClick={() => askDelete(it.id)}
                    aria-label="Delete item"
                    title="Delete"
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
                    {it.category} · {it.color} · Fit: {fitLabel(it.fit_tag || it.fitTag || it.fit)}
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

                {tab === "active" ? (
                  <button
                    type="button"
                    className="wardrobeIconBtn"
                    onClick={() => archiveItem(it.id)}
                    aria-label="Archive item"
                    title="Archive"
                    disabled={isItemBusy(it.id)}
                  >
                    {isItemBusy(it.id) ? "…" : "⤓"}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="wardrobeIconBtn"
                    onClick={() => unarchiveItem(it.id)}
                    aria-label="Unarchive item"
                    title="Unarchive"
                    disabled={isItemBusy(it.id)}
                  >
                    {isItemBusy(it.id) ? "…" : "⤒"}
                  </button>
                )}

                <button
                  type="button"
                  className="wardrobeIconBtn danger"
                  onClick={() => askDelete(it.id)}
                  aria-label="Delete item"
                  title="Delete"
                >
                  🗑
                </button>
              </div>
            </div>
          )
        )}

        {!filtered.length ? (
          <div className="wardrobeEmpty">
            <div className="wardrobeEmptyTitle">{tab === "archived" ? "No archived items found" : "No items found"}</div>
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
              {pendingPreview ? <img className="wardrobeAddPreviewImg" src={pendingPreview} alt="Preview" /> : null}
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
                <select className="wardrobeInput" value={formCategory} onChange={(e) => setFormCategory(e.target.value)}>
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

              <label className="wardrobeLabel">
                Fit (optional)
                <select className="wardrobeInput" value={formFitTag} onChange={(e) => setFormFitTag(e.target.value)}>
                  {FIT_TAG_OPTIONS.map((x) => (
                    <option key={x.value} value={x.value}>
                      {x.label}
                    </option>
                  ))}
                </select>
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
                <select className="wardrobeInput" value={editCategory} onChange={(e) => setEditCategory(e.target.value)}>
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

              <label className="wardrobeLabel">
                Fit (optional)
                <select className="wardrobeInput" value={editFitTag} onChange={(e) => setEditFitTag(e.target.value)}>
                  {FIT_TAG_OPTIONS.map((x) => (
                    <option key={x.value} value={x.value}>
                      {x.label}
                    </option>
                  ))}
                </select>
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
            <div className="modalTitle">Delete item?</div>
            <div className="modalSub">This permanently removes the item.</div>

            <div className="modalActions">
              <button type="button" className="btnSecondary" onClick={cancelDelete} disabled={isDeleting}>
                Cancel
              </button>
              <button type="button" className="btnPrimary" onClick={confirmDelete} disabled={isDeleting}>
                {isDeleting ? "Deleting..." : "Delete"}
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