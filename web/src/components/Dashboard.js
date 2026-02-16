// web/src/components/Dashboard.js
import React, { useEffect, useMemo, useState } from "react";

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

function joinNice(list) {
  if (!Array.isArray(list) || list.length === 0) return "Not set";
  if (list.length === 1) return titleCase(list[0]);
  if (list.length === 2) return `${titleCase(list[0])} and ${titleCase(list[1])}`;
  const allButLast = list.slice(0, -1).map(titleCase).join(", ");
  return `${allButLast}, and ${titleCase(list[list.length - 1])}`;
}

function pickDailyOutfit(items) {
  if (!Array.isArray(items) || items.length === 0) return [];

  const daySeed = Number(new Date().toISOString().slice(0, 10).replace(/-/g, ""));
  const hash = (n) => (n * 9301 + 49297) % 233280;

  const pool = items.map((x, idx) => ({ ...x, _idx: idx }));
  const picks = [];
  let h = daySeed;

  while (picks.length < Math.min(4, pool.length)) {
    h = hash(h);
    const i = h % pool.length;
    const candidate = pool[i];
    if (!picks.find((p) => p.id === candidate.id)) picks.push(candidate);
  }

  return picks.map((x, i) => ({
    id: x.id ?? `${i}`,
    name: x.name ?? "Wardrobe item",
    category: x.category ?? "",
    color: x.color ?? "",
    notes: x.notes ?? "",
  }));
}

function buildExplanation({ answers, outfit }) {
  const style = Array.isArray(answers?.style) ? answers.style : [];
  const dressFor = Array.isArray(answers?.dressFor) ? answers.dressFor : [];
  const bodyType = answers?.bodyType ?? DEFAULT_BODY_TYPE;

  const parts = [];

  if (dressFor.length > 0) parts.push(`Built for ${titleCase(dressFor[0])}.`);
  else parts.push("Built as a simple everyday outfit.");

  if (style.length > 0) parts.push(`Style direction: ${titleCase(style[0])}.`);

  if (outfit.length > 0) {
    const cats = outfit
      .map((o) => o.category)
      .filter(Boolean)
      .map(titleCase);
    const uniqueCats = Array.from(new Set(cats));
    if (uniqueCats.length > 0) parts.push(`Includes: ${uniqueCats.join(", ")}.`);
  }

  const bodyLine =
    bodyType && bodyType !== DEFAULT_BODY_TYPE
      ? `Fit note: adjusted for ${titleCase(bodyType)} proportions.`
      : "Fit note: body type not set yet, so fit logic is neutral.";

  return { why: parts.join(" "), body: bodyLine };
}

