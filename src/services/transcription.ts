const API_BASE = import.meta.env.VITE_WHISPER_BASE_URL || 'http://localhost:5005';

export interface TranscriptionSegment {
  start?: number;
  end?: number;
  text: string;
}

export interface TranscriptionResponse {
  text: string;
  detected_language?: string;
  duration?: number;
  segments?: TranscriptionSegment[];
}

export async function transcribeBlob(blob: Blob): Promise<TranscriptionResponse> {
  const form = new FormData();
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const ext = inferExtensionFromMime(blob.type) || 'webm';
  form.append('file', blob, `segment-${ts}.${ext}`);

  const res = await fetch(`${API_BASE}/transcribe`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    const msg = await safeError(res);
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return res.json();
}

function inferExtensionFromMime(mime: string): string | null {
  if (!mime) return null;
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('mp4')) return 'm4a';
  if (mime.includes('mpeg')) return 'mp3';
  return null;
}

async function safeError(res: Response): Promise<string | null> {
  try {
    const data = await res.json();
    return data?.error || null;
  } catch {
    try {
      const text = await res.text();
      return text || null;
    } catch {
      return null;
    }
  }
}
