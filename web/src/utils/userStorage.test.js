import {
  getUserId, userKey, makeLocalStore, makeObjectStore,
  loadWardrobe, saveWardrobe, migrateGuestData, clearGuestData, mirrorUserDataToGuest, mergeWardrobeWithLocalMetadata,
  readWeatherOverride, setWeatherOverride,
  readSeasonalMode, writeSeasonalMode,
  readRecSeed, writeRecSeed, readTimeOverride, writeTimeOverride,
  readDemoAuth, writeDemoAuth,
  loadAnswers, saveAnswers, isOnboarded, clearOnboarding,
  loadProfilePic, saveProfilePic,
  isTutorialDone, markTutorialDone,
} from "./userStorage";
import { GUEST_WARDROBE_KEY, WARDROBE_KEY, SAVED_OUTFITS_KEY, PROFILE_KEY, REC_SEED_KEY, TIME_OVERRIDE_KEY, WEATHER_OVERRIDE_KEY, DEMO_AUTH_KEY, ONBOARDING_ANSWERS_KEY, ONBOARDED_KEY, PROFILE_PIC_KEY, EVT_PROFILE_PIC_CHANGED, TUTORIAL_DONE_KEY } from "./constants";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("getUserId", () => {
  test("returns null for falsy user", () => {
    expect(getUserId(null)).toBeNull();
    expect(getUserId(undefined)).toBeNull();
  });

  test("extracts id field", () => {
    expect(getUserId({ id: "abc" })).toBe("abc");
  });

  test("falls back to user_id, email, demoEmail", () => {
    expect(getUserId({ user_id: "u1" })).toBe("u1");
    expect(getUserId({ email: "a@b.com" })).toBe("a@b.com");
    expect(getUserId({ demoEmail: "demo@x" })).toBe("demo@x");
  });

  test("returns null for empty strings", () => {
    expect(getUserId({ id: "" })).toBeNull();
    expect(getUserId({ id: "  " })).toBeNull();
  });
});

describe("userKey", () => {
  test("returns base key for guests", () => {
    expect(userKey("fitgpt_test", null)).toBe("fitgpt_test");
  });

  test("returns namespaced key for users", () => {
    expect(userKey("fitgpt_test", { id: "u1" })).toBe("fitgpt_test_u1");
  });
});

describe("makeLocalStore", () => {
  test("read returns empty array when nothing stored", () => {
    const store = makeLocalStore(SAVED_OUTFITS_KEY);
    expect(store.read(null)).toEqual([]);
  });

  test("write then read round-trips", () => {
    const store = makeLocalStore(SAVED_OUTFITS_KEY);
    const data = [{ id: "a" }, { id: "b" }];
    store.write(data, null);
    expect(store.read(null)).toEqual(data);
  });

  test("namespaces by user", () => {
    const store = makeLocalStore(SAVED_OUTFITS_KEY);
    const user = { id: "u1" };
    store.write([{ id: "x" }], user);
    expect(store.read(null)).toEqual([]);
    expect(store.read(user)).toEqual([{ id: "x" }]);
  });

  test("dispatches event when eventName provided", () => {
    const handler = jest.fn();
    window.addEventListener("test-event", handler);
    const store = makeLocalStore(SAVED_OUTFITS_KEY, "test-event");
    store.write([], null);
    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener("test-event", handler);
  });

  test("does not dispatch when no eventName", () => {
    const handler = jest.fn();
    window.addEventListener("test-event", handler);
    const store = makeLocalStore(SAVED_OUTFITS_KEY);
    store.write([], null);
    expect(handler).not.toHaveBeenCalled();
    window.removeEventListener("test-event", handler);
  });

  test("write coerces non-array to empty array", () => {
    const store = makeLocalStore(SAVED_OUTFITS_KEY);
    store.write("not-array", null);
    expect(store.read(null)).toEqual([]);
  });
});

describe("makeObjectStore", () => {
  test("read returns empty object when nothing stored", () => {
    const store = makeObjectStore(PROFILE_KEY);
    expect(store.read(null)).toEqual({});
  });

  test("write then read round-trips objects", () => {
    const store = makeObjectStore(PROFILE_KEY);
    const data = { name: "Alice", bodyType: "pear" };
    store.write(data, null);
    expect(store.read(null)).toEqual(data);
  });

  test("returns empty object for stored arrays", () => {
    const store = makeObjectStore(PROFILE_KEY);
    localStorage.setItem(PROFILE_KEY, JSON.stringify([1, 2, 3]));
    expect(store.read(null)).toEqual({});
  });

  test("namespaces by user", () => {
    const store = makeObjectStore(PROFILE_KEY);
    const user = { id: "u1" };
    store.write({ a: 1 }, user);
    expect(store.read(null)).toEqual({});
    expect(store.read(user)).toEqual({ a: 1 });
  });
});

