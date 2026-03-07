import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { loadWardrobe } from "../utils/userStorage";
import { buildWardrobeMap, monthKey } from "../utils/helpers";
import { outfitHistoryApi } from "../api/outfitHistoryApi";
import { savedOutfitsApi } from "../api/savedOutfitsApi";

import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area, Sector,
} from "recharts";

const COLOR_CSS = {
  red: "#e74c3c", blue: "#3498db", green: "#2ecc71", black: "#2c3e50",
  white: "#ecf0f1", navy: "#2c3e80", gray: "#95a5a6", grey: "#95a5a6",
  brown: "#8b6914", pink: "#e91e90", purple: "#9b59b6", orange: "#e67e22",
  yellow: "#f1c40f", teal: "#1abc9c", coral: "#ff7f7f", gold: "#d4a017",
  olive: "#6b8e23", beige: "#d2b48c", cream: "#fffdd0", maroon: "#800000",
  lavender: "#b57edc", tan: "#d2b48c", denim: "#5b7fa5", mint: "#98ff98",
  turquoise: "#40e0d0", peach: "#ffdab9",
};

const CHART_PALETTE = [
  "#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6",
  "#1abc9c", "#e67e22", "#e91e63", "#00bcd4", "#8bc34a",
  "#ff7043", "#7e57c2",
];

function monthLabel(dateStr) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: "short" });
  } catch {
    return "";
  }
}

