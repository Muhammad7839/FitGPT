import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { useNavigate } from "react-router-dom";
import { wardrobeApi } from "../api/wardrobeApi";
import { useAuth } from "../auth/AuthProvider";
import { loadWardrobe, saveWardrobe, loadAnswers } from "../utils/userStorage";
import { classifyFromUrl, preloadModel } from "../utils/classifyClothing";
import { OPEN_ADD_ITEM_FLAG } from "../utils/constants";
import { makeId, normalizeFitTag, fileToDataUrl } from "../utils/helpers";

import ItemFormFields, { CATEGORIES as ITEM_CATEGORIES, FIT_TAG_OPTIONS } from "./ItemFormFields";
import WardrobeItemCard from "./WardrobeItemCard";
import BulkUploadModal from "./BulkUploadModal";

const CATEGORIES = ["All Items", ...ITEM_CATEGORIES];

function fileIsOk(file) {
  const isImage = file.type === "image/jpeg" || file.type === "image/png" || file.type === "image/webp";
  const under10mb = file.size <= 10 * 1024 * 1024;
  return isImage && under10mb;
}

function fileToObjectUrl(file) {
  return URL.createObjectURL(file);
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
    const answers = loadAnswers(user);
    return answers?.bodyType || "rectangle";
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

  // Retry recovery when backendOffline is stuck — check every 5s until reachable
  React.useEffect(() => {
    if (!backendOffline || !user) return;
    let alive = true;
    const check = async () => {
      try {
        await wardrobeApi.getItems();
        if (alive) setBackendOffline(false);
      } catch {}
    };
    const t = setTimeout(check, 2000);
    const iv = setInterval(check, 5000);
    return () => { alive = false; clearTimeout(t); clearInterval(iv); };
  }, [backendOffline, user]);

  const effectiveSignedIn = !!user && !backendOffline;

  const [items, setItems] = useState(() => loadWardrobe(user));
  const [itemsLoaded, setItemsLoaded] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All Items");
  const [query, setQuery] = useState("");
  const [bodyFitOn, setBodyFitOn] = useState(false);
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
  const [isClassifying, setIsClassifying] = useState(false);


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
            // One-time sync: push local items to cloud if API is empty
            setItems(local);
            const validCategories = ["top","bottom","shoes","outerwear","accessory"];
            const validColors = ["black","white","gray","beige","red","blue","green","yellow","purple","orange"];
            const validFits = ["slim","regular","oversized"];
            const validStyles = ["casual","sporty","formal","street"];
            const closest = (val, list, fallback) => {
              if (!val) return fallback;
              const v = val.toLowerCase().trim();
              if (list.includes(v)) return v;
              const match = list.find(l => v.includes(l) || l.includes(v));
              return match || fallback;
            };
            for (const item of local) {
              try {
                await wardrobeApi.createItem({
                  name: item.name || "Unnamed Item",
                  category: closest(item.category, validCategories, "top"),
                  color: closest(item.color, validColors, "black"),
                  fit_type: closest(item.fit_tag || item.fit_type, validFits, "regular"),
                  style_tag: closest(item.style_tag, validStyles, "casual"),
                  image_url: item.image_url || "",
                });
              } catch (_) { /* best-effort */ }
            }
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

  // Start downloading MobileNet model in the background on mount
  useEffect(() => { preloadModel(); }, []);

  const resetAddForm = () => {
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingPreview("");
    setPendingFile(null);
    setFormName("");
    setFormCategory("Tops");
    setFormColor("");
    setFormFitTag("unknown");
    setAddError("");
    setIsClassifying(false);
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
        setIsClassifying(true);

      setAddOpen(true);

      // Run ML classification in the background
      classifyFromUrl(preview).then((result) => {
        if (result.category) setFormCategory(result.category);
        setIsClassifying(false);
      }).catch(() => setIsClassifying(false));
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
            _key: makeId(),
            file,
            preview,
            name: niceName,
            category: guessCategoryFromName(file.name),
            color: "",
            fitTag: "unknown",
            classifying: true,
            userOverrode: false,
          };
        })
      );
      setBulkItems(entries);
      setBulkError("");
      setBulkOpen(true);

      // Classify each entry in parallel
      for (const entry of entries) {
        classifyFromUrl(entry.preview).then((result) => {
          setBulkItems((prev) =>
            prev.map((e) => {
              if (e._key !== entry._key) return e;
              return {
                ...e,
                classifying: false,
                category: result.category && !e.userOverrode ? result.category : e.category,
              };
            })
          );
        }).catch(() => {
          setBulkItems((prev) =>
            prev.map((e) => e._key === entry._key ? { ...e, classifying: false } : e)
          );
        });
      }
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
      if (!user) {
        // Guest mode — save locally only
        const dataUrl = await fileToDataUrl(pendingFile);
        const localItem = {
          id: makeId(),
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

        setToast("Item added (guest mode).");
        window.setTimeout(() => setToast(""), 2000);
        return;
      }

      // Signed in — always try API first (even if backendOffline was previously set)
      // Convert file to data URL so we send JSON (backend doesn't accept FormData)
      let imageUrl = "";
      try { imageUrl = await fileToDataUrl(pendingFile); } catch {}
      const created = await wardrobeApi.createItem({
        name,
        category: formCategory,
        color,
        fit_type: fit_tag || "regular",
        style_tag: "casual",
        image_url: imageUrl,
      });

      // API succeeded — clear offline flag if it was stuck
      if (backendOffline) setBackendOffline(false);

      const localShadow = {
        id: created?.id || makeId(),
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
      if (isNetworkError(e)) {
        setBackendOffline(true);

        let dataUrl = "";
        try { dataUrl = await fileToDataUrl(pendingFile); } catch {}
        const localItem = {
          id: makeId(),
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

      // Non-network API error (e.g. 422) — still save locally
      let dataUrl = "";
      try { dataUrl = await fileToDataUrl(pendingFile); } catch {}
      const localItem = {
        id: makeId(),
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

      setToast("Saved locally.");
      window.setTimeout(() => setToast(""), 2000);
    }
  };

  const cancelAdd = () => {
    if (isSaving) return;
    setAddOpen(false);
    resetAddForm();
  };

  const updateBulkItem = (key, field, value) => {
    setBulkItems((prev) =>
      prev.map((entry) => {
        if (entry._key !== key) return entry;
        const update = { ...entry, [field]: value };
        if (field === "category") update.userOverrode = true;
        return update;
      })
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
        id: makeId(),
        name: entry.name.trim(),
        category: entry.category,
        color: entry.color.trim(),
        fit_tag: normalizeFitTag(entry.fitTag),
        image_url: entry.preview || "",
        is_active: true,
        is_favorite: false,
      }));

      if (!!user) {
        for (const entry of bulkItems) {
          try {
            let imgUrl = entry.preview || "";
            if (!imgUrl && entry.file) {
              try { imgUrl = await fileToDataUrl(entry.file); } catch {}
            }
            await wardrobeApi.createItem({
              name: entry.name.trim(),
              category: entry.category,
              color: entry.color.trim(),
              fit_type: normalizeFitTag(entry.fitTag) || "regular",
              style_tag: "casual",
              image_url: imgUrl,
            });
            if (backendOffline) setBackendOffline(false);
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

  const onTiltMove = useCallback((e) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(800px) rotateX(${-y * 8}deg) rotateY(${x * 8}deg) scale(1.02)`;
  }, []);

  const onTiltLeave = useCallback((e) => {
    e.currentTarget.style.transform = "";
  }, []);

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
            {!effectiveSignedIn && !backendOffline ? (
              <button type="button" className="btn primary" onClick={() => navigate("/auth")} style={{ marginLeft: 12, fontSize: "0.85rem", padding: "6px 16px", verticalAlign: "middle" }}>
                Sign in to save
              </button>
            ) : null}
          </div>
        </div>

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
        {filtered.map((it) => (
          <WardrobeItemCard
            key={it.id}
            item={it}
            view={view}
            tab={tab}
            bodyFitOn={bodyFitOn}
            userBodyType={userBodyType}
            bodyFitRating={bodyFitRating}
            onToggleFavorite={toggleFavorite}
            onEdit={openEdit}
            onArchive={archiveItem}
            onUnarchive={unarchiveItem}
            onDelete={askDelete}
            isItemBusy={isItemBusy}
            onTiltMove={onTiltMove}
            onTiltLeave={onTiltLeave}
          />
        ))}

        {!filtered.length ? (
          <div className="wardrobeEmpty">
            <div className="wardrobeEmptyIcon">{tab === "archived" ? "\u2001" : "\uD83D\uDC54"}</div>
            <div className="wardrobeEmptyTitle">{tab === "archived" ? "No archived items" : "No items found"}</div>
            <div className="wardrobeEmptySub">Try a different category or search term.</div>
          </div>
        ) : null}
      </section>

      {addOpen ? ReactDOM.createPortal(
        <div className="modalOverlay" role="dialog" aria-modal="true">
          <div className="modalCard">
            <div className="modalTitle">Add wardrobe item</div>
            <div className="modalSub">Fill in the details before saving.</div>

            <div className="wardrobeAddPreview">
              {pendingPreview ? <img className="wardrobeAddPreviewImg" src={pendingPreview} alt="Preview" /> : null}
            </div>

            <ItemFormFields
              name={formName} onNameChange={setFormName}
              category={formCategory} onCategoryChange={setFormCategory}
              color={formColor} onColorChange={setFormColor}
              fitTag={formFitTag} onFitTagChange={setFormFitTag}
              isClassifying={isClassifying}
              error={addError}
            />

            <div className="modalActions">
              <button type="button" className="btnSecondary" onClick={cancelAdd} disabled={isSaving}>
                Cancel
              </button>
              <button type="button" className="btnPrimary" onClick={saveNewItem} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save item"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      ) : null}

      {bulkOpen ? (
        <BulkUploadModal
          items={bulkItems}
          onUpdateItem={updateBulkItem}
          onRemoveItem={removeBulkItem}
          onCancel={cancelBulk}
          onSave={saveBulkItems}
          isSaving={isBulkSaving}
          error={bulkError}
        />
      ) : null}

      {editOpen ? ReactDOM.createPortal(
        <div className="modalOverlay" role="dialog" aria-modal="true">
          <div className="modalCard">
            <div className="modalTitle">Edit item</div>
            <div className="modalSub">Update the details and save changes.</div>

            <ItemFormFields
              name={editName} onNameChange={setEditName}
              category={editCategory} onCategoryChange={setEditCategory}
              color={editColor} onColorChange={setEditColor}
              fitTag={editFitTag} onFitTagChange={setEditFitTag}
              error={editError}
            />

            <div className="modalActions">
              <button type="button" className="btnSecondary" onClick={cancelEdit} disabled={isUpdating}>
                Cancel
              </button>
              <button type="button" className="btnPrimary" onClick={saveEdit} disabled={isUpdating}>
                {isUpdating ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>,
        document.body
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

    </div>
  );
}