import { CloudflareStreamAdapter } from "../../infrastructure/cloudflare/stream/cloudflare-stream";

interface Env {
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_STREAM_API_TOKEN: string;
  CLOUDFLARE_STREAM_CUSTOMER_CODE: string;
}

interface UploadRequestBody {
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
    const media = new CloudflareStreamAdapter({
      accountId: env.CLOUDFLARE_ACCOUNT_ID,
      apiToken: env.CLOUDFLARE_STREAM_API_TOKEN,
      customerCode: env.CLOUDFLARE_STREAM_CUSTOMER_CODE,
    });

    const upload = await media.createUpload({
      creatorId: CREATOR_ID,
      channelId: CHANNEL_ID,
      filename: body.filename,
      maxDurationSeconds: body.maxDurationSeconds,
    });

    return json(
      {
        creatorId: CREATOR_ID,
        channelId: CHANNEL_ID,
        providerAssetId: upload.providerAssetId,
        uploadUrl: upload.uploadUrl,
      },
      201,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected upload error";
    return json({ error: message }, 500);
  }
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
  ];

  const missing = required.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(", ")}`);
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