describe("loadWardrobe", () => {
  test("returns empty array when nothing stored", () => {
    expect(loadWardrobe(null)).toEqual([]);
  });

  test("prefers sessionStorage over localStorage", () => {
    sessionStorage.setItem(GUEST_WARDROBE_KEY, JSON.stringify([{ id: "s1" }]));
    localStorage.setItem(WARDROBE_KEY, JSON.stringify([{ id: "l1" }]));
    const result = loadWardrobe(null);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "s1" });
  });

  test("falls back to localStorage when sessionStorage empty", () => {
    localStorage.setItem(`${WARDROBE_KEY}_u1`, JSON.stringify([{ id: "l1" }]));
    const result = loadWardrobe({ id: "u1" });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "l1" });
  });

  test("guest mode ignores base localStorage wardrobe snapshots", () => {
    localStorage.setItem(WARDROBE_KEY, JSON.stringify([{ id: "l1" }]));
    const result = loadWardrobe(null);
    expect(result).toEqual([]);
  });

  test("uses namespaced keys for signed-in users", () => {
    const user = { id: "u1" };
    sessionStorage.setItem(`${GUEST_WARDROBE_KEY}_u1`, JSON.stringify([{ id: "n1" }]));
    const result = loadWardrobe(user);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "n1" });
  });

  test("signed-in user falls back to base keys", () => {
    const user = { id: "u1" };
    sessionStorage.setItem(GUEST_WARDROBE_KEY, JSON.stringify([{ id: "base" }]));
    const result = loadWardrobe(user);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "base" });
  });
});

describe("saveWardrobe", () => {
  test("saves to both sessionStorage and localStorage", () => {
    const items = [{ id: "a" }];
    saveWardrobe(items, { id: "u1" });
    expect(JSON.parse(sessionStorage.getItem(`${GUEST_WARDROBE_KEY}_u1`))).toEqual([
      expect.objectContaining({ id: "a" }),
    ]);
    expect(JSON.parse(localStorage.getItem(`${WARDROBE_KEY}_u1`))).toEqual([
      expect.objectContaining({ id: "a" }),
    ]);
  });

  test("guest mode saves wardrobe to sessionStorage only", () => {
    const items = [{ id: "a" }];
    saveWardrobe(items, null);
    expect(JSON.parse(sessionStorage.getItem(GUEST_WARDROBE_KEY))).toEqual([
      expect.objectContaining({ id: "a" }),
    ]);
    expect(localStorage.getItem(WARDROBE_KEY)).toBeNull();
  });

  test("uses namespaced keys for users", () => {
    const user = { id: "u1" };
    saveWardrobe([{ id: "x" }], user);
    expect(JSON.parse(sessionStorage.getItem(`${GUEST_WARDROBE_KEY}_u1`))).toEqual([
      expect.objectContaining({ id: "x" }),
    ]);
    expect(sessionStorage.getItem(GUEST_WARDROBE_KEY)).toBeNull();
  });
});

describe("mergeWardrobeWithLocalMetadata", () => {
  test("preserves local-only items while enriching matching server items", () => {
    const local = [
      { id: "local-1", name: "Local Only", category: "Tops", style_tags: ["work"] },
      { id: "2", name: "Server Shadow", category: "Bottoms", style_tags: ["social"], layer_type: "outer" },
    ];
    const remote = [
      { id: "2", name: "Server Shadow", category: "Bottoms", style_tags: [], layer_type: "" },
      { id: "3", name: "Remote Only", category: "Shoes" },
    ];

    const merged = mergeWardrobeWithLocalMetadata(remote, local);

    expect(merged.map((item) => item.id)).toEqual(["local-1", "2", "3"]);
    expect(merged[1].style_tags).toEqual(["social"]);
    expect(merged[1].layer_type).toBe("outer");
  });
});

