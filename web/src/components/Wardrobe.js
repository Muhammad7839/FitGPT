import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { useNavigate } from "react-router-dom";
import { wardrobeApi } from "../api/wardrobeApi";
import { useAuth } from "../auth/AuthProvider";
import { loadWardrobe, saveWardrobe, loadAnswers, mergeWardrobeWithLocalMetadata } from "../utils/userStorage";
import { classifyFromUrl, preloadModel } from "../utils/classifyClothing";
import { OPEN_ADD_ITEM_FLAG } from "../utils/constants";
import { makeId, normalizeFitTag, fileToDataUrl, isNetworkError, onTiltMove, onTiltLeave } from "../utils/helpers";
import {
  LAYER_TYPE_OPTIONS,
  STYLE_TAG_OPTIONS,
  OCCASION_TAG_OPTIONS,
  SEASON_TAG_OPTIONS,
  clothingTypeOptionsForCategory,
  normalizeItemMetadata,
  normalizeTagList,
  optionLabel,
} from "../utils/wardrobeOptions";

import ItemFormFields, { CATEGORIES as ITEM_CATEGORIES, FIT_TAG_OPTIONS } from "./ItemFormFields";
import WardrobeItemCard from "./WardrobeItemCard";
import BulkUploadModal from "./BulkUploadModal";

const CATEGORIES = ["All Items", ...ITEM_CATEGORIES];

function fileIsOk(file) {
  const isImage = file.type === "image/jpeg" || file.type === "image/png" || file.type === "image/webp";
  const under10mb = file.size <= 10 * 1024 * 1024;
  return isImage && under10mb;
}

function uploadIssueMessage(file) {
  const wrongType = !(file?.type === "image/jpeg" || file?.type === "image/png" || file?.type === "image/webp");
  const tooLarge = Number(file?.size || 0) > 10 * 1024 * 1024;

  if (wrongType && tooLarge) return "Upload not allowed. Use JPG, PNG, or WEBP files under 10MB.";
  if (tooLarge) return "This photo is too large. Please upload an image under 10MB.";
  if (wrongType) return "Upload not allowed. Please use JPG, PNG, or WEBP images.";
  return "Upload failed. Please try another image.";
}

function uploadBatchMessage(invalidFiles, validCount) {
  if (!invalidFiles.length) return "";
  if (invalidFiles.length === 1 && validCount === 0) return uploadIssueMessage(invalidFiles[0]);
  if (validCount > 0) return `${invalidFiles.length} file${invalidFiles.length > 1 ? "s were" : " was"} skipped. Use JPG, PNG, or WEBP files under 10MB.`;
  return "Upload not allowed. Please use JPG, PNG, or WEBP images under 10MB.";
}

function fileToObjectUrl(file) {
  return URL.createObjectURL(file);
}


function fitLabel(value) {
  const v = normalizeFitTag(value);
  return FIT_TAG_OPTIONS.find((x) => x.value === v)?.label || "Unknown";
}


function bodyFitRating(fitTag, bodyType, category) {
  const tag = normalizeFitTag(fitTag);

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

  return "good";
}



const API_CATEGORIES = ["top","bottom","shoes","outerwear","accessory"];
const API_COLORS = ["black","white","gray","beige","red","blue","green","yellow","purple","orange"];
const API_FITS = ["slim","regular","oversized"];
const API_STYLES = ["casual","sporty","formal","street"];

function toApiEnum(val, list, fallback) {
  if (!val) return fallback;
  const v = val.toLowerCase().trim();
  if (list.includes(v)) return v;
  const match = list.find(l => v.includes(l) || l.includes(v));
  return match || fallback;
}

function toApiTagList(value) {
  return normalizeTagList(value);
}

