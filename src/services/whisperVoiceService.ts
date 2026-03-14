import {Platform, PermissionsAndroid, Image, Alert} from 'react-native';
import * as RNFS from '@dr.pogodin/react-native-fs';
import {
  initWhisper,
  initWhisperVad,
  type WhisperContext,
  type WhisperVadContext,
} from 'whisper.rn';
import {RealtimeTranscriber} from 'whisper.rn/src/realtime-transcription';
import {AudioPcmStreamAdapter} from 'whisper.rn/src/realtime-transcription/adapters/AudioPcmStreamAdapter';
import {WavFileWriter} from 'whisper.rn/src/utils/WavFileWriter';

import {asrModelStore} from '../store/AsrModelStore';
import {readWavAsPcm16kMono} from '../utils/wavPcmReader';

/**
 * Voice capture and ASR (Whisper + optional VAD) for chat input.
 * Downloaded ASR models only (from AsrModelStore / Hugging Face). No bundled model.
 */
type VoiceCallbacks = {
  onTranscription?: (text: string) => void;
  onStatusChange?: (isActive: boolean) => void;
  onError?: (message: string) => void;
  /** When mode is 'online', called after stop with the path to the recorded WAV file. */
  onRecordingFileReady?: (path: string) => void;
};

export type VoiceCaptureOptions = {
  mode?: 'offline' | 'online';
  recordingOutputPath?: string;
};

const VAD_MODEL_ASSET = require('../assets/models/ggml-silero-v6.2.0.bin');

/**
 * Voice Activity Detection (VAD) is currently disabled; using Whisper-only transcription.
 */
const USE_VAD = false;

let whisperContext: WhisperContext | null = null;
let vadContext: WhisperVadContext | null = null;
let vadInitialized = false;
let audioStream: AudioPcmStreamAdapter | null = null;
let transcriber: RealtimeTranscriber | null = null;
let callbacks: VoiceCallbacks = {};
let loadedAsrModelId: string | null = null;
/** When mode is 'online', path we pass to the transcriber for WAV output. */
let currentRecordingOutputPath: string | null = null;
/** Used to detect mode switch and recreate transcriber with/without audioOutputPath. */
let lastRecordingOutputPath: string | null = null;

/** Online-only path: record to WAV without loading Whisper. */
let onlineAudioStream: AudioPcmStreamAdapter | null = null;
let onlineWavWriter: WavFileWriter | null = null;
let onlineOutputPath: string | null = null;

/** Offline path: record to WAV then transcribe with local model (same pipeline as "Transcribe sample file"). */
let offlineRecordingStream: AudioPcmStreamAdapter | null = null;
let offlineRecordingWavWriter: WavFileWriter | null = null;
let offlineRecordingPath: string | null = null;

/** RNFS adapter for WavFileWriter (writeFile/appendFile/readFile/exists/unlink with base64). */
function getRnfsWavAdapter(): import('whisper.rn/src/utils/WavFileWriter').WavFileWriterFs {
  return {
    writeFile: (p, data, enc) => RNFS.writeFile(p, data, (enc as 'base64') || 'base64'),
    appendFile: (p, data, enc) => RNFS.appendFile(p, data, (enc as 'base64') || 'base64'),
    readFile: (p, enc) => RNFS.readFile(p, (enc as 'base64') || 'base64'),
    exists: p => RNFS.exists(p),
    unlink: p => RNFS.unlink(p),
  };
}

/** First available writable directory (cache, temp, or documents). Same RNFS namespace as AsrModelStore. */
function getRecordingDir(): string | null {
  const candidates = [
    RNFS.CachesDirectoryPath,
    RNFS.TemporaryDirectoryPath,
    RNFS.DocumentDirectoryPath,
  ].filter((p): p is string => typeof p === 'string' && p.length > 0);
  return candidates[0] ?? null;
}

