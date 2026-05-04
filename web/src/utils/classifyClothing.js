/**
 * Clothing image classification using TensorFlow.js + MobileNet.
 *
 * Lazy-loads the model on first use (~16MB from Google CDN, browser-cached).
 * Maps ImageNet labels to the app's 5 clothing categories.
 * All public functions catch errors and return { category: null } — never throws.
 */

// ImageNet label substrings → app category
const LABEL_TO_CATEGORY = {
  // Tops
  jersey: "Tops",
  "t-shirt": "Tops",
  tshirt: "Tops",
  shirt: "Tops",
  polo: "Tops",
  sweater: "Tops",
  sweatshirt: "Tops",
  pullover: "Tops",
  tank: "Tops",
  blouse: "Tops",
  tee: "Tops",
  vest: "Tops",
  brassiere: "Tops",
  bra: "Tops",
  bikini: "Tops",
  maillot: "Tops",
  swimming: "Tops",

  // Bottoms
  jean: "Bottoms",
  jeans: "Bottoms",
  trouser: "Bottoms",
  pant: "Bottoms",
  shorts: "Bottoms",
  skirt: "Bottoms",
  miniskirt: "Bottoms",
  sarong: "Bottoms",
  overskirt: "Bottoms",

  // Outerwear
  jacket: "Outerwear",
  coat: "Outerwear",
  blazer: "Outerwear",
  trench: "Outerwear",
  "trench coat": "Outerwear",
  overcoat: "Outerwear",
  parka: "Outerwear",
  poncho: "Outerwear",
  cloak: "Outerwear",
  windbreaker: "Outerwear",
  hoodie: "Outerwear",
  fur: "Outerwear",
  "fur coat": "Outerwear",
  anorak: "Outerwear",
  raincoat: "Outerwear",
  duster: "Outerwear",
  cape: "Outerwear",
  stole: "Outerwear",
  "lab coat": "Outerwear",
  cardigan: "Outerwear",

  // Shoes
  shoe: "Shoes",
  sneaker: "Shoes",
  "running shoe": "Shoes",
  loafer: "Shoes",
  boot: "Shoes",
  sandal: "Shoes",
  clog: "Shoes",
  oxford: "Shoes",
  heel: "Shoes",
  slipper: "Shoes",
  flip: "Shoes",
  "cowboy boot": "Shoes",

  // Accessories
  sunglasses: "Accessories",
  sunglass: "Accessories",
  hat: "Accessories",
  cap: "Accessories",
  bonnet: "Accessories",
  beret: "Accessories",
  sombrero: "Accessories",
  cowboy: "Accessories",
  scarf: "Accessories",
  necktie: "Accessories",
  tie: "Accessories",
  "bow tie": "Accessories",
  bowtie: "Accessories",
  belt: "Accessories",
  wallet: "Accessories",
  purse: "Accessories",
  handbag: "Accessories",
  backpack: "Accessories",
  bag: "Accessories",
  watch: "Accessories",
  necklace: "Accessories",
  bracelet: "Accessories",
  earring: "Accessories",
  ring: "Accessories",
  glove: "Accessories",
  mitten: "Accessories",
  umbrella: "Accessories",
  "shower cap": "Accessories",
  sock: "Accessories",
  stocking: "Accessories",
  apron: "Accessories",
  mask: "Accessories",
  bandeau: "Accessories",

  // General garments — default to Tops
  gown: "Tops",
  dress: "Tops",
  suit: "Tops",
  uniform: "Tops",
  robe: "Tops",
  kimono: "Tops",
  abaya: "Tops",
  pajama: "Tops",
  academic: "Tops",
};

