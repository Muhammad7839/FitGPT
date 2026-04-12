// web/src/components/ThemePicker.js
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTheme } from "../App";
import { getThemesByCategory } from "../theme/themeDefinitions";
import CustomThemeEditor from "./CustomThemeEditor";

const CATEGORY_LABELS = {
  classic: "Classic",
  preset: "Color",
  seasonal: "Seasonal & Mood",
  custom: "Custom",
};

export default function ThemePicker({ inline }) {
  const { theme, setTheme, customThemes, deleteCustomTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const ref = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const doTransition = useCallback(
    (themeObj) => {
      if (animating || themeObj.id === theme.id) return;
      setAnimating(true);

      const overlay = document.createElement("div");
      overlay.className =
        "themeWaterfallOverlay " + (themeObj.base === "dark" ? "toDark" : "toLight");
      document.body.appendChild(overlay);

      setTimeout(() => setTheme(themeObj), 300);
      setTimeout(() => overlay.classList.add("done"), 380);
      setTimeout(() => {
        overlay.remove();
        setAnimating(false);
      }, 720);

      setOpen(false);
    },
    [animating, theme.id, setTheme]
  );

  const groups = getThemesByCategory();

  return (
    <>
      <div className={"themePicker" + (inline ? " themePickerInline" : "")} ref={ref}>
        <button
          type="button"
          className="themePickerPill"
          onClick={() => setOpen((o) => !o)}
          aria-label="Choose theme"
          aria-expanded={open}
        >
          <span
            className="themePickerDot"
            style={{ background: theme.vars?.["--accent"] || "var(--accent)" }}
          />
          <span className="themePickerName">{theme.name || "Theme"}</span>
          <span className={"themePickerChevron" + (open ? " open" : "")}>&#9662;</span>
        </button>

        {open && (
          <div className="themePickerDropdown">
            {/* Category sections */}
            {["classic", "preset", "seasonal"].map((cat) => {
              const items = groups[cat];
              if (!items?.length) return null;
              return (
                <div key={cat} className="themePickerSection">
                  <div className="themePickerSectionLabel">{CATEGORY_LABELS[cat]}</div>
                  <div className="themePickerGrid">
                    {items.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className={
                          "themePickerTile" + (t.id === theme.id ? " active" : "")
                        }
                        onClick={() => doTransition(t)}
                        disabled={animating}
                        title={t.name}
                      >
                        <span
                          className="themePickerSwatch"
                          style={{
                            background: t.vars["--bg"],
                            borderColor: t.id === theme.id ? t.vars["--accent"] : "transparent",
                          }}
                        >
                          <span
                            className="themePickerAccentBar"
                            style={{ background: t.vars["--accent"] }}
                          />
                        </span>
                        <span className="themePickerTileLabel">
                          <span className="themePickerTileIcon">{t.icon}</span>
                          {t.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Custom section */}
            <div className="themePickerSection">
              <div className="themePickerSectionLabel">{CATEGORY_LABELS.custom}</div>
              <div className="themePickerGrid">
                {customThemes.map((t) => (
                  <div key={t.id} className="themePickerTileWrap">
                    <button
                      type="button"
                      className={
                        "themePickerTile" + (t.id === theme.id ? " active" : "")
                      }
                      onClick={() => doTransition(t)}
                      disabled={animating}
                      title={t.name}
                    >
                      <span
                        className="themePickerSwatch"
                        style={{
                          background: t.vars["--bg"],
                          borderColor: t.id === theme.id ? t.vars["--accent"] : "transparent",
                        }}
                      >
                        <span
                          className="themePickerAccentBar"
                          style={{ background: t.vars["--accent"] }}
                        />
                      </span>
                      <span className="themePickerTileLabel">
                        <span className="themePickerTileIcon">{t.icon}</span>
                        {t.name}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="themePickerDeleteBtn"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteCustomTheme(t.id);
                      }}
                      title="Delete theme"
                    >
                      &times;
                    </button>
                  </div>
                ))}
                {customThemes.length < 5 && (
                  <button
                    type="button"
                    className="themePickerTile themePickerCreateBtn"
                    onClick={() => {
                      setEditorOpen(true);
                      setOpen(false);
                    }}
                  >
                    <span className="themePickerCreatePlus">+</span>
                    <span className="themePickerTileLabel">Create</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {editorOpen && <CustomThemeEditor onClose={() => setEditorOpen(false)} />}
    </>
  );
}
