import * as RNFS from '@dr.pogodin/react-native-fs';

const OPENAI_WHISPER_URL = 'https://api.openai.com/v1/audio/transcriptions';

function getApiKey(): string | undefined {
  try {
    const Config = require('react-native-config').default;
    const fromConfig = Config?.OPENAI_API_KEY ?? undefined;
    if (fromConfig && typeof fromConfig === 'string' && fromConfig.trim() !== '') {
      return fromConfig.trim();
    }
    const fromEnv = typeof process !== 'undefined' && (process as any).env?.OPENAI_API_KEY;
    if (fromEnv && typeof fromEnv === 'string' && fromEnv.trim() !== '') {
      return fromEnv.trim();
    }
  } catch {
    // ignore
  }
  return undefined;
}

/**
 * Transcribe a WAV file using OpenAI Whisper API (online).
 * Requires OPENAI_API_KEY in .env / react-native-config.
 */
export async function transcribeWithWhisperApi(wavPath: string): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey || apiKey.trim() === '') {
    throw new Error(
      'OPENAI_API_KEY is not set. Add OPENAI_API_KEY to .env in the project root, then rebuild the app (e.g. yarn android or build release).',
    );
  }

  const exists = await RNFS.exists(wavPath);
  if (!exists) {
    throw new Error('Recording file not found.');
  }

  let fileSize = 0;
  try {
    const stat = await RNFS.stat(wavPath);
    fileSize = stat?.size ?? 0;
  } catch {
    // ignore
  }
  if (__DEV__) {
    console.log('[OnlineSTT] File exists, size:', fileSize, 'path:', wavPath);
  }
  if (fileSize < 1000) {
    throw new Error('Recording file too small – speak longer then tap mic again.');
  }

  // FormData file: use file:// URI
  const uri = wavPath.startsWith('file://') ? wavPath : `file://${wavPath}`;
  const formData = new FormData();
  formData.append('file', {
    uri,
    type: 'audio/wav',
    name: 'recording.wav',
  } as any);
  formData.append('model', 'whisper-1');
  formData.append('language', 'en');

  if (__DEV__) console.log('[OnlineSTT] Uploading to Whisper API...');
  const response = await fetch(OPENAI_WHISPER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      // Do not set Content-Type; fetch will set multipart/form-data with boundary
    },
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `Whisper API error ${response.status}: ${errText || response.statusText}`,
    );
  }

  const json = (await response.json()) as { text?: string };
  const text = (json.text ?? '').trim();
  if (__DEV__) console.log('[OnlineSTT] Result:', text ? `${text.slice(0, 50)}...` : '(empty)');
  try {
    if (wavPath && (await RNFS.exists(wavPath))) {
      await RNFS.unlink(wavPath);
      if (__DEV__) console.log('[OnlineSTT] Recording file deleted');
    }
  } catch {
    // ignore cleanup errors
  }
  return text;
}

export function isOnlineSttConfigured(): boolean {
  const key = getApiKey();
  return !!key && key.trim() !== '';
}
