export type VideoId = string;

export type VideoStatus =
  | "draft"
  | "uploading"
  | "processing"
  | "ready"
  | "published"
  | "failed";

export interface Video {
  id: VideoId;
  creatorId: string;
  channelId: string;
  providerAssetId?: string;
  slug: string;
  title: string;
  description?: string;
  status: VideoStatus;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}
