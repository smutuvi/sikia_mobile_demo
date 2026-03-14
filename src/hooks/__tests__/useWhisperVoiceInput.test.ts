/**
 * Tests that ASR transcription result flows to the onResult callback.
 * Mocks whisperVoiceService so we can simulate transcription without native code.
 */
import {act, renderHook} from '@testing-library/react-hooks';
import * as React from 'react';

import {useWhisperVoiceInput} from '../useWhisperVoiceInput';

declare global {
  var __asrTestCallbacks: {
    onTranscription?: (text: string) => void;
    onStatusChange?: (isActive: boolean) => void;
    onError?: (message: string) => void;
  };
}

jest.mock('../../services/whisperVoiceService', () => ({
  startVoiceCapture: jest.fn(async (cb: any) => {
    global.__asrTestCallbacks = cb ?? {};
    if (global.__asrTestCallbacks.onStatusChange) {
      global.__asrTestCallbacks.onStatusChange(true);
    }
  }),
  stopVoiceCapture: jest.fn(async () => {
    if (global.__asrTestCallbacks?.onStatusChange) {
      global.__asrTestCallbacks.onStatusChange(false);
    }
  }),
  releaseVoiceResources: jest.fn(async () => {}),
}));

describe('useWhisperVoiceInput', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.__asrTestCallbacks = {};
  });

  it('calls onResult when transcription is received from service', async () => {
    const onResult = jest.fn();
    const {result} = renderHook(() => useWhisperVoiceInput({onResult}));

    await act(async () => {
      result.current.start();
    });

    expect(global.__asrTestCallbacks.onTranscription).toBeDefined();
    act(() => {
      global.__asrTestCallbacks.onTranscription!('hello world');
    });

    expect(onResult).toHaveBeenCalledWith('hello world');
  });

  it('appends multiple transcriptions when onResult is called multiple times', async () => {
    const onResult = jest.fn();
    const {result} = renderHook(() => useWhisperVoiceInput({onResult}));

    await act(async () => {
      result.current.start();
    });

    act(() => {
      global.__asrTestCallbacks.onTranscription!('first');
    });
    act(() => {
      global.__asrTestCallbacks.onTranscription!('second');
    });

    expect(onResult).toHaveBeenCalledWith('first');
    expect(onResult).toHaveBeenCalledWith('second');
  });

  it('sets error when onError is called by service', async () => {
    const onResult = jest.fn();
    const {result} = renderHook(() => useWhisperVoiceInput({onResult}));

    await act(async () => {
      result.current.start();
    });

    act(() => {
      global.__asrTestCallbacks.onError!('Microphone permission denied');
    });

    expect(result.current.error).toBe('Microphone permission denied');
  });
});
