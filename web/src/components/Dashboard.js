import React, { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";

const THEME_KEY = "fitgpt_theme_v1";
const WARDROBE_KEY = "fitgpt_wardrobe_v1";
const DEFAULT_BODY_TYPE = "unspecified";

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

function pickDailyOutfit(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return [
      { id: "p1", name: "Navy Blazer", color: "Navy", category: "Outerwear" },
      { id: "p2", name: "White Button-Up", color: "White", category: "Tops" },
      { id: "p3", name: "Gray Trousers", color: "Gray", category: "Bottoms" },
      { id: "p4", name: "Black Oxfords", color: "Black", category: "Shoes" },
    ];
  }

  const daySeed = Number(new Date().toISOString().slice(0, 10).replace(/-/g, ""));
  const hash = (n) => (n * 9301 + 49297) % 233280;

  const pool = items.map((x, idx) => ({ ...x, _idx: idx }));
  const picks = [];
  let h = daySeed;

  while (picks.length < Math.min(4, pool.length)) {
    h = hash(h);
    const i = h % pool.length;
    const candidate = pool[i];
    const candidateId = candidate.id ?? candidate._idx;
    if (!picks.find((p) => (p.id ?? p._idx) === candidateId)) picks.push(candidate);
  }

  return picks.map((x, i) => ({
    id: x.id ?? `w${i}`,
    name: x.name ?? "Wardrobe item",
    category: x.category ?? "",
    color: x.color ?? "",
  }));
}

function buildExplanation({ answers }) {
  const dressFor = Array.isArray(answers?.dressFor) ? answers.dressFor : [];
  const style = Array.isArray(answers?.style) ? answers.style : [];
  const bodyType = answers?.bodyType ?? DEFAULT_BODY_TYPE;

  const occasion = dressFor.length ? titleCase(dressFor[0]) : "your day";
  const styleHint = style.length ? ` in a ${titleCase(style[0])} direction` : "";
  const why = `Professional yet approachable for ${occasion}${styleHint}.`;

  const fit =
    bodyType && bodyType !== DEFAULT_BODY_TYPE
      ? `This combination is balanced to complement a ${titleCase(bodyType)} shape.`
      : "Body type is not set yet, so fit logic is neutral for now.";

  return { why, fit };
}

export default function Dashboard({
  answers,
  onResetOnboarding = () => {},
  authMode = "guest",
  onSignIn = () => {},
}) {
  const [theme, setTheme] = useState(() => readTheme());
  const [wardrobe, setWardrobe] = useState(() => loadWardrobe());

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

  const outfit = useMemo(() => pickDailyOutfit(wardrobe), [wardrobe]);
  const explanation = useMemo(() => buildExplanation({ answers }), [answers]);

  const chipText = useMemo(() => {
    const dressFor = Array.isArray(answers?.dressFor) ? answers.dressFor : [];
    return dressFor.length ? titleCase(dressFor[0]) : "Daily";
  }, [answers]);

  const toggleTheme = () => setTheme((prev) => (prev === "light" ? "dark" : "light"));
  const isGuest = authMode !== "google" && authMode !== "email";

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

        <div className="dashOutfitGridFigma">
          {outfit.map((item) => (
            <div key={item.id} className="dashSquareTile">
              <div className="dashSquareImg" aria-hidden="true" />
              <div className="dashSquareName">{item.name}</div>
            </div>
          ))}
        </div>

        <div className="dashInfoBlock">
          <div className="dashInfoTitle">Why This Outfit?</div>
          <div className="dashSubText">{explanation.why}</div>
        </div>

        <div className="dashInfoBlock" style={{ marginTop: 10 }}>
          <div className="dashInfoTitle">Tailored to Your Body Type</div>
          <div className="dashSubText">{explanation.fit}</div>
        </div>

        <div className="dashActionRow">
          <button type="button" className="btn primary" disabled>
            Get another suggestion
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