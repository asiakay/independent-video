-- Commit 005: video persistence
-- Internal video identity remains canonical; provider asset IDs are implementation details.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  provider_asset_id TEXT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN (
    'draft',
    'uploading',
    'processing',
    'ready',
    'published',
    'failed'
  )),
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (creator_id) REFERENCES creators(id) ON DELETE CASCADE,
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_videos_creator_id
  ON videos(creator_id);

CREATE INDEX IF NOT EXISTS idx_videos_channel_id
  ON videos(channel_id);

CREATE INDEX IF NOT EXISTS idx_videos_status
  ON videos(status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_videos_provider_asset_id
  ON videos(provider_asset_id)
  WHERE provider_asset_id IS NOT NULL;
