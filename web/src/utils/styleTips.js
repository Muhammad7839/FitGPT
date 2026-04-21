/**
 * Curated style tips used by the Dashboard marquee.
 *
 * Keep these short (single-line) and data-free — no brand names, no dated
 * trend references. Edit this list freely; the marquee auto-wraps any length.
 *
 * If you want to source tips from elsewhere later (backend endpoint, Groq,
 * localized strings), swap `loadStyleTips()` to an async fetcher — callers
 * already handle a Promise via the hook below.
 */

const DEFAULT_STYLE_TIPS = [
  "Pair navy with warm tones — camel, rust, or burgundy read richer than grey.",
  "Dark denim reads dressier than light; swap to indigo when you need a step up.",
  "Layer textures — knit, leather, and cotton in one outfit add depth without clashing.",
  "Stick to three colors per outfit. One dominant, one accent, one neutral.",
  "Tuck the front of your shirt only — a French tuck keeps shape without feeling formal.",
  "White sneakers dress down a blazer without breaking the outfit.",
  "Monochrome looks work best when you vary shades and fabrics, not just colors.",
  "If it's cool outside, a third piece (blazer, cardigan, overshirt) elevates any base.",
  "Your shoes and belt don't need to match exactly — same tone family is enough.",
  "Loose top + fitted bottom (or vice versa) reads more intentional than loose + loose.",
  "Rotate your most-worn pieces so favorites don't burn out.",
  "Accessories should feel personal, not performative — one good piece beats three meh ones.",
];

export function getStyleTips() {
  return DEFAULT_STYLE_TIPS.slice();
}

export default DEFAULT_STYLE_TIPS;
