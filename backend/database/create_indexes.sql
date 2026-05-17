-- create_indexes.sql
-- Creates indexes on the most frequently queried columns.
-- Run this after create_tables.sql.

-- users: fast login lookup by email (already unique, adding explicit index for clarity)
CREATE INDEX IF NOT EXISTS idx_users_email
    ON users (email);

-- clothing_items: load wardrobe by owner quickly
CREATE INDEX IF NOT EXISTS idx_clothing_items_owner_id
    ON clothing_items (owner_id);

-- clothing_items: filter by category (common wardrobe query)
CREATE INDEX IF NOT EXISTS idx_clothing_items_category
    ON clothing_items (category);

-- clothing_items: filter active vs archived items
CREATE INDEX IF NOT EXISTS idx_clothing_items_archived
    ON clothing_items (archived);

-- saved_outfits: load all outfits for a user
CREATE INDEX IF NOT EXISTS idx_saved_outfits_user_id
    ON saved_outfits (user_id);

-- outfit_history: load wear log for a user sorted by date
CREATE INDEX IF NOT EXISTS idx_outfit_history_user_id
    ON outfit_history (user_id);

CREATE INDEX IF NOT EXISTS idx_outfit_history_worn_at
    ON outfit_history (worn_at DESC);

-- planner_items: look up scheduled outfits by date
CREATE INDEX IF NOT EXISTS idx_planner_items_user_id
    ON planner_items (user_id);

CREATE INDEX IF NOT EXISTS idx_planner_items_planned_date
    ON planner_items (planned_date);
