#!/usr/bin/env node
// End-to-end smoke test for the first publishing flow:
//   Studio-style upload -> Stream processing -> D1 publish -> HLS manifest plays.
//
// Usage: node scripts/smoke-publish.mjs <baseUrl> <clip.mp4>
// Writes video_id / slug / hls_url / provider-free facts to $GITHUB_OUTPUT when set.

import { readFile, appendFile } from 'node:fs/promises';
import { basename } from 'node:path';

const [baseUrl, clipPath] = process.argv.slice(2);
if (!baseUrl || !clipPath) {
  console.error('Usage: node scripts/smoke-publish.mjs <baseUrl> <clip.mp4>');
  process.exit(2);
}

const PROCESSING_TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS ?? 5 * 60_000);
const POLL_MS = 5_000;
const api = (path) => new URL(path, baseUrl).toString();

function step(name) {
  console.log(`\n▶ ${name}`);
}

function assert(condition, message, detail) {
  if (!condition) {
    console.error(`✗ ${message}`);
    if (detail !== undefined) console.error(typeof detail === 'string' ? detail : JSON.stringify(detail, null, 2));
    process.exit(1);
  }
  console.log(`✓ ${message}`);
}

async function getJson(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  return { response, body };
}

async function output(key, value) {
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
}

// 1. Worker is up
step('Worker health');
{
  const { response } = await getJson(api('/health'));
  assert(response.ok, `GET /health -> ${response.status}`);
}

// 2. Create the upload exactly as Studio does
step('Create upload (D1 draft + Stream direct upload URL)');
const clip = await readFile(clipPath);
const runTag = process.env.GITHUB_RUN_ID ?? Date.now();
const { response: createRes, body: created } = await getJson(api('/api/uploads'), {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    title: `smoke-test-${runTag}`,
    description: 'Automated publishing-flow smoke test. Safe to delete.',
    filename: basename(clipPath),
    maxDurationSeconds: 30,
  }),
});
assert(createRes.status === 201, `POST /api/uploads -> ${createRes.status}`, created);
assert(typeof created.uploadUrl === 'string' && created.uploadUrl.startsWith('https://'), 'received a Stream upload URL');
const { videoId, slug } = created;
await output('video_id', videoId);
await output('slug', slug);
console.log(`  videoId=${videoId} slug=${slug}`);

// 3. Upload as multipart/form-data with a "file" field (mirrors apps/studio/src/app.js)
step('Direct upload to Stream (multipart "file" field)');
{
  const form = new FormData();
  form.append('file', new Blob([clip], { type: 'video/mp4' }), basename(clipPath));
  const res = await fetch(created.uploadUrl, { method: 'POST', body: form });
  const text = await res.text();
  assert(res.ok, `POST uploadUrl -> ${res.status}`, text);
}

// 4. Poll sync until Stream reports ready
step('Wait for Stream processing');
let synced;
{
  const deadline = Date.now() + PROCESSING_TIMEOUT_MS;
  for (;;) {
    const { response, body } = await getJson(api(`/api/videos/${encodeURIComponent(videoId)}/sync`), { method: 'POST' });
    if (!response.ok) assert(false, `POST /sync -> ${response.status}`, body);
    const status = body.video?.status;
    console.log(`  status=${status} state=${body.processing?.state} pct=${body.processing?.pctComplete}`);
    if (status === 'ready') { synced = body; break; }
    if (status === 'failed') assert(false, 'Stream reported a processing error', body.processing);
    if (Date.now() >= deadline) assert(false, `processing did not finish within ${PROCESSING_TIMEOUT_MS / 1000}s`, body);
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  assert(synced.video.status === 'ready', 'Stream processed the clip (status=ready)');
}

// 5. Publish
step('Publish');
const { response: pubRes, body: published } = await getJson(api(`/api/videos/${encodeURIComponent(videoId)}/publish`), { method: 'POST' });
assert(pubRes.ok, `POST /publish -> ${pubRes.status}`, published);
assert(published.video?.status === 'published', 'publish response status=published', published.video);
assert(typeof published.playback?.hlsUrl === 'string', 'publish response includes an HLS URL', published.playback);

// 6. Read back from D1 through the API (fresh request, not the publish response)
step('Read back from D1');
{
  const { response, body } = await getJson(api(`/api/videos/${encodeURIComponent(videoId)}`));
  assert(response.ok, `GET /api/videos/:id -> ${response.status}`, body);
  assert(body.video.status === 'published', 'D1 record status=published', body.video);
  assert(!!body.video.publishedAt, `D1 record has publishedAt (${body.video.publishedAt})`);
}

// 7. Public playback endpoint by slug
step('Playback endpoint by slug');
const { response: playRes, body: playback } = await getJson(api(`/api/playback/${encodeURIComponent(slug)}`));
assert(playRes.ok, `GET /api/playback/:slug -> ${playRes.status}`, playback);
const hlsUrl = playback.playback.hlsUrl;
assert(hlsUrl === published.playback.hlsUrl, 'playback HLS URL matches publish response');
await output('hls_url', hlsUrl);
console.log(`  ${hlsUrl}`);

// 8. Manifest is a real, fetchable HLS ladder with segments
step('HLS manifest');
{
  const masterRes = await fetch(hlsUrl);
  const master = await masterRes.text();
  assert(masterRes.ok, `GET master manifest -> ${masterRes.status}`, master.slice(0, 500));
  assert(master.startsWith('#EXTM3U'), 'master manifest starts with #EXTM3U', master.slice(0, 200));
  assert(master.includes('#EXT-X-STREAM-INF'), 'master manifest lists variant streams');

  const variantLine = master.split('\n').map((l) => l.trim()).find((l) => l && !l.startsWith('#'));
  const variantUrl = new URL(variantLine, hlsUrl).toString();
  const variantRes = await fetch(variantUrl);
  const variant = await variantRes.text();
  assert(variantRes.ok && variant.includes('#EXTINF'), `variant playlist has segments (${variantRes.status})`, variant.slice(0, 300));

  const segLine = variant.split('\n').map((l) => l.trim()).find((l) => l && !l.startsWith('#'));
  const segRes = await fetch(new URL(segLine, variantUrl));
  const seg = new Uint8Array(await segRes.arrayBuffer());
  assert(segRes.ok && seg.byteLength > 0, `first media segment fetched (${seg.byteLength} bytes)`);
}

console.log('\n✅ Publishing flow verified: upload → Stream → D1 published → manifest served.');
