import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { useNavigate } from "react-router-dom";
import { wardrobeApi } from "../api/wardrobeApi";
import { useAuth } from "../auth/AuthProvider";
import { loadWardrobe, saveWardrobe, loadAnswers, mergeWardrobeWithLocalMetadata, readSeasonalMode, writeSeasonalMode } from "../utils/userStorage";
import { preloadModel } from "../utils/classifyClothing";
import { detectDuplicateFindings, loadIgnoredDuplicateKeys, mergeDuplicateItems, saveIgnoredDuplicateKeys } from "../utils/duplicateDetection";
import { OPEN_ADD_ITEM_FLAG } from "../utils/constants";
import { makeId, normalizeFitTag, fileToDataUrl, isNetworkError, onTiltMove, onTiltLeave } from "../utils/helpers";
import { generateItemTagSuggestions } from "../utils/tagSuggestions";
import { getCurrentSeason, getSeasonLabel, getSeasonalWardrobeLabel, sortItemsBySeasonalRelevance, summarizeSeasonalCollection } from "../utils/seasonalWardrobe";
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
import DuplicateReviewModal from "./DuplicateReviewModal";
import ReceiptScannerModal from "./ReceiptScannerModal";
import useManagedTimeouts from "../hooks/useManagedTimeouts";

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

function hasSuggestedTagValues(suggestions) {
  if (!suggestions) return false;
  return Boolean(
    (suggestions.color || "").trim() ||
    (suggestions.clothingType || "").trim() ||
    (Array.isArray(suggestions.styleTags) && suggestions.styleTags.length) ||
    (Array.isArray(suggestions.occasionTags) && suggestions.occasionTags.length) ||
    (Array.isArray(suggestions.seasonTags) && suggestions.seasonTags.length)
  );
}