// ImageNet label keyword → app clothing type (must match CLOTHING_TYPE_OPTIONS values)
const LABEL_TO_TYPE = {
  // Tops
  jersey: "t-shirt",
  "t-shirt": "t-shirt",
  tshirt: "t-shirt",
  tee: "t-shirt",
  polo: "polo",
  sweater: "sweater",
  pullover: "sweater",
  sweatshirt: "hoodie",
  hoodie: "hoodie",
  tank: "tank top",
  blouse: "blouse",
  "dress shirt": "dress shirt",
  buttonup: "button-up",
  "button-up": "button-up",
  flannel: "flannel",
  // Bottoms
  jean: "jeans",
  jeans: "jeans",
  trouser: "dress pants",
  pant: "dress pants",
  shorts: "shorts",
  skirt: "skirt",
  miniskirt: "skirt",
  legging: "leggings",
  jogger: "joggers",
  sweatpants: "sweatpants",
  cargo: "cargo pants",
  // Outerwear
  jacket: "jacket",
  coat: "coat",
  blazer: "blazer",
  cardigan: "cardigan",
  trench: "coat",
  overcoat: "coat",
  parka: "parka",
  anorak: "parka",
  raincoat: "windbreaker",
  windbreaker: "windbreaker",
  // Shoes
  sneaker: "sneakers",
  "running shoe": "sneakers",
  trainer: "sneakers",
  loafer: "dress shoes",
  oxford: "dress shoes",
  boot: "boots",
  sandal: "sandals",
  clog: "sandals",
  heel: "heels",
  slipper: "flats",
  // Accessories
  hat: "hat",
  cap: "hat",
  beret: "hat",
  sombrero: "hat",
  bonnet: "hat",
  scarf: "scarf",
  stole: "scarf",
  tie: "scarf",
  necktie: "scarf",
  belt: "belt",
  watch: "watch",
  necklace: "jewelry",
  bracelet: "jewelry",
  earring: "jewelry",
  ring: "jewelry",
  sunglasses: "sunglasses",
  sunglass: "sunglasses",
  bag: "bag",
  backpack: "bag",
  handbag: "bag",
  purse: "bag",
};

// Minimum confidence to auto-apply ML result without needing manual review
const MIN_CONFIDENCE = 0.18;

// Below MIN_CONFIDENCE but above this → return result flagged as needing review
const REVIEW_CONFIDENCE = 0.08;

// ── Filename keyword fallback ─────────────────────────────────────────────────
// Infer category from the file name when ML confidence is low.

const FILENAME_CATEGORY_PATTERNS = [
  // Shoes — brand names and generic terms, listed first to avoid mis-hits
  {
    pattern: /\b(jordan|air.?jordan|air.?max|air.?force|nike|adidas|vans|converse|puma|reebok|new.?balance|asics|saucony|yeezy|ultraboost|stan.?smith|chuck.?taylor|shoe|shoes|sneaker|sneakers|boot|boots|sandal|sandals|heel|heels|loafer|loafers|slipper|slippers|oxford|trainer|trainers|kicks|footwear|clog|clogs|slide|slides)\b/i,
    category: "Shoes",
    type: "sneakers",
  },
  // Bottoms
  {
    pattern: /\b(jeans?|denim|trousers?|pants?|shorts?|skirts?|leggings?|joggers?|sweatpants?|chinos?|cargo|slacks)\b/i,
    category: "Bottoms",
    type: "jeans",
  },
  // Outerwear
  {
    pattern: /\b(jackets?|coats?|blazers?|hoodies?|parkas?|windbreakers?|overcoat|raincoat|cardigan|trench|anorak)\b/i,
    category: "Outerwear",
    type: "jacket",
  },
  // Tops
  {
    pattern: /\b(shirts?|tshirts?|tees?|tops?|blouses?|sweaters?|pullover|tanks?|polos?|tunic|halter|crop)\b/i,
    category: "Tops",
    type: "t-shirt",
  },
  // Accessories
  {
    pattern: /\b(hats?|caps?|scarves?|scarf|belts?|bags?|purse|wallet|watches?|sunglasses|glasses|necklace|bracelet|rings?|earrings?|gloves?|socks?)\b/i,
    category: "Accessories",
    type: "hat",
  },
];

/**
 * Guess category from a file's basename before the ML model runs.
 * Returns { category, type } or null if no match found.
 */
export function categoryFromFilename(filename) {
  if (!filename) return null;
  const base = filename
    .split(/[\\/]/)
    .pop()
    .replace(/\.[^.]+$/, "")
    .replace(/[_\-. ]+/g, " ");
  for (const { pattern, category, type } of FILENAME_CATEGORY_PATTERNS) {
    if (pattern.test(base)) return { category, type };
  }
  return null;
}

