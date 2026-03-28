import React, { useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { HistoryContent } from "./History";
import { AnalyticsContent } from "./Analytics";
import ErrorBoundary from "./ErrorBoundary";
import GuestModeNotice from "./GuestModeNotice";
import { useAuth } from "../auth/AuthProvider";

const TABS = [
  { key: "history", label: "History" },
  { key: "analytics", label: "Analytics" },
];

const TAB_META = {
  history: { title: "Outfit History", sub: "Track what you've worn" },
  analytics: { title: "Analytics", sub: "Your style at a glance" },
};

const TAB_INDEX = { history: 0, analytics: 1 };

export default function HistoryAnalytics() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") === "analytics" ? "analytics" : "history";
  const meta = TAB_META[activeTab];
  const prevTabRef = useRef(activeTab);
  const [direction, setDirection] = useState("left");

  const switchTab = (key) => {
    if (key !== prevTabRef.current) {
      setDirection(TAB_INDEX[key] > TAB_INDEX[prevTabRef.current] ? "left" : "right");
      prevTabRef.current = key;
    }
    if (key === "history") {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ tab: key }, { replace: true });
    }
  };

  if (!user) {
    return (
      <div className="onboarding onboardingPage">
        <div className="historyTopBar">
          <div>
            <div className="historyTitle">{meta.title}</div>
            <div className="historySub">Sign in to track outfit history and analytics</div>
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

      <div key={activeTab} className={`tabFlip tabFlip--${direction}`}>
        {activeTab === "history" ? <HistoryContent /> : <ErrorBoundary><AnalyticsContent /></ErrorBoundary>}
      </div>
    </div>
  );
}
