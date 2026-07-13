-- =============================================================================
-- GEU Alumni Connect — PostgreSQL Schema (full)
-- Run on a fresh DB:  psql -U postgres -d geu_alumni -f schema.sql
-- For an EXISTING DB created from the older schema, run migrations.sql instead.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Users (auth) ────────────────────────────────────────────────────────────
-- A row in `users` ALWAYS represents an approved, active alumnus.
-- Pending sign-up requests live in `pending_registrations` until an admin acts.
CREATE TABLE IF NOT EXISTS users (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email                 VARCHAR(255) UNIQUE NOT NULL,
  username              VARCHAR(64)  UNIQUE NOT NULL,
  password_hash         VARCHAR(255) NOT NULL,
  is_admin              BOOLEAN     NOT NULL DEFAULT FALSE,
  is_super_admin        BOOLEAN     NOT NULL DEFAULT FALSE,
  must_change_password  BOOLEAN     NOT NULL DEFAULT FALSE,
  last_seen             TIMESTAMP   DEFAULT NOW(),
  last_ip               VARCHAR(45),
  created_at            TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- ─── Profiles ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  full_name       VARCHAR(255) NOT NULL DEFAULT '',
  headline        VARCHAR(500),
  bio             TEXT,
  graduation_year INTEGER,
  course          VARCHAR(255),
  student_id      VARCHAR(64),
  avatar_url      VARCHAR(1000),
  resume_url      VARCHAR(1000),
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

-- ─── Pending registrations (signup approval queue) ──────────────────────────
CREATE TABLE IF NOT EXISTS pending_registrations (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email               VARCHAR(255) UNIQUE NOT NULL,
  full_name           VARCHAR(255) NOT NULL,
  graduation_year     INTEGER,
  course              VARCHAR(255),
  student_id          VARCHAR(64),
  reason              TEXT,
  verification_doc_url VARCHAR(1000) NOT NULL,
  status              VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
  reviewed_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at         TIMESTAMP,
  rejection_reason    TEXT,
  created_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─── OTPs (password change & reset) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS otps (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash   VARCHAR(255) NOT NULL,
  purpose     VARCHAR(40)  NOT NULL,  -- 'change_password' | 'reset_password'
  expires_at  TIMESTAMP    NOT NULL,
  used        BOOLEAN      NOT NULL DEFAULT FALSE,
  attempts    INTEGER      NOT NULL DEFAULT 0,
  created_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS otps_user_purpose_idx ON otps (user_id, purpose);

-- ─── Posts (feed) ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS posts (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL DEFAULT '',
  image_url  VARCHAR(1000),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS post_likes (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id    UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

CREATE TABLE IF NOT EXISTS comments (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id    UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ─── Connections ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS connections (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_id UUID REFERENCES users(id) ON DELETE CASCADE,
  addressee_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status       VARCHAR(20) DEFAULT 'pending',  -- pending | accepted
  created_at   TIMESTAMP DEFAULT NOW(),
  UNIQUE(requester_id, addressee_id)
);

-- ─── Messages (1-to-1) ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id   UUID REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  read        BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- ─── Communities ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS communities (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(255) NOT NULL,
  description   TEXT,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  chat_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS community_members (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  community_id  UUID REFERENCES communities(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  role          VARCHAR(20) NOT NULL DEFAULT 'member',  -- admin | moderator | member
  can_chat      BOOLEAN NOT NULL DEFAULT TRUE,
  joined_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (community_id, user_id)
);

CREATE TABLE IF NOT EXISTS community_messages (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  community_id  UUID REFERENCES communities(id) ON DELETE CASCADE,
  sender_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─── Community posts (admin announcements, like WhatsApp Communities) ───────
CREATE TABLE IF NOT EXISTS community_posts (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  community_id  UUID REFERENCES communities(id) ON DELETE CASCADE,
  author_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  title         VARCHAR(300),
  content       TEXT NOT NULL,
  image_url     VARCHAR(1000),
  pinned        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS community_post_likes (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id       UUID REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS community_post_comments (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id       UUID REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─── Jobs ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jobs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  posted_by     UUID REFERENCES users(id) ON DELETE CASCADE,
  title         VARCHAR(255) NOT NULL,
  company       VARCHAR(255) NOT NULL,
  location      VARCHAR(255),
  job_type      VARCHAR(40),                  -- full-time | part-time | contract | internship | remote
  experience    VARCHAR(40),
  salary        VARCHAR(100),
  description   TEXT NOT NULL,
  apply_url     VARCHAR(1000),
  apply_email   VARCHAR(255),
  is_open       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS jobs_open_created_idx ON jobs (is_open, created_at DESC);
