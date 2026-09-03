export interface CreateUploadInput {
  creatorId: string;
  channelId: string;
  filename?: string;
  maxDurationSeconds?: number;
}

export interface CreateUploadResult {
  providerAssetId: string;
  uploadUrl: string;
}

export interface PlaybackSource {
  providerAssetId: string;
  hlsUrl?: string;
  dashUrl?: string;
}

export interface MediaProvider {
  createUpload(input: CreateUploadInput): Promise<CreateUploadResult>;
  getPlaybackSource(providerAssetId: string): Promise<PlaybackSource>;
  deleteAsset(providerAssetId: string): Promise<void>;
}
