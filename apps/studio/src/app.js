const form = document.querySelector('#upload-form');
const workflow = document.querySelector('#workflow');
const statusEl = document.querySelector('#status');
const progressEl = document.querySelector('#progress');
const syncButton = document.querySelector('#sync');
const publishButton = document.querySelector('#publish');
const resultEl = document.querySelector('#result');

let currentVideoId = null;
let currentSlug = null;

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const fileInput = document.querySelector('#file');
  const titleInput = document.querySelector('#title');
  const descriptionInput = document.querySelector('#description');
  const file = fileInput.files?.[0];

  if (!file) return;

  workflow.hidden = false;
  publishButton.disabled = true;
  setStatus('Reading video duration…', 2);

  try {
    const durationSeconds = await getVideoDurationSeconds(file);
    const maxDurationSeconds = Math.max(10, Math.ceil(durationSeconds) + 5);

    setStatus(`Creating video record… (${Math.ceil(durationSeconds)}s video)`, 5);

    const createResponse = await fetch('/api/uploads', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: titleInput.value,
        description: descriptionInput.value,
        filename: file.name,
        maxDurationSeconds,
      }),
    });

    const created = await readJson(createResponse);
    if (!createResponse.ok) throw new Error(created.error || 'Could not create upload');

    currentVideoId = created.videoId;
    currentSlug = created.slug;
    setStatus('Uploading directly to video storage…', 20);

    const uploadResponse = await fetch(created.uploadUrl, {
      method: 'POST',
      body: file,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Video upload failed (${uploadResponse.status})`);
    }

    setStatus('Upload complete. Cloudflare is processing the video.', 60);
    render({
      videoId: currentVideoId,
      slug: currentSlug,
      status: 'processing',
      durationSeconds,
      maxDurationSeconds,
    });
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Unexpected upload error', 0);
  }
});

syncButton.addEventListener('click', async () => {
  if (!currentVideoId) return;

  setStatus('Checking processing status…', progressEl.value || 60);

  try {
    const response = await fetch(`/api/videos/${encodeURIComponent(currentVideoId)}/sync`, {
      method: 'POST',
    });
    const data = await readJson(response);
    if (!response.ok) throw new Error(data.error || 'Could not sync video status');

    const pct = Number(data.processing?.pctComplete ?? 0);
    const video = data.video;
    setStatus(`Status: ${video.status}`, video.status === 'ready' ? 100 : Math.max(60, pct));
    publishButton.disabled = video.status !== 'ready';
    render(data);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Unexpected status error', progressEl.value);
  }
});

publishButton.addEventListener('click', async () => {
  if (!currentVideoId) return;

  setStatus('Publishing…', 100);

  try {
    const response = await fetch(`/api/videos/${encodeURIComponent(currentVideoId)}/publish`, {
      method: 'POST',
    });
    const data = await readJson(response);
    if (!response.ok) throw new Error(data.error || 'Could not publish video');

    setStatus('Published.', 100);
    publishButton.disabled = true;
    render(data);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Unexpected publish error', progressEl.value);
  }
});

function getVideoDurationSeconds(file) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(file);

    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const duration = video.duration;
      URL.revokeObjectURL(objectUrl);

      if (!Number.isFinite(duration) || duration <= 0) {
        reject(new Error('Could not determine video duration.'));
        return;
      }

      resolve(duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read video metadata.'));
    };
    video.src = objectUrl;
  });
}

function setStatus(message, progress) {
  statusEl.textContent = message;
  progressEl.value = Number(progress) || 0;
}

function render(value) {
  resultEl.textContent = JSON.stringify(value, null, 2);
}

async function readJson(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { error: text || `Request failed (${response.status})` };
  }
}
