export const FULL_NAV_ITEMS = [
  { to: "/dashboard", label: "Home" },
  { to: "/wardrobe", label: "Wardrobe" },
  { to: "/builder", label: "Builder" },
  { to: "/history", label: "Insights" },
  { to: "/saved-outfits", label: "Outfits" },
  { to: "/plans", label: "Plans" },
  { to: "/profile", label: "Profile" },
];

export const GUEST_NAV_ITEMS = FULL_NAV_ITEMS.filter(
  (item) => item.to === "/dashboard" || item.to === "/wardrobe"
);

const GUEST_ALLOWED_ROUTES = new Set([
  "/",
  "/auth",
  "/dashboard",
  "/wardrobe",
  "/favorites",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/onboarding",
]);

export const GUEST_PROTECTED_MESSAGE =
  "Sign in to unlock the full FitGPT experience.";

export function getVisibleNavItems(user) {
  return user ? FULL_NAV_ITEMS : GUEST_NAV_ITEMS;
}

export function isGuestRouteAllowed(pathname) {
  return GUEST_ALLOWED_ROUTES.has(pathname || "/");
}

export function getGuestProtectedRedirect(pathname) {
  const next = pathname && pathname !== "/" ? pathname : "/dashboard";
  return {
    pathname: "/login",
    search: `?reason=guest_protected&next=${encodeURIComponent(next)}`,
  };
}

export function getStartupStage({
  user,
  isChecking = false,
  onboarded = false,
  tutorialDone = false,
  splashSeen = false,
}) {
  if (isChecking) return "checking";
  if (user) return onboarded ? "signed-in-home" : "onboarding";
  if (!onboarded) return splashSeen ? "onboarding" : "splash";
  if (!tutorialDone) return "tutorial";
  return "guest-home";
}

export function shouldShowTutorial({ user, onboarded, tutorialDone, justOnboarded }) {
  if (!onboarded || tutorialDone) return false;
  return !user || !!justOnboarded;
}
