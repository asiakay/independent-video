import type {
  CreateUploadInput,
  CreateUploadResult,
  MediaProvider,
  PlaybackSource,
} from "../../../modules/media/providers/provider";

export interface CloudflareStreamConfig {
  accountId: string;
  apiToken: string;
  customerCode: string;
  apiBaseUrl?: string;
}

interface CloudflareEnvelope<T> {
  success: boolean;
  errors?: Array<{ code?: number; message?: string }>;
  result: T;
}

interface DirectUploadResult {
  uid: string;
  uploadURL: string;
}

export class CloudflareStreamAdapter implements MediaProvider {
  private readonly apiBaseUrl: string;

  constructor(private readonly config: CloudflareStreamConfig) {
    this.apiBaseUrl = config.apiBaseUrl ?? "https://api.cloudflare.com/client/v4";
  }

  async createUpload(input: CreateUploadInput): Promise<CreateUploadResult> {
    const result = await this.request<DirectUploadResult>(
      `/accounts/${this.config.accountId}/stream/direct_upload`,
      {
        method: "POST",
        body: JSON.stringify({
          maxDurationSeconds: input.maxDurationSeconds ?? 3600,
          meta: {
            creatorId: input.creatorId,
            channelId: input.channelId,
            ...(input.filename ? { filename: input.filename } : {}),
          },
        }),
      },
    );

    return {
      providerAssetId: result.uid,
      uploadUrl: result.uploadURL,
    };
  }

  async getPlaybackSource(providerAssetId: string): Promise<PlaybackSource> {
    await this.request(`/accounts/${this.config.accountId}/stream/${providerAssetId}`);

    const base = `https://customer-${this.config.customerCode}.cloudflarestream.com/${providerAssetId}/manifest`;

    return {
      providerAssetId,
      hlsUrl: `${base}/video.m3u8`,
      dashUrl: `${base}/video.mpd`,
    };
  }

  async deleteAsset(providerAssetId: string): Promise<void> {
    await this.request(`/accounts/${this.config.accountId}/stream/${providerAssetId}`, {
      method: "DELETE",
    });
  }

  private async request<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.apiBaseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.config.apiToken}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });

    const payload = (await response.json()) as CloudflareEnvelope<T>;

    if (!response.ok || !payload.success) {
      const detail = payload.errors?.map((error) => error.message).filter(Boolean).join("; ");
      throw new Error(`Cloudflare Stream request failed${detail ? `: ${detail}` : ""}`);
    }

    return payload.result;
  }
}
