// Auth & session
export const TOKEN_KEY = "fitgpt_token_v1";
export const AUTH_MODE_KEY = "fitgpt_auth_mode_v1";
export const DEMO_AUTH_KEY = "fitgpt_demo_auth_v1";

// Wardrobe
export const GUEST_WARDROBE_KEY = "fitgpt_guest_wardrobe_v1";
export const WARDROBE_KEY = "fitgpt_wardrobe_v1";
export const OPEN_ADD_ITEM_FLAG = "fitgpt_open_add_item";

// Outfits
export const SAVED_OUTFITS_KEY = "fitgpt_saved_outfits_v1";
export const OUTFIT_HISTORY_KEY = "fitgpt_outfit_history_v1";
export const PLANNED_OUTFITS_KEY = "fitgpt_planned_outfits_v1";
export const REUSE_OUTFIT_KEY = "fitgpt_reuse_outfit_v1";

// Recommendations
export const REC_SEED_KEY = "fitgpt_rec_seed_v1";
export const WEATHER_OVERRIDE_KEY = "fitgpt_weather_override_v1";
export const TIME_OVERRIDE_KEY = "fitgpt_time_override_v1";

// User
export const PROFILE_KEY = "fitgpt_profile_v1";
export const PROFILE_PIC_KEY = "fitgpt_profile_pic_v1";
export const ONBOARDING_ANSWERS_KEY = "fitgpt_onboarding_answers_v1";
export const ONBOARDED_KEY = "fitgpt_onboarded_v1";

// Theme
export const LEGACY_THEME_KEY = "fitgpt_theme_v1";
export const THEME_KEY = "fitgpt_theme_v2";
export const CUSTOM_THEMES_KEY = "fitgpt_custom_themes_v1";

// Misc
export const STALE_CLEANUP_KEY = "fitgpt_stale_cleanup_v2";
export const TUTORIAL_DONE_KEY = "fitgpt_tutorial_done_v1";
export const CHAT_HISTORY_KEY = "fitgpt_chat_history_v1";
export const REJECTED_OUTFITS_KEY = "fitgpt_rejected_outfits_v1";
export const DISMISSED_DUPLICATES_KEY = "fitgpt_dismissed_duplicates_v1";

// Custom events
export const EVT_WARDROBE_CHANGED = "fitgpt:guest-wardrobe-changed";
export const EVT_SAVED_OUTFITS_CHANGED = "fitgpt:saved-outfits-changed";
export const EVT_PLANNED_OUTFITS_CHANGED = "fitgpt:planned-outfits-changed";
export const EVT_PROFILE_PIC_CHANGED = "fitgpt:profile-pic-changed";

// Fit tags (canonical set — used by Wardrobe form + recommendation scoring)
export const FIT_TAGS = ["unknown", "slim", "regular", "relaxed", "oversized", "tailored", "athletic", "petite", "plus"];