describe("migrateGuestData", () => {
  test("copies base keys to namespaced keys", () => {
    localStorage.setItem(WARDROBE_KEY, JSON.stringify([{ id: "g1" }]));
    migrateGuestData({ id: "u1" });
    expect(JSON.parse(localStorage.getItem(`${WARDROBE_KEY}_u1`))).toEqual([{ id: "g1" }]);
  });

  test("does not overwrite existing namespaced data", () => {
    localStorage.setItem(WARDROBE_KEY, JSON.stringify([{ id: "guest" }]));
    localStorage.setItem(`${WARDROBE_KEY}_u1`, JSON.stringify([{ id: "existing" }]));
    migrateGuestData({ id: "u1" });
    expect(JSON.parse(localStorage.getItem(`${WARDROBE_KEY}_u1`))).toEqual([{ id: "existing" }]);
  });

  test("no-op for null user", () => {
    localStorage.setItem(WARDROBE_KEY, JSON.stringify([{ id: "g1" }]));
    migrateGuestData(null);
    expect(localStorage.getItem(`${WARDROBE_KEY}_null`)).toBeNull();
  });
});

describe("clearGuestData", () => {
  test("removes base keys", () => {
    localStorage.setItem(WARDROBE_KEY, "data");
    sessionStorage.setItem(GUEST_WARDROBE_KEY, "data");
    clearGuestData();
    expect(localStorage.getItem(WARDROBE_KEY)).toBeNull();
    expect(sessionStorage.getItem(GUEST_WARDROBE_KEY)).toBeNull();
  });

  test("does not remove namespaced keys", () => {
    localStorage.setItem(`${WARDROBE_KEY}_u1`, "user-data");
    clearGuestData();
    expect(localStorage.getItem(`${WARDROBE_KEY}_u1`)).toBe("user-data");
  });
});

describe("mirrorUserDataToGuest", () => {
  test("copies signed-in wardrobe and profile data back to guest keys", () => {
    const user = { id: "u1" };
    sessionStorage.setItem(`${GUEST_WARDROBE_KEY}_u1`, JSON.stringify([{ id: "look-1" }]));
    localStorage.setItem(`${WARDROBE_KEY}_u1`, JSON.stringify([{ id: "look-1" }]));
    localStorage.setItem(`${ONBOARDING_ANSWERS_KEY}_u1`, JSON.stringify({ style: ["casual"] }));
    localStorage.setItem(`${ONBOARDED_KEY}_u1`, "1");
    localStorage.setItem(`${PROFILE_PIC_KEY}_u1`, "data:image/png;base64,abc");

    mirrorUserDataToGuest(user);

    expect(JSON.parse(sessionStorage.getItem(GUEST_WARDROBE_KEY))).toEqual([{ id: "look-1" }]);
    expect(JSON.parse(localStorage.getItem(WARDROBE_KEY))).toEqual([{ id: "look-1" }]);
    expect(JSON.parse(localStorage.getItem(ONBOARDING_ANSWERS_KEY))).toEqual({ style: ["casual"] });
    expect(localStorage.getItem(ONBOARDED_KEY)).toBe("1");
    expect(localStorage.getItem(PROFILE_PIC_KEY)).toBe("data:image/png;base64,abc");
  });
});

describe("readWeatherOverride / setWeatherOverride", () => {
  test("returns null when nothing stored", () => {
    expect(readWeatherOverride()).toBeNull();
  });

  test("round-trips a valid weather category", () => {
    setWeatherOverride("cold");
    expect(readWeatherOverride()).toBe("cold");
  });

  test("rejects invalid weather categories", () => {
    sessionStorage.setItem(WEATHER_OVERRIDE_KEY, JSON.stringify({ category: "tornado" }));
    expect(readWeatherOverride()).toBeNull();
  });

  test("clearing removes the key", () => {
    setWeatherOverride("warm");
    setWeatherOverride(null);
    expect(sessionStorage.getItem(WEATHER_OVERRIDE_KEY)).toBeNull();
    expect(readWeatherOverride()).toBeNull();
  });
});

describe("readSeasonalMode / writeSeasonalMode", () => {
  test("defaults to enabled", () => {
    expect(readSeasonalMode(null)).toBe(true);
  });

  test("round-trips the seasonal toggle", () => {
    writeSeasonalMode(false, { id: "u1" });
    expect(readSeasonalMode({ id: "u1" })).toBe(false);
    expect(readSeasonalMode(null)).toBe(true);
  });
});

describe("readRecSeed / writeRecSeed", () => {
  test("returns Date.now() when nothing stored", () => {
    const before = Date.now();
    const seed = readRecSeed();
    expect(seed).toBeGreaterThanOrEqual(before);
  });

  test("round-trips a numeric seed", () => {
    writeRecSeed(42);
    expect(readRecSeed()).toBe(42);
  });

  test("ignores non-finite values", () => {
    sessionStorage.setItem(REC_SEED_KEY, "not-a-number");
    const seed = readRecSeed();
    expect(Number.isFinite(seed)).toBe(true);
  });
});

