import { D1VideoRepository, type D1DatabaseLike } from "../../infrastructure/cloudflare/d1/video.repository";
import { CloudflareStreamAdapter } from "../../infrastructure/cloudflare/stream/cloudflare-stream";
import type { Video, VideoStatus } from "../../modules/media/video";

interface Env {
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_STREAM_API_TOKEN: string;
  CLOUDFLARE_STREAM_CUSTOMER_CODE: string;
  DB: D1DatabaseLike;
}

interface UploadRequestBody {
  title?: string;
  description?: string;
  filename?: string;
  maxDurationSeconds?: number;
}

const CREATOR_ID = "creator_001";
const CHANNEL_ID = "channel_001";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/api/uploads") {
      return handleCreateUpload(request, env);
    }

    if (request.method === "GET" && url.pathname === "/api/videos") {
      return handleListVideos(env);
    }

    if (request.method === "POST" && url.pathname.startsWith("/api/videos/") && url.pathname.endsWith("/sync")) {
      const value = decodeURIComponent(
        url.pathname.slice("/api/videos/".length, -"/sync".length),
      );
      return handleSyncVideo(value, env);
    }

    if (request.method === "POST" && url.pathname.startsWith("/api/videos/") && url.pathname.endsWith("/publish")) {
      const value = decodeURIComponent(
        url.pathname.slice("/api/videos/".length, -"/publish".length),
      );
      return handlePublishVideo(value, env);
    }

    if (request.method === "GET" && url.pathname.startsWith("/api/playback/")) {
      const value = decodeURIComponent(url.pathname.slice("/api/playback/".length));
      return handleGetPlayback(value, env);
    }

    if (request.method === "GET" && url.pathname.startsWith("/api/videos/")) {
      const value = decodeURIComponent(url.pathname.slice("/api/videos/".length));
      return handleGetVideo(value, env);
    }

    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true });
    }

    return json({ error: "Not found" }, 404);
  },
};

