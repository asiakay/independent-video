import type { Video, VideoId, VideoStatus } from "./video";

export interface VideoRepository {
  findById(id: VideoId): Promise<Video | null>;
  findBySlug(slug: string): Promise<Video | null>;
  findByProviderAssetId(providerAssetId: string): Promise<Video | null>;
  listByChannel(channelId: string): Promise<Video[]>;
  listByStatus(status: VideoStatus): Promise<Video[]>;
  save(video: Video): Promise<void>;
}
