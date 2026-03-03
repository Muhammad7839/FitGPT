import React, { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { wardrobeApi } from "../api/wardrobeApi";
import { useAuth } from "../auth/AuthProvider";
import { loadWardrobe, saveWardrobe, userKey, ONBOARDING_ANSWERS_KEY } from "../utils/userStorage";

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

const OPEN_ADD_ITEM_FLAG = "fitgpt_open_add_item";

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

function fileToDataUrl(file, maxSize = 200) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not load image"));
    };
    img.src = objectUrl;
  });
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

// Map wardrobe fit tags to body-type compatibility
// Based on Dashboard.js fitPenalty logic
function bodyFitRating(fitTag, bodyType, category) {
  const tag = normalizeFitTag(fitTag);
  // Map wardrobe fit tags → Dashboard fit categories
  let mapped = "unspecified";
  if (tag === "slim") mapped = "tight";
  else if (tag === "regular") mapped = "regular";
  else if (tag === "relaxed" || tag === "plus") mapped = "relaxed";
  else if (tag === "oversized") mapped = "oversized";
  else if (tag === "tailored" || tag === "athletic" || tag === "petite") mapped = "fitted";

  const body = (bodyType || "rectangle").toString().trim().toLowerCase();
  if (mapped === "unspecified") return "neutral";

  if (body === "apple") {
    if (mapped === "tight") return "poor";
    if (mapped === "fitted" && category === "Tops") return "fair";
    if (mapped === "relaxed" || mapped === "regular") return "great";
    return "good";
  }
  if (body === "pear") {
    if (category === "Tops" && mapped === "oversized") return "poor";
    if (category === "Bottoms" && mapped === "tight") return "fair";
    if (category === "Tops" && (mapped === "fitted" || mapped === "regular")) return "great";
    return "good";
  }
  if (body === "inverted") {
    if (category === "Tops" && mapped === "tight") return "poor";
    if (category === "Bottoms" && mapped === "oversized") return "fair";
    if (category === "Bottoms" && (mapped === "regular" || mapped === "relaxed")) return "great";
    return "good";
  }
  if (body === "hourglass") {
    if (mapped === "oversized") return "fair";
    if (mapped === "fitted" || mapped === "regular") return "great";
    return "good";
  }
  // rectangle — everything works
  return "good";
}

