import { D1VideoRepository, type D1DatabaseLike } from "../../infrastructure/cloudflare/d1/video.repository";
import { CloudflareStreamAdapter } from "../../infrastructure/cloudflare/stream/cloudflare-stream";
import type { Video } from "../../modules/media/video";

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
    const media = new CloudflareStreamAdapter({
      accountId: env.CLOUDFLARE_ACCOUNT_ID,
      apiToken: env.CLOUDFLARE_STREAM_API_TOKEN,
      customerCode: env.CLOUDFLARE_STREAM_CUSTOMER_CODE,
    });

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
