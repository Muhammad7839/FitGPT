import React from "react";
import { useSearchParams } from "react-router-dom";
import { HistoryContent } from "./History";
import { AnalyticsContent } from "./Analytics";

function formatTodayTopRight() {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

const TABS = [
  { key: "history", label: "History" },
  { key: "analytics", label: "Analytics" },
];

const TAB_META = {
  history: { title: "Outfit History", sub: "Track what you've worn" },
  analytics: { title: "Analytics", sub: "Your style at a glance" },
};

export default function HistoryAnalytics() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") === "analytics" ? "analytics" : "history";
  const meta = TAB_META[activeTab];

  const switchTab = (key) => {
    if (key === "history") {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ tab: key }, { replace: true });
    }
  };

  return (
    <div className="onboarding onboardingPage">
      <div className="historyTopBar">
        <div>
          <div className="historyTitle">{meta.title}</div>
          <div className="historySub">{meta.sub}</div>
        </div>
        <div className="historyTopRight" />
      </div>

      <div className="wardrobeTabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`wardrobeTab${activeTab === t.key ? " active" : ""}`}
            onClick={() => switchTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "history" ? <HistoryContent /> : <AnalyticsContent />}
    </div>
  );
}