describe("readTimeOverride / writeTimeOverride", () => {
  test("returns empty string when nothing stored", () => {
    expect(readTimeOverride()).toBe("");
  });

  test("round-trips a valid time category", () => {
    writeTimeOverride("evening");
    expect(readTimeOverride()).toBe("evening");
  });

  test("rejects invalid time categories", () => {
    sessionStorage.setItem(TIME_OVERRIDE_KEY, JSON.stringify("invalid"));
    expect(readTimeOverride()).toBe("");
  });

  test("clearing removes the key", () => {
    writeTimeOverride("morning");
    writeTimeOverride("");
    expect(sessionStorage.getItem(TIME_OVERRIDE_KEY)).toBeNull();
    expect(readTimeOverride()).toBe("");
  });
});

describe("readDemoAuth / writeDemoAuth", () => {
  test("returns null when nothing stored", () => {
    expect(readDemoAuth()).toBeNull();
  });

  test("round-trips a demo auth object", () => {
    const auth = { demoEmail: "test@demo.com" };
    writeDemoAuth(auth);
    expect(readDemoAuth()).toEqual(auth);
  });

  test("writeDemoAuth(null) clears storage", () => {
    writeDemoAuth({ demoEmail: "x" });
    writeDemoAuth(null);
    expect(readDemoAuth()).toBeNull();
    expect(localStorage.getItem(DEMO_AUTH_KEY)).toBeNull();
  });

  test("returns null for non-object stored values", () => {
    localStorage.setItem(DEMO_AUTH_KEY, JSON.stringify("string"));
    expect(readDemoAuth()).toBeNull();
  });
});

describe("loadAnswers / saveAnswers / isOnboarded / clearOnboarding", () => {
  test("loadAnswers returns null when nothing stored", () => {
    expect(loadAnswers(null)).toBeNull();
  });

  test("saveAnswers + loadAnswers round-trips", () => {
    const answers = { style: ["Casual"], bodyType: "pear" };
    saveAnswers(answers, null);
    expect(loadAnswers(null)).toEqual(answers);
  });

  test("saveAnswers sets onboarded flag", () => {
    saveAnswers({ style: [] }, null);
    expect(isOnboarded(null)).toBe(true);
  });

  test("clearOnboarding removes answers and flag", () => {
    saveAnswers({ style: [] }, null);
    clearOnboarding(null);
    expect(loadAnswers(null)).toBeNull();
    expect(isOnboarded(null)).toBe(false);
  });

  test("namespaces by user", () => {
    const user = { id: "u1" };
    saveAnswers({ style: ["Formal"] }, user);
    expect(loadAnswers(null)).toBeNull();
    expect(loadAnswers(user)).toEqual({ style: ["Formal"] });
    expect(isOnboarded(user)).toBe(true);
    expect(isOnboarded(null)).toBe(false);
  });
});

describe("loadProfilePic / saveProfilePic", () => {
  test("returns empty string when nothing stored", () => {
    expect(loadProfilePic(null)).toBe("");
  });

  test("round-trips a profile picture", () => {
    saveProfilePic("data:image/png;base64,abc", null);
    expect(loadProfilePic(null)).toBe("data:image/png;base64,abc");
  });

  test("clearing removes the picture", () => {
    saveProfilePic("data:image/png;base64,abc", null);
    saveProfilePic("", null);
    expect(loadProfilePic(null)).toBe("");
  });

  test("dispatches event on save", () => {
    const handler = jest.fn();
    window.addEventListener(EVT_PROFILE_PIC_CHANGED, handler);
    saveProfilePic("data:image/png;base64,abc", null);
    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener(EVT_PROFILE_PIC_CHANGED, handler);
  });

  test("namespaces by user", () => {
    const user = { id: "u1" };
    saveProfilePic("pic-for-user", user);
    expect(loadProfilePic(null)).toBe("");
    expect(loadProfilePic(user)).toBe("pic-for-user");
  });
});

describe("isTutorialDone / markTutorialDone", () => {
  test("returns false when nothing stored", () => {
    expect(isTutorialDone()).toBe(false);
  });

  test("returns true after markTutorialDone", () => {
    markTutorialDone();
    expect(isTutorialDone()).toBe(true);
  });
});
