import { normalizeCategory, titleCase } from "./recommendationEngine";

function normalizeList(values) {
  return new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => (value || "").toString().trim().toLowerCase())
      .filter(Boolean)
  );
}

function normalizeText(value) {
  return (value || "").toString().trim().toLowerCase();
}

function itemText(item) {
  return [
    item?.name,
    item?.category,
    item?.clothing_type,
    item?.layer_type,
    ...(Array.isArray(item?.style_tags) ? item.style_tags : []),
    ...(Array.isArray(item?.occasion_tags) ? item.occasion_tags : []),
    ...(Array.isArray(item?.season_tags) ? item.season_tags : []),
  ]
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .join(" ");
}

function itemMatches(item, terms) {
  const haystack = itemText(item);
  return (Array.isArray(terms) ? terms : []).some((term) => haystack.includes(normalizeText(term)));
}

function buildTargetSearchUrl(query) {
  return `https://www.target.com/s?searchTerm=${encodeURIComponent(query)}`;
}

function buildRetailerLink(id) {
  switch (id) {
    case "athletic-shoes":
      return {
        retailerName: "Nike",
        url: "https://www.nike.com/w/running-shoes-37v7jzy7ok",
      };
    case "formal-shoes":
      return {
        retailerName: "Target",
        url: buildTargetSearchUrl("dress shoes"),
      };
    case "structured-layer":
      return {
        retailerName: "Target",
        url: buildTargetSearchUrl("blazer"),
      };
    case "button-up":
      return {
        retailerName: "Target",
        url: buildTargetSearchUrl("button-up shirt"),
      };
    case "light-jacket":
      return {
        retailerName: "Target",
        url: buildTargetSearchUrl("light jacket"),
      };
    case "warm-jacket":
      return {
        retailerName: "Target",
        url: buildTargetSearchUrl("puffer jacket"),
      };
    case "jeans":
      return {
        retailerName: "Target",
        url: buildTargetSearchUrl("jeans"),
      };
    case "trousers":
      return {
        retailerName: "Target",
        url: buildTargetSearchUrl("straight leg trousers"),
      };
    case "plain-tee":
      return {
        retailerName: "Target",
        url: buildTargetSearchUrl("plain t-shirt"),
      };
    case "long-sleeve":
      return {
        retailerName: "Target",
        url: buildTargetSearchUrl("long sleeve shirt"),
      };
    case "casual-sneakers":
      return {
        retailerName: "Target",
        url: buildTargetSearchUrl("casual sneakers"),
      };
    case "simple-accessory":
      return {
        retailerName: "Target",
        url: buildTargetSearchUrl("belt or scarf"),
      };
    default:
      return {
        retailerName: "Target",
        url: buildTargetSearchUrl("wardrobe basics"),
      };
  }
}

