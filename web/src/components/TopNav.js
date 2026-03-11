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
  { to: "/history", label: "Insights" },
  { to: "/saved-outfits", label: "Outfits" },
  { to: "/plans", label: "Plans" },
  { to: "/profile", label: "Profile" },
];

// Pages where the top nav should NOT appear
const HIDDEN_ROUTES = ["/", "/login", "/signup", "/onboarding"];

export default function TopNav() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const demoUser = useMemo(() => readDemoAuth(), []);
  const effectiveUser = user || demoUser;
  const [profilePic, setProfilePic] = useState(() => loadProfilePic(effectiveUser));
  const isGif = profilePic.startsWith("data:image/gif");

  useEffect(() => {
    setProfilePic(loadProfilePic(effectiveUser));
    const onPicChange = () => setProfilePic(loadProfilePic(effectiveUser));
    window.addEventListener(EVT_PROFILE_PIC_CHANGED, onPicChange);
    return () => window.removeEventListener(EVT_PROFILE_PIC_CHANGED, onPicChange);
  }, [effectiveUser]);

  // Freeze GIF to a static first frame for the nav; animate on hover
  const [frozenPic, setFrozenPic] = useState("");
  useEffect(() => {
    if (!isGif || !profilePic) { setFrozenPic(""); return; }
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext("2d").drawImage(img, 0, 0);
      setFrozenPic(canvas.toDataURL("image/png"));
    };
    img.src = profilePic;
  }, [profilePic, isGif]);

  const [profileHover, setProfileHover] = useState(false);

  // Hide on auth/onboarding pages
  if (HIDDEN_ROUTES.includes(pathname)) return null;

  return (
    <header className="topNav">
      <nav className="topNavInner" aria-label="Main navigation">
        <div className="topNavBrand">
          <img className="topNavLogo" src="/officialLogo.png" alt="FitGPT" />
          <span className="topNavBrandName">FitGPT</span>
        </div>
        <div className="topNavLinks">
          {NAV_ITEMS.map(({ to, label }) => (
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
                profilePic
                  ? <img src={isGif && !profileHover && frozenPic ? frozenPic : profilePic} alt="" className="topNavProfilePic" />
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