async function ensureMicPermission() {
  if (Platform.OS !== 'android') {
    return true;
  }

  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    {
      title: 'Microphone permission',
      message:
        'This app needs microphone access to record speech for transcription.',
      buttonNeutral: 'Ask Me Later',
      buttonNegative: 'Cancel',
      buttonPositive: 'OK',
    },
  );

  if (result === PermissionsAndroid.RESULTS.GRANTED) {
    return true;
  }

  const permanentlyDenied =
    result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN;
  const message = permanentlyDenied
    ? 'Microphone access was denied. To use voice input, open Settings → Apps → Sikia → Permissions and enable Microphone.'
    : 'Microphone permission is required for voice input. Please allow when prompted.';
  callbacks.onError?.(message);
  if (typeof Alert !== 'undefined') {
    Alert.alert('Microphone permission', message);
  }
  return false;
}

async function resetContexts() {
  if (transcriber) {
    try {
      await transcriber.stop();
    } catch {
      // ignore
    }
  }
  if (whisperContext) {
    try {
      await whisperContext.release();
    } catch {
      // ignore
    }
  }
  if (vadContext) {
    try {
      await vadContext.release();
    } catch {
      // ignore
    }
  }
  if (audioStream) {
    try {
      await audioStream.stop();
    } catch {
      // ignore
    }
  }
  // Online-only path: stop and clear without loading Whisper
  if (onlineAudioStream) {
    try {
      await onlineAudioStream.stop();
    } catch {
      // ignore
    }
    onlineAudioStream = null;
  }
  if (onlineWavWriter) {
    try {
      await onlineWavWriter.cancel();
    } catch {
      // ignore
    }
    onlineWavWriter = null;
  }
  onlineOutputPath = null;

  transcriber = null;
  whisperContext = null;
  vadContext = null;
  audioStream = null;
  loadedAsrModelId = null;
  currentRecordingOutputPath = null;
  lastRecordingOutputPath = null;

  if (offlineRecordingStream) {
    try {
      await offlineRecordingStream.stop();
    } catch {
      // ignore
    }
    offlineRecordingStream = null;
  }
  if (offlineRecordingWavWriter) {
    try {
      await offlineRecordingWavWriter.cancel();
    } catch {
      // ignore
    }
    offlineRecordingWavWriter = null;
  }
  offlineRecordingPath = null;
}

async function resetTranscriberOnly() {
  if (transcriber) {
    try {
      await transcriber.stop();
    } catch {
      // ignore
    }
  }
  transcriber = null;
  // Clear stream so next ensureContexts() creates a new one; avoids reusing a stopped
  // native stream which can fail to produce data on some devices (e.g. Android).
  if (audioStream) {
    try {
      await audioStream.stop();
    } catch {
      // ignore
    }
    audioStream = null;
  }
}

/** Resolve Whisper model: downloaded file path only (no bundled asset). */
async function resolveWhisperModelFile(): Promise<
  {filePath: string; modelId: string; isBundleAsset: false}
> {
  const active = asrModelStore.activeModel;
  if (!active) {
    throw new Error(
      'No ASR model selected. Open Models → ASR, download a model (e.g. ndizi-whisper-small-GGUF from Hugging Face), then set it active.',
    );
  }

  await asrModelStore.refreshDownloadStatuses();
  const fullPath = await asrModelStore.getModelFullPath(active);
  if (
    typeof fullPath === 'string' &&
    fullPath.length > 0 &&
    RNFS != null &&
    typeof RNFS.exists === 'function' &&
    (await RNFS.exists(fullPath))
  ) {
    if (__DEV__) {
      console.log('[ASR] Resolved model path:', fullPath);
    }
    return {filePath: fullPath, modelId: active.id, isBundleAsset: false};
  }

  throw new Error(
    'Selected ASR model file not found. Open Models → ASR, re-download the model and set it active.',
  );
}

