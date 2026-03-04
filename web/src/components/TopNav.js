// web/src/components/TopNav.js
import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import ThemePicker from "./ThemePicker";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Home" },
  { to: "/wardrobe", label: "Wardrobe" },
  { to: "/favorites", label: "Favorites" },
  { to: "/history", label: "Insights" },
  { to: "/saved-outfits", label: "Saved" },
  { to: "/plans", label: "Plans" },
  { to: "/profile", label: "Profile" },
];

// Pages where the top nav should NOT appear
const HIDDEN_ROUTES = ["/", "/auth", "/login", "/signup", "/onboarding"];

export default function TopNav() {
  const { pathname } = useLocation();

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
                "topNavLink" + (isActive ? " topNavLinkActive" : "")
              }
            >
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
