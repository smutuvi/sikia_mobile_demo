declare module 'react-native/Libraries/Blob/Blob' {
  class Blob {
    constructor(parts: Array<Blob | string>);

    get size(): number;
  }

  export default Blob;
}

declare module '*.png' {
  const value: any;
  export default value;
}

declare module '*.svg' {
  import React from 'react';
  import {SvgProps} from 'react-native-svg';
  const content: React.FC<SvgProps>;
  export default content;
}

// whisper.rn doesn't ship TypeScript declarations (yet)
declare module 'whisper.rn' {
  export type WhisperContext = any;
  export type WhisperVadContext = any;
  export function initWhisper(options: any): Promise<WhisperContext>;
  export function initWhisperVad(options: any): Promise<WhisperVadContext>;
}

declare module 'whisper.rn/src/realtime-transcription' {
  export class RealtimeTranscriber {
    constructor(...args: any[]);
    start(): Promise<void>;
    stop(): Promise<void>;
  }
}

declare module 'whisper.rn/src/realtime-transcription/adapters/AudioPcmStreamAdapter' {
  export class AudioPcmStreamAdapter {
    constructor(...args: any[]);
    stop(): Promise<void>;
  }
}
