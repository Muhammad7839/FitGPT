# FitGPT Database SQL Scripts

This folder contains SQL scripts for setting up the FitGPT PostgreSQL database from scratch.
Run them in the order listed below using `psql -d your_database_name -f <filename>`.

## create_tables.sql

Creates all five tables: `users`, `clothing_items`, `saved_outfits`, `outfit_history`, and `planner_items`.
Includes all columns, data types, primary keys, foreign keys with cascade deletes, and NOT NULL constraints.
Run this first before any other script.

## create_indexes.sql

Creates indexes on the most frequently queried columns to speed up common lookups.
Covers `users.email`, `clothing_items.owner_id`, `clothing_items.category`, `clothing_items.archived`,
`saved_outfits.user_id`, `outfit_history.user_id`, `outfit_history.worn_at`, and `planner_items.planned_date`.
Run this after `create_tables.sql`.

## create_views.sql

Creates two read-only views for reporting and quick lookups.
`active_wardrobe_items` returns all non-archived clothing items joined with the owner's email.
`outfit_wear_log` returns all outfit history records that have a `worn_at` timestamp, ordered by most recent first.
Run this after `create_tables.sql`.

## Notes

- All scripts use `IF NOT EXISTS` / `OR REPLACE` so they are safe to run more than once.
- Column names match the SQLAlchemy models in `app/models.py` exactly.
- The `outfit_wear_log` view is named differently from the `outfit_history` table to avoid a naming conflict.