function splitColorTags(value) {
  return (value || "")
    .toString()
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function primaryStyleTag(styleTags) {
  const [first] = toApiTagList(styleTags);
  return first || "casual";
}

function buildWardrobeApiPayload({
  name,
  category,
  color,
  fitTag,
  clothingType = "",
  layerType = "",
  isOnePiece = false,
  setId = "",
  styleTags = [],
  occasionTags = [],
  seasonTags = [],
  imageUrl = "",
}) {
  const normalizedColor = (color || "").toString().trim();
  const normalizedFit = normalizeFitTag(fitTag);

  const payload = {
    name,
    category: toApiEnum(category, API_CATEGORIES, "top"),
    color: toApiEnum(normalizedColor, API_COLORS, "black"),
    colors: splitColorTags(normalizedColor),
    fit_type: toApiEnum(normalizedFit, API_FITS, "regular"),
    fit_tag: normalizedFit,
    style_tag: toApiEnum(primaryStyleTag(styleTags), API_STYLES, "casual"),
    style_tags: toApiTagList(styleTags),
    clothing_type: (clothingType || "").toString().trim(),
    layer_type: (layerType || "").toString().trim(),
    is_one_piece: !!isOnePiece,
    set_id: (setId || "").toString().trim(),
    occasion_tags: toApiTagList(occasionTags),
    season_tags: toApiTagList(seasonTags),
  };

  if (imageUrl) payload.image_url = imageUrl;

  return payload;
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
  const isGuestMode = !user;

  const userBodyType = useMemo(() => {
    const answers = loadAnswers(user);
    return answers?.bodyType || "rectangle";
  }, [user]);

  const fileInputRef = useRef(null);
  const filterRef = useRef(null);
  const localEditRef = useRef(false);
  const setItemsAndSave = useCallback((updater) => {
    setItems((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveWardrobe(next, user);
      return next;
    });
    localEditRef.current = true;
  }, [user]);

  const [backendOffline, setBackendOffline] = useState(false);

 
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
  const [uploadError, setUploadError] = useState("");
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const [showCategoryTabs, setShowCategoryTabs] = useState(false);

  const [filterOpen, setFilterOpen] = useState(false);
  const [filterColors, setFilterColors] = useState(new Set());
  const [filterFits, setFilterFits] = useState(new Set());
  const [filterClothingTypes, setFilterClothingTypes] = useState(new Set());
  const [filterLayers, setFilterLayers] = useState(new Set());
  const [filterStyles, setFilterStyles] = useState(new Set());
  const [filterOccasions, setFilterOccasions] = useState(new Set());
  const [filterSeasons, setFilterSeasons] = useState(new Set());

  useEffect(() => {
    if (!filterOpen) return;
    const handleClick = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setFilterOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [filterOpen]);

  const [tab, setTab] = useState("active");

  useEffect(() => {
    if (isGuestMode && tab !== "active") setTab("active");
  }, [isGuestMode, tab]);

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
  const [formClothingType, setFormClothingType] = useState("");
  const [formLayerType, setFormLayerType] = useState("");
  const [formIsOnePiece, setFormIsOnePiece] = useState(false);
  const [formSetId, setFormSetId] = useState("");
  const [formStyleTags, setFormStyleTags] = useState([]);
  const [formOccasionTags, setFormOccasionTags] = useState([]);
  const [formSeasonTags, setFormSeasonTags] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [addError, setAddError] = useState("");
  const [isClassifying, setIsClassifying] = useState(false);



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
  const [editClothingType, setEditClothingType] = useState("");
  const [editLayerType, setEditLayerType] = useState("");
  const [editIsOnePiece, setEditIsOnePiece] = useState(false);
  const [editSetId, setEditSetId] = useState("");
  const [editStyleTags, setEditStyleTags] = useState([]);
  const [editOccasionTags, setEditOccasionTags] = useState([]);
  const [editSeasonTags, setEditSeasonTags] = useState([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editError, setEditError] = useState("");

  const [isArchiving, setIsArchiving] = useState(false);
  const [pendingArchiveId, setPendingArchiveId] = useState(null);

  React.useEffect(() => {
    let alive = true;


    if (localEditRef.current) {
      localEditRef.current = false;
      setItemsLoaded(true);
      return;
    }

    async function load() {

      const local = loadWardrobe(user);

      try {
        if (effectiveSignedIn) {
          const data = await wardrobeApi.getItems();
          if (!alive) return;
          const apiItems = Array.isArray(data) ? data : [];
          const merged = apiItems.length > 0 ? mergeWardrobeWithLocalMetadata(apiItems, local) : (Array.isArray(local) ? local : []);
          setItems(merged);
        } else {
          if (!alive) return;
          setItems(Array.isArray(local) ? local : []);
        }
      } catch (e) {
        if (!alive) return;

        if (effectiveSignedIn && isNetworkError(e)) {
          setBackendOffline(true);
        }

   
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


  React.useEffect(() => {
    if (itemsLoaded) {
      saveWardrobe(items, user);
    }
   
  }, [items, itemsLoaded, user]);

  const activeItems = useMemo(() => items.filter((x) => x && x.is_active !== false), [items]);
  const archivedItems = useMemo(() => items.filter((x) => x && x.is_active === false), [items]);
  const favoriteItems = useMemo(() => activeItems.filter((x) => x.is_favorite === true), [activeItems]);

  const counts = useMemo(() => {
    const source = tab === "archived" ? archivedItems : tab === "favorites" ? favoriteItems : activeItems;

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
  }, [activeItems, archivedItems, favoriteItems, tab]);

  const availableColors = useMemo(() => {
    const source = tab === "archived" ? archivedItems : tab === "favorites" ? favoriteItems : activeItems;
    const set = new Set();
    for (const it of source) {
      const raw = (it.color || "").trim();
      if (!raw) continue;
      const parts = raw.split(",").map((c) => c.trim()).filter(Boolean);
      for (const c of (parts.length ? parts : [raw])) set.add(c);
    }
    return [...set].sort();
  }, [activeItems, archivedItems, favoriteItems, tab]);

  const availableFits = useMemo(() => {
    const source = tab === "archived" ? archivedItems : tab === "favorites" ? favoriteItems : activeItems;
    const set = new Set();
    for (const it of source) {
      const f = normalizeFitTag(it.fit_tag || it.fitTag || it.fit);
      if (f && f !== "unknown") set.add(f);
    }
    return FIT_TAG_OPTIONS.filter((x) => set.has(x.value));
  }, [activeItems, archivedItems, favoriteItems, tab]);

  const availableClothingTypes = useMemo(() => {
    const source = tab === "archived" ? archivedItems : tab === "favorites" ? favoriteItems : activeItems;
    const options = new Set();
    for (const it of source) {
      const type = (it.clothing_type || "").toString().trim().toLowerCase();
      if (type) options.add(type);
      else {
        for (const option of clothingTypeOptionsForCategory(it.category)) options.add(option);
      }
    }
    return [...options].sort((a, b) => optionLabel(a).localeCompare(optionLabel(b)));
  }, [activeItems, archivedItems, favoriteItems, tab]);

  const availableLayers = useMemo(() => {
    const source = tab === "archived" ? archivedItems : tab === "favorites" ? favoriteItems : activeItems;
    const options = new Set();
    for (const it of source) {
      const layer = (it.layer_type || "").toString().trim().toLowerCase();
      if (layer) options.add(layer);
    }
    return LAYER_TYPE_OPTIONS.filter((option) => option.value && options.has(option.value));
  }, [activeItems, archivedItems, favoriteItems, tab]);

  const availableStyles = useMemo(() => {
    const source = tab === "archived" ? archivedItems : tab === "favorites" ? favoriteItems : activeItems;
    const options = new Set();
    for (const it of source) for (const tag of normalizeTagList(it.style_tags)) options.add(tag);
    return STYLE_TAG_OPTIONS.filter((option) => options.has(option));
  }, [activeItems, archivedItems, favoriteItems, tab]);

  const availableOccasions = useMemo(() => {
    const source = tab === "archived" ? archivedItems : tab === "favorites" ? favoriteItems : activeItems;
    const options = new Set();
    for (const it of source) for (const tag of normalizeTagList(it.occasion_tags)) options.add(tag);
    return OCCASION_TAG_OPTIONS.filter((option) => options.has(option));
  }, [activeItems, archivedItems, favoriteItems, tab]);

  const availableSeasons = useMemo(() => {
    const source = tab === "archived" ? archivedItems : tab === "favorites" ? favoriteItems : activeItems;
    const options = new Set();
    for (const it of source) for (const tag of normalizeTagList(it.season_tags)) options.add(tag);
    return SEASON_TAG_OPTIONS.filter((option) => options.has(option));
  }, [activeItems, archivedItems, favoriteItems, tab]);

  const activeFilterCount = filterColors.size + filterFits.size + filterClothingTypes.size + filterLayers.size + filterStyles.size + filterOccasions.size + filterSeasons.size;

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

  const toggleFilterClothingType = (value) =>
    setFilterClothingTypes((prev) => {
      const next = new Set(prev);
      next.has(value) ? next.delete(value) : next.add(value);
      return next;
    });

  const toggleFilterLayer = (value) =>
    setFilterLayers((prev) => {
      const next = new Set(prev);
      next.has(value) ? next.delete(value) : next.add(value);
      return next;
    });

  const toggleFilterStyle = (value) =>
    setFilterStyles((prev) => {
      const next = new Set(prev);
      next.has(value) ? next.delete(value) : next.add(value);
      return next;
    });

  const toggleFilterOccasion = (value) =>
    setFilterOccasions((prev) => {
      const next = new Set(prev);
      next.has(value) ? next.delete(value) : next.add(value);
      return next;
    });

  const toggleFilterSeason = (value) =>
    setFilterSeasons((prev) => {
      const next = new Set(prev);
      next.has(value) ? next.delete(value) : next.add(value);
      return next;
    });

  const clearFilters = () => {
    setFilterColors(new Set());
    setFilterFits(new Set());
    setFilterClothingTypes(new Set());
    setFilterLayers(new Set());
    setFilterStyles(new Set());
    setFilterOccasions(new Set());
    setFilterSeasons(new Set());
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = tab === "archived" ? archivedItems : tab === "favorites" ? favoriteItems : activeItems;

    return base.filter((it) => {
      const catOk = activeCategory === "All Items" ? true : it.category === activeCategory;
      const fit = fitLabel(it.fit_tag || it.fitTag || it.fit);
      const itemColors = (it.color || "").split(",").map((c) => c.trim()).filter(Boolean);
      const clothingType = (it.clothing_type || "").toString().trim().toLowerCase();
      const layerType = (it.layer_type || "").toString().trim().toLowerCase();
      const styleTags = normalizeTagList(it.style_tags);
      const occasionTags = normalizeTagList(it.occasion_tags);
      const seasonTags = normalizeTagList(it.season_tags);
      const searchBlob = [
        it.name,
        it.color,
        it.category,
        fit,
        clothingType,
        optionLabel(clothingType),
        layerType,
        optionLabel(layerType),
        it.set_id,
        it.is_one_piece ? "one piece" : "",
        ...styleTags,
        ...styleTags.map(optionLabel),
        ...seasonTags,
        ...seasonTags.map(optionLabel),
        ...occasionTags,
        ...occasionTags.map(optionLabel),
      ].join(" ").toLowerCase();
      const qOk = !q ? true : searchBlob.includes(q);
      const colorOk = filterColors.size === 0 || itemColors.some((c) => filterColors.has(c));
      const fitOk = filterFits.size === 0 || filterFits.has(normalizeFitTag(it.fit_tag || it.fitTag || it.fit));
      const clothingTypeOk = filterClothingTypes.size === 0 || (clothingType && filterClothingTypes.has(clothingType));
      const layerOk = filterLayers.size === 0 || (layerType && filterLayers.has(layerType));
      const styleOk = filterStyles.size === 0 || styleTags.some((tag) => filterStyles.has(tag));
      const occasionOk = filterOccasions.size === 0 || occasionTags.some((tag) => filterOccasions.has(tag));
      const seasonOk = filterSeasons.size === 0 || seasonTags.some((tag) => filterSeasons.has(tag));
      return catOk && qOk && colorOk && fitOk && clothingTypeOk && layerOk && styleOk && occasionOk && seasonOk;
    });
  }, [activeItems, archivedItems, favoriteItems, tab, activeCategory, query, filterColors, filterFits, filterClothingTypes, filterLayers, filterStyles, filterOccasions, filterSeasons]);

  const openPicker = () => fileInputRef.current?.click();

  React.useEffect(() => {
    const flag = sessionStorage.getItem(OPEN_ADD_ITEM_FLAG);
    if (flag === "1") {
      sessionStorage.removeItem(OPEN_ADD_ITEM_FLAG);
      window.setTimeout(() => openPicker(), 50);
    }
  }, [user]);

  useEffect(() => { preloadModel(); }, []);

  const resetAddForm = () => {
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingPreview("");
    setPendingFile(null);
    setFormName("");
    setFormCategory("Tops");
    setFormColor("");
    setFormFitTag("unknown");
    setFormClothingType("");
    setFormLayerType("");
    setFormIsOnePiece(false);
    setFormSetId("");
    setFormStyleTags([]);
    setFormOccasionTags([]);
    setFormSeasonTags([]);
    setAddError("");
    setIsClassifying(false);
  };

  const openAddModalForFile = (file) => {
    if (!file) return;

    if (!fileIsOk(file)) {
      const message = uploadIssueMessage(file);
      setUploadError(message);
      setToast(message);
      window.setTimeout(() => setToast(""), 2500);
      return;
    }

    try {
      setUploadError("");
      const preview = fileToObjectUrl(file);
      setPendingPreview(preview);
      setPendingFile(file);

      const niceName = file.name.replace(/\.[^/.]+$/, "");
      setFormName(niceName);
      setFormCategory(guessCategoryFromName(file.name));
      setFormColor("");
      setFormFitTag("unknown");
      setFormClothingType("");
      setFormLayerType("");
      setFormIsOnePiece(false);
      setFormSetId("");
      setFormStyleTags([]);
      setFormOccasionTags([]);
      setFormSeasonTags([]);
      setAddError("");
        setIsClassifying(true);

      setAddOpen(true);

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
    const allFiles = Array.from(fileList || []);
    const files = allFiles.filter(fileIsOk);
    const invalidFiles = allFiles.filter((file) => !fileIsOk(file));
    if (!files.length) {
      if (fileList?.length) {
        const message = uploadBatchMessage(invalidFiles, 0);
        setUploadError(message);
        setToast(message);
        window.setTimeout(() => setToast(""), 2500);
      }
      return;
    }

    if (invalidFiles.length) {
      const message = uploadBatchMessage(invalidFiles, files.length);
      setUploadError(message);
      setToast(message);
      window.setTimeout(() => setToast(""), 2800);
    } else {
      setUploadError("");
    }

      if (files.length === 1) {
      openAddModalForFile(files[0]);
    } else {
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
            clothingType: "",
            layerType: "",
            isOnePiece: false,
            setId: "",
            styleTags: [],
            occasionTags: [],
            seasonTags: [],
            classifying: true,
            userOverrode: false,
          };
        })
      );
      setBulkItems(entries);
      setBulkError("");
      setBulkOpen(true);

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
        const dataUrl = await fileToDataUrl(pendingFile);
        const localItem = normalizeItemMetadata({
          id: makeId(),
          name,
          category: formCategory,
          color,
          fit_tag,
          clothing_type: formClothingType,
          layer_type: formLayerType,
          is_one_piece: formIsOnePiece,
          set_id: formSetId.trim(),
          style_tags: formStyleTags,
          occasion_tags: formOccasionTags,
          season_tags: formSeasonTags,
          image_url: dataUrl || "",
          is_active: true,
          is_favorite: false,
        });

        setItemsAndSave((prev) => [localItem, ...prev]);

        setIsSaving(false);
        setAddOpen(false);
        resetAddForm();

        setToast("Item added for this session. Sign in to save it permanently.");
        window.setTimeout(() => setToast(""), 2000);
        return;
      }

      let imageUrl = "";
      try { imageUrl = await fileToDataUrl(pendingFile); } catch {}
      const created = await wardrobeApi.createItem(buildWardrobeApiPayload({
        name,
        category: formCategory,
        color,
        fitTag: fit_tag,
        clothingType: formClothingType,
        layerType: formLayerType,
        isOnePiece: formIsOnePiece,
        setId: formSetId,
        styleTags: formStyleTags,
        occasionTags: formOccasionTags,
        seasonTags: formSeasonTags,
        imageUrl,
      }));

      if (backendOffline) setBackendOffline(false);

      const localShadow = normalizeItemMetadata({
        id: created?.id || makeId(),
        name,
        category: formCategory,
        color,
        fit_tag: created?.fit_tag ?? fit_tag,
        clothing_type: formClothingType,
        layer_type: formLayerType,
        is_one_piece: formIsOnePiece,
        set_id: formSetId.trim(),
        style_tags: formStyleTags,
        occasion_tags: formOccasionTags,
        season_tags: formSeasonTags,
        image_url: created?.image_url || "",
        is_active: created?.is_active ?? true,
        is_favorite: created?.is_favorite ?? false,
      });

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
        const localItem = normalizeItemMetadata({
          id: makeId(),
          name,
          category: formCategory,
          color,
          fit_tag,
          clothing_type: formClothingType,
          layer_type: formLayerType,
          is_one_piece: formIsOnePiece,
          set_id: formSetId.trim(),
          style_tags: formStyleTags,
          occasion_tags: formOccasionTags,
          season_tags: formSeasonTags,
          image_url: dataUrl,
          is_active: true,
          is_favorite: false,
        });

        setItemsAndSave((prev) => [localItem, ...prev]);

        setIsSaving(false);
        setAddOpen(false);
        resetAddForm();

        setToast("Backend offline. Saved locally for demo.");
        window.setTimeout(() => setToast(""), 2200);
        return;
      }

      let dataUrl = "";
      try { dataUrl = await fileToDataUrl(pendingFile); } catch {}
      const localItem = normalizeItemMetadata({
        id: makeId(),
        name,
        category: formCategory,
        color,
        fit_tag,
        clothing_type: formClothingType,
        layer_type: formLayerType,
        is_one_piece: formIsOnePiece,
        set_id: formSetId.trim(),
        style_tags: formStyleTags,
        occasion_tags: formOccasionTags,
        season_tags: formSeasonTags,
        image_url: dataUrl,
        is_active: true,
        is_favorite: false,
      });

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
      const newItems = bulkItems.map((entry) => normalizeItemMetadata({
        id: makeId(),
        name: entry.name.trim(),
        category: entry.category,
        color: entry.color.trim(),
        fit_tag: normalizeFitTag(entry.fitTag),
        clothing_type: entry.clothingType || "",
        layer_type: entry.layerType || "",
        is_one_piece: entry.isOnePiece === true,
        set_id: (entry.setId || "").trim(),
        style_tags: entry.styleTags || [],
        occasion_tags: entry.occasionTags || [],
        season_tags: entry.seasonTags || [],
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
            await wardrobeApi.createItem(buildWardrobeApiPayload({
              name: entry.name.trim(),
              category: entry.category,
              color: entry.color.trim(),
              fitTag: entry.fitTag,
              clothingType: entry.clothingType,
              layerType: entry.layerType,
              isOnePiece: entry.isOnePiece,
              setId: entry.setId,
              styleTags: entry.styleTags,
              occasionTags: entry.occasionTags,
              seasonTags: entry.seasonTags,
              imageUrl: imgUrl,
            }));
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

      setToast(isGuestMode ? `${newItems.length} item${newItems.length > 1 ? "s added for this session" : " added for this session"}.` : `${newItems.length} item${newItems.length > 1 ? "s" : ""} added.`);
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
    setEditClothingType((item.clothing_type || "").toString());
    setEditLayerType((item.layer_type || "").toString());
    setEditIsOnePiece(item.is_one_piece === true || item.is_one_piece === "true");
    setEditSetId((item.set_id || "").toString());
    setEditStyleTags(normalizeTagList(item.style_tags));
    setEditOccasionTags(normalizeTagList(item.occasion_tags));
    setEditSeasonTags(normalizeTagList(item.season_tags));
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
    setEditClothingType("");
    setEditLayerType("");
    setEditIsOnePiece(false);
    setEditSetId("");
    setEditStyleTags([]);
    setEditOccasionTags([]);
    setEditSeasonTags([]);
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

    setItemsAndSave((prev) =>
      prev.map((it) => (it.id === editId ? normalizeItemMetadata({ ...it, name, category: editCategory, color, fit_tag, clothing_type: editClothingType, layer_type: editLayerType, is_one_piece: editIsOnePiece, set_id: editSetId.trim(), style_tags: editStyleTags, occasion_tags: editOccasionTags, season_tags: editSeasonTags }) : it))
    );

    setIsUpdating(false);
    setEditOpen(false);
    setToast("Changes saved.");
    window.setTimeout(() => setToast(""), 2000);

    try {
      if (effectiveSignedIn) {
        await wardrobeApi.updateItem(editId, buildWardrobeApiPayload({
          name,
          category: editCategory,
          color,
          fitTag: fit_tag,
          clothingType: editClothingType,
          layerType: editLayerType,
          isOnePiece: editIsOnePiece,
          setId: editSetId,
          styleTags: editStyleTags,
          occasionTags: editOccasionTags,
          seasonTags: editSeasonTags,
        }));
      }
    } catch {
    }
  };

  const toggleFavorite = async (id) => {
    if (isGuestMode) {
      setToast("Sign in to use favorites.");
      window.setTimeout(() => setToast(""), 2200);
      return;
    }

    const current = items.find((x) => x.id === id);
    const nextVal = !(current?.is_favorite === true);

    setItemsAndSave((prev) => prev.map((it) => (it.id === id ? { ...it, is_favorite: nextVal } : it)));
    setToast(nextVal ? "Added to favorites." : "Removed from favorites.");
    window.setTimeout(() => setToast(""), 1500);

    try {
      if (effectiveSignedIn) {
        await wardrobeApi.setFavorite(id, nextVal);
      }
    } catch {
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
            {isGuestMode ? "Upload pieces and generate recommendations in guest mode. Guest wardrobes stay temporary." : "Upload and manage your clothing items"}
            {!effectiveSignedIn && !backendOffline ? (
              <button type="button" className="btn primary" onClick={() => navigate("/login")} style={{ marginLeft: 12, fontSize: "0.85rem", padding: "6px 16px", verticalAlign: "middle" }}>
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
        {!isGuestMode ? (
          <>
            <button
              type="button"
              className={tab === "favorites" ? "wardrobeTab active" : "wardrobeTab"}
              onClick={() => {
                setTab("favorites");
                setActiveCategory("All Items");
              }}
              aria-pressed={tab === "favorites" ? "true" : "false"}
            >
              Favorites ({favoriteItems.length})
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
          </>
        ) : null}
      </section>

      <section className="wardrobeActionStrip">
        <div className="wardrobeActionCopy">
          <div className="wardrobeActionTitle">Add to your wardrobe</div>
          <div className="wardrobeActionSub">Upload photos when you are ready. Keep the screen focused on your clothes the rest of the time.</div>
        </div>
        <div className="wardrobeActionButtons">
          <button type="button" className="wardrobeChooseBtn" onClick={openPicker}>
            Upload Photos
          </button>
          <button
            type="button"
            className={showUploadPanel ? "wardrobeChipBtn active" : "wardrobeChipBtn"}
            onClick={() => setShowUploadPanel((prev) => !prev)}
            aria-expanded={showUploadPanel}
          >
            {showUploadPanel ? "Hide upload help" : "Show upload help"}
          </button>
        </div>
      </section>

      {showUploadPanel ? (
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
            {uploadError ? <div className="wardrobeFormError" style={{ marginTop: 12, width: "min(520px, 100%)" }}>{uploadError}</div> : null}
          </div>
        </section>
      ) : null}

      <section className="wardrobeControls">
        <div className="wardrobeSearchWrap">
          <input
            className="wardrobeSearch"
            placeholder={tab === "archived" ? "Search archived items..." : tab === "favorites" ? "Search favorites..." : "Search your wardrobe..."}
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

                {availableClothingTypes.length > 0 && (
                  <div className="wardrobeFilterSection">
                    <div className="wardrobeFilterHeading">Clothing Type</div>
                    <div className="wardrobeFilterChips">
                      {availableClothingTypes.map((type) => (
                        <button
                          key={type}
                          type="button"
                          className={filterClothingTypes.has(type) ? "wardrobeFilterChip active" : "wardrobeFilterChip"}
                          onClick={() => toggleFilterClothingType(type)}
                        >
                          {optionLabel(type)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {availableLayers.length > 0 && (
                  <div className="wardrobeFilterSection">
                    <div className="wardrobeFilterHeading">Layer</div>
                    <div className="wardrobeFilterChips">
                      {availableLayers.map((layer) => (
                        <button
                          key={layer.value}
                          type="button"
                          className={filterLayers.has(layer.value) ? "wardrobeFilterChip active" : "wardrobeFilterChip"}
                          onClick={() => toggleFilterLayer(layer.value)}
                        >
                          {layer.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {availableStyles.length > 0 && (
                  <div className="wardrobeFilterSection">
                    <div className="wardrobeFilterHeading">Style</div>
                    <div className="wardrobeFilterChips">
                      {availableStyles.map((style) => (
                        <button
                          key={style}
                          type="button"
                          className={filterStyles.has(style) ? "wardrobeFilterChip active" : "wardrobeFilterChip"}
                          onClick={() => toggleFilterStyle(style)}
                        >
                          {optionLabel(style)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {availableOccasions.length > 0 && (
                  <div className="wardrobeFilterSection">
                    <div className="wardrobeFilterHeading">Occasion</div>
                    <div className="wardrobeFilterChips">
                      {availableOccasions.map((occasion) => (
                        <button
                          key={occasion}
                          type="button"
                          className={filterOccasions.has(occasion) ? "wardrobeFilterChip active" : "wardrobeFilterChip"}
                          onClick={() => toggleFilterOccasion(occasion)}
                        >
                          {optionLabel(occasion)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {availableSeasons.length > 0 && (
                  <div className="wardrobeFilterSection">
                    <div className="wardrobeFilterHeading">Season</div>
                    <div className="wardrobeFilterChips">
                      {availableSeasons.map((season) => (
                        <button
                          key={season}
                          type="button"
                          className={filterSeasons.has(season) ? "wardrobeFilterChip active" : "wardrobeFilterChip"}
                          onClick={() => toggleFilterSeason(season)}
                        >
                          {optionLabel(season)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {availableColors.length === 0 && availableFits.length === 0 && availableClothingTypes.length === 0 && availableLayers.length === 0 && availableStyles.length === 0 && availableOccasions.length === 0 && availableSeasons.length === 0 && (
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

          <button
            type="button"
            className={showCategoryTabs || activeCategory !== "All Items" ? "wardrobeChipBtn active" : "wardrobeChipBtn"}
            onClick={() => setShowCategoryTabs((prev) => !prev)}
            aria-expanded={showCategoryTabs || activeCategory !== "All Items"}
          >
            Categories
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

      {showCategoryTabs || activeCategory !== "All Items" ? (
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
      ) : null}

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
            allowFavorites={!isGuestMode}
            allowArchive={!isGuestMode}
            onTiltMove={onTiltMove}
            onTiltLeave={onTiltLeave}
          />
        ))}

        {!filtered.length ? (
          <div className="wardrobeEmpty">
            <div className="wardrobeEmptyIcon">{tab === "archived" ? "\u2001" : tab === "favorites" ? "\u2661" : "\uD83D\uDC54"}</div>
            <div className="wardrobeEmptyTitle">{tab === "archived" ? "No archived items yet" : tab === "favorites" ? "No favorites yet" : "Nothing matches right now"}</div>
            <div className="wardrobeEmptySub">
              {tab === "favorites"
                ? "Tap the heart on wardrobe items you love and they will show up here."
                : tab === "archived"
                  ? "Archived pieces will stay here until you bring them back into your active wardrobe."
                  : "Try clearing filters, changing your search, or adding a few more items to your wardrobe."}
            </div>
            {tab === "active" ? (
              <button type="button" className="btn primary wardrobeEmptyBtn" onClick={() => setShowUploadPanel(true)}>
                Add wardrobe item
              </button>
            ) : null}
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
              clothingType={formClothingType} onClothingTypeChange={setFormClothingType}
              layerType={formLayerType} onLayerTypeChange={setFormLayerType}
              isOnePiece={formIsOnePiece} onIsOnePieceChange={setFormIsOnePiece}
              setId={formSetId} onSetIdChange={setFormSetId}
              styleTags={formStyleTags} onStyleTagsChange={setFormStyleTags}
              occasionTags={formOccasionTags} onOccasionTagsChange={setFormOccasionTags}
              seasonTags={formSeasonTags} onSeasonTagsChange={setFormSeasonTags}
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
              clothingType={editClothingType} onClothingTypeChange={setEditClothingType}
              layerType={editLayerType} onLayerTypeChange={setEditLayerType}
              isOnePiece={editIsOnePiece} onIsOnePieceChange={setEditIsOnePiece}
              setId={editSetId} onSetIdChange={setEditSetId}
              styleTags={editStyleTags} onStyleTagsChange={setEditStyleTags}
              occasionTags={editOccasionTags} onOccasionTagsChange={setEditOccasionTags}
              seasonTags={editSeasonTags} onSeasonTagsChange={setEditSeasonTags}
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
