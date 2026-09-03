import type { Video, VideoStatus } from "../../../modules/media/video";
import type { VideoRepository } from "../../../modules/media/video.repository";

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results?: T[] }>;
  run(): Promise<unknown>;
}

export interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatement;
}

interface VideoRow {
  id: string;
  creator_id: string;
  channel_id: string;
  provider_asset_id: string | null;
  slug: string;
  title: string;
  description: string | null;
  status: VideoStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export class D1VideoRepository implements VideoRepository {
  constructor(private readonly db: D1DatabaseLike) {}

  async findById(id: string): Promise<Video | null> {
    return this.findOne("SELECT * FROM videos WHERE id = ? LIMIT 1", id);
  }

  async findBySlug(slug: string): Promise<Video | null> {
    return this.findOne("SELECT * FROM videos WHERE slug = ? LIMIT 1", slug);
  }

  async findByProviderAssetId(providerAssetId: string): Promise<Video | null> {
    return this.findOne(
      "SELECT * FROM videos WHERE provider_asset_id = ? LIMIT 1",
      providerAssetId,
    );
  }

  async listByChannel(channelId: string): Promise<Video[]> {
    return this.findMany(
      "SELECT * FROM videos WHERE channel_id = ? ORDER BY created_at DESC",
      channelId,
    );
  }

  async listByStatus(status: VideoStatus): Promise<Video[]> {
    return this.findMany(
      "SELECT * FROM videos WHERE status = ? ORDER BY created_at DESC",
      status,
    );
  }

  async save(video: Video): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO videos (
          id, creator_id, channel_id, provider_asset_id, slug, title,
          description, status, published_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          creator_id = excluded.creator_id,
          channel_id = excluded.channel_id,
          provider_asset_id = excluded.provider_asset_id,
          slug = excluded.slug,
          title = excluded.title,
          description = excluded.description,
          status = excluded.status,
          published_at = excluded.published_at,
          updated_at = excluded.updated_at`,
      )
      .bind(
        video.id,
        video.creatorId,
        video.channelId,
        video.providerAssetId ?? null,
        video.slug,
        video.title,
        video.description ?? null,
        video.status,
        video.publishedAt ?? null,
        video.createdAt,
        video.updatedAt,
      )
      .run();
  }

  private async findOne(query: string, value: string): Promise<Video | null> {
    const row = await this.db.prepare(query).bind(value).first<VideoRow>();
    return row ? mapRow(row) : null;
  }

  private async findMany(query: string, value: string): Promise<Video[]> {
    const result = await this.db.prepare(query).bind(value).all<VideoRow>();
    return (result.results ?? []).map(mapRow);
  }
}

function mapRow(row: VideoRow): Video {
  return {
    id: row.id,
    creatorId: row.creator_id,
    channelId: row.channel_id,
    providerAssetId: row.provider_asset_id ?? undefined,
    slug: row.slug,
    title: row.title,
    description: row.description ?? undefined,
    status: row.status,
    publishedAt: row.published_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
