// web/src/components/TopNav.js
import React, { useMemo, useState, useEffect, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";
import ThemePicker from "./ThemePicker";
import { useAuth } from "../auth/AuthProvider";
import { readDemoAuth, loadProfilePic } from "../utils/userStorage";
import { EVT_PROFILE_PIC_CHANGED } from "../utils/constants";
import { getVisibleNavItems } from "../utils/firstLaunchFlow";

const HIDDEN_ROUTES = ["/", "/login", "/signup", "/onboarding"];

export default function TopNav() {
  const { pathname } = useLocation();
  const { user, isChecking } = useAuth();
  const demoUser = useMemo(() => readDemoAuth(), []);
  const effectiveUser = user || demoUser;
  const visibleNavItems = getVisibleNavItems(user);
  const [profilePic, setProfilePic] = useState(() => loadProfilePic(effectiveUser));
  const safeProfilePic = (profilePic || "").toString();
  const isGif = safeProfilePic.startsWith("data:image/gif");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    setProfilePic(loadProfilePic(effectiveUser));
    const onPicChange = () => setProfilePic(loadProfilePic(effectiveUser));
    window.addEventListener(EVT_PROFILE_PIC_CHANGED, onPicChange);
    return () => window.removeEventListener(EVT_PROFILE_PIC_CHANGED, onPicChange);
  }, [effectiveUser]);

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

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

  if (isChecking || HIDDEN_ROUTES.includes(pathname)) return null;

  return (
    <header className="topNav" ref={menuRef}>
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

        {/* Desktop nav links */}
        <div className="topNavLinks topNavLinksDesktop">
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
          {!user ? (
            <NavLink to="/login" className="topNavAuthBtn topNavAuthBtnDesktop">
              Sign in
            </NavLink>
          ) : null}
          <ThemePicker inline />

          {/* Hamburger — mobile only */}
          <button
            className={"topNavHamburger" + (menuOpen ? " topNavHamburgerOpen" : "")}
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span className="topNavHamburgerBar" />
            <span className="topNavHamburgerBar" />
            <span className="topNavHamburgerBar" />
          </button>
        </div>
      </nav>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="topNavMobileMenu" role="navigation" aria-label="Mobile navigation">
          {visibleNavItems.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                "topNavMobileLink" + (isActive ? " topNavMobileLinkActive" : "")
              }
              onClick={() => setMenuOpen(false)}
            >
              {to === "/profile" && safeProfilePic && (
                <img src={isGif && frozenPic ? frozenPic : safeProfilePic} alt="" className="topNavProfilePic" style={{ marginRight: 6 }} />
              )}
              {label}
            </NavLink>
          ))}
          {!user && (
            <NavLink to="/login" className="topNavMobileAuthBtn" onClick={() => setMenuOpen(false)}>
              Sign in
            </NavLink>
          )}
        </div>
      )}
    </header>
  );
}
