-- create_views.sql
-- Creates two convenience views for common reporting queries.
-- Run this after create_tables.sql.

-- View 1: active_wardrobe_items
-- Shows every clothing item that has not been archived or soft-deleted,
-- joined with the owner's email so reports include user context.
CREATE OR REPLACE VIEW active_wardrobe_items AS
SELECT
    ci.id,
    ci.name,
    ci.category,
    ci.color,
    ci.fit_type,
    ci.style_tag,
    ci.image_url,
    ci.owner_id,
    u.email AS owner_email
FROM clothing_items ci
JOIN users u ON u.id = ci.owner_id
WHERE ci.archived = FALSE
  AND ci.is_deleted = FALSE;

-- View 2: outfit_wear_log
-- Shows every outfit that has actually been worn (worn_at is not null),
-- ordered by most recently worn first.
-- Note: named outfit_wear_log to avoid conflict with the outfit_history table.
CREATE OR REPLACE VIEW outfit_wear_log AS
SELECT
    oh.id,
    oh.user_id,
    u.email AS user_email,
    oh.saved_outfit_id,
    oh.worn_at
FROM outfit_history oh
JOIN users u ON u.id = oh.user_id
WHERE oh.worn_at IS NOT NULL
ORDER BY oh.worn_at DESC;
