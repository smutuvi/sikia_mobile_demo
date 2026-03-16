import * as React from 'react';

import {
  startVoiceCapture,
  stopVoiceCapture,
  releaseVoiceResources,
} from '../services/whisperVoiceService';
import {transcribeWithWhisperApi} from '../services/onlineSttService';

export type SttMode = 'offline' | 'online' | 'live';

type UseWhisperVoiceInputOptions = {
  onResult: (text: string) => void;
  mode?: SttMode;
  /** ISO 639-1 language code for ASR (e.g. 'en', 'fr', 'sw'). Defaults to 'en'. */
  language?: string;
};

export function useWhisperVoiceInput({
  onResult,
  mode = 'offline',
  language = 'en',
}: UseWhisperVoiceInputOptions) {
  const [isRecording, setIsRecording] = React.useState(false);
  const [isTranscribing, setIsTranscribing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  /** For online: show where we are in the pipeline (for debugging). */
  const [onlineStep, setOnlineStep] = React.useState<string>('');
  const emptyResultTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearEmptyResultTimeout = React.useCallback(() => {
    if (emptyResultTimeoutRef.current != null) {
      clearTimeout(emptyResultTimeoutRef.current);
      emptyResultTimeoutRef.current = null;
    }
  }, []);

  const handleStart = React.useCallback(async () => {
    setError(null);
    setOnlineStep('');
    clearEmptyResultTimeout();
    setIsTranscribing(true); // "Starting…" until recording actually starts

    const isOnline = mode === 'online';
    const isLiveOffline = mode === 'live';
    if (isOnline) setOnlineStep('Starting…');
    await startVoiceCapture(
      {
        onTranscription: text => {
          if (isOnline) return; // online uses onRecordingFileReady instead
          clearEmptyResultTimeout();
          if (text) {
            setIsTranscribing(false);
            if (typeof onResult === 'function') {
              onResult(text);
            }
          } else {
            emptyResultTimeoutRef.current = setTimeout(() => {
              emptyResultTimeoutRef.current = null;
              setIsTranscribing(false);
            }, 4000);
          }
        },
        onStatusChange: isActive => {
          setIsRecording(isActive);
          if (isOnline && isActive) setOnlineStep('Recording');
        },
        onError: message => {
          setError(message);
          setOnlineStep('');
          setIsRecording(false);
          setIsTranscribing(false);
        },
        onRecordingFileReady: isOnline
          ? async path => {
              clearEmptyResultTimeout();
              setOnlineStep('Transcribing…');
              try {
                const text = await transcribeWithWhisperApi(path, language);
                setOnlineStep('');
                setIsTranscribing(false);
                if (text && typeof onResult === 'function') {
                  onResult(text);
                } else {
                  setIsTranscribing(false);
                }
              } catch (err) {
                const msg =
                  err != null && typeof err === 'object' && 'message' in err
                    ? String((err as Error).message)
                    : 'Online transcription failed';
                setError(msg);
                setOnlineStep(`Error: ${msg.slice(0, 40)}`);
                setIsTranscribing(false);
              }
            }
          : undefined,
      },
      isOnline ? {mode: 'online', language} : isLiveOffline ? undefined : {mode: 'offline', language},
    );
  }, [onResult, mode, language]);

  React.useEffect(() => {
    return () => clearEmptyResultTimeout();
  }, [clearEmptyResultTimeout]);

  const handleStop = React.useCallback(async () => {
    setIsRecording(false);
    // Keep isTranscribing true so user sees "Processing…" until we get result or timeout

    try {
      await stopVoiceCapture();
    } catch (err) {
      const msg =
        err != null && typeof err === 'object' && 'message' in err && typeof (err as Error).message === 'string'
          ? (err as Error).message
          : 'Failed to stop recording';
      setError(msg);
      setIsTranscribing(false);
    }
  }, []);

  /** Clear error and step state so user can restart with a clean slate. Does not stop active recording; call stop first if needed. */
  const reset = React.useCallback(() => {
    setError(null);
    setOnlineStep('');
    setIsTranscribing(false);
    setIsRecording(false);
  }, []);

  // If we're "processing" after stop, set a timeout so we're not stuck if no result (e.g. silence or hang)
  const modeRef = React.useRef(mode);
  modeRef.current = mode;
  React.useEffect(() => {
    if (!isRecording && isTranscribing) {
      const t = setTimeout(() => {
        if (modeRef.current === 'offline') {
          setError(
            'Transcription timed out. Try a short phrase (2–10 sec), then tap mic to stop. If it still fails, free device memory and retry.',
          );
        }
        setIsTranscribing(false);
      }, 45000); // 45s max wait for offline result
      return () => clearTimeout(t);
    }
  }, [isRecording, isTranscribing]);

  React.useEffect(() => {
    return () => {
      // Best-effort cleanup when the hook is unmounted
      releaseVoiceResources().catch(() => {
        // ignore cleanup errors
      });
    };
  }, []);

  return {
    isRecording,
    isTranscribing,
    error,
    onlineStep,
    start: handleStart,
    stop: handleStop,
    reset,
  };
}