export default function Dashboard({ answers, onResetOnboarding, onLogout, userName }) {
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || "light");
  const [wardrobe, setWardrobe] = useState(() => loadWardrobe());

  const [weather] = useState({
    label: "Today's Weather",
    condition: "Partly Cloudy",
    tempF: 68,
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, JSON.stringify(theme));
  }, [theme]);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === WARDROBE_KEY) setWardrobe(loadWardrobe());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const outfit = useMemo(() => pickDailyOutfit(wardrobe), [wardrobe]);
  const explanation = useMemo(() => buildExplanation({ answers, outfit }), [answers, outfit]);

  const hasBodyType = !!answers?.bodyType && answers.bodyType !== DEFAULT_BODY_TYPE;
  const bodyTypeDisplay = hasBodyType ? titleCase(answers.bodyType) : "Not set";

  const chipText = useMemo(() => {
    const dressFor = Array.isArray(answers?.dressFor) ? answers.dressFor : [];
    if (dressFor.length > 0) return titleCase(dressFor[0]);
    return "Daily";
  }, [answers]);

  const toggleTheme = () => setTheme((prev) => (prev === "light" ? "dark" : "light"));

  return (
    <div className="onboarding onboardingPage">
      <div className="dashHeaderBar">
        <div className="brandBar" style={{ marginBottom: 0 }}>
          <div className="brandLeft">
            <div className="brandMark brandMarkSm">
              <img className="dashLogo" src="/officialLogo.png" alt="FitGPT official logo" />
            </div>
            <div>
              <div className="dashStrong">{userName ? `Hi, ${userName}` : "FitGPT"}</div>
              <div className="dashDate">{formatToday()}</div>
            </div>
          </div>
        </div>

        <div className="dashHeaderRight">
          <button type="button" className="linkBtn" onClick={toggleTheme}>
            {theme === "light" ? "Dark" : "Light"}
          </button>
          <button type="button" className="linkBtn" onClick={onResetOnboarding}>
            Reset
          </button>
          <button type="button" className="linkBtn" onClick={onLogout}>
            Logout
          </button>
        </div>
      </div>

      <div className="dashGrid">
        <section className="card dashWide">
          <div className="dashCardTitle">Weather</div>
          <div className="dashWeatherLine">
            <span className="dashMuted">{weather.label}</span>
            <span className="dashDot" />
            <span className="dashStrong">{weather.condition}</span>
            <span className="dashMuted">, {weather.tempF}°F</span>
          </div>
        </section>

        <section className="card dashWide">
          <div className="dashRecTop">
            <div>
              <div className="dashCardTitle">Today’s recommendation</div>
              <div className="dashSubText">Based on your onboarding preferences</div>
            </div>
            <div className="dashChip">{chipText}</div>
          </div>

          {outfit.length === 0 ? (
            <div className="dashEmpty">
              <div className="dashEmptyTitle">No wardrobe items yet</div>
              <div className="dashSubText">
                Add a few items first, then FitGPT can generate outfits from what you own.
              </div>

              <div className="buttonRow">
                <button type="button" className="btn primary" disabled>
                  Add wardrobe item
                </button>
                <button type="button" className="btn" disabled>
                  Generate outfit
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="dashOutfitGrid">
                {outfit.map((item) => (
                  <div key={item.id} className="dashOutfitItem">
                    <div className="dashThumb" />
                    <div className="dashItemName">{item.name}</div>
                    <div className="dashItemMeta">
                      {item.category ? titleCase(item.category) : "Item"}
                      {item.color ? ` • ${titleCase(item.color)}` : ""}
                    </div>
                  </div>
                ))}
              </div>

              <div className="dashDivider" />

              <div className="dashExplainBlock">
                <div className="dashExplainTitle">Why this outfit</div>
                <div className="dashSubText">{explanation.why}</div>
              </div>

              <div className="dashDivider" />

              <div className="dashExplainBlock">
                <div className="dashExplainTitle">Fit logic</div>
                <div className="dashSubText">{explanation.body}</div>
              </div>

              <div className="buttonRow">
                <button type="button" className="btn primary" disabled>
                  Another suggestion
                </button>
                <button type="button" className="btn" disabled>
                  Save
                </button>
                <button type="button" className="btn" disabled>
                  Share
                </button>
              </div>
            </>
          )}
        </section>

        <section className="card">
          <div className="dashCardTitle">Your profile</div>

          <div className="dashProfileRow">
            <div className="dashMuted">Style</div>
            <div className="dashStrong">{joinNice(answers?.style)}</div>
          </div>

          <div className="dashProfileRow">
            <div className="dashMuted">Dress for</div>
            <div className="dashStrong">{joinNice(answers?.dressFor)}</div>
          </div>

          <div className="dashProfileRow">
            <div className="dashMuted">Body type</div>
            <div className="dashStrong">{bodyTypeDisplay}</div>
          </div>
        </section>

        <section className="card">
          <div className="dashCardTitle">Quick actions</div>

          <button type="button" className="dashQuickAction" disabled>
            <div className="dashStrong">Plan tomorrow’s outfit</div>
            <div className="dashSubText">Weekly planning comes next</div>
          </button>

          <button type="button" className="dashQuickAction" disabled>
            <div className="dashStrong">Browse past outfits</div>
            <div className="dashSubText">Favorites and history come next</div>
          </button>
        </section>
      </div>

      <nav className="dashBottomNav" aria-label="Dashboard navigation">
        <button type="button" className="dashNavItem dashNavActive">
          Today
        </button>
        <button type="button" className="dashNavItem" disabled>
          Wardrobe
        </button>
        <button type="button" className="dashNavItem" disabled>
          Favorites
        </button>
        <button type="button" className="dashNavItem" disabled>
          Profile
        </button>
      </nav>
    </div>
  );
}
