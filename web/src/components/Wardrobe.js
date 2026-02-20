import React, { useMemo, useRef, useState } from "react";
import { NavLink } from "react-router-dom";

const WARDROBE_KEY = "fitgpt_wardrobe_v1";

const CATEGORIES = ["All Items", "Tops", "Bottoms", "Outerwear", "Shoes"];

function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function loadWardrobe() {
  const raw = localStorage.getItem(WARDROBE_KEY);
  const parsed = raw ? safeParse(raw) : null;
  return Array.isArray(parsed) ? parsed : [];
}

function saveWardrobe(items) {
  localStorage.setItem(WARDROBE_KEY, JSON.stringify(items));
}

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function fileIsOk(file) {
  const isImage = file.type === "image/jpeg" || file.type === "image/png";
  const under10mb = file.size <= 10 * 1024 * 1024;
  return isImage && under10mb;
}

export default function Wardrobe() {
  const fileInputRef = useRef(null);

  const [items, setItems] = useState(() => loadWardrobe());
  const [activeCategory, setActiveCategory] = useState("All Items");
  const [query, setQuery] = useState("");
  const [bodyFitOn, setBodyFitOn] = useState(true);
  const [view, setView] = useState("grid"); // grid | list
  const [toast, setToast] = useState("");

  const totalCount = items.length;

  const counts = useMemo(() => {
    const map = { "All Items": items.length, Tops: 0, Bottoms: 0, Outerwear: 0, Shoes: 0 };
    for (const it of items) {
      const cat = it.category;
      if (map[cat] !== undefined) map[cat] += 1;
    }
    return map;
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      const catOk = activeCategory === "All Items" ? true : it.category === activeCategory;
      const qOk = !q
        ? true
        : `${it.name} ${it.color} ${it.category}`.toLowerCase().includes(q);
      return catOk && qOk;
    });
  }, [items, activeCategory, query]);

  const openPicker = () => fileInputRef.current?.click();

  const addFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    const bad = files.find((f) => !fileIsOk(f));
    if (bad) {
      setToast("Only JPG/PNG up to 10MB are supported.");
      setTimeout(() => setToast(""), 2500);
      return;
    }

    const newItems = files.map((f) => ({
      id: uid(),
      name: f.name.replace(/\.[^/.]+$/, ""),
      category: guessCategoryFromName(f.name),
      color: "Unknown",
      fitTag: pickFitTag(),
    }));

    const next = [...newItems, ...items];
    setItems(next);
    saveWardrobe(next);

    setToast(`${files.length} item(s) added.`);
    setTimeout(() => setToast(""), 2000);
  };

  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    addFiles(e.dataTransfer.files);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const removeItem = (id) => {
    const next = items.filter((x) => x.id !== id);
    setItems(next);
    saveWardrobe(next);
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
          accept="image/png,image/jpeg"
          multiple
          style={{ display: "none" }}
          onChange={(e) => addFiles(e.target.files)}
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
          <div className="wardrobeUploadHint">Supports JPG, PNG up to 10MB each</div>
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
          const label =
            cat === "All Items" ? `All Items (${counts["All Items"]})` : `${cat} (${counts[cat] || 0})`;

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
              <div className="wardrobeThumb" aria-hidden="true" />
              {bodyFitOn ? (
                <div className={it.fitTag === "Great Fit" ? "wardrobeBadge great" : "wardrobeBadge good"}>
                  {it.fitTag}
                </div>
              ) : null}

              <div className="wardrobeCardBody">
                <div className="wardrobeItemName">{it.name}</div>
                <div className="wardrobeItemMeta">
                  {it.category} · {it.color}
                </div>

                <button
                  type="button"
                  className="wardrobeRemove"
                  onClick={() => removeItem(it.id)}
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <div key={it.id} className="wardrobeRowItem">
              <div className="wardrobeRowLeft">
                <div className="wardrobeThumb sm" aria-hidden="true" />
                <div className="wardrobeRowText">
                  <div className="wardrobeItemName">{it.name}</div>
                  <div className="wardrobeItemMeta">
                    {it.category} · {it.color}
                    {bodyFitOn ? ` · ${it.fitTag}` : ""}
                  </div>
                </div>
              </div>

              <button type="button" className="wardrobeRemove" onClick={() => removeItem(it.id)}>
                Remove
              </button>
            </div>
          )
        )}

        {!filtered.length ? (
          <div className="wardrobeEmpty">
            <div className="wardrobeEmptyTitle">No items found</div>
            <div className="wardrobeEmptySub">
              Try a different category or search term.
            </div>
          </div>
        ) : null}
      </section>

      {toast ? <div className="wardrobeToast">{toast}</div> : null}

      <nav className="dashBottomNav" aria-label="Dashboard navigation">
        <NavLink
          to="/dashboard"
          className={({ isActive }) => `dashNavItem ${isActive ? "dashNavActive" : ""}`}
        >
          Today
        </NavLink>

        <NavLink
          to="/wardrobe"
          className={({ isActive }) => `dashNavItem ${isActive ? "dashNavActive" : ""}`}
        >
          Wardrobe
        </NavLink>

        <NavLink
          to="/favorites"
          className={({ isActive }) => `dashNavItem ${isActive ? "dashNavActive" : ""}`}
        >
          Favorites
        </NavLink>

        <NavLink
          to="/profile"
          className={({ isActive }) => `dashNavItem ${isActive ? "dashNavActive" : ""}`}
        >
          Profile
        </NavLink>
      </nav>
    </div>
  );
}

function guessCategoryFromName(name) {
  const n = (name || "").toLowerCase();
  if (n.includes("shoe") || n.includes("sneaker") || n.includes("heel") || n.includes("boot")) return "Shoes";
  if (n.includes("jacket") || n.includes("coat") || n.includes("blazer")) return "Outerwear";
  if (n.includes("pant") || n.includes("jean") || n.includes("trouser") || n.includes("skirt")) return "Bottoms";
  return "Tops";
}

function pickFitTag() {
  return Math.random() < 0.45 ? "Great Fit" : "Good Fit";
}