// Singleton model promise — lazy loaded
let modelPromise = null;

function getModel() {
  if (!modelPromise) {
    modelPromise = import("@tensorflow/tfjs").then(() =>
      import("@tensorflow-models/mobilenet").then((mobilenet) =>
        mobilenet.load({ version: 2, alpha: 1.0 })
      )
    ).catch((err) => {
      // Reset so next call retries
      modelPromise = null;
      throw err;
    });
  }
  return modelPromise;
}

/**
 * Start downloading the model in the background.
 * Call on Wardrobe mount so it's ready by the time the user uploads.
 */
export function preloadModel() {
  getModel().catch(() => {});
}

/**
 * Match a MobileNet label string to one of the app's categories.
 * Returns the category string or null if no match.
 */
function labelToCategory(label) {
  const lower = label.toLowerCase();

  // Try longest match first for multi-word labels
  const entries = Object.entries(LABEL_TO_CATEGORY);
  // Sort by key length descending so "trench coat" matches before "coat"
  entries.sort((a, b) => b[0].length - a[0].length);

  for (const [keyword, category] of entries) {
    if (lower.includes(keyword)) {
      return category;
    }
  }
  return null;
}

function labelToType(label) {
  const lower = label.toLowerCase();
  const entries = Object.entries(LABEL_TO_TYPE);
  entries.sort((a, b) => b[0].length - a[0].length);
  for (const [keyword, type] of entries) {
    if (lower.includes(keyword)) return type;
  }
  return "";
}

/**
 * Classify an already-loaded HTMLImageElement.
 * Returns { category, type, confidence, label, needsReview }
 *   needsReview=true  → low-confidence result, show the user a review prompt
 *   needsReview=false → result is reliable enough to auto-apply
 * @param {HTMLImageElement} imgElement
 * @param {string} [filename] - optional original filename for keyword fallback
 */
export async function classifyClothingImage(imgElement, filename) {
  try {
    const model = await getModel();
    const predictions = await model.classify(imgElement, 5);

    // Find the best matching prediction at or above the review threshold
    let best = null;
    for (const pred of predictions) {
      const category = labelToCategory(pred.className);
      if (category && pred.probability >= REVIEW_CONFIDENCE) {
        best = { category, type: labelToType(pred.className), confidence: pred.probability, label: pred.className };
        break;
      }
    }

    if (best) {
      // High-confidence: auto-apply. Low-confidence: flag for review.
      const needsReview = best.confidence < MIN_CONFIDENCE;
      return { ...best, needsReview };
    }

    // ML gave no usable result — try filename keyword fallback
    const fileGuess = categoryFromFilename(filename);
    if (fileGuess) {
      return { ...fileGuess, confidence: 0, label: "filename-inferred", needsReview: false };
    }

    return { category: null, type: "", confidence: 0, label: "", needsReview: true };
  } catch {
    const fileGuess = categoryFromFilename(filename);
    if (fileGuess) {
      return { ...fileGuess, confidence: 0, label: "filename-inferred", needsReview: false };
    }
    return { category: null, type: "", confidence: 0, label: "", needsReview: true };
  }
}

/**
 * Classify a clothing image from a data URL or object URL.
 * Creates a temporary Image, waits for load, then classifies.
 * @param {string} imageUrl - data:... URL or blob:... URL
 * @param {string} [filename] - optional original filename for keyword fallback
 * @returns {Promise<{category: string|null, type: string, confidence: number, label: string, needsReview: boolean}>}
 */
export async function classifyFromUrl(imageUrl, filename) {
  if (!imageUrl) return { category: null, type: "", confidence: 0, label: "", needsReview: true };

  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = "anonymous";
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Image load failed"));
      el.src = imageUrl;
    });

    return await classifyClothingImage(img, filename);
  } catch {
    const fileGuess = categoryFromFilename(filename);
    if (fileGuess) {
      return { ...fileGuess, confidence: 0, label: "filename-inferred", needsReview: false };
    }
    return { category: null, type: "", confidence: 0, label: "", needsReview: true };
  }
}
