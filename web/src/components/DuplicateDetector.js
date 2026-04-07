import React, { useMemo, useState } from "react";
import { detectDuplicates } from "../utils/recommendationEngine";
import { loadDismissedDuplicates, dismissDuplicatePair } from "../utils/userStorage";

const LEVEL_LABELS = {
  exact: "Exact Duplicate",
  likely: "Likely Duplicate",
  similar: "Similar Item",
};
const LEVEL_ORDER = ["exact", "likely", "similar"];

function PairCard({ pair, onDismiss }) {
  const { itemA, itemB, score, level } = pair;
  const pct = Math.round(score * 100);

  return (
    <div className={`dupPairCard dupPairCard--${level}`}>
      <div className="dupPairItems">
        <div className="dupPairItem">
          {itemA?.image_url ? (
            <img className="dupPairThumb" src={itemA.image_url} alt="" />
          ) : (
            <div className="dupPairThumbPh" />
          )}
          <div className="dupPairName">{itemA?.name || "Item"}</div>
          <div className="dupPairMeta">{itemA?.color} / {itemA?.clothing_type || itemA?.category}</div>
        </div>
        <div className="dupPairVs">
          <span className="dupPairPct">{pct}%</span>
          <span className="dupPairLevel">{LEVEL_LABELS[level]}</span>
        </div>
        <div className="dupPairItem">
          {itemB?.image_url ? (
            <img className="dupPairThumb" src={itemB.image_url} alt="" />
          ) : (
            <div className="dupPairThumbPh" />
          )}
          <div className="dupPairName">{itemB?.name || "Item"}</div>
          <div className="dupPairMeta">{itemB?.color} / {itemB?.clothing_type || itemB?.category}</div>
        </div>
      </div>
      <button className="btn dupDismissBtn" onClick={() => onDismiss(pair.pairKey)}>
        Not a Duplicate
      </button>
    </div>
  );
}

export default function DuplicateDetector({ items, user }) {
  const [dismissed, setDismissed] = useState(() => new Set(loadDismissedDuplicates(user)));
  const [collapsed, setCollapsed] = useState(false);

  const results = useMemo(
    () => detectDuplicates(items, dismissed),
    [items, dismissed]
  );

  const handleDismiss = (pairKey) => {
    dismissDuplicatePair(pairKey, user);
    setDismissed((prev) => new Set([...prev, pairKey]));
  };

  if (results.total === 0) return null;

  return (
    <div className="dupDetectorWrap">
      <button className="dupDetectorHeader" onClick={() => setCollapsed((c) => !c)}>
        <span className="dupDetectorIcon">&#x26A0;</span>
        <span className="dupDetectorTitle">
          {results.total} potential duplicate{results.total !== 1 ? "s" : ""} detected
        </span>
        <span className="dupDetectorChevron">{collapsed ? "\u25B6" : "\u25BC"}</span>
      </button>

      {!collapsed && (
        <div className="dupDetectorBody">
          {LEVEL_ORDER.map((level) => {
            const pairs = results[level];
            if (!pairs.length) return null;
            return (
              <div key={level} className="dupLevelGroup">
                <div className="dupLevelLabel">{LEVEL_LABELS[level]}s ({pairs.length})</div>
                {pairs.slice(0, 5).map((pair) => (
                  <PairCard key={pair.pairKey} pair={pair} onDismiss={handleDismiss} />
                ))}
                {pairs.length > 5 && (
                  <div className="dupMoreNote">+{pairs.length - 5} more</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
