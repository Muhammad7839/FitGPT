import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { savedOutfitsApi } from "../api/savedOutfitsApi";

const REUSE_OUTFIT_KEY = "fitgpt_reuse_outfit_v1";

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
}

function uniq(arr) {
  const out = [];
  for (const x of Array.isArray(arr) ? arr : []) {
    if (!out.includes(x)) out.push(x);
  }
  return out;
}

export default function SavedOutfits() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState([]);
  const [msg, setMsg] = useState("");

  async function refresh() {
    setLoading(true);
    setMsg("");

    try {
      const res = await savedOutfitsApi.listSaved();
      const list = Array.isArray(res?.saved_outfits) ? res.saved_outfits : [];
      setSaved(list);
    } catch (e) {
      setSaved([]);
      setMsg(e?.message || "Could not load saved outfits.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!user) {
      setSaved([]);
      return;
    }
    refresh();
  }, [user]);

  const hasAny = saved.length > 0;

  const sorted = useMemo(() => {
    return [...saved].sort((a, b) => {
      const da = (a?.created_at || "").toString();
      const db = (b?.created_at || "").toString();
      return db.localeCompare(da);
    });
  }, [saved]);

  function reuseOutfit(outfit) {
    const items = uniq(outfit?.items || []);
    if (!items.length) return;

    sessionStorage.setItem(REUSE_OUTFIT_KEY, JSON.stringify({ items, saved_outfit_id: outfit?.saved_outfit_id || "" }));
    navigate("/dashboard");
  }

  if (!user) {
    return (
      <div className="card" style={{ marginTop: 12 }}>
        <div className="dashCardTitle">Saved Outfits</div>
        <div className="dashSubText" style={{ marginTop: 6 }}>
          Sign in to view and save outfits.
        </div>
        <div style={{ marginTop: 12 }}>
          <button type="button" className="btn primary" onClick={() => navigate("/auth")}>
            Sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div className="dashCardTitle">Saved Outfits</div>
        <button type="button" className="btn" onClick={refresh} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {msg ? (
        <div className="noteBox" style={{ marginTop: 12 }}>
          {msg}
        </div>
      ) : null}

      {!loading && !hasAny ? (
        <div style={{ marginTop: 12 }}>
          <div className="dashSubText">No saved outfits yet.</div>
          <div style={{ marginTop: 10 }}>
            <button type="button" className="btn primary" onClick={() => navigate("/dashboard")}>
              Go to recommendations
            </button>
          </div>
        </div>
      ) : null}

      {sorted.map((o) => {
        const itemCount = Array.isArray(o?.items) ? o.items.length : 0;
        const date = formatDate(o?.created_at);

        return (
          <div key={o?.saved_outfit_id || o?.outfit_signature} className="dashQuickActionFigma" style={{ marginTop: 12 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
              <div className="dashStrong">{o?.name ? o.name : "Saved outfit"}</div>
              <div className="dashMuted" style={{ fontSize: 12 }}>
                {date}
              </div>
            </div>

            <div className="dashSubText" style={{ marginTop: 6 }}>
              {itemCount} item{itemCount === 1 ? "" : "s"}
            </div>

            <div style={{ marginTop: 10 }}>
              <button type="button" className="btn primary" onClick={() => reuseOutfit(o)}>
                Reuse
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}