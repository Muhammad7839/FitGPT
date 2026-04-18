// web/src/components/CustomThemeEditor.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { useTheme } from "../App";
import { buildCustomTheme } from "../theme/themeDefinitions";
import { deriveAccentVars } from "../theme/colorUtils";

const CTE_TITLE_ID = "cte-title";

function ColorRow({ label, value, onChange }) {
  return (
    <label className="cteColorRow">
      <span className="cteColorLabel">{label}</span>
      <span className="cteColorInputs">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="cteColorPicker"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange(v);
          }}
          className="cteHexInput"
          maxLength={7}
          spellCheck={false}
        />
      </span>
    </label>
  );
}

export default function CustomThemeEditor({ onClose }) {
  const { saveCustomTheme, setTheme } = useTheme();
  const lastFocusedRef = useRef(null);

  useEffect(() => {
    lastFocusedRef.current = document.activeElement;
    return () => {
      const target = lastFocusedRef.current;
      if (target && typeof target.focus === "function") {
        target.focus();
      }
    };
  }, []);

  const [name, setName] = useState("");
  const [base, setBase] = useState("dark");
  const [accent, setAccent] = useState("#c43c3c");
  const [bg, setBg] = useState("#141418");
  const [text, setText] = useState("#e8e6e3");
  const [surface, setSurface] = useState("#1c1c22");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advAccentHover, setAdvAccentHover] = useState("");
  const [advBorder, setAdvBorder] = useState("");
  const [advMuted, setAdvMuted] = useState("");

  // When base toggles, reset defaults
  const handleBaseChange = (b) => {
    setBase(b);
    if (b === "light") {
      setBg("#ffffff");
      setText("#111111");
      setSurface("#ffffff");
      setAccent("#8b1e1e");
    } else {
      setBg("#141418");
      setText("#e8e6e3");
      setSurface("#1c1c22");
      setAccent("#c43c3c");
    }
  };

  const derived = useMemo(() => deriveAccentVars(accent, base), [accent, base]);

  const previewTheme = useMemo(() => {
    const advancedOverrides = {};
    if (advAccentHover) advancedOverrides["--accent-hover"] = advAccentHover;
    if (advBorder) advancedOverrides["--border"] = advBorder;
    if (advMuted) advancedOverrides["--muted"] = advMuted;

    return buildCustomTheme({
      id: "preview",
      name: name || "Custom Theme",
      base,
      accent,
      bg,
      text,
      surface,
      advancedOverrides,
    });
  }, [name, base, accent, bg, text, surface, advAccentHover, advBorder, advMuted]);

  const handleSave = useCallback(() => {
    const id = "custom_" + Date.now().toString(36);
    const theme = { ...previewTheme, id, name: name || "Custom Theme" };
    saveCustomTheme(theme);
    setTheme(theme);
    onClose();
  }, [previewTheme, name, saveCustomTheme, setTheme, onClose]);

  return ReactDOM.createPortal(
    <div
      className="modalOverlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={CTE_TITLE_ID}
      onClick={onClose}
    >
      <div className="modalCard cteModal" onClick={(e) => e.stopPropagation()}>
        <div className="cteHeader">
          <h2 id={CTE_TITLE_ID} className="cteTitle">Create Custom Theme</h2>
          <button type="button" className="cteCloseBtn" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="cteBody">
          <div className="cteForm">
            {/* Name */}
            <label className="cteFieldLabel">
              Theme Name
              <input
                type="text"
                className="cteNameInput"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Theme"
                maxLength={24}
              />
            </label>

            {/* Base toggle */}
            <div className="cteFieldLabel">Base Mode</div>
            <div className="cteBaseToggle">
              <button
                type="button"
                className={"cteBaseBtn" + (base === "light" ? " active" : "")}
                onClick={() => handleBaseChange("light")}
              >
                &#9728;&#65039; Light
              </button>
              <button
                type="button"
                className={"cteBaseBtn" + (base === "dark" ? " active" : "")}
                onClick={() => handleBaseChange("dark")}
              >
                &#127769; Dark
              </button>
            </div>

            {/* Color pickers */}
            <ColorRow label="Accent" value={accent} onChange={setAccent} />
            <ColorRow label="Background" value={bg} onChange={setBg} />
            <ColorRow label="Text" value={text} onChange={setText} />
            <ColorRow label="Surface" value={surface} onChange={setSurface} />

            {/* Advanced */}
            <button
              type="button"
              className="cteAdvToggle"
              onClick={() => setShowAdvanced((v) => !v)}
            >
              {showAdvanced ? "\u25BC" : "\u25B6"} Advanced
            </button>
            {showAdvanced && (
              <div className="cteAdvSection">
                <ColorRow
                  label="Accent Hover"
                  value={advAccentHover || derived["--accent-hover"]}
                  onChange={setAdvAccentHover}
                />
                <ColorRow
                  label="Border"
                  value={advBorder || (base === "light" ? "#1b1927" : "#ffffff")}
                  onChange={setAdvBorder}
                />
                <ColorRow
                  label="Muted Text"
                  value={advMuted || (base === "light" ? "#111111" : "#e8e6e3")}
                  onChange={setAdvMuted}
                />
              </div>
            )}
          </div>

          {/* Live preview */}
          <div className="ctePreview">
            <div className="ctePreviewLabel">Preview</div>
            <div
              className="ctePreviewCard"
              style={{
                background: previewTheme.vars["--bg"],
                color: previewTheme.vars["--text"],
                borderColor: previewTheme.vars["--accent"],
              }}
            >
              <div
                className="ctePreviewAccentBar"
                style={{
                  background: `linear-gradient(90deg, ${previewTheme.vars["--accent"]}, ${previewTheme.vars["--accent-hover"]})`,
                }}
              />
              <div className="ctePreviewTitle" style={{ color: previewTheme.vars["--text"] }}>
                {name || "Custom Theme"}
              </div>
              <div
                className="ctePreviewMuted"
                style={{ color: previewTheme.vars["--muted"] }}
              >
                Sample subtitle text
              </div>
              <div
                className="ctePreviewSurface"
                style={{
                  background: previewTheme.vars["--surface"],
                  borderColor: previewTheme.vars["--border"],
                }}
              >
                <span
                  className="ctePreviewAccentText"
                  style={{ color: previewTheme.vars["--accent"] }}
                >
                  Accent
                </span>
                <span style={{ color: previewTheme.vars["--text"], fontSize: "12px" }}>
                  Surface card
                </span>
              </div>
              <div className="ctePreviewBtnRow">
                <span
                  className="ctePreviewBtn"
                  style={{
                    background: previewTheme.vars["--accent"],
                    color: "#fff",
                  }}
                >
                  Button
                </span>
                <span
                  className="ctePreviewBtn ctePreviewBtnOutline"
                  style={{
                    borderColor: previewTheme.vars["--accent"],
                    color: previewTheme.vars["--accent"],
                  }}
                >
                  Outline
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="cteFooter">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="styledSaveBtn" onClick={handleSave}>
            <span className="styledSaveBtnInner">Save &amp; Apply</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
