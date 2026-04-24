import {
  GUEST_PROTECTED_MESSAGE,
  getGuestProtectedRedirect,
  getStartupStage,
  getVisibleNavItems,
  isGuestRouteAllowed,
  shouldShowTutorial,
} from "./firstLaunchFlow";

describe("first launch flow", () => {
  test("fresh localStorage state starts at splash before login", () => {
    expect(
      getStartupStage({
        user: null,
        onboarded: false,
        tutorialDone: false,
        splashSeen: false,
      })
    ).toBe("splash");
  });

  test("splash completion proceeds to onboarding", () => {
    expect(
      getStartupStage({
        user: null,
        onboarded: false,
        tutorialDone: false,
        splashSeen: true,
      })
    ).toBe("onboarding");
  });

  test("onboarding completion starts guest tutorial before guest home", () => {
    expect(
      getStartupStage({
        user: null,
        onboarded: true,
        tutorialDone: false,
        splashSeen: true,
      })
    ).toBe("tutorial");
    expect(
      shouldShowTutorial({
        user: null,
        onboarded: true,
        tutorialDone: false,
        justOnboarded: false,
      })
    ).toBe(true);
  });

  test("tutorial completion routes guest to home stage", () => {
    expect(
      getStartupStage({
        user: null,
        onboarded: true,
        tutorialDone: true,
        splashSeen: true,
      })
    ).toBe("guest-home");
  });
});

describe("guest access", () => {
  test("guest nav shows only Home, Wardrobe, and separate Sign in action", () => {
    expect([...getVisibleNavItems(null).map((item) => item.label), "Sign in"]).toEqual([
      "Home",
      "Wardrobe",
      "Sign in",
    ]);
  });

  test("signed-in nav shows full app", () => {
    expect(getVisibleNavItems({ id: "u1" }).map((item) => item.label)).toEqual([
      "Home",
      "Wardrobe",
      "Builder",
      "Insights",
      "Outfits",
      "Plans",
      "Profile",
    ]);
  });

  test("guest protected route redirects to sign-in with clear message", () => {
    expect(isGuestRouteAllowed("/history")).toBe(false);
    expect(getGuestProtectedRedirect("/history")).toEqual({
      pathname: "/login",
      search: "?reason=guest_protected&next=%2Fhistory",
    });
    expect(GUEST_PROTECTED_MESSAGE).toMatch(/Sign in to unlock/);
  });
});
