import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AnalyticsContent } from "./Analytics";
import { LaundryContent } from "./LaundryInsights";
import ErrorBoundary from "./ErrorBoundary";
import GuestModeNotice from "./GuestModeNotice";
import { useAuth } from "../auth/AuthProvider";
import { outfitHistoryApi } from "../api/outfitHistoryApi";
import { EVT_LAUNDRY_CHANGED, EVT_OUTFIT_HISTORY_CHANGED, EVT_WARDROBE_CHANGED } from "../utils/constants";
import { loadWardrobe } from "../utils/userStorage";
import { buildLaundryInsights, readLaundryPreferences } from "../utils/laundryTracking";

const TABS = [
  { key: "analytics", label: "Analytics" },
  { key: "laundry", label: "Laundry" },
];

const TAB_META = {
  analytics: { title: "Analytics", sub: "Your style at a glance" },
  laundry: { title: "Laundry Insights", sub: "Track outfit reuse and plan wash cycles" },
};

const TAB_INDEX = { analytics: 0, laundry: 1 };

export default function HistoryAnalytics() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = (searchParams.get("tab") || "").toString().trim().toLowerCase();
  const activeTab = tabParam === "laundry" ? "laundry" : "analytics";
  const meta = TAB_META[activeTab];
  const prevTabRef = useRef(activeTab);
  const [direction, setDirection] = useState("left");
  const [laundryAlertCount, setLaundryAlertCount] = useState(0);

  useEffect(() => {
    let alive = true;

    const refreshLaundryAlerts = async () => {
      if (!user) {
        if (alive) setLaundryAlertCount(0);
        return;
      }

      try {
        const res = await outfitHistoryApi.listHistory(user);
        const history = Array.isArray(res?.history) ? res.history : [];
        const insights = buildLaundryInsights({
          wardrobe: loadWardrobe(user),
          history,
          preferences: readLaundryPreferences(user),
        });
        if (alive) setLaundryAlertCount(insights.alerts.length);
      } catch {
        if (alive) setLaundryAlertCount(0);
      }
    };

    refreshLaundryAlerts();

    const onDataChanged = () => refreshLaundryAlerts();
    window.addEventListener(EVT_OUTFIT_HISTORY_CHANGED, onDataChanged);
    window.addEventListener(EVT_WARDROBE_CHANGED, onDataChanged);
    window.addEventListener(EVT_LAUNDRY_CHANGED, onDataChanged);

    return () => {
      alive = false;
      window.removeEventListener(EVT_OUTFIT_HISTORY_CHANGED, onDataChanged);
      window.removeEventListener(EVT_WARDROBE_CHANGED, onDataChanged);
      window.removeEventListener(EVT_LAUNDRY_CHANGED, onDataChanged);
    };
  }, [user]);

  const switchTab = (key) => {
    if (key !== prevTabRef.current) {
      setDirection(TAB_INDEX[key] > TAB_INDEX[prevTabRef.current] ? "left" : "right");
      prevTabRef.current = key;
    }
    setSearchParams(key === "analytics" ? {} : { tab: key }, { replace: true });
  };

  if (!user) {
    return (
      <div className="onboarding onboardingPage">
        <div className="historyTopBar">
          <div>
            <div className="historyTitle">{meta.title}</div>
            <div className="historySub">Sign in to view your analytics and laundry insights</div>
          </div>
        </div>
        <GuestModeNotice compact />
      </div>
    );
  }

  return (
    <div className="onboarding onboardingPage">
      <div className="historyTopBar">
        <div>
          <div className="historyTitle">{meta.title}</div>
          <div className="historySub">{meta.sub}</div>
        </div>
        <div className="historyTopRight" />
      </div>

      {activeTab !== "laundry" && laundryAlertCount > 0 ? (
        <div className="laundryInlineBanner" role="status" aria-live="polite">
          <div className="laundryInlineBannerCopy">
            <strong>{laundryAlertCount} item{laundryAlertCount === 1 ? "" : "s"} may be ready for a wash.</strong>
            <span> Reuse tracking updates whenever you log or repeat an outfit.</span>
          </div>
          <button className="btn" type="button" onClick={() => switchTab("laundry")}>
            View Laundry Alerts
          </button>
        </div>
      ) : null}

      <div className="wardrobeTabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`wardrobeTab${activeTab === t.key ? " active" : ""}`}
            onClick={() => switchTab(t.key)}
          >
            {t.label}
            {t.key === "laundry" && laundryAlertCount > 0 ? (
              <span className="laundryTabCount">{laundryAlertCount}</span>
            ) : null}
          </button>
        ))}
      </div>

      <div key={activeTab} className={`tabFlip tabFlip--${direction}`}>
        {activeTab === "analytics" ? <ErrorBoundary><AnalyticsContent /></ErrorBoundary> : null}
        {activeTab === "laundry" ? <ErrorBoundary><LaundryContent /></ErrorBoundary> : null}
      </div>
    </div>
  );
}