function applySuggestionToBulkEntry(entry, result) {
  const suggestions = result?.suggestions || null;
  const next = {
    ...entry,
    classifying: false,
    taggingState: result?.status || "error",
    taggingMessage: result?.message || "We couldn't generate tags. Please add them manually.",
    suggestedTags: hasSuggestedTagValues(suggestions) ? suggestions : null,
  };

  if (result?.category && !entry.userOverrode) next.category = result.category;
  if (!entry.color && suggestions?.color) next.color = suggestions.color;
  if (!entry.clothingType && suggestions?.clothingType) next.clothingType = suggestions.clothingType;
  if ((!Array.isArray(entry.styleTags) || entry.styleTags.length === 0) && suggestions?.styleTags?.length) next.styleTags = suggestions.styleTags;
  if ((!Array.isArray(entry.occasionTags) || entry.occasionTags.length === 0) && suggestions?.occasionTags?.length) next.occasionTags = suggestions.occasionTags;
  if ((!Array.isArray(entry.seasonTags) || entry.seasonTags.length === 0) && suggestions?.seasonTags?.length) next.seasonTags = suggestions.seasonTags;

  return next;
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
  const addCategoryTouchedRef = useRef(false);
  const toastTimeouts = useManagedTimeouts();
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
  const [seasonalMode, setSeasonalMode] = useState(() => readSeasonalMode(user));
  const [bodyFitOn, setBodyFitOn] = useState(false);
  const [view, setView] = useState("grid");
  const [toast, setToast] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const [receiptScannerOpen, setReceiptScannerOpen] = useState(false);
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
  const [addTaggingState, setAddTaggingState] = useState("idle");
  const [addTaggingMessage, setAddTaggingMessage] = useState("");
  const [addSuggestedTags, setAddSuggestedTags] = useState(null);



  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkItems, setBulkItems] = useState([]);
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const [duplicateScan, setDuplicateScan] = useState({ status: "idle", findings: [], scannedIds: [], scannedAt: 0 });
  const [duplicateReviewOpen, setDuplicateReviewOpen] = useState(false);
  const [pendingDuplicateAction, setPendingDuplicateAction] = useState(null);
  const [ignoredDuplicateKeys, setIgnoredDuplicateKeys] = useState(() => loadIgnoredDuplicateKeys(user));
  const duplicateScanRef = useRef(0);

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
  const currentSeason = useMemo(() => getCurrentSeason(), []);
  const currentSeasonLabel = useMemo(() => getSeasonLabel(currentSeason), [currentSeason]);
  const seasonalWardrobeLabel = useMemo(() => getSeasonalWardrobeLabel(currentSeason), [currentSeason]);

  useEffect(() => {
    setSeasonalMode(readSeasonalMode(user));
  }, [user]);
  const uploadErrorId = "wardrobe-upload-error";

  useEffect(() => {
    const ignored = loadIgnoredDuplicateKeys(user);
    setIgnoredDuplicateKeys(ignored);
    setDuplicateScan({ status: "idle", findings: [], scannedIds: [], scannedAt: 0 });
    setDuplicateReviewOpen(false);
    setPendingDuplicateAction(null);
  }, [user]);

  useEffect(() => {
    saveIgnoredDuplicateKeys(ignoredDuplicateKeys, user);
  }, [ignoredDuplicateKeys, user]);

  useEffect(() => {
    setDuplicateScan((prev) => {
      if (!prev.findings.length) return prev;
      const itemIds = new Set(items.map((item) => String(item.id || "")));
      const nextFindings = prev.findings.filter(
        (finding) => itemIds.has(String(finding.leftItem?.id || "")) && itemIds.has(String(finding.rightItem?.id || ""))
      );
      if (nextFindings.length === prev.findings.length) return prev;
      return {
        ...prev,
        findings: nextFindings,
        status: nextFindings.length ? "found" : (prev.status === "loading" ? "loading" : "clear"),
      };
    });
  }, [items]);

  const runDuplicateScan = useCallback(async (allItems, newItems = [], options = {}) => {
    const scanItems = Array.isArray(newItems) ? newItems.filter(Boolean) : [];
    const scannedIds = scanItems.map((item) => String(item?.id || "")).filter(Boolean);
    if (!scannedIds.length) {
      setDuplicateScan({ status: "clear", findings: [], scannedIds: [], scannedAt: Date.now() });
      return [];
    }

    const runId = Date.now() + Math.random();
    duplicateScanRef.current = runId;
    setDuplicateScan({ status: "loading", findings: [], scannedIds, scannedAt: Date.now() });

    try {
      const findings = await detectDuplicateFindings({
        items: allItems,
        newItemIds: scannedIds,
        ignoredPairKeys: ignoredDuplicateKeys,
      });

      if (duplicateScanRef.current !== runId) return findings;

      const nextState = {
        status: findings.length ? "found" : "clear",
        findings,
        scannedIds,
        scannedAt: Date.now(),
      };
      setDuplicateScan(nextState);
      if (findings.length && options.openOnFound !== false) setDuplicateReviewOpen(true);
      return findings;
    } catch {
      if (duplicateScanRef.current === runId) {
        setDuplicateScan({ status: "clear", findings: [], scannedIds, scannedAt: Date.now() });
      }
      return [];
    }
  }, [ignoredDuplicateKeys]);

  const applyDuplicateScanResult = useCallback((nextItems, focusItems = [], options = {}) => {
    void runDuplicateScan(nextItems, focusItems, options);
  }, [runDuplicateScan]);

  const removeDuplicateFinding = useCallback((pairKey) => {
    setDuplicateScan((prev) => {
      const nextFindings = prev.findings.filter((finding) => finding.pairKey !== pairKey);
      return {
        ...prev,
        findings: nextFindings,
        status: nextFindings.length ? "found" : "clear",
      };
    });
  }, []);

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

    const matches = base.filter((it) => {
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

    return seasonalMode ? sortItemsBySeasonalRelevance(matches, currentSeason) : matches;
  }, [activeItems, archivedItems, favoriteItems, tab, activeCategory, query, filterColors, filterFits, filterClothingTypes, filterLayers, filterStyles, filterOccasions, filterSeasons, seasonalMode, currentSeason]);

  const seasonalSummarySource = useMemo(() => (
    tab === "archived" ? archivedItems : tab === "favorites" ? favoriteItems : activeItems
  ), [activeItems, archivedItems, favoriteItems, tab]);

  const seasonalSummary = useMemo(
    () => summarizeSeasonalCollection(seasonalSummarySource, currentSeason),
    [seasonalSummarySource, currentSeason]
  );

  const seasonalSummaryText = useMemo(() => {
    if (!seasonalMode) return "Seasonal filtering is off, so you are seeing your full wardrobe.";
    if (!seasonalSummary.hasSeasonalMetadata) return `Filtered by current season. Add season tags to make your ${currentSeasonLabel.toLowerCase()} wardrobe smarter.`;

    const parts = [];
    if (seasonalSummary.inSeasonCount) parts.push(`${seasonalSummary.inSeasonCount} in season`);
    if (seasonalSummary.allSeasonCount) parts.push(`${seasonalSummary.allSeasonCount} all season`);
    if (seasonalSummary.overlapCount) parts.push(`${seasonalSummary.overlapCount} season overlap`);
    if (seasonalSummary.outOfSeasonCount) parts.push(`${seasonalSummary.outOfSeasonCount} out of season`);
    return `Filtered by current season. ${parts.join(" · ")}.`;
  }, [seasonalMode, seasonalSummary, currentSeasonLabel]);

  const toggleSeasonalMode = () => {
    setSeasonalMode((prev) => {
      const next = !prev;
      writeSeasonalMode(next, user);
      return next;
    });
  };

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
    addCategoryTouchedRef.current = false;
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
    setAddTaggingState("idle");
    setAddTaggingMessage("");
    setAddSuggestedTags(null);
  };

  const handleAddCategoryChange = (value) => {
    addCategoryTouchedRef.current = true;
    setFormCategory(value);
  };

  const openAddModalForFile = (file) => {
    if (!file) return;

    if (!fileIsOk(file)) {
      const message = uploadIssueMessage(file);
      setShowUploadPanel(true);
      setUploadError(message);
      setToast(message);
      toastTimeouts.set(() => setToast(""), 2500);
      return;
    }

    try {
      setUploadError("");
      const preview = fileToObjectUrl(file);
      setPendingPreview(preview);
      setPendingFile(file);

      const niceName = file.name.replace(/\.[^/.]+$/, "");
      const fallbackCategory = guessCategoryFromName(file.name);
      setFormName(niceName);
      addCategoryTouchedRef.current = false;
      setFormCategory(fallbackCategory);
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
      setAddTaggingState("loading");
      setAddTaggingMessage("");
      setAddSuggestedTags(null);

      setAddOpen(true);

      generateItemTagSuggestions({
        imageUrl: preview,
        fileName: file.name,
        fallbackCategory,
      }).then((result) => {
        setIsClassifying(false);
        setAddTaggingState(result.status);
        setAddTaggingMessage(result.message);
        setAddSuggestedTags(hasSuggestedTagValues(result.suggestions) ? result.suggestions : null);
        if (result.category) {
          setFormCategory((current) => (addCategoryTouchedRef.current ? current : result.category));
        }
        if (result.suggestions?.color) {
          setFormColor((current) => (current.trim() ? current : result.suggestions.color));
        }
        if (result.suggestions?.clothingType) {
          setFormClothingType((current) => (current.trim() ? current : result.suggestions.clothingType));
        }
        if (result.suggestions?.styleTags?.length) {
          setFormStyleTags((current) => (current.length ? current : result.suggestions.styleTags));
        }
        if (result.suggestions?.occasionTags?.length) {
          setFormOccasionTags((current) => (current.length ? current : result.suggestions.occasionTags));
        }
        if (result.suggestions?.seasonTags?.length) {
          setFormSeasonTags((current) => (current.length ? current : result.suggestions.seasonTags));
        }
      }).catch(() => {
        setIsClassifying(false);
        setAddTaggingState("error");
        setAddTaggingMessage("We couldn't generate tags. Please add them manually.");
        setAddSuggestedTags(null);
      });
    } catch {
      setShowUploadPanel(true);
      setUploadError("Upload failed. Try again.");
      setToast("Upload failed. Try again.");
      toastTimeouts.set(() => setToast(""), 2500);
    }
  };

  const onPickFile = async (fileList) => {
    const allFiles = Array.from(fileList || []);
    const files = allFiles.filter(fileIsOk);
    const invalidFiles = allFiles.filter((file) => !fileIsOk(file));
    if (!files.length) {
      if (fileList?.length) {
        const message = uploadBatchMessage(invalidFiles, 0);
        setShowUploadPanel(true);
        setUploadError(message);
        setToast(message);
        toastTimeouts.set(() => setToast(""), 2500);
      }
      return;
    }

    if (invalidFiles.length) {
      const message = uploadBatchMessage(invalidFiles, files.length);
      setShowUploadPanel(true);
      setUploadError(message);
      setToast(message);
      toastTimeouts.set(() => setToast(""), 2800);
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
            taggingState: "loading",
            taggingMessage: "",
            suggestedTags: null,
            userOverrode: false,
          };
        })
      );
      setBulkItems(entries);
      setBulkError("");
      setBulkOpen(true);

      for (const entry of entries) {
        generateItemTagSuggestions({
          imageUrl: entry.preview,
          fileName: entry.file?.name || entry.name,
          fallbackCategory: entry.category,
        }).then((result) => {
          setBulkItems((prev) =>
            prev.map((e) => {
              if (e._key !== entry._key) return e;
              return applySuggestionToBulkEntry(e, result);
            })
          );
        }).catch(() => {
          setBulkItems((prev) =>
            prev.map((e) => e._key === entry._key ? {
              ...e,
              classifying: false,
              taggingState: "error",
              taggingMessage: "We couldn't generate tags. Please add them manually.",
              suggestedTags: null,
            } : e)
          );
        });
      }
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleReceiptResult = useCallback(({ items: extractedItems }) => {
    setReceiptScannerOpen(false);
    if (!Array.isArray(extractedItems) || !extractedItems.length) return;

    const categoryMap = {
      Top: "Tops",
      Bottom: "Bottoms",
      Outerwear: "Outerwear",
      Shoes: "Shoes",
      Accessory: "Accessories",
    };

    const entries = extractedItems.map((item) => {
      const name = (item?.name || "").toString().trim();
      return {
        _key: makeId(),
        file: null,
        preview: "",
        name,
        category: categoryMap[(item?.category || "").toString().trim()] || guessCategoryFromName(name),
        color: (item?.color || "").toString().trim(),
        fitTag: "unknown",
        clothingType: "",
        layerType: "",
        isOnePiece: false,
        setId: "",
        styleTags: [],
        occasionTags: [],
        seasonTags: [],
        classifying: false,
        taggingState: "idle",
        taggingMessage: "",
        suggestedTags: null,
        userOverrode: false,
      };
    });

    setBulkItems(entries);
    setBulkError("");
    setBulkOpen(true);
    setToast(`Extracted ${entries.length} item${entries.length > 1 ? "s" : ""} from receipt. Review before saving.`);
    toastTimeouts.set(() => setToast(""), 3500);
  }, []);

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

        const nextItems = [localItem, ...items];
        setItemsAndSave(nextItems);
        applyDuplicateScanResult(nextItems, [localItem]);

        setIsSaving(false);
        setAddOpen(false);
        resetAddForm();

        setToast("Item added for this session. Sign in to save it permanently.");
        toastTimeouts.set(() => setToast(""), 2000);
        return;
      }

      let imageUrl = "";
      try { imageUrl = await fileToDataUrl(pendingFile); } catch {}

      const tempId = makeId();
      const optimisticItem = normalizeItemMetadata({
        id: tempId,
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
        image_url: imageUrl,
        is_active: true,
        is_favorite: false,
      });

      const nextItems = [optimisticItem, ...items];
      setItemsAndSave(nextItems);
      applyDuplicateScanResult(nextItems, [optimisticItem]);

      setIsSaving(false);
      setAddOpen(false);
      resetAddForm();

      setToast("Item added.");
      toastTimeouts.set(() => setToast(""), 2000);

      wardrobeApi.createItem(buildWardrobeApiPayload({
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
      })).then((created) => {
        if (created?.id && String(created.id) !== String(tempId)) {
          setItemsAndSave((prev) => prev.map((it) =>
            String(it.id) === String(tempId)
              ? normalizeItemMetadata({ ...it, id: created.id })
              : it
          ));
        }
        if (backendOffline) setBackendOffline(false);
      }).catch(() => {});
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

        const nextItems = [localItem, ...items];
        setItemsAndSave(nextItems);
        applyDuplicateScanResult(nextItems, [localItem]);

        setIsSaving(false);
        setAddOpen(false);
        resetAddForm();

        setToast("Backend offline. Saved locally for demo.");
        toastTimeouts.set(() => setToast(""), 2200);
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

      const nextItems = [localItem, ...items];
      setItemsAndSave(nextItems);
      applyDuplicateScanResult(nextItems, [localItem]);

      setIsSaving(false);
      setAddOpen(false);
      resetAddForm();

      setToast("Saved locally.");
      toastTimeouts.set(() => setToast(""), 2000);
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

      const nextItems = [...newItems, ...items];
      setItemsAndSave(nextItems);
      applyDuplicateScanResult(nextItems, newItems);
      setIsBulkSaving(false);
      setBulkOpen(false);
      setBulkItems([]);

      setToast(isGuestMode ? `${newItems.length} item${newItems.length > 1 ? "s added for this session" : " added for this session"}.` : `${newItems.length} item${newItems.length > 1 ? "s" : ""} added.`);
      toastTimeouts.set(() => setToast(""), 2000);
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

  const closeDuplicateReview = () => {
    setDuplicateReviewOpen(false);
    setPendingDuplicateAction(null);
  };

  const keepDuplicateItems = (finding) => {
    if (!finding?.pairKey) return;
    const nextIgnored = [...new Set([...ignoredDuplicateKeys, finding.pairKey])];
    setIgnoredDuplicateKeys(nextIgnored);
    removeDuplicateFinding(finding.pairKey);
    setPendingDuplicateAction(null);
    setToast("We will stop flagging this pair as a duplicate.");
    toastTimeouts.set(() => setToast(""), 2200);
  };

  const handleDuplicateActionChange = (nextAction) => {
    if (!nextAction) {
      setPendingDuplicateAction(null);
      return;
    }

    if (nextAction.confirmNow) {
      setPendingDuplicateAction((prev) => prev ? { ...prev, confirmNow: true } : prev);
      return;
    }

    setPendingDuplicateAction({ ...nextAction, isProcessing: false, confirmNow: false });
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
        toastTimeouts.set(() => setToast(""), 2000);
        return;
      }

      await wardrobeApi.deleteItem(pendingDeleteId);
      removeLocally();
      setToast("Deleted.");
      toastTimeouts.set(() => setToast(""), 2000);
    } catch (e) {
      removeLocally();

      if (effectiveSignedIn && isNetworkError(e)) {
        setBackendOffline(true);
        setToast("Backend offline. Deleted locally.");
      } else {
        setToast("Deleted locally.");
      }
      toastTimeouts.set(() => setToast(""), 2200);
      toastTimeouts.set(() => setToast(""), 2500);
    }
  };

  const archiveItem = async (id) => {
    const current = items.find((x) => x.id === id);
    if (!current) return;

    setIsArchiving(true);
    setPendingArchiveId(id);

    setItemsAndSave((prev) => prev.map((x) => (x.id === id ? { ...x, is_active: false } : x)));
    setToast("Archived.");
    toastTimeouts.set(() => setToast(""), 2000);

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
    toastTimeouts.set(() => setToast(""), 2000);

    try {
      if (effectiveSignedIn) await wardrobeApi.unarchiveItem(id);
    } catch {
    } finally {
      setIsArchiving(false);
      setPendingArchiveId(null);
    }
  };

  const syncMergedItemBestEffort = useCallback(async (mergedItem, removeId) => {
    if (!effectiveSignedIn) return;

    try {
      await wardrobeApi.updateItem(mergedItem.id, buildWardrobeApiPayload({
        name: mergedItem.name,
        category: mergedItem.category,
        color: mergedItem.color,
        fitTag: mergedItem.fit_tag || mergedItem.fitTag || mergedItem.fit,
        clothingType: mergedItem.clothing_type,
        layerType: mergedItem.layer_type,
        isOnePiece: mergedItem.is_one_piece,
        setId: mergedItem.set_id,
        styleTags: mergedItem.style_tags,
        occasionTags: mergedItem.occasion_tags,
        seasonTags: mergedItem.season_tags,
        imageUrl: mergedItem.image_url,
      }));
    } catch (e) {
      if (isNetworkError(e)) setBackendOffline(true);
    }

    try {
      await wardrobeApi.deleteItem(removeId);
    } catch (e) {
      if (isNetworkError(e)) setBackendOffline(true);
    }
  }, [effectiveSignedIn]);

  useEffect(() => {
    if (!pendingDuplicateAction?.confirmNow || pendingDuplicateAction?.isProcessing) return;

    let cancelled = false;

    async function run() {
      const action = pendingDuplicateAction;
      setPendingDuplicateAction((prev) => prev ? { ...prev, isProcessing: true } : prev);

      if (action.mode === "delete") {
        const nextItems = items.filter((item) => String(item.id) !== String(action.removeId));
        const focusItem = nextItems.find((item) => String(item.id) === String(action.survivorId));

        setItemsAndSave(nextItems);
        removeDuplicateFinding(action.pairKey);

        try {
          if (effectiveSignedIn) await wardrobeApi.deleteItem(action.removeId);
        } catch (e) {
          if (isNetworkError(e)) setBackendOffline(true);
        }

        if (!cancelled) {
          if (focusItem) applyDuplicateScanResult(nextItems, [focusItem], { openOnFound: false });
          else setDuplicateScan({ status: "clear", findings: [], scannedIds: [], scannedAt: Date.now() });
          setPendingDuplicateAction(null);
          setToast("Duplicate item removed.");
          toastTimeouts.set(() => setToast(""), 2200);
        }
        return;
      }

      if (action.mode === "merge") {
        const keepItem = items.find((item) => String(item.id) === String(action.keepId));
        const removeItem = items.find((item) => String(item.id) === String(action.removeId));
        if (!keepItem || !removeItem) {
          if (!cancelled) setPendingDuplicateAction(null);
          return;
        }

        const mergedItem = mergeDuplicateItems(keepItem, removeItem);
        const nextItems = items
          .filter((item) => String(item.id) !== String(action.removeId))
          .map((item) => (String(item.id) === String(action.keepId) ? mergedItem : item));

        setItemsAndSave(nextItems);
        removeDuplicateFinding(action.pairKey);
        await syncMergedItemBestEffort(mergedItem, action.removeId);

        if (!cancelled) {
          applyDuplicateScanResult(nextItems, [mergedItem], { openOnFound: false });
          setPendingDuplicateAction(null);
          setToast("Items merged into one wardrobe entry.");
          toastTimeouts.set(() => setToast(""), 2200);
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [
    applyDuplicateScanResult,
    effectiveSignedIn,
    items,
    pendingDuplicateAction,
    removeDuplicateFinding,
    setItemsAndSave,
    syncMergedItemBestEffort,
  ]);

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
    toastTimeouts.set(() => setToast(""), 2000);

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
      toastTimeouts.set(() => setToast(""), 2200);
      return;
    }

    const current = items.find((x) => x.id === id);
    const nextVal = !(current?.is_favorite === true);

    setItemsAndSave((prev) => prev.map((it) => (it.id === id ? { ...it, is_favorite: nextVal } : it)));
    setToast(nextVal ? "Added to favorites." : "Removed from favorites.");
    toastTimeouts.set(() => setToast(""), 1500);

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
            <div className="wardrobeSeasonIndicator">{currentSeasonLabel}</div>
          </div>
          <div className="wardrobeSeasonBanner">
            <div className="wardrobeSeasonCopy">
              <div className="wardrobeSeasonEyebrow">Seasonal Wardrobe</div>
              <div className="wardrobeSeasonHeadline">{seasonalWardrobeLabel}</div>
              <div className="wardrobeSeasonMeta">{seasonalMode ? "Filtered by current season" : "Seasonal filtering is off"}</div>
              <div className="wardrobeSeasonNote">{seasonalSummaryText}</div>
            </div>
            <button
              type="button"
              className={seasonalMode ? "wardrobeChipBtn active wardrobeSeasonToggle" : "wardrobeChipBtn wardrobeSeasonToggle"}
              onClick={toggleSeasonalMode}
              aria-pressed={seasonalMode}
            >
              {seasonalMode ? "Seasonal filtering on" : "Seasonal filtering off"}
            </button>
          </div>
          {!effectiveSignedIn && !backendOffline ? (
            <div className="wardrobeSub">
              <button type="button" className="btn primary" onClick={() => navigate("/login")} style={{ fontSize: "0.85rem", padding: "6px 16px", verticalAlign: "middle" }}>
                Sign in to save
              </button>
            </div>
          ) : null}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          aria-describedby={uploadError ? uploadErrorId : undefined}
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
        </div>
        <div className="wardrobeActionButtons">
          <button type="button" className="wardrobeChooseBtn" onClick={openPicker}>
            Upload Photos
          </button>
          <button
            type="button"
            className="wardrobeChipBtn"
            onClick={() => setReceiptScannerOpen(true)}
          >
            Scan receipt
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

      {uploadError ? (
        <div
          id={uploadErrorId}
          className="wardrobeFormError"
          role="alert"
          aria-live="assertive"
          style={{ marginTop: 12 }}
        >
          {uploadError}
        </div>
      ) : null}

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
            <div className="wardrobeUploadSub">Drag photos here or browse</div>
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

      {duplicateScan.status !== "idle" ? (
        <section
          className={`duplicateScanBanner ${duplicateScan.status}`}
          role="status"
          aria-live="polite"
        >
          <div className="duplicateScanCopy">
            <div className="duplicateScanEyebrow">Wardrobe Organization</div>
            <div className="duplicateScanTitle">
              {duplicateScan.status === "loading"
                ? "Checking your latest upload for duplicates"
                : duplicateScan.status === "found"
                  ? "Possible duplicate detected"
                  : "No duplicates found"}
            </div>
            <div className="duplicateScanSub">
              {duplicateScan.status === "loading"
                ? "We are comparing your newest wardrobe items across category, color, style, fit, and image similarity."
                : duplicateScan.status === "found"
                  ? `${duplicateScan.findings.length} potential duplicate ${duplicateScan.findings.length === 1 ? "pair was" : "pairs were"} found. These items look similar.`
                  : "Your latest upload stayed below the duplicate-confidence threshold."}
            </div>
          </div>

          <div className="duplicateScanActions">
            {duplicateScan.status === "found" ? (
              <button type="button" className="wardrobeChooseBtn duplicateReviewBtn" onClick={() => setDuplicateReviewOpen(true)}>
                Review matches
              </button>
            ) : null}
            <button
              type="button"
              className="wardrobeChipBtn"
              onClick={() => {
                if (duplicateScan.status === "found") {
                  setDuplicateReviewOpen(false);
                  return;
                }
                setDuplicateScan((prev) => ({ ...prev, status: "idle" }));
                setDuplicateReviewOpen(false);
              }}
            >
              {duplicateScan.status === "found" ? "Later" : "Hide"}
            </button>
          </div>
        </section>
      ) : null}

      <section className={view === "grid" ? "wardrobeGrid" : "wardrobeList"}>
        {filtered.map((it) => (
          <WardrobeItemCard
            key={it.id}
            item={it}
            view={view}
            tab={tab}
            seasonalModeEnabled={seasonalMode}
            currentSeason={currentSeason}
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
                ? "Favorite items appear here."
                : tab === "archived"
                  ? "Archived items appear here."
                  : "Try another search or add an item."}
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

            <div className="wardrobeAddPreview">
              {pendingPreview ? <img className="wardrobeAddPreviewImg" src={pendingPreview} alt="Preview" /> : null}
            </div>

            <ItemFormFields
              name={formName} onNameChange={setFormName}
              category={formCategory} onCategoryChange={handleAddCategoryChange}
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
              tagSuggestionStatus={addTaggingState}
              tagSuggestionMessage={addTaggingMessage}
              tagSuggestions={addSuggestedTags}
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

      <ReceiptScannerModal
        open={receiptScannerOpen}
        onClose={() => setReceiptScannerOpen(false)}
        onResult={handleReceiptResult}
      />

      <DuplicateReviewModal
        open={duplicateReviewOpen}
        findings={duplicateScan.findings}
        isDetecting={duplicateScan.status === "loading"}
        pendingAction={pendingDuplicateAction}
        onClose={closeDuplicateReview}
        onStartAction={handleDuplicateActionChange}
        onKeepBoth={keepDuplicateItems}
      />

      {editOpen ? ReactDOM.createPortal(
        <div className="modalOverlay" role="dialog" aria-modal="true">
          <div className="modalCard">
            <div className="modalTitle">Edit item</div>

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