const RATING_META = {
  great: { label: "Great Fit", cls: "bodyFitGreat" },
  good:  { label: "Good Fit",  cls: "bodyFitGood" },
  fair:  { label: "Okay Fit",  cls: "bodyFitFair" },
  poor:  { label: "Not Ideal", cls: "bodyFitPoor" },
  neutral: { label: "", cls: "" },
};

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

  const userBodyType = useMemo(() => {
    try {
      const key = userKey(ONBOARDING_ANSWERS_KEY, user);
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw)?.bodyType || "rectangle";
    } catch {}
    return "rectangle";
  }, [user]);

  const fileInputRef = useRef(null);
  const filterRef = useRef(null);
  const localEditRef = useRef(false); // prevents load effect from clobbering local changes

  // Wraps setItems to also save to storage synchronously and flag local edit,
  // preventing the load effect from clobbering freshly added/modified items.
  const setItemsAndSave = React.useCallback((updater) => {
    setItems((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveWardrobe(next, user);
      return next;
    });
    localEditRef.current = true;
  }, [user]);

  const [backendOffline, setBackendOffline] = useState(false);
  const effectiveSignedIn = !!user && !backendOffline;

  const [items, setItems] = useState(() => loadWardrobe(user));
  const [itemsLoaded, setItemsLoaded] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All Items");
  const [query, setQuery] = useState("");
  const [bodyFitOn, setBodyFitOn] = useState(true);
  const [view, setView] = useState("grid");
  const [toast, setToast] = useState("");

  const [filterOpen, setFilterOpen] = useState(false);
  const [filterColors, setFilterColors] = useState(new Set());
  const [filterFits, setFilterFits] = useState(new Set());

  useEffect(() => {
    if (!filterOpen) return;
    const handleClick = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setFilterOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [filterOpen]);

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

  // Bulk upload state
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkItems, setBulkItems] = useState([]);
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const [bulkError, setBulkError] = useState("");

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

    // Skip re-loading from storage if a local edit just happened —
    // the save effect will persist the current items to storage.
    if (localEditRef.current) {
      localEditRef.current = false;
      setItemsLoaded(true);
      return;
    }

    async function load() {
      // Always start with local data so we never lose items
      const local = loadWardrobe(user);

      try {
        if (effectiveSignedIn) {
          const data = await wardrobeApi.getItems();
          if (!alive) return;
          const apiItems = Array.isArray(data) ? data : [];
          // Only use API data if it has items; otherwise keep local
          if (apiItems.length > 0) {
            setItems(apiItems);
          } else if (local.length > 0) {
            setItems(local);
          } else {
            setItems([]);
          }
        } else {
          if (!alive) return;
          setItems(Array.isArray(local) ? local : []);
        }
      } catch (e) {
        if (!alive) return;

        if (effectiveSignedIn && isNetworkError(e)) {
          setBackendOffline(true);
        }

        // On any error, fall back to local data
        setItems(Array.isArray(local) ? local : []);
      } finally {
        if (alive) setItemsLoaded(true);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [effectiveSignedIn, user]);

  // Always persist to sessionStorage as local backup, regardless of auth state
  React.useEffect(() => {
    if (itemsLoaded) {
      saveWardrobe(items, user);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, itemsLoaded]);

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

  const availableColors = useMemo(() => {
    const source = tab === "archived" ? archivedItems : activeItems;
    const set = new Set();
    for (const it of source) {
      const c = (it.color || "").trim();
      if (c) set.add(c);
    }
    return [...set].sort();
  }, [activeItems, archivedItems, tab]);

  const availableFits = useMemo(() => {
    const source = tab === "archived" ? archivedItems : activeItems;
    const set = new Set();
    for (const it of source) {
      const f = normalizeFitTag(it.fit_tag || it.fitTag || it.fit);
      if (f && f !== "unknown") set.add(f);
    }
    return FIT_TAG_OPTIONS.filter((x) => set.has(x.value));
  }, [activeItems, archivedItems, tab]);

  const activeFilterCount = filterColors.size + filterFits.size;

  const toggleFilterColor = (color) =>
    setFilterColors((prev) => {
      const next = new Set(prev);
      next.has(color) ? next.delete(color) : next.add(color);
      return next;
    });

  const toggleFilterFit = (fitVal) =>
    setFilterFits((prev) => {
      const next = new Set(prev);
      next.has(fitVal) ? next.delete(fitVal) : next.add(fitVal);
      return next;
    });

  const clearFilters = () => {
    setFilterColors(new Set());
    setFilterFits(new Set());
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = tab === "archived" ? archivedItems : activeItems;

    return base.filter((it) => {
      const catOk = activeCategory === "All Items" ? true : it.category === activeCategory;
      const fit = fitLabel(it.fit_tag || it.fitTag || it.fit);
      const qOk = !q ? true : `${it.name} ${it.color} ${it.category} ${fit}`.toLowerCase().includes(q);
      const colorOk = filterColors.size === 0 || filterColors.has((it.color || "").trim());
      const fitOk = filterFits.size === 0 || filterFits.has(normalizeFitTag(it.fit_tag || it.fitTag || it.fit));
      return catOk && qOk && colorOk && fitOk;
    });
  }, [activeItems, archivedItems, tab, activeCategory, query, filterColors, filterFits]);

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

  const onPickFile = async (fileList) => {
    const files = Array.from(fileList || []).filter(fileIsOk);
    if (!files.length) {
      if (fileList?.length) {
        setToast("Only JPG/PNG/WEBP up to 10MB are supported.");
        window.setTimeout(() => setToast(""), 2500);
      }
      return;
    }

    if (files.length === 1) {
      openAddModalForFile(files[0]);
    } else {
      // Bulk upload
      const entries = await Promise.all(
        files.map(async (file) => {
          const preview = await fileToDataUrl(file);
          const niceName = file.name.replace(/\.[^/.]+$/, "");
          return {
            _key: uid(),
            file,
            preview,
            name: niceName,
            category: guessCategoryFromName(file.name),
            color: "",
            fitTag: "unknown",
          };
        })
      );
      setBulkItems(entries);
      setBulkError("");
      setBulkOpen(true);
    }

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
        const dataUrl = await fileToDataUrl(pendingFile);
        const localItem = {
          id: uid(),
          name,
          category: formCategory,
          color,
          fit_tag,
          image_url: dataUrl || "",
          is_active: true,
          is_favorite: false,
        };

        setItemsAndSave((prev) => [localItem, ...prev]);

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

      setItemsAndSave((prev) => [localShadow, ...prev]);

      setIsSaving(false);
      setAddOpen(false);
      resetAddForm();

      setToast("Item added.");
      window.setTimeout(() => setToast(""), 2000);
    } catch (e) {
      if (effectiveSignedIn && isNetworkError(e)) {
        setBackendOffline(true);

        let dataUrl = "";
        try { dataUrl = await fileToDataUrl(pendingFile); } catch {}
        const localItem = {
          id: uid(),
          name,
          category: formCategory,
          color,
          fit_tag,
          image_url: dataUrl,
          is_active: true,
          is_favorite: false,
        };

        setItemsAndSave((prev) => [localItem, ...prev]);

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

  const updateBulkItem = (key, field, value) => {
    setBulkItems((prev) =>
      prev.map((entry) => (entry._key === key ? { ...entry, [field]: value } : entry))
    );
  };

  const removeBulkItem = (key) => {
    setBulkItems((prev) => prev.filter((entry) => entry._key !== key));
  };

  const cancelBulk = () => {
    if (isBulkSaving) return;
    setBulkOpen(false);
    setBulkItems([]);
    setBulkError("");
  };

  const saveBulkItems = async () => {
    setBulkError("");

    const missing = bulkItems.find((e) => !e.name.trim() || !e.color.trim());
    if (missing) {
      setBulkError("Every item needs a name and color.");
      return;
    }

    setIsBulkSaving(true);

    try {
      const newItems = bulkItems.map((entry) => ({
        id: uid(),
        name: entry.name.trim(),
        category: entry.category,
        color: entry.color.trim(),
        fit_tag: normalizeFitTag(entry.fitTag),
        image_url: entry.preview || "",
        is_active: true,
        is_favorite: false,
      }));

      if (effectiveSignedIn) {
        for (const entry of bulkItems) {
          try {
            await wardrobeApi.createItem({
              name: entry.name.trim(),
              category: entry.category,
              color: entry.color.trim(),
              fit_tag: normalizeFitTag(entry.fitTag),
              imageFile: entry.file,
            });
          } catch (e) {
            if (isNetworkError(e)) {
              setBackendOffline(true);
              break;
            }
          }
        }
      }

      setItemsAndSave((prev) => [...newItems, ...prev]);
      setIsBulkSaving(false);
      setBulkOpen(false);
      setBulkItems([]);

      setToast(`${newItems.length} item${newItems.length > 1 ? "s" : ""} added.`);
      window.setTimeout(() => setToast(""), 2000);
    } catch (e) {
      setIsBulkSaving(false);
      setBulkError(e?.message || "Bulk upload failed. Please try again.");
    }
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

    const removeLocally = () => {
      setItemsAndSave((prev) => prev.filter((x) => x.id !== pendingDeleteId));
      setIsDeleting(false);
      setConfirmOpen(false);
      setPendingDeleteId(null);
    };

    try {
      if (!effectiveSignedIn) {
        removeLocally();
        setToast(backendOffline ? "Deleted (demo)." : "Deleted (guest mode).");
        window.setTimeout(() => setToast(""), 2000);
        return;
      }

      await wardrobeApi.deleteItem(pendingDeleteId);
      removeLocally();
      setToast("Deleted.");
      window.setTimeout(() => setToast(""), 2000);
    } catch (e) {
      // Always fall back to local delete if API fails
      removeLocally();

      if (effectiveSignedIn && isNetworkError(e)) {
        setBackendOffline(true);
        setToast("Backend offline. Deleted locally.");
      } else {
        setToast("Deleted locally.");
      }
      window.setTimeout(() => setToast(""), 2200);
      window.setTimeout(() => setToast(""), 2500);
    }
  };

  const archiveItem = async (id) => {
    const current = items.find((x) => x.id === id);
    if (!current) return;

    setIsArchiving(true);
    setPendingArchiveId(id);

    setItemsAndSave((prev) => prev.map((x) => (x.id === id ? { ...x, is_active: false } : x)));
    setToast("Archived.");
    window.setTimeout(() => setToast(""), 2000);

    if (tab === "active" && activeCategory !== "All Items") {
      const stillHas = items.some((x) => x.id !== id && x.is_active !== false && x.category === activeCategory);
      if (!stillHas) setActiveCategory("All Items");
    }

    try {
      if (effectiveSignedIn) await wardrobeApi.archiveItem(id);
    } catch {
      // Ignore API errors — local update is already saved
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

    setItemsAndSave((prev) => prev.map((x) => (x.id === id ? { ...x, is_active: true } : x)));
    setToast("Unarchived.");
    window.setTimeout(() => setToast(""), 2000);

    try {
      if (effectiveSignedIn) await wardrobeApi.unarchiveItem(id);
    } catch {
      // Ignore API errors — local update is already saved
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

    // Always save locally
    setItemsAndSave((prev) =>
      prev.map((it) => (it.id === editId ? { ...it, name, category: editCategory, color, fit_tag } : it))
    );

    setIsUpdating(false);
    setEditOpen(false);
    setToast("Changes saved.");
    window.setTimeout(() => setToast(""), 2000);

    // Best-effort API sync
    try {
      if (effectiveSignedIn) {
        await wardrobeApi.updateItem(editId, { name, category: editCategory, color, fit_tag });
      }
    } catch {
      // Ignore API errors — local update is already saved
    }
  };

  const toggleFavorite = async (id) => {
    const current = items.find((x) => x.id === id);
    const nextVal = !(current?.is_favorite === true);

    // Always update locally first
    setItemsAndSave((prev) => prev.map((it) => (it.id === id ? { ...it, is_favorite: nextVal } : it)));
    setToast(nextVal ? "Added to favorites." : "Removed from favorites.");
    window.setTimeout(() => setToast(""), 1500);

    // Best-effort API sync
    try {
      if (effectiveSignedIn) {
        await wardrobeApi.setFavorite(id, nextVal);
      }
    } catch {
      // Ignore API errors — local update is already saved
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
          multiple
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

          <div className="wardrobeFilterWrap" ref={filterRef}>
            <button
              type="button"
              className={filterOpen || activeFilterCount > 0 ? "wardrobeChipBtn active" : "wardrobeChipBtn"}
              onClick={() => setFilterOpen((v) => !v)}
            >
              Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
            </button>

            {filterOpen && (
              <div className="wardrobeFilterDropdown">
                {availableColors.length > 0 && (
                  <div className="wardrobeFilterSection">
                    <div className="wardrobeFilterHeading">Color</div>
                    <div className="wardrobeFilterChips">
                      {availableColors.map((c) => (
                        <button
                          key={c}
                          type="button"
                          className={filterColors.has(c) ? "wardrobeFilterChip active" : "wardrobeFilterChip"}
                          onClick={() => toggleFilterColor(c)}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {availableFits.length > 0 && (
                  <div className="wardrobeFilterSection">
                    <div className="wardrobeFilterHeading">Fit Type</div>
                    <div className="wardrobeFilterChips">
                      {availableFits.map((f) => (
                        <button
                          key={f.value}
                          type="button"
                          className={filterFits.has(f.value) ? "wardrobeFilterChip active" : "wardrobeFilterChip"}
                          onClick={() => toggleFilterFit(f.value)}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {availableColors.length === 0 && availableFits.length === 0 && (
                  <div className="wardrobeFilterEmpty">No filter options available yet. Add items to your wardrobe first.</div>
                )}

                {activeFilterCount > 0 && (
                  <button type="button" className="wardrobeFilterClear" onClick={clearFilters}>
                    Clear All Filters
                  </button>
                )}
              </div>
            )}
          </div>

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

              <div className="wardrobeCardBody">
                <div className="wardrobeItemName">{it.name}</div>
                <div className="wardrobeItemMeta">
                  {it.category} · {it.color} · Fit: {fitLabel(it.fit_tag || it.fitTag || it.fit)}
                </div>
                {bodyFitOn && (() => {
                  const r = bodyFitRating(it.fit_tag || it.fitTag || it.fit, userBodyType, it.category);
                  const meta = RATING_META[r];
                  return meta?.label ? <span className={`wardrobeBodyFitBadge ${meta.cls}`}>{meta.label}</span> : null;
                })()}

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
                    {bodyFitOn && (() => {
                      const r = bodyFitRating(it.fit_tag || it.fitTag || it.fit, userBodyType, it.category);
                      const meta = RATING_META[r];
                      return meta?.label ? <span className={`wardrobeBodyFitBadge inline ${meta.cls}`}>{meta.label}</span> : null;
                    })()}
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
            <div className="wardrobeEmptyIcon">{tab === "archived" ? "\u2001" : "\uD83D\uDC54"}</div>
            <div className="wardrobeEmptyTitle">{tab === "archived" ? "No archived items" : "No items found"}</div>
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

      {bulkOpen ? (
        <div className="modalOverlay" role="dialog" aria-modal="true">
          <div className="modalCard" style={{ maxHeight: "85vh", overflow: "auto", width: "min(680px, 96vw)" }}>
            <div className="modalTitle">Add {bulkItems.length} item{bulkItems.length > 1 ? "s" : ""}</div>
            <div className="modalSub">Review and fill in details for each item.</div>

            <div style={{ display: "grid", gap: 14, marginTop: 12 }}>
              {bulkItems.map((entry, idx) => (
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
                      onChange={(e) => updateBulkItem(entry._key, "name", e.target.value)}
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      <select
                        className="wardrobeInput"
                        value={entry.category}
                        onChange={(e) => updateBulkItem(entry._key, "category", e.target.value)}
                        style={{ flex: 1 }}
                      >
                        {CATEGORIES.filter((c) => c !== "All Items").map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <input
                        className="wardrobeInput"
                        placeholder="Color"
                        value={entry.color}
                        onChange={(e) => updateBulkItem(entry._key, "color", e.target.value)}
                        style={{ flex: 1 }}
                      />
                    </div>
                    <select
                      className="wardrobeInput"
                      value={entry.fitTag}
                      onChange={(e) => updateBulkItem(entry._key, "fitTag", e.target.value)}
                    >
                      {FIT_TAG_OPTIONS.map((x) => (
                        <option key={x.value} value={x.value}>{x.label}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    className="wardrobeIconBtn danger"
                    onClick={() => removeBulkItem(entry._key)}
                    title="Remove"
                    aria-label="Remove item"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {bulkError ? <div className="wardrobeFormError" style={{ marginTop: 10 }}>{bulkError}</div> : null}

            <div className="modalActions">
              <button type="button" className="btnSecondary" onClick={cancelBulk} disabled={isBulkSaving}>
                Cancel
              </button>
              <button
                type="button"
                className="btnPrimary"
                onClick={saveBulkItems}
                disabled={isBulkSaving || !bulkItems.length}
              >
                {isBulkSaving ? "Saving..." : `Save ${bulkItems.length} item${bulkItems.length > 1 ? "s" : ""}`}
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
          Home
        </NavLink>
        <NavLink to="/wardrobe" className={({ isActive }) => `dashNavItem ${isActive ? "dashNavActive" : ""}`}>
          Wardrobe
        </NavLink>
        <NavLink to="/favorites" className={({ isActive }) => `dashNavItem ${isActive ? "dashNavActive" : ""}`}>
          Favorites
        </NavLink>
        <NavLink to="/history" className={({ isActive }) => `dashNavItem ${isActive ? "dashNavActive" : ""}`}>
          History
        </NavLink>
        <NavLink to="/plans" className={({ isActive }) => `dashNavItem ${isActive ? "dashNavActive" : ""}`}>
          Plans
        </NavLink>
        <NavLink to="/profile" className={({ isActive }) => `dashNavItem ${isActive ? "dashNavActive" : ""}`}>
          Profile
        </NavLink>
      </nav>
    </div>
  );
}