function useThemeColors() {
  const [colors, setColors] = useState({ accent: "#8b1e1e", text: "#111", muted: "#888", bg: "#fff", surface: "#fff" });
  useEffect(() => {
    const root = document.documentElement;
    const cs = getComputedStyle(root);
    setColors({
      accent: cs.getPropertyValue("--accent").trim() || "#8b1e1e",
      text: cs.getPropertyValue("--text").trim() || "#111",
      muted: cs.getPropertyValue("--muted").trim() || "#888",
      bg: cs.getPropertyValue("--bg").trim() || "#fff",
      surface: cs.getPropertyValue("--surface").trim() || "#fff",
    });

    const obs = new MutationObserver(() => {
      const cs2 = getComputedStyle(root);
      setColors({
        accent: cs2.getPropertyValue("--accent").trim() || "#8b1e1e",
        text: cs2.getPropertyValue("--text").trim() || "#111",
        muted: cs2.getPropertyValue("--muted").trim() || "#888",
        bg: cs2.getPropertyValue("--bg").trim() || "#fff",
        surface: cs2.getPropertyValue("--surface").trim() || "#fff",
      });
    });
    obs.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  return colors;
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="analyticsTooltip">
      {label && <div className="analyticsTooltipLabel">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="analyticsTooltipValue">
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
};

const PieLabelRender = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={700}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

const ActivePieShape = (props) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, stroke } = props;
  return (
    <Sector
      cx={cx}
      cy={cy}
      innerRadius={innerRadius - 4}
      outerRadius={outerRadius + 8}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
      stroke={stroke || "none"}
      style={{ transition: "all 800ms cubic-bezier(0.25, 1, 0.5, 1)", cursor: "pointer" }}
    />
  );
};

export function AnalyticsContent() {
  const { user } = useAuth();
  const theme = useThemeColors();

  const [loading, setLoading] = useState(true);
  const [wardrobe, setWardrobe] = useState([]);
  const [history, setHistory] = useState([]);
  const [saved, setSaved] = useState([]);
  const [activeCatIdx, setActiveCatIdx] = useState(-1);
  const [activeColorIdx, setActiveColorIdx] = useState(-1);

  const refresh = async () => {
    setLoading(true);
    try {
      const [histRes, savedRes] = await Promise.all([
        outfitHistoryApi.listHistory(user),
        savedOutfitsApi.listSaved(user),
      ]);
      setWardrobe(loadWardrobe(user));
      setHistory(Array.isArray(histRes?.history) ? histRes.history : []);
      setSaved(Array.isArray(savedRes?.saved_outfits) ? savedRes.saved_outfits : []);
    } catch {
      setWardrobe(loadWardrobe(user));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const wardrobeById = useMemo(() => buildWardrobeMap(wardrobe), [wardrobe]);

  const activeItems = useMemo(
    () => wardrobe.filter((i) => i?.is_active !== false),
    [wardrobe]
  );

  const overviewStats = useMemo(() => {
    const wornIds = new Set();
    for (const h of history) {
      const ids = Array.isArray(h?.item_ids) ? h.item_ids : [];
      for (const rawId of ids) {
        const id = (rawId ?? "").toString().trim();
        if (id) wornIds.add(id);
      }
    }
    const activeIds = new Set(
      activeItems.map((i) => (i?.id ?? "").toString().trim()).filter(Boolean)
    );
    const wornActiveCount = [...wornIds].filter((id) => activeIds.has(id)).length;
    const utilization = activeItems.length > 0
      ? Math.round((wornActiveCount / activeItems.length) * 100)
      : 0;

    const categories = new Set(
      activeItems.map((i) => (i?.category || "").toString().trim()).filter(Boolean)
    ).size;

    const colorCount = new Set(
      activeItems.map((i) => (i?.color || "").toString().trim().toLowerCase()).filter(Boolean)
    ).size;

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recentCount = history.filter((h) => {
      const t = new Date(h?.worn_at).getTime();
      return Number.isFinite(t) && t >= thirtyDaysAgo;
    }).length;
    const avgPerWeek = (recentCount / (30 / 7)).toFixed(1);

    return { totalItems: activeItems.length, utilization, categories, colorCount, avgPerWeek };
  }, [activeItems, history]);

  const categoryData = useMemo(() => {
    const counts = {};
    for (const it of activeItems) {
      const cat = (it?.category || "Other").toString().trim();
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));
  }, [activeItems]);

  const colorData = useMemo(() => {
    const counts = {};
    for (const it of activeItems) {
      const col = (it?.color || "").toString().trim().toLowerCase();
      if (!col) continue;
      counts[col] = (counts[col] || 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, value]) => ({ name, value, fill: COLOR_CSS[name] || "#999" }));
  }, [activeItems]);

  const wearData = useMemo(() => {
    const counts = new Map();
    for (const h of history) {
      const ids = Array.isArray(h?.item_ids) ? h.item_ids : [];
      for (const rawId of ids) {
        const id = (rawId ?? "").toString().trim();
        if (!id) continue;
        counts.set(id, (counts.get(id) || 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id, count]) => ({
        name: (wardrobeById.get(id)?.name || "Unknown").slice(0, 18),
        wears: count,
      }));
  }, [history, wardrobeById]);

  const leastWorn = useMemo(() => {
    const counts = new Map();
    for (const it of activeItems) {
      const id = (it?.id ?? "").toString().trim();
      if (id) counts.set(id, 0);
    }
    for (const h of history) {
      const ids = Array.isArray(h?.item_ids) ? h.item_ids : [];
      for (const rawId of ids) {
        const id = (rawId ?? "").toString().trim();
        if (id && counts.has(id)) counts.set(id, counts.get(id) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => a[1] - b[1])
      .slice(0, 5)
      .map(([id, count]) => ({
        id,
        name: wardrobeById.get(id)?.name || "Unknown Item",
        count,
      }));
  }, [activeItems, history, wardrobeById]);

  const occasionData = useMemo(() => {
    const counts = {};
    for (const h of history) {
      const occ = (h?.context?.occasion || "").toString().trim();
      if (!occ) continue;
      counts[occ] = (counts[occ] || 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value]) => ({ name, count: value }));
  }, [history]);

  const styleInsights = useMemo(() => {
    const uniqueCombos = new Set(
      history.map((h) => {
        const ids = Array.isArray(h?.item_ids) ? h.item_ids : [];
        return [...ids].sort().join("|");
      })
    ).size;

    const versatility = history.length > 0
      ? Math.min(100, Math.round((uniqueCombos / history.length) * 100))
      : 0;

    const avgSize = history.length > 0
      ? (history.reduce((sum, h) => sum + (Array.isArray(h?.item_ids) ? h.item_ids.length : 0), 0) / history.length).toFixed(1)
      : "0";

    let recCount = 0;
    let planCount = 0;
    for (const h of history) {
      const src = (h?.source || "").toString().trim().toLowerCase();
      if (src === "planner") planCount++;
      else recCount++;
    }

    return { versatility, uniqueCombos, avgSize, recCount, planCount };
  }, [history]);

  const sourceData = useMemo(() => {
    const entries = [];
    if (styleInsights.recCount > 0) entries.push({ name: "Recommended", value: styleInsights.recCount });
    if (styleInsights.planCount > 0) entries.push({ name: "Planned", value: styleInsights.planCount });
    return entries;
  }, [styleInsights]);

  const monthlyTimeline = useMemo(() => {
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: monthKey(d.toISOString()),
        month: monthLabel(d.toISOString()),
        outfits: 0,
      });
    }
    for (const h of history) {
      const k = monthKey(h?.worn_at);
      const m = months.find((mo) => mo.key === k);
      if (m) m.outfits++;
    }
    return months;
  }, [history]);

  if (loading) {
    return <div className="noteBox" style={{ marginTop: 24 }}>Loading...</div>;
  }

  const noData = !wardrobe.length && !history.length && !saved.length;

  return (
    <div className="tabContentFadeIn">
      <div className="historyControls" style={{ marginTop: 14, marginBottom: 8 }}>
        <button className="btn" onClick={refresh}>Refresh</button>
      </div>

      {noData && (
        <div className="noteBox" style={{ marginTop: 16 }}>
          No data yet. Add items to your wardrobe and wear some outfits to see analytics!
        </div>
      )}

      {/* Section 1: Overview Stats */}
      <section className="card dashWide historyStatsCard" style={{ marginTop: 14 }}>
        <div className="historyStatsTitle">Overview</div>
        <div className="historyStatsGrid analyticsOverviewGrid">
          <div className="historyStatTile">
            <div className="historyStatIcon">&#x1F455;</div>
            <div className="historyStatNumber">{overviewStats.totalItems}</div>
            <div className="historyStatLabel">Wardrobe Size</div>
          </div>
          <div className="historyStatTile">
            <div className="historyStatIcon">&#x1F4AF;</div>
            <div className="historyStatNumber">{overviewStats.utilization}%</div>
            <div className="historyStatLabel">Utilization</div>
          </div>
          <div className="historyStatTile">
            <div className="historyStatIcon">&#x1F3A8;</div>
            <div className="historyStatNumber">{overviewStats.colorCount}</div>
            <div className="historyStatLabel">Colors</div>
          </div>
          <div className="historyStatTile">
            <div className="historyStatIcon">&#x1F4C8;</div>
            <div className="historyStatNumber">{overviewStats.avgPerWeek}</div>
            <div className="historyStatLabel">Outfits / Week</div>
          </div>
        </div>
      </section>

      {/* Section 2: Wardrobe Breakdown */}
      {activeItems.length > 0 && (
        <section className="card dashWide" style={{ marginTop: 14 }}>
          <div className="historyStatsTitle">Wardrobe Breakdown</div>

          <div className="analyticsChartRow">
            {categoryData.length > 0 && (
              <div className="analyticsChartBlock">
                <div className="analyticsSubtitle">By Category</div>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={95}
                      paddingAngle={3}
                      dataKey="value"
                      labelLine={false}
                      label={PieLabelRender}
                      activeIndex={activeCatIdx}
                      activeShape={ActivePieShape}
                      onMouseEnter={(_, i) => setActiveCatIdx(i)}
                      onMouseLeave={() => setActiveCatIdx(-1)}
                      onClick={(_, i) => setActiveCatIdx(i === activeCatIdx ? -1 : i)}
                      style={{ cursor: "pointer" }}
                    >
                      {categoryData.map((_, i) => (
                        <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {colorData.length > 0 && (
              <div className="analyticsChartBlock">
                <div className="analyticsSubtitle">Color Palette</div>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={colorData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={95}
                      paddingAngle={2}
                      dataKey="value"
                      labelLine={false}
                      label={PieLabelRender}
                      activeIndex={activeColorIdx}
                      activeShape={ActivePieShape}
                      onMouseEnter={(_, i) => setActiveColorIdx(i)}
                      onMouseLeave={() => setActiveColorIdx(-1)}
                      onClick={(_, i) => setActiveColorIdx(i === activeColorIdx ? -1 : i)}
                      style={{ cursor: "pointer" }}
                    >
                      {colorData.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={entry.fill}
                          stroke={entry.name === "white" || entry.name === "cream" ? "#ccc" : "none"}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Section 3: Outfit Insights */}
      {history.length > 0 && (
        <section className="card dashWide" style={{ marginTop: 14 }}>
          <div className="historyStatsTitle">Outfit Insights</div>

          {wearData.length > 0 && (
            <>
              <div className="analyticsSubtitle">Most Worn Items</div>
              <ResponsiveContainer width="100%" height={Math.max(200, wearData.length * 38)}>
                <BarChart data={wearData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.muted} opacity={0.2} />
                  <XAxis type="number" allowDecimals={false} tick={{ fill: theme.muted, fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fill: theme.text, fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="wears" fill={theme.accent} radius={[0, 6, 6, 0]} barSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </>
          )}

          {leastWorn.length > 0 && (
            <>
              <div className="analyticsSubtitle" style={{ marginTop: 24 }}>Least Worn Items</div>
              <div className="analyticsLeastWornList">
                {leastWorn.map((item) => (
                  <div key={item.id} className="analyticsLeastWornRow">
                    <span className="analyticsBarLabel">{item.name}</span>
                    <span className="analyticsLeastWornCount">
                      {item.count === 0 ? "Never worn" : `${item.count} wear${item.count !== 1 ? "s" : ""}`}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {occasionData.length > 0 && (
            <>
              <div className="analyticsSubtitle" style={{ marginTop: 24 }}>Top Occasions</div>
              <ResponsiveContainer width="100%" height={Math.max(180, occasionData.length * 38)}>
                <BarChart data={occasionData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.muted} opacity={0.2} />
                  <XAxis type="number" allowDecimals={false} tick={{ fill: theme.muted, fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fill: theme.text, fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" fill={CHART_PALETTE[1]} radius={[0, 6, 6, 0]} barSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </>
          )}
        </section>
      )}

      {/* Section 4: Style Insights */}
      {history.length > 0 && (
        <section className="card dashWide" style={{ marginTop: 14 }}>
          <div className="historyStatsTitle">Style Insights</div>

          <div className="analyticsInsightsRow">
            <div className="analyticsScoreCard">
              <div className="analyticsScoreCircle">
                <span className="analyticsScoreValue">{styleInsights.versatility}</span>
              </div>
              <div className="analyticsScoreLabel">Versatility Score</div>
              <div className="analyticsScoreSub">
                {styleInsights.uniqueCombos} unique combo{styleInsights.uniqueCombos !== 1 ? "s" : ""} from {history.length} outfit{history.length !== 1 ? "s" : ""}
              </div>
            </div>

            <div className="analyticsSmallStats">
              <div className="historyStatTile">
                <div className="historyStatIcon">&#x1F457;</div>
                <div className="historyStatNumber">{styleInsights.avgSize}</div>
                <div className="historyStatLabel">Avg Items / Outfit</div>
              </div>

              {sourceData.length > 0 && (
                <div className="analyticsSourcePie">
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={sourceData}
                        cx="50%"
                        cy="50%"
                        innerRadius={30}
                        outerRadius={55}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        <Cell fill={theme.accent} />
                        <Cell fill={CHART_PALETTE[1]} />
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Section 5: Activity Timeline */}
      {history.length > 0 && (
        <section className="card dashWide" style={{ marginTop: 14, marginBottom: 24 }}>
          <div className="historyStatsTitle">Activity Timeline</div>
          <div className="analyticsSubtitle">Last 6 Months</div>

          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthlyTimeline} margin={{ left: 0, right: 10, top: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={theme.accent} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={theme.accent} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.muted} opacity={0.15} />
              <XAxis dataKey="month" tick={{ fill: theme.muted, fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fill: theme.muted, fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="outfits"
                stroke={theme.accent}
                strokeWidth={2.5}
                fill="url(#areaGrad)"
                dot={{ r: 4, fill: theme.accent, strokeWidth: 0 }}
                activeDot={{ r: 6, fill: theme.accent }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </section>
      )}
    </div>
  );
}

export default function Analytics() {
  return (
    <div className="onboarding onboardingPage">
      <div className="historyTopBar">
        <div>
          <div className="historyTitle">Analytics</div>
          <div className="historySub">Your style at a glance</div>
        </div>
        <div className="historyTopRight" />
      </div>
      <AnalyticsContent />
    </div>
  );
}