async function handleCreateUpload(request: Request, env: Env): Promise<Response> {
  try {
    assertEnv(env);

    const body = await readJson<UploadRequestBody>(request);
    const videos = new D1VideoRepository(env.DB);
    const media = createMedia(env);

    const videoId = `video_${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const title = body.title?.trim() || body.filename?.trim() || "Untitled video";
    const slug = await createUniqueSlug(videos, title, videoId);

    const video: Video = {
      id: videoId,
      creatorId: CREATOR_ID,
      channelId: CHANNEL_ID,
      slug,
      title,
      description: body.description?.trim() || undefined,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    };

    await videos.save(video);

    try {
      const upload = await media.createUpload({
        creatorId: CREATOR_ID,
        channelId: CHANNEL_ID,
        filename: body.filename,
        maxDurationSeconds: body.maxDurationSeconds,
      });

      video.providerAssetId = upload.providerAssetId;
      video.status = "uploading";
      video.updatedAt = new Date().toISOString();
      await videos.save(video);

      return json(
        {
          videoId: video.id,
          slug: video.slug,
          creatorId: video.creatorId,
          channelId: video.channelId,
          status: video.status,
          uploadUrl: upload.uploadUrl,
        },
        201,
      );
    } catch (error) {
      video.status = "failed";
      video.updatedAt = new Date().toISOString();
      await videos.save(video);
      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected upload error";
    return json({ error: message }, 500);
  }
}

async function handleListVideos(env: Env): Promise<Response> {
  try {
    assertDatabase(env);
    const videos = new D1VideoRepository(env.DB);
    const items = await videos.listByChannel(CHANNEL_ID);

    return json({
      creatorId: CREATOR_ID,
      channelId: CHANNEL_ID,
      videos: items.map(toVideoResource),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected catalog error";
    return json({ error: message }, 500);
  }
}

async function handleGetVideo(value: string, env: Env): Promise<Response> {
  try {
    assertDatabase(env);

    const video = await findVideo(value, env);
    if (!video) {
      return json({ error: "Video not found" }, 404);
    }

    return json({ video: toVideoResource(video) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected catalog error";
    return json({ error: message }, 500);
  }
}

async function handleSyncVideo(value: string, env: Env): Promise<Response> {
  try {
    assertEnv(env);

    const videos = new D1VideoRepository(env.DB);
    const video = await findVideo(value, env);

    if (!video) {
      return json({ error: "Video not found" }, 404);
    }

    if (!video.providerAssetId) {
      return json({ error: "Video has no media provider asset" }, 409);
    }

    if (video.status === "published") {
      return json({ video: toVideoResource(video) });
    }

    const providerStatus = await createMedia(env).getAssetStatus(video.providerAssetId);
    const nextStatus = mapProviderStatus(providerStatus.state, providerStatus.readyToStream);

    if (nextStatus !== video.status) {
      video.status = nextStatus;
      video.updatedAt = new Date().toISOString();
      await videos.save(video);
    }

    return json({
      video: toVideoResource(video),
      processing: {
        state: providerStatus.state,
        pctComplete: providerStatus.pctComplete ?? null,
        errorReasonCode: providerStatus.errorReasonCode ?? null,
        errorReasonText: providerStatus.errorReasonText ?? null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected status sync error";
    return json({ error: message }, 500);
  }
}

async function handlePublishVideo(value: string, env: Env): Promise<Response> {
  try {
    assertEnv(env);

    const videos = new D1VideoRepository(env.DB);
    const video = await findVideo(value, env);

    if (!video) {
      return json({ error: "Video not found" }, 404);
    }

    if (video.status === "published") {
      return json({ video: toVideoResource(video) });
    }

    if (!video.providerAssetId) {
      return json({ error: "Video has no media provider asset" }, 409);
    }

    const providerStatus = await createMedia(env).getAssetStatus(video.providerAssetId);
    if (!providerStatus.readyToStream && providerStatus.state !== "ready") {
      return json(
        {
          error: "Video is not ready to publish",
          status: mapProviderStatus(providerStatus.state, providerStatus.readyToStream),
        },
        409,
      );
    }

    const now = new Date().toISOString();
    video.status = "published";
    video.publishedAt = now;
    video.updatedAt = now;
    await videos.save(video);

    const playback = await createMedia(env).getPlaybackSource(video.providerAssetId);

    return json({
      video: toVideoResource(video),
      playback: {
        hlsUrl: playback.hlsUrl ?? null,
        dashUrl: playback.dashUrl ?? null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected publish error";
    return json({ error: message }, 500);
  }
}

async function handleGetPlayback(value: string, env: Env): Promise<Response> {
  try {
    assertEnv(env);

    const video = await findVideo(value, env);
    if (!video || video.status !== "published") {
      return json({ error: "Published video not found" }, 404);
    }

    if (!video.providerAssetId) {
      return json({ error: "Video has no media provider asset" }, 409);
    }

    const playback = await createMedia(env).getPlaybackSource(video.providerAssetId);

    return json({
      video: toVideoResource(video),
      playback: {
        hlsUrl: playback.hlsUrl ?? null,
        dashUrl: playback.dashUrl ?? null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected playback error";
    return json({ error: message }, 500);
  }
}

async function findVideo(value: string, env: Env): Promise<Video | null> {
  if (!value) {
    return null;
  }

  const videos = new D1VideoRepository(env.DB);
  const video = value.startsWith("video_")
    ? await videos.findById(value)
    : await videos.findBySlug(value);

  return video && video.channelId === CHANNEL_ID ? video : null;
}

function mapProviderStatus(state: string, readyToStream: boolean): VideoStatus {
  if (state === "error") {
    return "failed";
  }

  if (readyToStream || state === "ready") {
    return "ready";
  }

  if (state === "pendingupload") {
    return "uploading";
  }

  return "processing";
}

function createMedia(env: Env): CloudflareStreamAdapter {
  return new CloudflareStreamAdapter({
    accountId: env.CLOUDFLARE_ACCOUNT_ID,
    apiToken: env.CLOUDFLARE_STREAM_API_TOKEN,
    customerCode: env.CLOUDFLARE_STREAM_CUSTOMER_CODE,
  });
}

function toVideoResource(video: Video) {
  return {
    id: video.id,
    creatorId: video.creatorId,
    channelId: video.channelId,
    slug: video.slug,
    title: video.title,
    description: video.description ?? null,
    status: video.status,
    publishedAt: video.publishedAt ?? null,
    createdAt: video.createdAt,
    updatedAt: video.updatedAt,
  };
}

async function createUniqueSlug(
  videos: D1VideoRepository,
  title: string,
  videoId: string,
): Promise<string> {
  const base = slugify(title) || "video";
  if (!(await videos.findBySlug(base))) {
    return base;
  }

  return `${base}-${videoId.replace("video_", "").slice(0, 8)}`;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function readJson<T>(request: Request): Promise<T> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return {} as T;
  }

  return (await request.json()) as T;
}

function assertDatabase(env: Env): void {
  if (!env.DB) {
    throw new Error("Missing environment binding: DB");
  }
}

function assertEnv(env: Env): void {
  const required: Array<keyof Env> = [
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_STREAM_API_TOKEN",
    "CLOUDFLARE_STREAM_CUSTOMER_CODE",
    "DB",
  ];

  const missing = required.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing environment bindings: ${missing.join(", ")}`);
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}
