/**
 * Read a WAV file once and return PCM as 16-bit mono 16 kHz ArrayBuffer
 * for use with whisper.rn transcribeData (avoids repeated file load per chunk).
 */

const TARGET_SAMPLE_RATE = 16000;

export interface WavInfo {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  dataOffset: number;
  dataSize: number;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Parse WAV header; returns offset and size of raw PCM data and format.
 */
function parseWavHeader(data: Uint8Array): WavInfo {
  if (data.length < 44) throw new Error('WAV file too short');
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const riff = String.fromCharCode(...data.slice(0, 4));
  if (riff !== 'RIFF') throw new Error('Invalid WAV: missing RIFF');
  const wave = String.fromCharCode(...data.slice(8, 12));
  if (wave !== 'WAVE') throw new Error('Invalid WAV: missing WAVE');
  const fmt = String.fromCharCode(...data.slice(12, 16));
  if (fmt !== 'fmt ') throw new Error('Invalid WAV: missing fmt chunk');
  const audioFormat = view.getUint16(20, true);
  if (audioFormat !== 1) throw new Error('WAV must be PCM (format 1)');
  const channels = view.getUint16(22, true);
  const sampleRate = view.getUint32(24, true);
  const bitsPerSample = view.getUint16(34, true);
  if (bitsPerSample !== 16) throw new Error('WAV must be 16-bit');
  let dataOffset = 36;
  while (dataOffset + 8 <= data.length) {
    const chunkId = String.fromCharCode(...data.slice(dataOffset, dataOffset + 4));
    const chunkSize = view.getUint32(dataOffset + 4, true);
    if (chunkId === 'data') {
      return { sampleRate, channels, bitsPerSample, dataOffset: dataOffset + 8, dataSize: chunkSize };
    }
    dataOffset += 8 + chunkSize;
  }
  throw new Error('Invalid WAV: missing data chunk');
}

/** Convert stereo 16-bit PCM to mono (average L/R). */
function stereoToMono(pcm: Int16Array): Int16Array {
  const n = pcm.length >> 1;
  const mono = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    const l = pcm[i * 2];
    const r = pcm[i * 2 + 1];
    mono[i] = (l + r) >> 1;
  }
  return mono;
}

/** Resample 16-bit PCM to target sample rate (linear interpolation). */
function resample(pcm: Int16Array, fromRate: number, toRate: number): Int16Array {
  if (fromRate === toRate) return pcm;
  const srcLen = pcm.length;
  const dstLen = Math.floor((pcm.length * toRate) / fromRate);
  const out = new Int16Array(dstLen);
  for (let i = 0; i < dstLen; i++) {
    const srcIdx = (i * fromRate) / toRate;
    const i0 = Math.floor(srcIdx);
    const i1 = Math.min(i0 + 1, srcLen - 1);
    const frac = srcIdx - i0;
    const s0 = pcm[i0];
    const s1 = pcm[i1];
    out[i] = Math.round(s0 + frac * (s1 - s0));
  }
  return out;
}

/**
 * Read WAV file from path and return PCM as ArrayBuffer: 16-bit, mono, 16 kHz.
 * Throws if format is unsupported or file cannot be read.
 */
export async function readWavAsPcm16kMono(
  readFile: (path: string, encoding: string) => Promise<string>,
  path: string,
): Promise<ArrayBuffer> {
  const base64 = await readFile(path, 'base64');
  const data = base64ToUint8Array(base64);
  const { dataOffset, dataSize, sampleRate, channels } = parseWavHeader(data);
  const slice = data.slice(dataOffset, dataOffset + dataSize);
  let pcm = new Int16Array(slice.buffer, slice.byteOffset, slice.byteLength >> 1);
  if (channels === 2) pcm = stereoToMono(pcm);
  if (sampleRate !== TARGET_SAMPLE_RATE) pcm = resample(pcm, sampleRate, TARGET_SAMPLE_RATE);
  return pcm.buffer;
}
