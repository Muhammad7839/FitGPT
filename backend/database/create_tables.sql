-- create_tables.sql
-- Creates all FitGPT database tables in PostgreSQL.
-- Run this first before any other SQL scripts.

CREATE TABLE IF NOT EXISTS users (
    id                  SERIAL PRIMARY KEY,
    email               VARCHAR NOT NULL UNIQUE,
    hashed_password     VARCHAR NOT NULL,
    body_type           VARCHAR NOT NULL DEFAULT 'unspecified',
    lifestyle           VARCHAR NOT NULL DEFAULT 'casual',
    comfort_preference  VARCHAR NOT NULL DEFAULT 'medium',
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS clothing_items (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR NOT NULL,
    category    VARCHAR NOT NULL,
    color       VARCHAR NOT NULL,
    fit_type    VARCHAR NOT NULL DEFAULT 'regular',
    style_tag   VARCHAR NOT NULL DEFAULT 'casual',
    image_url   VARCHAR,
    is_deleted  BOOLEAN NOT NULL DEFAULT FALSE,
    archived    BOOLEAN NOT NULL DEFAULT FALSE,
    owner_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS saved_outfits (
    id            SERIAL PRIMARY KEY,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    top_id        INTEGER NOT NULL REFERENCES clothing_items(id),
    bottom_id     INTEGER NOT NULL REFERENCES clothing_items(id),
    shoes_id      INTEGER REFERENCES clothing_items(id),
    outerwear_id  INTEGER REFERENCES clothing_items(id),
    accessory_id  INTEGER REFERENCES clothing_items(id),
    created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS outfit_history (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    saved_outfit_id INTEGER NOT NULL REFERENCES saved_outfits(id) ON DELETE CASCADE,
    worn_at         TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS planner_items (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    saved_outfit_id INTEGER NOT NULL REFERENCES saved_outfits(id) ON DELETE CASCADE,
    planned_date    DATE NOT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
