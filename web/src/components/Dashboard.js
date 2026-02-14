import React, { useEffect, useMemo, useState } from "react";

const DEFAULT_BODY_TYPE = "unspecified";
const WARDROBE_KEY = "fitgpt_wardrobe_v1";

function titleCase(text) {
  if (!text) return "";
  return text
    .toString()
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

function makeId() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

const CATEGORY_OPTIONS = ["Top", "Bottom", "Dress", "Outerwear", "Shoes", "Accessory"];

export default function Dashboard({ answers, onResetOnboarding }) {
  const [wardrobe, setWardrobe] = useState([]);
  const [form, setForm] = useState({
    name: "",
    category: "Top",
    color: "",
    notes: "",
  });

  const [error, setError] = useState("");

  useEffect(() => {
    setWardrobe(loadWardrobe());
  }, []);

  useEffect(() => {
    saveWardrobe(wardrobe);
  }, [wardrobe]);

  const hasBodyType = !!answers?.bodyType && answers.bodyType !== DEFAULT_BODY_TYPE;
  const bodyTypeDisplay = hasBodyType ? titleCase(answers.bodyType) : "Not set";

  const summary = useMemo(() => {
    const styleCount = answers?.style?.length ?? 0;
    const dressForCount = answers?.dressFor?.length ?? 0;
    const bodyTypeIsSkipped = !answers?.bodyType || answers.bodyType === DEFAULT_BODY_TYPE;

    if (wardrobe.length === 0) {
      return "Add your first wardrobe item. Once you have a few pieces, FitGPT can start building outfits.";
    }

    if (dressForCount > 0) {
      return `Focus today: ${titleCase(answers.dressFor[0])}. You have ${wardrobe.length} item${
        wardrobe.length === 1 ? "" : "s"
      } saved.`;
    }

    if (styleCount > 0) {
      return `Your vibe leans ${titleCase(answers.style[0])}. You have ${wardrobe.length} item${
        wardrobe.length === 1 ? "" : "s"
      } saved.`;
    }

    if (bodyTypeIsSkipped) {
      return `You have ${wardrobe.length} wardrobe item${wardrobe.length === 1 ? "" : "s"} saved.`;
    }

    return `You have ${wardrobe.length} wardrobe item${wardrobe.length === 1 ? "" : "s"} saved.`;
  }, [answers, wardrobe.length]);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (error) setError("");
  };

  const handleAddItem = (e) => {
    e.preventDefault();

    const name = form.name.trim();
    const color = form.color.trim();

    if (!name) {
      setError("Please enter an item name.");
      return;
    }

    const newItem = {
      id: makeId(),
      name,
      category: form.category,
      color,
      notes: form.notes.trim(),
      createdAt: Date.now(),
    };

    setWardrobe((prev) => [newItem, ...prev]);
    setForm({ name: "", category: form.category, color: "", notes: "" });
  };

  const handleDelete = (id) => {
    setWardrobe((prev) => prev.filter((x) => x.id !== id));
  };

  return (
    <div className="dashboard">
      <div className="dashboardHeader">
        <div className="brandBar">
          <div className="brandLeft">
            <img className="brandLogo" src="/officialLogo.png" alt="FitGPT official logo" />
          </div>
        </div>

        <button type="button" className="btn" onClick={onResetOnboarding}>
          Reset onboarding
        </button>
      </div>

      <div className="dashCard">
        <div className="dashTitle">Your style profile</div>

        <div className="profileRow">
          <div className="label">Style</div>
          <div className="value">{joinNice(answers?.style)}</div>
        </div>

        <div className="profileRow">
          <div className="label">Dress for</div>
          <div className="value">{joinNice(answers?.dressFor)}</div>
        </div>

        <div className="profileRow">
          <div className="label">Body type</div>
          <div className="value">{bodyTypeDisplay}</div>
        </div>
      </div>

      <div className="dashCard">
        <div className="dashTitle">Next best step</div>
        <div className="mutedText">{summary}</div>

        <div className="quickActions">
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              const el = document.getElementById("wardrobeSection");
              if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            Add wardrobe item
          </button>

          <button type="button" className="btn" disabled title="Next story">
            Get an outfit
          </button>

          <button type="button" className="btn" disabled title="Next story">
            Plan a week
          </button>
        </div>

        <div className="mutedNote">
          Wardrobe is implemented below. Outfit generation comes next.
        </div>
      </div>

      <div className="dashCard" id="wardrobeSection">
        <div className="dashTitle">Wardrobe</div>

        <form onSubmit={handleAddItem} style={{ marginTop: 10 }}>
          <div className="wardrobeFormRow">
            <div className="field">
              <div className="fieldLabel">Item name</div>
              <input
                className="textInput"
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="Example: Black blazer"
              />
            </div>

            <div className="field">
              <div className="fieldLabel">Category</div>
              <select
                className="textInput"
                value={form.category}
                onChange={(e) => handleChange("category", e.target.value)}
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <div className="fieldLabel">Color</div>
              <input
                className="textInput"
                value={form.color}
                onChange={(e) => handleChange("color", e.target.value)}
                placeholder="Example: Red"
              />
            </div>
          </div>

          <div className="field" style={{ marginTop: 10 }}>
            <div className="fieldLabel">Notes (optional)</div>
            <input
              className="textInput"
              value={form.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              placeholder="Example: Oversized fit, good for work"
            />
          </div>

          {error ? (
            <div style={{ marginTop: 10 }} className="noteBox">
              {error}
            </div>
          ) : null}

          <div className="buttonRow" style={{ justifyContent: "flex-start" }}>
            <button type="submit" className="btn primary">
              Save item
            </button>
          </div>
        </form>

        {wardrobe.length === 0 ? (
          <div className="noteBox" style={{ marginTop: 14 }}>
            Your wardrobe is empty. Add your first item above to start building outfits.
          </div>
        ) : (
          <div style={{ marginTop: 14 }}>
            <div className="mutedText" style={{ marginBottom: 10 }}>
              Saved items: {wardrobe.length}
            </div>

            <div className="wardrobeList">
              {wardrobe.map((item) => (
                <div key={item.id} className="wardrobeItem">
                  <div className="wardrobeMain">
                    <div className="wardrobeName">{item.name}</div>
                    <div className="wardrobeMeta">
                      {item.category}
                      {item.color ? ` • ${titleCase(item.color)}` : ""}
                      {item.notes ? ` • ${item.notes}` : ""}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn"
                    onClick={() => handleDelete(item.id)}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
