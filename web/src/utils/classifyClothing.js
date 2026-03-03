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
  cardigan: "Tops",
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

// Minimum confidence to trust the ML result over filename guess
const MIN_CONFIDENCE = 0.08;

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

/**
 * Classify an already-loaded HTMLImageElement.
 * @param {HTMLImageElement} imgElement
 * @returns {Promise<{category: string|null, confidence: number, label: string}>}
 */
export async function classifyClothingImage(imgElement) {
  try {
    const model = await getModel();
    const predictions = await model.classify(imgElement, 5);

    for (const pred of predictions) {
      const category = labelToCategory(pred.className);
      if (category && pred.probability >= MIN_CONFIDENCE) {
        return {
          category,
          confidence: pred.probability,
          label: pred.className,
        };
      }
    }

    return { category: null, confidence: 0, label: "" };
  } catch {
    return { category: null, confidence: 0, label: "" };
  }
}

/**
 * Classify a clothing image from a data URL or object URL.
 * Creates a temporary Image, waits for load, then classifies.
 * @param {string} imageUrl - data:... URL or blob:... URL
 * @returns {Promise<{category: string|null, confidence: number, label: string}>}
 */
export async function classifyFromUrl(imageUrl) {
  if (!imageUrl) return { category: null, confidence: 0, label: "" };

  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = "anonymous";
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Image load failed"));
      el.src = imageUrl;
    });

    return await classifyClothingImage(img);
  } catch {
    return { category: null, confidence: 0, label: "" };
  }
}