function escapeXml(value) {
  return (value || "")
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const REAL_SUGGESTION_IMAGES = {
  "plain-tee": {
    imageUrl: "/wardrobe-tee-real.jpg",
    imageAlt: "Real plain white t-shirt",
  },
  "long-sleeve": {
    imageUrl: "/wardrobe-sweater-real.jpg",
    imageAlt: "Real long-sleeve sweater",
  },
  jeans: {
    imageUrl: "/wardrobe-jeans-real.jpg",
    imageAlt: "Real blue jeans",
  },
  trousers: {
    imageUrl: "/gap-trousers.svg",
    imageAlt: "Versatile neutral trousers",
  },
  "casual-sneakers": {
    imageUrl: "/gap-sneakers-real.jpg",
    imageAlt: "Real everyday sneakers",
  },
  "athletic-shoes": {
    imageUrl: "/gap-sneakers-real.jpg",
    imageAlt: "Real athletic sneakers",
  },
  "formal-shoes": {
    imageUrl: "/gap-sneakers-real.jpg",
    imageAlt: "Real shoe option",
  },
  "light-jacket": {
    imageUrl: "/gap-jacket-real.jpg",
    imageAlt: "Real light jacket",
  },
  "warm-jacket": {
    imageUrl: "/gap-jacket-real.jpg",
    imageAlt: "Real warm jacket",
  },
  "structured-layer": {
    imageUrl: "/gap-jacket-real.jpg",
    imageAlt: "Real structured jacket layer",
  },
};

function iconMarkup(visualKey, color) {
  const fill = color || "#8b1e1e";

  if (visualKey === "bottoms") {
    return `<path d="M84 40 L106 40 L114 112 L96 112 L92 74 L86 112 L68 112 L76 40 Z" fill="${fill}" />`;
  }

  if (visualKey === "shoes") {
    return `<path d="M54 92 C64 86 74 84 84 86 L101 90 C108 92 111 97 110 103 L48 103 C47 97 49 94 54 92 Z" fill="${fill}" /><path d="M94 84 C103 82 111 84 119 89 L129 95 C134 98 135 102 132 107 L78 107 C77 99 82 89 94 84 Z" fill="${fill}" opacity="0.9" />`;
  }

  if (visualKey === "outerwear") {
    return `<path d="M60 34 L78 24 L92 36 L108 24 L126 34 L120 112 L102 112 L100 70 L84 70 L82 112 L64 112 Z" fill="${fill}" />`;
  }

  if (visualKey === "accessories") {
    return `<circle cx="92" cy="56" r="26" fill="${fill}" opacity="0.18" /><path d="M64 78 C76 64 92 58 120 56 C116 72 104 90 84 102 Z" fill="${fill}" /><path d="M96 34 C101 46 99 58 90 68" stroke="${fill}" stroke-width="10" stroke-linecap="round" fill="none" />`;
  }

  return `<path d="M54 44 L72 28 L86 44 L98 44 L112 28 L130 44 L120 112 L102 112 L96 76 L88 76 L82 112 L64 112 Z" fill="${fill}" />`;
}

function buildSuggestionImage({ name, shortLabel, colors, visualKey }) {
  const label = escapeXml(shortLabel || name);
  const title = escapeXml(name);
  const bgStart = colors?.[0] || "#f8d9d6";
  const bgEnd = colors?.[1] || "#f6f2ea";
  const accent = colors?.[2] || "#8b1e1e";
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 184 132" role="img" aria-labelledby="title desc">
      <title>${title}</title>
      <desc>${escapeXml(`${name} visual example`)}</desc>
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${bgStart}" />
          <stop offset="100%" stop-color="${bgEnd}" />
        </linearGradient>
      </defs>
      <rect width="184" height="132" rx="20" fill="url(#bg)" />
      <rect x="14" y="14" width="156" height="104" rx="16" fill="rgba(255,255,255,0.7)" />
      ${iconMarkup(visualKey, accent)}
      <rect x="18" y="92" width="148" height="22" rx="11" fill="rgba(255,255,255,0.92)" />
      <text x="92" y="107" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="700" text-anchor="middle" fill="#271617">${label}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function buildSuggestion(definition) {
  const retailer = buildRetailerLink(definition.id);
  const realImage = REAL_SUGGESTION_IMAGES[definition.id];
  return {
    ...definition,
    ...retailer,
    imageUrl: realImage?.imageUrl || buildSuggestionImage(definition),
    imageAlt: realImage?.imageAlt || `${definition.name} example`,
  };
}

const SUGGESTIONS = {
  plainTee: buildSuggestion({
    id: "plain-tee",
    name: "Plain t-shirt",
    shortLabel: "Plain Tee",
    reason: "A clean basic top makes casual outfits easier to rotate.",
    visualKey: "tops",
    colors: ["#f6d8d6", "#f8efe6", "#8b1e1e"],
  }),
  longSleeve: buildSuggestion({
    id: "long-sleeve",
    name: "Long-sleeve basic",
    shortLabel: "Long Sleeve",
    reason: "Useful for layering, cooler mornings, and repeat outfit variety.",
    visualKey: "tops",
    colors: ["#d9e8f6", "#edf4fb", "#355d85"],
  }),
  jeans: buildSuggestion({
    id: "jeans",
    name: "Everyday jeans",
    shortLabel: "Jeans",
    reason: "A dependable bottom anchors most casual and smart-casual looks.",
    visualKey: "bottoms",
    colors: ["#dce6f7", "#f3f7fd", "#294c7d"],
  }),
  trousers: buildSuggestion({
    id: "trousers",
    name: "Versatile trousers",
    shortLabel: "Trousers",
    reason: "Helps bridge casual outfits and more polished plans.",
    visualKey: "bottoms",
    colors: ["#ece8e3", "#f9f7f4", "#63564c"],
  }),
  casualSneakers: buildSuggestion({
    id: "casual-sneakers",
    name: "Everyday sneakers",
    shortLabel: "Sneakers",
    reason: "Comfortable footwear gives your tops and bottoms more outfit options.",
    visualKey: "shoes",
    colors: ["#d8efe6", "#f2faf6", "#22634c"],
  }),
  formalShoes: buildSuggestion({
    id: "formal-shoes",
    name: "Formal shoes",
    shortLabel: "Dress Shoes",
    reason: "Useful for work, events, and any outfit that needs a cleaner finish.",
    visualKey: "shoes",
    colors: ["#ece3db", "#f8f3ee", "#5b4336"],
  }),
  athleticShoes: buildSuggestion({
    id: "athletic-shoes",
    name: "Athletic shoes",
    shortLabel: "Running Shoes",
    reason: "Performance footwear keeps activewear recommendations practical.",
    visualKey: "shoes",
    colors: ["#d8e6f8", "#eef4fd", "#245495"],
  }),
  lightJacket: buildSuggestion({
    id: "light-jacket",
    name: "Light jacket",
    shortLabel: "Light Jacket",
    reason: "Adds an easy extra layer for mild weather and evening plans.",
    visualKey: "outerwear",
    colors: ["#e4e1f5", "#f6f4fd", "#584596"],
  }),
  warmJacket: buildSuggestion({
    id: "warm-jacket",
    name: "Cold-weather jacket",
    shortLabel: "Warm Jacket",
    reason: "Important when your current weather calls for real warmth.",
    visualKey: "outerwear",
    colors: ["#dce9f3", "#f3f8fb", "#3f627b"],
  }),
  structuredLayer: buildSuggestion({
    id: "structured-layer",
    name: "Blazer or structured layer",
    shortLabel: "Blazer",
    reason: "A structured layer gives work or formal outfits a sharper finish.",
    visualKey: "outerwear",
    colors: ["#eadfd7", "#faf4ef", "#6b4a3c"],
  }),
  buttonUp: buildSuggestion({
    id: "button-up",
    name: "Button-up shirt",
    shortLabel: "Button-Up",
    reason: "A polished top helps when your style leans work, formal, or social.",
    visualKey: "tops",
    colors: ["#dce8ef", "#f5fafc", "#406579"],
  }),
  accessory: buildSuggestion({
    id: "simple-accessory",
    name: "Simple accessory",
    shortLabel: "Accessory",
    reason: "A low-effort accessory can make repeated outfits feel more finished.",
    visualKey: "accessories",
    colors: ["#f2e2c9", "#fbf6eb", "#9a6a26"],
  }),
};

function summarizeCoverage(count, label) {
  return `${count} active ${label}${count === 1 ? "" : "s"} found`;
}

function recentRotationNote(items, recentItemCounts) {
  const entryList = (Array.isArray(items) ? items : []).map((item) => ({
    item,
    wears: Number(recentItemCounts?.get?.((item?.id ?? "").toString()) || 0),
  }));
  const totalWears = entryList.reduce((sum, entry) => sum + entry.wears, 0);

  if (entryList.length === 1 && totalWears >= 2) {
    const repeatedName = entryList[0].item?.name || "that piece";
    return `You have been leaning on ${repeatedName} lately, so one more option would give you a better rotation.`;
  }

  if (entryList.length === 2 && totalWears >= 5) {
    return "This category is doing a lot of work in your recent outfits, so adding one more option would spread the wear around.";
  }

  return "";
}

function buildGap({
  id,
  phrase,
  title,
  severity,
  priority,
  summary,
  coverage,
  note,
  suggestions,
}) {
  return {
    id,
    phrase,
    title,
    severity,
    priority,
    summary,
    coverage,
    note,
    suggestions,
  };
}

function starterGap(weatherCategory) {
  const isColdWeather = weatherCategory === "cold" || weatherCategory === "cool";
  return [
    buildGap({
      id: "starter-core",
      phrase: "You may be missing...",
      title: "Core outfit starters",
      severity: "high",
      priority: 110,
      summary: "Your wardrobe is empty right now, so FitGPT is starting with practical basics that make recommendations possible.",
      coverage: "0 active wardrobe items found",
      note: "FitGPT uses a flexible baseline: tops, bottoms, footwear, and outerwear when weather or layering calls for it.",
      suggestions: [
        SUGGESTIONS.plainTee,
        SUGGESTIONS.jeans,
      ],
    }),
    buildGap({
      id: "starter-footwear",
      phrase: "Consider adding...",
      title: "Everyday footwear",
      severity: "medium",
      priority: 100,
      summary: "A versatile pair of shoes makes every future recommendation more wearable.",
      coverage: "0 active shoes found",
      note: "",
      suggestions: [
        SUGGESTIONS.casualSneakers,
        isColdWeather ? SUGGESTIONS.warmJacket : SUGGESTIONS.lightJacket,
      ],
    }),
  ];
}

export function analyzeWardrobeGaps({ wardrobe, answers, weatherCategory = "mild", recentItemCounts = new Map() }) {
  const activeItems = (Array.isArray(wardrobe) ? wardrobe : []).filter((item) => item && item.is_active !== false);

  if (activeItems.length === 0) {
    return {
      emptyWardrobe: true,
      starterMode: true,
      summaryTitle: "Your wardrobe could use a starter lineup",
      summaryText: "Start with a few essentials and FitGPT will turn them into more personalized outfit recommendations.",
      gaps: starterGap(weatherCategory),
      checkedItems: 0,
    };
  }

  const styles = normalizeList(answers?.style);
  const occasions = normalizeList(answers?.dressFor);
  const comfort = normalizeList(answers?.comfort);
  const categoryItems = {
    Tops: activeItems.filter((item) => normalizeCategory(item?.category) === "Tops"),
    Bottoms: activeItems.filter((item) => normalizeCategory(item?.category) === "Bottoms"),
    Shoes: activeItems.filter((item) => normalizeCategory(item?.category) === "Shoes"),
    Outerwear: activeItems.filter((item) => normalizeCategory(item?.category) === "Outerwear"),
    Accessories: activeItems.filter((item) => normalizeCategory(item?.category) === "Accessories"),
  };

  const counts = Object.fromEntries(
    Object.entries(categoryItems).map(([key, items]) => [key, items.length])
  );

  const isSmallWardrobe = activeItems.length <= 6;
  const needsColdWeatherSupport = weatherCategory === "cold" || weatherCategory === "cool";
  const wantsLayering = needsColdWeatherSupport || comfort.has("layered");
  const wantsFormal = styles.has("formal") || styles.has("professional") || styles.has("work") || occasions.has("work") || occasions.has("date night") || occasions.has("party / event") || occasions.has("social");
  const wantsAthletic = styles.has("athletic") || styles.has("activewear") || occasions.has("gym");

  const basicTopCount = categoryItems.Tops.filter((item) => itemMatches(item, ["t-shirt", "tee", "long sleeve", "tank", "polo", "blouse", "shirt"])).length;
  const essentialBottomCount = categoryItems.Bottoms.filter((item) => itemMatches(item, ["jean", "trouser", "dress pant", "pant", "legging", "jogger"])).length;
  const formalTopCount = categoryItems.Tops.filter((item) => itemMatches(item, ["button-up", "dress shirt", "button down", "blouse", "polo"])).length;
  const structuredLayerCount = categoryItems.Outerwear.filter((item) => itemMatches(item, ["blazer", "coat", "jacket", "cardigan", "overshirt"])).length;
  const formalShoesCount = categoryItems.Shoes.filter((item) => itemMatches(item, ["dress shoe", "loafer", "oxford", "heel", "flat", "boot"])).length;
  const athleticShoesCount = categoryItems.Shoes.filter((item) => itemMatches(item, ["running", "trainer", "gym", "athletic", "sport", "sneaker"])).length;

  const gaps = [];

  if (counts.Tops === 0 || basicTopCount < (isSmallWardrobe ? 1 : 2)) {
    gaps.push(buildGap({
      id: "tops",
      phrase: counts.Tops === 0 ? "You may be missing..." : "Your wardrobe could use...",
      title: counts.Tops === 0 ? "Everyday tops" : "More basic tops",
      severity: counts.Tops === 0 ? "high" : "medium",
      priority: counts.Tops === 0 ? 100 : 78,
      summary: counts.Tops === 0
        ? "FitGPT could not find any active tops, which makes daily outfit building hard."
        : "You have some tops already, but not many simple ones that can anchor repeat outfits.",
      coverage: summarizeCoverage(counts.Tops, "top"),
      note: recentRotationNote(categoryItems.Tops, recentItemCounts),
      suggestions: [SUGGESTIONS.plainTee, SUGGESTIONS.longSleeve],
    }));
  }

  if (counts.Bottoms === 0 || essentialBottomCount < (isSmallWardrobe ? 1 : 2)) {
    gaps.push(buildGap({
      id: "bottoms",
      phrase: counts.Bottoms === 0 ? "You may be missing..." : "Consider adding...",
      title: counts.Bottoms === 0 ? "Core bottoms" : "Another bottom option",
      severity: counts.Bottoms === 0 ? "high" : "medium",
      priority: counts.Bottoms === 0 ? 98 : 74,
      summary: counts.Bottoms === 0
        ? "No active bottoms were found, so recommendations cannot build complete looks reliably."
        : "A second dependable bottom would give your outfits more range than repeating the same pair.",
      coverage: summarizeCoverage(counts.Bottoms, "bottom"),
      note: recentRotationNote(categoryItems.Bottoms, recentItemCounts),
      suggestions: [SUGGESTIONS.jeans, SUGGESTIONS.trousers],
    }));
  }

  if (counts.Shoes === 0 || counts.Shoes < (isSmallWardrobe ? 1 : 2)) {
    gaps.push(buildGap({
      id: "shoes",
      phrase: counts.Shoes === 0 ? "You may be missing..." : "Consider adding...",
      title: counts.Shoes === 0 ? "Everyday footwear" : "More footwear variety",
      severity: counts.Shoes === 0 ? "high" : "medium",
      priority: counts.Shoes === 0 ? 96 : 72,
      summary: counts.Shoes === 0
        ? "FitGPT could not find any active footwear, which blocks full outfit recommendations."
        : "A second shoe option would help the same outfits feel more intentional across occasions.",
      coverage: summarizeCoverage(counts.Shoes, "shoe"),
      note: recentRotationNote(categoryItems.Shoes, recentItemCounts),
      suggestions: [SUGGESTIONS.casualSneakers, wantsFormal ? SUGGESTIONS.formalShoes : SUGGESTIONS.athleticShoes],
    }));
  }

  if (wantsLayering && counts.Outerwear === 0) {
    gaps.push(buildGap({
      id: "outerwear",
      phrase: "You may be missing...",
      title: needsColdWeatherSupport ? "Cold-weather outerwear" : "A useful outer layer",
      severity: "high",
      priority: needsColdWeatherSupport ? 92 : 68,
      summary: needsColdWeatherSupport
        ? "Current conditions call for an outer layer, but no jackets or coats are active in your wardrobe."
        : "A light outer layer would make your wardrobe more flexible for changing temps and layered outfits.",
      coverage: summarizeCoverage(counts.Outerwear, "outerwear item"),
      note: "",
      suggestions: [needsColdWeatherSupport ? SUGGESTIONS.warmJacket : SUGGESTIONS.lightJacket, SUGGESTIONS.structuredLayer],
    }));
  }

  if (wantsFormal && formalTopCount === 0) {
    gaps.push(buildGap({
      id: "formal-top",
      phrase: "Consider adding...",
      title: "A polished top",
      severity: "medium",
      priority: 66,
      summary: "Your style preferences suggest dressier looks, but FitGPT did not spot a clear button-up or equivalent top.",
      coverage: summarizeCoverage(formalTopCount, "polished top"),
      note: "",
      suggestions: [SUGGESTIONS.buttonUp, SUGGESTIONS.structuredLayer],
    }));
  }

  if (wantsFormal && structuredLayerCount === 0) {
    gaps.push(buildGap({
      id: "structured-layer",
      phrase: "Your wardrobe could use...",
      title: "A structured layer",
      severity: "medium",
      priority: 65,
      summary: "A blazer, cardigan, or similar layer would make work and formal outfits feel more complete.",
      coverage: summarizeCoverage(structuredLayerCount, "structured layer"),
      note: "",
      suggestions: [SUGGESTIONS.structuredLayer, SUGGESTIONS.buttonUp],
    }));
  }

  if (wantsFormal && formalShoesCount === 0) {
    gaps.push(buildGap({
      id: "formal-shoes",
      phrase: "You may be missing...",
      title: "Formal shoes",
      severity: "medium",
      priority: 64,
      summary: "Work or formal outfits usually need footwear that looks more polished than sneakers alone.",
      coverage: summarizeCoverage(formalShoesCount, "formal shoe"),
      note: "",
      suggestions: [SUGGESTIONS.formalShoes, SUGGESTIONS.structuredLayer],
    }));
  }

  if (wantsAthletic && athleticShoesCount === 0) {
    gaps.push(buildGap({
      id: "athletic-shoes",
      phrase: "Consider adding...",
      title: "Performance footwear",
      severity: "medium",
      priority: 62,
      summary: "You have activewear preferences, but FitGPT did not find shoes that clearly support gym or running outfits.",
      coverage: summarizeCoverage(athleticShoesCount, "athletic shoe"),
      note: "",
      suggestions: [SUGGESTIONS.athleticShoes, SUGGESTIONS.casualSneakers],
    }));
  }

  if (activeItems.length >= 6 && wantsFormal && counts.Accessories === 0) {
    gaps.push(buildGap({
      id: "accessories",
      phrase: "Your wardrobe could use...",
      title: "One simple finishing piece",
      severity: "low",
      priority: 44,
      summary: "Accessories are optional, but one finishing piece can help repeat outfits feel more complete.",
      coverage: summarizeCoverage(counts.Accessories, "accessory"),
      note: "",
      suggestions: [SUGGESTIONS.accessory, SUGGESTIONS.structuredLayer],
    }));
  }

  const sortedGaps = gaps.sort((a, b) => b.priority - a.priority).slice(0, 3);

  return {
    emptyWardrobe: false,
    starterMode: false,
    summaryTitle: sortedGaps.length
      ? "You may be missing a few useful pieces"
      : "Your wardrobe looks well covered",
    summaryText: sortedGaps.length
      ? `FitGPT checked ${activeItems.length} active items against a flexible baseline of tops, bottoms, footwear, and weather-ready layers, then adjusted for your style preferences.`
      : `FitGPT checked ${activeItems.length} active items and did not find any major wardrobe gaps for your current style and weather context.`,
    gaps: sortedGaps,
    checkedItems: activeItems.length,
  };
}

export function gapSeverityLabel(severity) {
  if (severity === "high") return "Essential";
  if (severity === "medium") return "Useful";
  return "Optional";
}

export function gapSeverityTone(severity) {
  if (severity === "high") return "high";
  if (severity === "medium") return "medium";
  return "low";
}

export function gapTitleCasePhrase(phrase) {
  return titleCase((phrase || "").replace("...", ""));
}