async function ensureContexts() {
  const resolved = await resolveWhisperModelFile();
  const filePath = resolved.filePath;
  const modelId = resolved.modelId;
  if (filePath == null || filePath.length === 0) {
    throw new Error('ASR model could not be resolved.');
  }

  // If user switched ASR model, reset native resources and re-init
  if (loadedAsrModelId != null && loadedAsrModelId !== modelId) {
    await resetContexts();
  }

  if (!whisperContext) {
    const pathToUse = filePath.replace(/^file:\/\//, '');
    const ext = (pathToUse.split('.').pop() || '').toLowerCase();
    if (ext === 'gguf') {
      throw new Error(
        'Offline ASR does not support .gguf models with the current engine. Use a .bin (ggml) model instead: open Models → ASR and choose a preset like "Whisper small (ndizi, q4_0)" or download a .bin file from Hugging Face (e.g. ggml-model-q4_0.bin).',
      );
    }
    if (__DEV__) {
      console.log('[ASR] initWhisper path:', pathToUse);
    }
    whisperContext = await initWhisper({
      filePath: pathToUse,
      isBundleAsset: false,
    });
    loadedAsrModelId = modelId;
  }

  if (USE_VAD && !vadContext && !vadInitialized) {
    try {
      vadContext = await initWhisperVad({
        filePath: VAD_MODEL_ASSET as number,
        isBundleAsset: true,
        useGpu: Platform.OS === 'ios',
        nThreads: 4,
      });
      vadInitialized = true;
    } catch (e) {
      // If VAD cannot be initialized on this device, fall back to Whisper-only
      vadContext = null;
      vadInitialized = false;
      if (__DEV__) {
        console.warn('[ASR] Failed to initialize VAD context; continuing without VAD:', e);
      }
    }
  }

  if (!audioStream) {
    audioStream = new AudioPcmStreamAdapter();
  }

  const hasFs = RNFS != null && typeof (RNFS as any).writeFile === 'function';
  const audioStreamConfig = {
    sampleRate: 16000,
    channels: 1,
    bitsPerSample: 16,
    audioSource: 6,
    bufferSize: 16 * 1024,
  };
  if (!transcriber && whisperContext && audioStream) {
    const useVad = USE_VAD && vadInitialized && vadContext;
    transcriber = new RealtimeTranscriber(
      {
        whisperContext,
        vadContext: useVad ? vadContext ?? undefined : undefined,
        audioStream,
        ...(hasFs ? {fs: RNFS} : {}),
      },
      {
        // Smaller slices and shorter startup/pause for lower latency
        audioSliceSec: 3,
        maxSlicesInMemory: 3,
        audioStreamConfig,
        ...(currentRecordingOutputPath
          ? {audioOutputPath: currentRecordingOutputPath}
          : {}),
        transcribeOptions: {
          language: 'en',
        },
        initRealtimeAfterMs: 150,
        realtimeProcessingPauseMs: 250,
        logger: __DEV__ ? (msg: string) => console.log(msg) : () => {},
      },
      {
        onTranscribe: event => {
          try {
            if (event == null || typeof event !== 'object') return;
            const ev = event as { type?: string; data?: { result?: string; segments?: Array<{ text?: string }> } | string };
            // Only forward actual transcription results; ignore 'start' / 'end' so we don't clear "Processing…" with empty
            if (ev.type !== 'transcribe') return;

            if (__DEV__) {
              console.log('[ASR] onTranscribe transcribe event:', ev.data != null ? (typeof ev.data === 'object' ? JSON.stringify({ result: (ev.data as any).result, segmentsCount: (ev.data as any).segments?.length }) : ev.data) : 'no data');
            }
            let text = '';
            if (ev.data != null) {
              if (typeof ev.data === 'string') {
                text = ev.data;
              } else {
                const d = ev.data as { result?: string; segments?: Array<{ text?: string }> };
                text = d.result ?? '';
                if (!text && Array.isArray(d.segments) && d.segments.length > 0) {
                  text = d.segments.map(s => s?.text ?? '').filter(Boolean).join(' ');
                }
              }
            }
            text = (text ?? '').trim();
            if (callbacks.onTranscription) {
              if (__DEV__ && text) console.log('[ASR] sending to chat input:', text);
              callbacks.onTranscription(text);
            }
          } catch (e) {
            if (__DEV__) console.warn('[whisperVoiceService] onTranscribe callback error:', e);
          }
        },
        onVad: () => {
          // No-op for now; could be used to show VAD activity UI
        },
        onStatusChange: isActive => {
          try {
            callbacks.onStatusChange?.(isActive);
          } catch (e) {
            if (__DEV__) console.warn('[whisperVoiceService] onStatusChange callback error:', e);
          }
        },
        onError: error => {
          try {
            let message = 'Voice input error';
            if (typeof error === 'string') {
              message = error;
            } else if (error != null && typeof error === 'object' && 'message' in error && typeof (error as {message: unknown}).message === 'string') {
              message = (error as {message: string}).message;
            }
            callbacks.onError?.(message);
          } catch (e) {
            if (__DEV__) console.warn('[whisperVoiceService] onError callback error:', e);
            callbacks.onError?.('Voice input error');
          }
        },
      },
    );
  }

  return {whisperContext, vadContext, audioStream, transcriber};
}

export async function startVoiceCapture(
  cb: VoiceCallbacks,
  options?: VoiceCaptureOptions,
) {
  callbacks = cb != null && typeof cb === 'object' ? cb : {};
  if (options?.mode === 'online') {
    const dir = getRecordingDir();
    const baseName = `asr_online_${Date.now()}.wav`;
    currentRecordingOutputPath = options?.recordingOutputPath?.trim() || (dir ? `${dir}/${baseName}` : null);
  } else {
    currentRecordingOutputPath = null;
    lastRecordingOutputPath = null;
  }
  if (lastRecordingOutputPath !== currentRecordingOutputPath) {
    await resetTranscriberOnly();
    lastRecordingOutputPath = currentRecordingOutputPath;
  }

  const hasPermission = await ensureMicPermission();
  if (!hasPermission) {
    callbacks.onError?.(
      'Microphone permission is required for voice input.',
    );
    return;
  }

  if (options?.mode === 'online') {
    const dir = getRecordingDir();
    const baseName = `asr_online_${Date.now()}.wav`;
    const outputPath = options?.recordingOutputPath?.trim() || (dir ? `${dir}/${baseName}` : null);
    if (!outputPath) {
      callbacks.onError?.('No writable directory for online recording. Storage may be unavailable.');
      return;
    }
    try {
      if (onlineAudioStream) {
        try {
          await onlineAudioStream.stop();
        } catch {
          // ignore
        }
        onlineAudioStream = null;
      }
      if (onlineWavWriter) {
        try {
          await onlineWavWriter.cancel();
        } catch {
          // ignore
        }
        onlineWavWriter = null;
      }
      onlineOutputPath = null;

      const fs = getRnfsWavAdapter();
      const wavWriter = new WavFileWriter(fs, outputPath, {
        sampleRate: 16000,
        channels: 1,
        bitsPerSample: 16,
      });
      await wavWriter.initialize();
      onlineWavWriter = wavWriter;
      onlineOutputPath = outputPath;

      const stream = new AudioPcmStreamAdapter();
      stream.onData(async (data: { data: Uint8Array }) => {
        if (onlineWavWriter) {
          await onlineWavWriter.appendAudioData(data.data);
        }
      });
      stream.onError(err => {
        callbacks.onError?.(typeof err === 'string' ? err : (err as Error)?.message ?? 'Recording error');
      });
      await stream.initialize({
        sampleRate: 16000,
        channels: 1,
        bitsPerSample: 16,
        audioSource: 6,
        bufferSize: 16 * 1024,
      });
      await stream.start();
      onlineAudioStream = stream;
      callbacks.onStatusChange?.(true);
      if (__DEV__) console.log('[ASR] Online recording started (no Whisper model loaded).');
    } catch (err) {
      const message =
        (err != null && typeof err === 'object' && 'message' in err && typeof (err as Error).message === 'string')
          ? (err as Error).message
          : 'Failed to start online recording.';
      if (__DEV__ && err != null) console.error('[whisperVoiceService] online start error:', err);
      callbacks.onError?.(message);
    }
    return;
  }

  // Offline: record to WAV then transcribe file (same path as "Transcribe sample file" – avoids RealtimeTranscriber timeout).
  if (options?.mode === 'offline') {
    const dir = getRecordingDir();
    const outputPath = dir ? `${dir}/asr_offline_${Date.now()}.wav` : null;
    if (!outputPath) {
      callbacks.onError?.('No writable directory for recording. Storage may be unavailable.');
      return;
    }
    try {
      await ensureContexts();
      if (!whisperContext) {
        callbacks.onError?.('ASR model not loaded.');
        return;
      }
      if (offlineRecordingStream) {
        try {
          await offlineRecordingStream.stop();
        } catch {
          // ignore
        }
        offlineRecordingStream = null;
      }
      if (offlineRecordingWavWriter) {
        try {
          await offlineRecordingWavWriter.cancel();
        } catch {
          // ignore
        }
        offlineRecordingWavWriter = null;
      }
      offlineRecordingPath = null;

      const fs = getRnfsWavAdapter();
      const wavWriter = new WavFileWriter(fs, outputPath, {
        sampleRate: 16000,
        channels: 1,
        bitsPerSample: 16,
      });
      await wavWriter.initialize();
      offlineRecordingWavWriter = wavWriter;
      offlineRecordingPath = outputPath;

      const stream = new AudioPcmStreamAdapter();
      stream.onData(async (data: { data: Uint8Array }) => {
        if (offlineRecordingWavWriter) {
          await offlineRecordingWavWriter.appendAudioData(data.data);
        }
      });
      stream.onError(err => {
        callbacks.onError?.(typeof err === 'string' ? err : (err as Error)?.message ?? 'Recording error');
      });
      await stream.initialize({
        sampleRate: 16000,
        channels: 1,
        bitsPerSample: 16,
        audioSource: 6,
        bufferSize: 16 * 1024,
      });
      await stream.start();
      offlineRecordingStream = stream;
      callbacks.onStatusChange?.(true);
      if (__DEV__) console.log('[ASR] Offline recording to WAV started; speak then tap mic to stop.');
    } catch (err) {
      const message =
        (err != null && typeof err === 'object' && 'message' in err && typeof (err as Error).message === 'string')
          ? (err as Error).message
          : 'Failed to start offline recording.';
      if (__DEV__ && err != null) console.error('[whisperVoiceService] offline start error:', err);
      callbacks.onError?.(message);
    }
    return;
  }

  try {
    const result = await ensureContexts();
    const t = result.transcriber;
    if (!t) {
      callbacks.onError?.('Failed to initialize voice transcriber.');
      return;
    }
    await t.start();
    if (__DEV__) console.log('[ASR] RealtimeTranscriber started; speak then tap mic again to stop.');
  } catch (err) {
    let message =
      (err != null && typeof err === 'object' && 'message' in err && typeof (err as Error).message === 'string')
        ? (err as Error).message
        : 'Failed to start voice input.';
    if (message.includes('Failed to initialize context')) {
      message =
        'Model failed to load. Use a .bin (ggml) ASR model: open Models → ASR, choose a preset like "Whisper small (ndizi, q4_0)" or download a .bin file. .gguf models are not supported for offline ASR. Or use Online mode.';
    }
    if (__DEV__ && err != null) {
      console.error('[whisperVoiceService] startVoiceCapture error:', err);
    }
    callbacks.onError?.(message);
  }
}

/** Pre-load Whisper ASR context in the background so first use is faster. */
export async function warmUpAsrModel(): Promise<void> {
  try {
    await ensureContexts();
  } catch (e) {
    if (__DEV__) {
      console.warn('[ASR] Warm-up failed (non-fatal):', e);
    }
  }
}

export async function stopVoiceCapture() {
  if (onlineAudioStream != null) {
    const pathToSend = onlineOutputPath;
    try {
      await onlineAudioStream.stop();
      onlineAudioStream = null;
      if (onlineWavWriter) {
        await onlineWavWriter.finalize();
        onlineWavWriter = null;
      }
      onlineOutputPath = null;
      callbacks.onStatusChange?.(false);
      if (pathToSend && callbacks.onRecordingFileReady) {
        await new Promise(r => setTimeout(r, 200));
        try {
          if (__DEV__) console.log('[ASR] Online: onRecordingFileReady', pathToSend);
          callbacks.onRecordingFileReady(pathToSend);
        } catch (e) {
          if (__DEV__) console.warn('[ASR] onRecordingFileReady error:', e);
        }
      }
    } catch (e) {
      if (__DEV__) console.warn('[ASR] online stop error:', e);
      callbacks.onStatusChange?.(false);
      onlineAudioStream = null;
      onlineWavWriter = null;
      onlineOutputPath = null;
    }
    return;
  }

  if (offlineRecordingStream != null) {
    const pathToTranscribe = offlineRecordingPath;
    try {
      await offlineRecordingStream.stop();
      offlineRecordingStream = null;
      if (offlineRecordingWavWriter) {
        await offlineRecordingWavWriter.finalize();
        offlineRecordingWavWriter = null;
      }
      offlineRecordingPath = null;
      callbacks.onStatusChange?.(false);
      if (pathToTranscribe && callbacks.onTranscription) {
        // Give WAV file time to flush to disk before reading (same as online path)
        await new Promise(r => setTimeout(r, 500));
        try {
          if (__DEV__) console.log('[ASR] Offline: transcribing recorded WAV', pathToTranscribe);
          const {result} = await transcribeWavFile(pathToTranscribe, {
            language: 'en',
            quickTest30s: true,
          });
          const text = (result ?? '').trim();
          if (__DEV__ && text) console.log('[ASR] Offline result:', text);
          callbacks.onTranscription(text);
        } catch (e) {
          if (__DEV__) console.warn('[ASR] Offline transcribe error:', e);
          const msg =
            e != null && typeof e === 'object' && 'message' in e
              ? String((e as Error).message)
              : 'Offline transcription failed';
          callbacks.onError?.(msg);
        } finally {
          try {
            if (pathToTranscribe && (await RNFS.exists(pathToTranscribe))) {
              await RNFS.unlink(pathToTranscribe);
              if (__DEV__) console.log('[ASR] Offline recording file deleted');
            }
          } catch {
            // ignore cleanup errors
          }
        }
      }
    } catch (e) {
      if (__DEV__) console.warn('[ASR] offline stop error:', e);
      callbacks.onStatusChange?.(false);
      offlineRecordingStream = null;
      offlineRecordingWavWriter = null;
      offlineRecordingPath = null;
    }
    return;
  }

  if (!transcriber) {
    try {
      callbacks.onStatusChange?.(false);
    } catch {
      // ignore
    }
    return;
  }

  try {
    // Flush final slice and queue it for transcription. We must wait for the queue to
    // process before calling stop(), because stop() sets isActive=false and the library's
    // processTranscription() then returns without transcribing. So allow time for the
    // final slice to be transcribed (up to ~12s for a 10s slice on device).
    await (transcriber as any).nextSlice?.();
    await new Promise(r => setTimeout(r, 12000));
    await transcriber.stop();
    if (__DEV__) console.log('[ASR] Stopped; final transcription should have been delivered.');
    const pathToSend = currentRecordingOutputPath;
    currentRecordingOutputPath = null;
    if (pathToSend && callbacks.onRecordingFileReady) {
      // Give the WAV writer time to flush and finalize the file
      await new Promise(r => setTimeout(r, 800));
      try {
        if (__DEV__) console.log('[ASR] Calling onRecordingFileReady:', pathToSend);
        callbacks.onRecordingFileReady(pathToSend);
      } catch (e) {
        if (__DEV__) console.warn('[ASR] onRecordingFileReady error:', e);
      }
    }
  } finally {
    try {
      callbacks.onStatusChange?.(false);
    } catch {
      // ignore
    }
  }
}

export async function releaseVoiceResources() {
  await resetContexts();
  callbacks = {};
}

/** True if the Whisper (ASR) context is loaded and ready for transcription. */
export function isWhisperLoaded(): boolean {
  return whisperContext != null;
}

/** Chunk size for file transcription (whisper.cpp processes in ~30s windows). */
const CHUNK_MS = 30_000;
/** Max chunks to process (e.g. 20 × 30s = 10 min) to avoid runaway. */
const MAX_CHUNKS = 20;
/** Bytes per 30s at 16 kHz mono 16-bit. */
const BYTES_PER_CHUNK = 30 * 16000 * 2;
/** Default thread count for transcription; increase on 6+ core devices for speed. */
const DEFAULT_MAX_THREADS = 8;
/** Use single-candidate decoding for speed (bestOf: 1). */
const TRANSCRIBE_SPEED_OPTIONS = { bestOf: 1 } as const;

/** Resolve filePathOrAsset to a file path string (strip file://). */
function resolveToPath(filePathOrAsset: string | number): string | null {
  if (typeof filePathOrAsset === 'string') {
    return filePathOrAsset.replace(/^file:\/\//, '');
  }
  try {
    const source = Image.resolveAssetSource(filePathOrAsset as number);
    if (source?.uri) return source.uri.replace(/^file:\/\//, '');
  } catch {
    // ignore
  }
  return null;
}

/**
 * Transcribe using PCM chunks (file read once). Returns null if PCM path cannot be used.
 */
async function transcribeWavFileViaPcm(
  ctx: WhisperContext,
  path: string,
  options: {
    language: string;
    maxThreads: number;
    onChunkProgress?: (chunkIndex: number) => void;
    quickTest30s?: boolean;
  },
): Promise<{result: string; language: string; segments: Array<{text: string; t0: number; t1: number}>} | null> {
  if (!RNFS?.readFile) return null;
  let pcmBuffer: ArrayBuffer;
  try {
    pcmBuffer = await readWavAsPcm16kMono(
      (p: string, enc: string) => RNFS.readFile(p, enc),
      path,
    );
  } catch (e) {
    if (__DEV__) {
      console.warn('[ASR] PCM path failed (using fallback):', (e as Error)?.message ?? e);
    }
    return null;
  }
  const totalSamples = pcmBuffer.byteLength >> 1;
  const maxChunks = options.quickTest30s ? 1 : MAX_CHUNKS;
  const chunkResults: string[] = [];
  let firstLanguage = '';
  const allSegments: Array<{text: string; t0: number; t1: number}> = [];
  let chunkIndex = 0;
  let offsetSamples = 0;
  let emptyChunksInRow = 0;

  while (offsetSamples < totalSamples && chunkIndex < maxChunks) {
    chunkIndex += 1;
    options.onChunkProgress?.(chunkIndex);
    const chunkSamples = Math.min(BYTES_PER_CHUNK >> 1, totalSamples - offsetSamples);
    if (chunkSamples <= 0) break;
    const chunkBuffer = pcmBuffer.slice(
      offsetSamples * 2,
      (offsetSamples + chunkSamples) * 2,
    );
    const ttftStart = chunkIndex === 1 ? Date.now() : 0;
    const {promise} = ctx.transcribeData(chunkBuffer, {
      language: options.language,
      maxThreads: options.maxThreads,
      ...TRANSCRIBE_SPEED_OPTIONS,
    });
    const res = await promise;
    if (ttftStart > 0) {
      const ttftMs = Date.now() - ttftStart;
      console.log(`[ASR] TTFT (time to first result): ${ttftMs} ms`);
    }
    const text = (res.result ?? '').trim();
    if (res.language) firstLanguage = res.language;
    if (res.segments?.length) {
      const offsetCentisec = (offsetSamples / 16000) * 100;
      for (const s of res.segments) {
        allSegments.push({
          text: s.text ?? '',
          t0: (s.t0 ?? 0) + offsetCentisec,
          t1: (s.t1 ?? 0) + offsetCentisec,
        });
      }
    }
    if (text) {
      chunkResults.push(text);
      emptyChunksInRow = 0;
    } else {
      emptyChunksInRow += 1;
      if (emptyChunksInRow >= 2) break;
    }
    offsetSamples += chunkSamples;
  }

  return {
    result: chunkResults.join(' ').trim(),
    language: firstLanguage || options.language,
    segments: allSegments,
  };
}

/**
 * Temporary test helper: transcribe a WAV file using the same ASR model as the app.
 * Preferentially reads the file once and sends PCM chunks via transcribeData (faster).
 * Falls back to transcribe(path, {offset, duration}) per chunk if PCM path is unavailable.
 * @param filePathOrAsset - File path (on device) or require() asset number for a bundled WAV
 * @param options - language (default 'en'), maxThreads (default 8), onChunkProgress, quickTest30s (default false) – when true, only first 30s is processed
 */
export async function transcribeWavFile(
  filePathOrAsset: string | number,
  options?: {
    language?: string;
    maxThreads?: number;
    onChunkProgress?: (chunkIndex: number) => void;
    quickTest30s?: boolean;
  },
): Promise<{result: string; language: string; segments: Array<{text: string; t0: number; t1: number}>}> {
  const {whisperContext: ctx} = await ensureContexts();
  if (!ctx) {
    throw new Error('ASR context not available');
  }
  const language = options?.language ?? 'en';
  const maxThreads = options?.maxThreads ?? DEFAULT_MAX_THREADS;
  const onChunkProgress = options?.onChunkProgress;
  const quickTest30s = options?.quickTest30s ?? false;

  const path = resolveToPath(filePathOrAsset);
  if (path) {
    const pcmResult = await transcribeWavFileViaPcm(ctx, path, {
      language,
      maxThreads,
      onChunkProgress,
      quickTest30s,
    });
    if (pcmResult != null) {
      if (__DEV__) console.log('[ASR] transcribeWavFile used PCM path (file read once)');
      return pcmResult;
    }
    if (__DEV__) console.log('[ASR] transcribeWavFile using fallback (path/offset/duration per chunk)');
  }

  // Fallback: transcribe by file path/asset with offset/duration (repeated file load per chunk)
  const chunkResults: string[] = [];
  let firstLanguage = '';
  const allSegments: Array<{text: string; t0: number; t1: number}> = [];
  const maxChunks = quickTest30s ? 1 : MAX_CHUNKS;
  let offsetMs = 0;
  let emptyChunksInRow = 0;
  let chunkIndex = 0;

  while (offsetMs < CHUNK_MS * maxChunks) {
    chunkIndex += 1;
    onChunkProgress?.(chunkIndex);
    const ttftStart = chunkIndex === 1 ? Date.now() : 0;
    const {promise} = ctx.transcribe(filePathOrAsset, {
      language,
      maxThreads,
      ...TRANSCRIBE_SPEED_OPTIONS,
      duration: CHUNK_MS,
      offset: offsetMs,
    });
    const res = await promise;
    if (ttftStart > 0) {
      const ttftMs = Date.now() - ttftStart;
      console.log(`[ASR] TTFT (time to first result): ${ttftMs} ms`);
    }
    const text = (res.result ?? '').trim();
    if (res.language) firstLanguage = res.language;
    if (res.segments?.length) {
      const offsetCentisec = offsetMs / 10;
      for (const s of res.segments) {
        allSegments.push({
          text: s.text ?? '',
          t0: (s.t0 ?? 0) + offsetCentisec,
          t1: (s.t1 ?? 0) + offsetCentisec,
        });
      }
    }
    if (text) {
      chunkResults.push(text);
      emptyChunksInRow = 0;
    } else {
      emptyChunksInRow += 1;
      if (emptyChunksInRow >= 2) break;
    }
    offsetMs += CHUNK_MS;
  }

  return {
    result: chunkResults.join(' ').trim(),
    language: firstLanguage || language,
    segments: allSegments,
  };
}

