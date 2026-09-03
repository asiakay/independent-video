-- Deterministic local/bootstrap identities for the first creator and channel.
-- These are internal platform IDs, not Cloudflare/provider IDs.

INSERT OR IGNORE INTO creators (
  id,
  handle,
  display_name,
  created_at,
  updated_at
) VALUES (
  'creator_001',
  'asiakay',
  'Asia K',
  '2026-09-03T00:00:00.000Z',
  '2026-09-03T00:00:00.000Z'
);

INSERT OR IGNORE INTO channels (
  id,
  creator_id,
  slug,
  title,
  created_at,
  updated_at
) VALUES (
  'channel_001',
  'creator_001',
  'asiakay',
  'Asia K',
  '2026-09-03T00:00:00.000Z',
  '2026-09-03T00:00:00.000Z'
);
