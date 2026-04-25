// web/src/components/TopNav.js
import React, { useMemo, useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import ThemePicker from "./ThemePicker";
import { useAuth } from "../auth/AuthProvider";
import { readDemoAuth, loadProfilePic } from "../utils/userStorage";
import { EVT_PROFILE_PIC_CHANGED } from "../utils/constants";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Home" },
  { to: "/wardrobe", label: "Wardrobe" },
  { to: "/builder", label: "Builder" },
  { to: "/history", label: "Insights" },
  { to: "/saved-outfits", label: "Outfits" },
  { to: "/plans", label: "Plans" },
  { to: "/profile", label: "Profile" },
];

const HIDDEN_ROUTES = ["/", "/login", "/signup", "/onboarding"];

export default function TopNav() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const demoUser = useMemo(() => readDemoAuth(), []);
  const effectiveUser = user || demoUser;
  const visibleNavItems = user ? NAV_ITEMS : NAV_ITEMS.filter((item) => item.to === "/dashboard" || item.to === "/wardrobe");
  const [profilePic, setProfilePic] = useState(() => loadProfilePic(effectiveUser));
  const safeProfilePic = (profilePic || "").toString();
  const isGif = safeProfilePic.startsWith("data:image/gif");

  useEffect(() => {
    setProfilePic(loadProfilePic(effectiveUser));
    const onPicChange = () => setProfilePic(loadProfilePic(effectiveUser));
    window.addEventListener(EVT_PROFILE_PIC_CHANGED, onPicChange);
    return () => window.removeEventListener(EVT_PROFILE_PIC_CHANGED, onPicChange);
  }, [effectiveUser]);

  
  const [frozenPic, setFrozenPic] = useState("");
  useEffect(() => {
    if (!isGif || !safeProfilePic) { setFrozenPic(""); return; }
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext("2d").drawImage(img, 0, 0);
      setFrozenPic(canvas.toDataURL("image/png"));
    };
    img.src = safeProfilePic;
  }, [safeProfilePic, isGif]);

  const [profileHover, setProfileHover] = useState(false);

  if (HIDDEN_ROUTES.includes(pathname)) return null;

  return (
    <header className="topNav">
      <nav className="topNavInner" aria-label="Main navigation">
        <NavLink to="/" className="topNavBrand" aria-label="Go to home page">
          <img
            className="topNavLogo"
            src="/officialLogo.png"
            alt="FitGPT"
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = "/fitgpt-logo.png";
            }}
          />
          <span className="topNavBrandName">FitGPT</span>
        </NavLink>
        <div className="topNavLinks">
          {visibleNavItems.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                "topNavLink" + (isActive ? " topNavLinkActive" : "") + (to === "/profile" ? " topNavProfileLink" : "")
              }
              {...(to === "/profile" ? {
                onMouseEnter: () => setProfileHover(true),
                onMouseLeave: () => setProfileHover(false),
              } : {})}
            >
              {to === "/profile" && (
                safeProfilePic
                  ? <img src={isGif && !profileHover && frozenPic ? frozenPic : safeProfilePic} alt="" className="topNavProfilePic" />
                  : <span className="topNavProfilePicPlaceholder">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </span>
              )}
              {label}
            </NavLink>
          ))}
        </div>
        <div className="topNavRight">
          <ThemePicker inline />
        </div>
      </nav>
    </header>
  );
}
