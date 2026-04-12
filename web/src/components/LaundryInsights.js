import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { outfitHistoryApi } from "../api/outfitHistoryApi";
import { loadWardrobe } from "../utils/userStorage";
import { EVT_LAUNDRY_CHANGED, EVT_OUTFIT_HISTORY_CHANGED, EVT_WARDROBE_CHANGED } from "../utils/constants";
import { formatCardDate } from "../utils/helpers";
import {
  LAUNDRY_THRESHOLD_CATEGORIES,
  buildLaundryInsights,
  dismissLaundryAlert,
  markLaundryItemWashed,
  readLaundryPreferences,
  resetLaundryThresholds,
  restoreLaundryAlert,
  setLaundryTrackingEnabled,
  updateLaundryThreshold,
} from "../utils/laundryTracking";

function LaundryItemCard({ item, onMarkWashed, onDismissAlert, onRestoreAlert }) {
  return (
    <article className={`laundryItemCard laundryItemCard--${item.tone}`}>
      <div className="laundryItemMedia">
        {item.imageUrl ? (
          <img className="laundryItemImg" src={item.imageUrl} alt={item.name} />
        ) : (
          <div className="laundryItemPh" aria-hidden="true" />
        )}
      </div>

      <div className="laundryItemBody">
        <div className="laundryItemHeader">
          <div>
            <div className="laundryItemTitle">{item.name}</div>
            <div className="laundryItemMeta">{item.category}</div>
          </div>
          <span className={`laundryStatusBadge laundryStatusBadge--${item.tone}`}>
            {item.statusLabel}
          </span>
        </div>

        <div className="laundryProgressWrap" aria-label={`${item.reuseCount} of ${item.threshold} recommended wears used`}>
          <div
            className={`laundryProgressBar laundryProgressBar--${item.tone}`}
            style={{ width: `${Math.max(item.percentUsed, item.reuseCount > 0 ? 10 : 0)}%` }}
          />
        </div>

        <div className="laundryInfoGrid">
          <div className="laundryInfoCell">
            <span className="laundryInfoLabel">Reuse Count</span>
            <strong>{item.reuseCount} / {item.threshold}</strong>
          </div>
          <div className="laundryInfoCell">
            <span className="laundryInfoLabel">Last Worn</span>
            <strong>{formatCardDate(item.lastWornAt) || "Unknown"}</strong>
          </div>
          <div className="laundryInfoCell">
            <span className="laundryInfoLabel">Total Wears</span>
            <strong>{item.totalWearCount}</strong>
          </div>
          <div className="laundryInfoCell">
            <span className="laundryInfoLabel">Laundry Status</span>
            <strong>
              {item.statusKey === "needs-wash"
                ? "These items may be ready for a wash"
                : item.statusKey === "nearing"
                  ? `${item.wearsRemaining} wear${item.wearsRemaining === 1 ? "" : "s"} left`
                  : "Still wearable"}
            </strong>
          </div>
        </div>

        <div className="laundrySuggestion">{item.suggestion}</div>

        <div className="historyActions">
          <button className="btn primary" type="button" onClick={() => onMarkWashed(item)}>
            Mark Washed
          </button>

          {item.statusKey === "needs-wash" && !item.alertDismissed ? (
            <button className="btn" type="button" onClick={() => onDismissAlert(item)}>
              Dismiss Alert
            </button>
          ) : null}

          {item.statusKey === "needs-wash" && item.alertDismissed ? (
            <button className="btn" type="button" onClick={() => onRestoreAlert(item)}>
              Show Alert Again
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function LaundryContent() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [filter, setFilter] = useState("all");
  const [wardrobe, setWardrobe] = useState([]);
  const [history, setHistory] = useState([]);
  const [preferences, setPreferences] = useState(() => readLaundryPreferences(user));
  const [thresholdDrafts, setThresholdDrafts] = useState(() => ({ ...readLaundryPreferences(user).thresholds }));

  const refresh = async () => {
    setLoading(true);
    setMsg("");
    try {
      const res = await outfitHistoryApi.listHistory(user);
      setWardrobe(loadWardrobe(user));
      setHistory(Array.isArray(res?.history) ? res.history : []);
      setPreferences(readLaundryPreferences(user));
    } catch {
      setWardrobe(loadWardrobe(user));
      setHistory([]);
      setPreferences(readLaundryPreferences(user));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();

    const onDataChanged = () => refresh();
    const onLaundryChanged = () => setPreferences(readLaundryPreferences(user));
    window.addEventListener(EVT_OUTFIT_HISTORY_CHANGED, onDataChanged);
    window.addEventListener(EVT_WARDROBE_CHANGED, onDataChanged);
    window.addEventListener(EVT_LAUNDRY_CHANGED, onLaundryChanged);

    return () => {
      window.removeEventListener(EVT_OUTFIT_HISTORY_CHANGED, onDataChanged);
      window.removeEventListener(EVT_WARDROBE_CHANGED, onDataChanged);
      window.removeEventListener(EVT_LAUNDRY_CHANGED, onLaundryChanged);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    setThresholdDrafts({ ...preferences.thresholds });
  }, [preferences.thresholds]);

  const insights = useMemo(() => {
    return buildLaundryInsights({ wardrobe, history, preferences });
  }, [wardrobe, history, preferences]);

  const filteredItems = useMemo(() => {
    if (filter === "all") return insights.items;
    return insights.items.filter((item) => item.statusKey === filter);
  }, [filter, insights.items]);

  const showMessage = (next) => {
    setMsg(next);
    window.setTimeout(() => setMsg(""), 2600);
  };

  const handleToggleTracking = () => {
    const next = setLaundryTrackingEnabled(!preferences.enabled, user);
    setPreferences(next);
    showMessage(next.enabled ? "Laundry tracking is on." : "Laundry tracking is off.");
  };

  const commitThresholdChange = (category) => {
    const next = updateLaundryThreshold(category, thresholdDrafts[category], user);
    setPreferences(next);
  };

  const handleResetThresholds = () => {
    const next = resetLaundryThresholds(user);
    setPreferences(next);
    showMessage("Laundry thresholds reset.");
  };

  const handleMarkWashed = (item) => {
    const next = markLaundryItemWashed(item.id, user);
    setPreferences(next);
    showMessage(`${item.name} marked as washed.`);
  };

  const handleDismissAlert = (item) => {
    const next = dismissLaundryAlert(item.id, item.alertKey, user);
    setPreferences(next);
    showMessage(`Alert dismissed for ${item.name}.`);
  };

  const handleRestoreAlert = (item) => {
    const next = restoreLaundryAlert(item.id, user);
    setPreferences(next);
    showMessage(`Laundry alert restored for ${item.name}.`);
  };

  if (loading) {
    return <div className="noteBox" style={{ marginTop: 24 }}>Loading laundry insights...</div>;
  }

  const noUsageData = insights.items.length === 0;

  return (
    <div className="tabContentFadeIn">
      <div className="historyControls" style={{ marginTop: 14, marginBottom: 8 }}>
        <select
          className="historySelect"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Filter laundry items"
        >
          <option value="all">All items</option>
          <option value="needs-wash">Needs wash</option>
          <option value="nearing">Almost due</option>
          <option value="worn">In rotation</option>
          <option value="fresh">Fresh</option>
        </select>

        <button className="btn" type="button" onClick={refresh}>
          Refresh
        </button>

        <button className="btn" type="button" onClick={handleToggleTracking}>
          {preferences.enabled ? "Disable Tracking" : "Enable Tracking"}
        </button>
      </div>

      {msg ? (
        <div className="noteBox" style={{ marginTop: 12 }} aria-live="polite">
          {msg}
        </div>
      ) : null}

      <section className="card dashWide historyStatsCard laundryHeroCard" style={{ marginTop: 14 }}>
        <div className="historyStatsTitle">Laundry Snapshot</div>
        <div className="laundryHeroSub">
          Laundry insights count item wears from your outfit history and reset when you mark an item as washed.
        </div>

        <div className="historyStatsGrid laundrySummaryGrid">
          <div className="historyStatTile">
            <div className="historyStatIcon">&#x1F9FA;</div>
            <div className="historyStatNumber">{insights.overview.dueCount}</div>
            <div className="historyStatLabel">Needs Wash</div>
          </div>
          <div className="historyStatTile">
            <div className="historyStatIcon">&#x23F3;</div>
            <div className="historyStatNumber">{insights.overview.nearingCount}</div>
            <div className="historyStatLabel">Almost Due</div>
          </div>
          <div className="historyStatTile">
            <div className="historyStatIcon">&#x2728;</div>
            <div className="historyStatNumber">{insights.overview.freshCount}</div>
            <div className="historyStatLabel">Fresh</div>
          </div>
          <div className="historyStatTile">
            <div className="historyStatIcon">&#x1F4CA;</div>
            <div className="historyStatNumber">{insights.overview.averageReuse}</div>
            <div className="historyStatLabel">Avg Reuse</div>
          </div>
        </div>
      </section>

      {!preferences.enabled ? (
        <div className="noteBox" style={{ marginTop: 16 }}>
          Laundry tracking is currently off. Turn it back on whenever you want item reuse alerts and wash reminders.
        </div>
      ) : null}

      {preferences.enabled && insights.alerts.length > 0 ? (
        <section className="card dashWide laundryAlertSection" style={{ marginTop: 14 }}>
          <div className="historyStatsTitle">Laundry Alerts</div>
          <div className="laundryAlertIntro" aria-live="polite">
            {insights.alerts.length === 1
              ? "1 item may be ready for a wash."
              : `${insights.alerts.length} items may be ready for a wash.`}
          </div>

          <div className="laundryAlertStack">
            {insights.alerts.map((item) => (
              <div key={`alert_${item.id}`} className="laundryAlertCard">
                <div className="laundryAlertCopy">
                  <div className="laundryAlertTitle">{item.name}</div>
                  <div className="laundryAlertMeta">
                    {item.reuseCount} wears since last wash • Last worn {formatCardDate(item.lastWornAt) || "recently"}
                  </div>
                  <div className="laundryAlertText">These items may be ready for a wash.</div>
                </div>

                <div className="laundryAlertActions">
                  <button className="btn primary" type="button" onClick={() => handleMarkWashed(item)}>
                    Time to Wash
                  </button>
                  <button className="btn" type="button" onClick={() => handleDismissAlert(item)}>
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {preferences.enabled && insights.alerts.length === 0 ? (
        <div className="noteBox laundryPositiveNote" style={{ marginTop: 16 }}>
          No urgent laundry alerts right now. Your tracked items are still within their current wear thresholds.
        </div>
      ) : null}

      <section className="card dashWide laundrySettingsCard" style={{ marginTop: 14 }}>
        <div className="historyStatsTitle">Threshold Controls</div>
        <div className="laundryHeroSub">
          Thresholds are category-based by default: tops refresh fastest, bottoms and shoes last longer, and outerwear gets the highest limit.
        </div>

        <div className="laundryThresholdGrid">
          {LAUNDRY_THRESHOLD_CATEGORIES.map((category) => (
            <label key={category} className="laundryThresholdCard">
              <span className="laundryThresholdLabel">{category}</span>
              <input
                className="wardrobeInput laundryThresholdInput"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={thresholdDrafts[category] ?? ""}
                onChange={(e) => {
                  const next = e.target.value.replace(/[^\d]/g, "").slice(0, 2);
                  setThresholdDrafts((current) => ({ ...current, [category]: next }));
                }}
                onBlur={() => commitThresholdChange(category)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.currentTarget.blur();
                  }
                }}
                aria-label={`${category} reuse threshold`}
              />
              <span className="laundryThresholdHint">Recommended wears before wash</span>
            </label>
          ))}
        </div>

        <div className="historyActions">
          <button className="btn" type="button" onClick={handleResetThresholds}>
            Reset Defaults
          </button>
        </div>
      </section>

      {preferences.enabled && noUsageData ? (
        <section className="card dashWide historyStatsCard" style={{ marginTop: 14 }}>
          <div className="historyStatsEmpty">
            <div className="historyStatsEmptyIcon">&#x1F9FA;</div>
            <div className="historyStatsEmptyTitle">No laundry data yet</div>
            <div className="historyStatsEmptySub">
              Wear or log an outfit to start tracking reuse counts, wash reminders, and last worn dates.
            </div>
            <div style={{ marginTop: 14 }}>
              <button className="btn primary" type="button" onClick={() => navigate("/dashboard")}>
                Wear an Outfit
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {preferences.enabled && insights.frequentItems.length > 0 ? (
        <section className="card dashWide" style={{ marginTop: 14 }}>
          <div className="historyStatsTitle">Frequently Reused</div>
          <div className="laundryFrequentGrid">
            {insights.frequentItems.map((item) => (
              <div key={`freq_${item.id}`} className="laundryFrequentCard">
                <div className="laundryFrequentTop">
                  <span className={`laundryStatusBadge laundryStatusBadge--${item.tone}`}>
                    {item.statusLabel}
                  </span>
                  <strong>{item.totalWearCount} total wear{item.totalWearCount === 1 ? "" : "s"}</strong>
                </div>
                <div className="laundryFrequentName">{item.name}</div>
                <div className="laundryFrequentMeta">
                  {item.reuseCount} since wash • Last worn {formatCardDate(item.lastWornAt) || "recently"}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {preferences.enabled && filteredItems.length > 0 ? (
        <section className="card dashWide" style={{ marginTop: 14, marginBottom: 24 }}>
          <div className="historyStatsTitle">Tracked Items</div>
          <div className="laundryItemGrid">
            {filteredItems.map((item) => (
              <LaundryItemCard
                key={item.id}
                item={item}
                onMarkWashed={handleMarkWashed}
                onDismissAlert={handleDismissAlert}
                onRestoreAlert={handleRestoreAlert}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default function LaundryInsights() {
  return (
    <div className="onboarding onboardingPage">
      <div className="historyTopBar">
        <div>
          <div className="historyTitle">Laundry Insights</div>
          <div className="historySub">Track outfit reuse and plan wash cycles</div>
        </div>
      </div>
      <LaundryContent />
    </div>
  );
}
