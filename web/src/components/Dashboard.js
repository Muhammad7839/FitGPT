import React, { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";

const THEME_KEY = "fitgpt_theme_v1";
const WARDROBE_KEY = "fitgpt_wardrobe_v1";


const DEFAULT_BODY_TYPE = "rectangle";

const BODY_TYPE_LABELS = {
  pear: "Pear",
  apple: "Apple",
  hourglass: "Hourglass",
  rectangle: "Rectangle",
  inverted: "Inverted Triangle",
};

function formatToday() {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function readTheme() {
  const raw = localStorage.getItem(THEME_KEY);
  if (!raw) return "light";

  const parsed = safeParse(raw);
  if (parsed === "light" || parsed === "dark") return parsed;
  if (raw === "light" || raw === "dark") return raw;

  return "light";
}

function loadWardrobe() {
  const raw = localStorage.getItem(WARDROBE_KEY);
  const parsed = raw ? safeParse(raw) : null;
  return Array.isArray(parsed) ? parsed : [];
}

function titleCase(text) {
  if (!text) return "";
  return text
    .toString()
    .replace(/[_-]/g, " ")
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ");
}

function normalizeCategory(cat) {
  const c = (cat || "").toString().trim().toLowerCase();
  if (!c) return "";
  if (c === "tops" || c === "top") return "Tops";
  if (c === "bottoms" || c === "bottom") return "Bottoms";
  if (c === "outerwear" || c === "jacket" || c === "coats") return "Outerwear";
  if (c === "shoes" || c === "shoe") return "Shoes";
  if (c === "accessories" || c === "accessory") return "Accessories";
  return titleCase(c);
}

function normalizeColorName(raw) {
  if (!raw) return "";
  const t = raw.toString().trim().toLowerCase();

  const map = {
    "off white": "white",
    ivory: "white",
    cream: "beige",
    tan: "beige",
    khaki: "beige",
    "navy blue": "navy",
    "dark blue": "navy",
    "light blue": "blue",
    "forest green": "green",
    olive: "green",
    mint: "green",
    "hot pink": "pink",
    rose: "pink",
    burgundy: "red",
    maroon: "red",
    wine: "red",
    charcoal: "gray",
    silver: "gray",
    denim: "navy",
  };

  return map[t] || t;
}

function colorGroup(colorRaw) {
  const c = normalizeColorName(colorRaw);

  const neutrals = new Set([
    "black",
    "white",
    "gray",
    "grey",
    "beige",
    "tan",
    "cream",
    "brown",
    "navy",
    "denim",
  ]);

  const warms = new Set(["red", "orange", "yellow", "pink", "coral", "peach"]);
  const cools = new Set(["blue", "green", "purple", "teal", "turquoise"]);

  if (!c) return "unknown";
  if (neutrals.has(c)) return "neutral";
  if (warms.has(c)) return "warm";
  if (cools.has(c)) return "cool";
  return "unknown";
}


function pairScore(aColor, bColor) {
  const a = colorGroup(aColor);
  const b = colorGroup(bColor);

  if (a === "neutral" || b === "neutral") return 3;
  if (a === "unknown" || b === "unknown") return 2;
  if (a === b) return 3;
  return 1;
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return function next() {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function pickOne(list, rng) {
  if (!Array.isArray(list) || list.length === 0) return null;
  const idx = Math.floor(rng() * list.length);
  return list[idx];
}

function bestMatch(primaryItem, candidates, rng) {
  if (!primaryItem) return pickOne(candidates, rng);
  if (!Array.isArray(candidates) || candidates.length === 0) return null;

  let best = null;
  let bestScore = -1;

  for (const c of candidates) {
    const s = pairScore(primaryItem.color, c.color);
    if (s > bestScore) {
      bestScore = s;
      best = c;
    } else if (s === bestScore && rng() > 0.5) {
      best = c;
    }
  }

  return best || pickOne(candidates, rng);
}

function bucketWardrobe(activeItems) {
  const pool = (Array.isArray(activeItems) ? activeItems : []).map((x, idx) => ({
    ...x,
    _idx: idx,
    category: normalizeCategory(x?.category),
    color: titleCase(normalizeColorName(x?.color || "")),
    name: x?.name || "Wardrobe item",
  }));

  const byCat = { Tops: [], Bottoms: [], Shoes: [], Other: [] };

  for (const item of pool) {
    if (item.category === "Tops") byCat.Tops.push(item);
    else if (item.category === "Bottoms") byCat.Bottoms.push(item);
    else if (item.category === "Shoes") byCat.Shoes.push(item);
    else byCat.Other.push(item);
  }

  return byCat;
}

function defaultOutfitSet(seedNumber) {
  const base = [
    { id: "d1", name: "Navy Blazer", color: "Navy", category: "Outerwear" },
    { id: "d2", name: "White Button-Up", color: "White", category: "Tops" },
    { id: "d3", name: "Gray Trousers", color: "Gray", category: "Bottoms" },
    { id: "d4", name: "Black Oxfords", color: "Black", category: "Shoes" },
  ];

  const seed =
    typeof seedNumber === "number" && Number.isFinite(seedNumber) ? seedNumber : Date.now();
  const rng = mulberry32(seed);

  const altShoes = [
    { id: "d4a", name: "Black Oxfords", color: "Black", category: "Shoes" },
    { id: "d4b", name: "White Sneakers", color: "White", category: "Shoes" },
    { id: "d4c", name: "Nude Flats", color: "Beige", category: "Shoes" },
  ];

  const altBottoms = [
    { id: "d3a", name: "Gray Trousers", color: "Gray", category: "Bottoms" },
    { id: "d3b", name: "Black Jeans", color: "Black", category: "Bottoms" },
    { id: "d3c", name: "Navy Skirt", color: "Navy", category: "Bottoms" },
  ];

  const altTops = [
    { id: "d2a", name: "White Button-Up", color: "White", category: "Tops" },
    { id: "d2b", name: "Cream Knit Top", color: "Beige", category: "Tops" },
    { id: "d2c", name: "Black Turtleneck", color: "Black", category: "Tops" },
  ];

  const make = () => {
    const top = pickOne(altTops, rng);
    const bottom = bestMatch(top, altBottoms, rng);
    const shoes = bestMatch(bottom || top, altShoes, rng);

    const outer = base[0];

    return [outer, top, bottom, shoes].map((x, i) => ({
      id: x.id ?? `df_${i}`,
      name: x.name,
      category: normalizeCategory(x.category),
      color: titleCase(x.color || ""),
    }));
  };

  return [make(), make(), make()];
}

function buildOneOutfit({ buckets, rng }) {
  const fallback = [...buckets.Tops, ...buckets.Bottoms, ...buckets.Shoes, ...buckets.Other];

  const top = pickOne(buckets.Tops.length ? buckets.Tops : fallback, rng);
  const bottom = bestMatch(top, buckets.Bottoms.length ? buckets.Bottoms : fallback, rng);
  const shoes = bestMatch(bottom || top, buckets.Shoes.length ? buckets.Shoes : fallback, rng);

  const items = [top, bottom, shoes].filter(Boolean);

  return items.map((x, i) => ({
    id: x.id ?? `w${i}_${x._idx}`,
    name: x.name ?? "Wardrobe item",
    category: normalizeCategory(x.category),
    color: titleCase(x.color || ""),
  }));
}

function generateThreeOutfits(items, seedNumber) {
  const active = (Array.isArray(items) ? items : []).filter((x) => x && x.is_active !== false);

  if (active.length === 0) {
    return defaultOutfitSet(seedNumber);
  }

  const seed =
    typeof seedNumber === "number" && Number.isFinite(seedNumber) ? seedNumber : Date.now();
  const rng = mulberry32(seed);
  const buckets = bucketWardrobe(active);

  const outfits = [];
  for (let i = 0; i < 3; i++) {
    const outfit = buildOneOutfit({ buckets, rng });
    if (outfit.length === 0) break;
    outfits.push(outfit);
  }

  while (outfits.length < 3) {
    outfits.push(defaultOutfitSet(seedNumber)[outfits.length]);
  }

  return outfits.slice(0, 3);
}

function uniqueNonEmpty(values) {
  const out = [];
  for (const v of values) {
    const val = (v || "").toString().trim();
    if (!val) continue;
    if (!out.includes(val)) out.push(val);
  }
  return out;
}

function fitFocusSentence(bodyTypeId) {
  const id = (bodyTypeId || DEFAULT_BODY_TYPE).toString();

  if (id === "pear") return "Fit focus: add structure on top and keep balance through the hips.";
  if (id === "apple") return "Fit focus: clean lines and comfort through the middle with light structure.";
  if (id === "hourglass") return "Fit focus: highlight the waist while keeping proportions even.";
  if (id === "inverted") return "Fit focus: balance the shoulders with a bit more volume below.";
  return "Fit focus: add shape with layers and contrast.";
}

function bodyTypeLabelFromId(bodyTypeId) {
  const id = (bodyTypeId || DEFAULT_BODY_TYPE).toString();
  return BODY_TYPE_LABELS[id] || titleCase(id);
}

function buildExplanation1to2Sentences({ answers, outfit }) {
  const dressFor = Array.isArray(answers?.dressFor) ? answers.dressFor : [];
  const style = Array.isArray(answers?.style) ? answers.style : [];

  const bodyTypeId = answers?.bodyType ? answers.bodyType : DEFAULT_BODY_TYPE;

  const occasion = dressFor.length ? titleCase(dressFor[0]) : "your day";
  const styleHint = style.length ? titleCase(style[0]) : "";

  const colors = uniqueNonEmpty((outfit || []).map((x) => x?.color));
  const categories = uniqueNonEmpty((outfit || []).map((x) => normalizeCategory(x?.category)));

  const colorPart = colors.length
    ? `The colors (${colors.slice(0, 3).join(", ")}) work well together.`
    : "The colors work well together.";

  const occasionPart = styleHint
    ? `It fits ${occasion} with a ${styleHint.toLowerCase()} feel.`
    : `It fits ${occasion} comfortably.`;

  const fitPart = `It’s chosen to flatter a ${bodyTypeLabelFromId(bodyTypeId)} shape.`;

  const hasOutfit = Array.isArray(outfit) && outfit.length > 0;
  const fallback = "Pick a style and an occasion in onboarding to get a personalized explanation.";

  if (!hasOutfit) return fallback;

  const sentence1 = `${occasionPart} ${colorPart}`.trim();

  const mentionsCategories =
    categories.length >= 2 ? `You’ve got a good mix of ${categories.slice(0, 3).join(", ")}.` : "";

  
  const sentence2 = [fitPart, mentionsCategories].filter(Boolean).join(" ").trim();

  const sentence3 = fitFocusSentence(bodyTypeId);

  return [sentence1, sentence2, sentence3].filter(Boolean).join(" ").trim();
}

export default function Dashboard({
  answers,
  onResetOnboarding = () => {},
  authMode = "guest",
  onSignIn = () => {},
}) {
  const [theme, setTheme] = useState(() => readTheme());
  const [wardrobe, setWardrobe] = useState(() => loadWardrobe());

  const [recSeed, setRecSeed] = useState(() => Date.now());

  const weather = { label: "Today's Weather", condition: "Partly Cloudy", tempF: 68 };

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === WARDROBE_KEY) setWardrobe(loadWardrobe());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const outfits = useMemo(() => generateThreeOutfits(wardrobe, recSeed), [wardrobe, recSeed]);

  const explanationText = useMemo(() => {
    const firstOutfit = outfits[0] || [];
    const text = buildExplanation1to2Sentences({ answers, outfit: firstOutfit });
    const cleaned = (text || "").toString().trim();
    return cleaned || "Pick a style and an occasion in onboarding to get a personalized explanation.";
  }, [answers, outfits]);

  const chipText = useMemo(() => {
    const dressFor = Array.isArray(answers?.dressFor) ? answers.dressFor : [];
    return dressFor.length ? titleCase(dressFor[0]) : "Daily";
  }, [answers]);

  const toggleTheme = () => setTheme((prev) => (prev === "light" ? "dark" : "light"));
  const isGuest = authMode !== "google" && authMode !== "email";

  const canRefresh = true;

  const handleRefreshRecommendation = () => {
    setRecSeed(Date.now());
  };

  return (
    <div className="onboarding onboardingPage">
      <div className="dashHeaderBar">
        <div className="brandBar" style={{ marginBottom: 0 }}>
          <div className="brandLeft">
            <div className="brandMark brandMarkSm">
              <img className="dashLogo" src="/officialLogo.png" alt="FitGPT official logo" />
            </div>
            <div className="dashStrong">FitGPT</div>
          </div>
        </div>

        <div className="dashHeaderRight">
          <button type="button" className="linkBtn" onClick={toggleTheme}>
            {theme === "light" ? "Dark" : "Light"}
          </button>

          <button type="button" className="linkBtn" onClick={onResetOnboarding}>
            Reset
          </button>

          {isGuest ? (
            <button
              type="button"
              className="btn primary"
              onClick={() => onSignIn()}
              disabled={typeof onSignIn !== "function"}
            >
              Sign in to save
            </button>
          ) : (
            <div className="dashMuted" style={{ fontSize: 13 }}>
              Signed in
            </div>
          )}
        </div>
      </div>

      <div className="dashTopRightDate">{formatToday()}</div>

      <section className="card dashWide">
        <div className="dashWeatherRow">
          <div className="dashWeatherLeft">
            <div className="dashMuted">{weather.label}</div>
            <div className="dashStrong">
              {weather.condition}, {weather.tempF}°F
            </div>
          </div>
          <div className="dashWeatherIcon" aria-hidden="true" />
        </div>
      </section>

      <section className="card dashWide dashRecCard">
        <div className="dashRecHeader">
          <div className="dashRecHeaderLeft">
            <div className="dashRecTitle">Today’s Recommendation</div>
          </div>
          <div className="dashChip">{chipText}</div>
        </div>

        {outfits.map((outfit, idx) => (
          <div key={`opt_${idx}`} style={{ marginTop: idx === 0 ? 0 : 14 }}>
            <div className="dashMuted" style={{ fontSize: 13, marginBottom: 8 }}>
              Option {idx + 1}
            </div>

            <div className="dashOutfitGridFigma">
              {outfit.map((item) => (
                <div key={item.id} className="dashSquareTile">
                  <div className="dashSquareImg" aria-hidden="true" />
                  <div className="dashSquareName">{item.name}</div>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="dashInfoBlock" aria-live="polite" style={{ marginTop: 12 }}>
          <div className="dashInfoTitle">Why This Outfit?</div>
          <div className="dashSubText" style={{ lineHeight: 1.45 }}>
            {explanationText}
          </div>
        </div>

        <div className="dashActionRow">
          <button
            type="button"
            className="btn primary"
            onClick={handleRefreshRecommendation}
            disabled={!canRefresh}
          >
            Refresh suggestions
          </button>
          <button type="button" className="btn" disabled>
            Save
          </button>
          <button type="button" className="btn" disabled>
            Share
          </button>
        </div>
      </section>

      <section className="card dashWide">
        <div className="dashCardTitle">Quick Actions</div>

        <div className="dashQuickActionFigma" aria-disabled="true">
          <div className="dashStrong">Plan Tomorrow’s Outfit</div>
          <div className="dashSubText">Get ahead of your schedule</div>
        </div>

        <div className="dashQuickActionFigma" aria-disabled="true">
          <div className="dashStrong">Browse Past Outfits</div>
          <div className="dashSubText">See what you’ve worn recently</div>
        </div>
      </section>

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