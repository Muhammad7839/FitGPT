import React from "react";
import { useNavigate } from "react-router-dom";
import { buildWardrobeMap, formatPlanDate, setReuseOutfit, buildGoogleCalendarUrl } from "../utils/helpers";

function UpcomingPlanCard({ plan, wardrobe, onWearNow }) {
  const navigate = useNavigate();

  if (!plan) return null;

  const details = Array.isArray(plan.item_details) ? plan.item_details : [];
  const previewIds = Array.isArray(plan.item_ids) ? plan.item_ids.slice(0, 4) : [];
  const wardrobeMap = buildWardrobeMap(wardrobe);
  const dateLabel = formatPlanDate(plan.planned_date);

  const handleWearNow = () => {
    setReuseOutfit(plan.item_ids || [], plan.planned_id);
    if (onWearNow) onWearNow();
    else window.location.reload();
  };

  return (
    <section className="card dashWide upcomingPlanCard">
      <div className="upcomingPlanHeader">
        <div>
          <div className="upcomingPlanTitle">Upcoming Plan</div>
          <div className="upcomingPlanMeta">
            {dateLabel}
            {plan.occasion ? ` \u2022 ${plan.occasion}` : ""}
          </div>
        </div>
        <span className="historyBadge planned">Planned</span>
      </div>

      <div className="upcomingPlanItems">
        {details.length > 0
          ? details.slice(0, 4).map((d, idx) => (
              <div key={`up_d_${idx}`} className="upcomingPlanItem">
                {d?.image_url ? (
                  <img className="upcomingPlanItemImg" src={d.image_url} alt={d?.name || "Item"} />
                ) : (
                  <div className="upcomingPlanItemPh" />
                )}
                <span className="upcomingPlanItemName">{d?.name || "Item"}</span>
              </div>
            ))
          : previewIds.map((id, idx) => {
              const item = wardrobeMap.get((id ?? "").toString().trim());
              return (
                <div key={`up_i_${idx}`} className="upcomingPlanItem">
                  {item?.image_url ? (
                    <img className="upcomingPlanItemImg" src={item.image_url} alt={item?.name || "Item"} />
                  ) : (
                    <div className="upcomingPlanItemPh" />
                  )}
                  <span className="upcomingPlanItemName">{item?.name || "Item"}</span>
                </div>
              );
            })}
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="button" className="btn primary" onClick={handleWearNow}>
          Wear This Now
        </button>
        <button type="button" className="btn" onClick={() => {
          const names = details.map((d) => d?.name).filter(Boolean);
          const url = buildGoogleCalendarUrl({ date: plan.planned_date, occasion: plan.occasion, itemNames: names });
          window.open(url, "_blank", "noopener");
        }}>
          Add to Google Calendar
        </button>
        <button type="button" className="btn" onClick={() => navigate("/plans")}>
          View All Plans
        </button>
      </div>
    </section>
  );
}

export default React.memo(UpcomingPlanCard);
