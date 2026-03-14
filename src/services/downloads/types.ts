/**
 * Minimal shape required to download a file.
 *
 * NOTE: LLM models use the richer `Model` type, but ASR models (and other
 * downloadable assets) can also reuse the same download infrastructure by
 * conforming to this interface.
 */
export interface DownloadableItem {
  id: string;
  downloadUrl: string;
  size: number; // size in bytes (best-effort; used for space checks + progress)
  filename: string;
}

export interface DownloadProgress {
  bytesDownloaded: number;
  bytesTotal: number;
  progress: number; // percentage (0-100)
  speed: string; // formatted string like "1.5 MB/s"
  eta: string; // formatted string like "2 min" or "30 sec"
  rawSpeed?: number; // raw speed in bytes per second
  rawEta?: number; // raw eta in seconds
}

export interface DownloadState {
  isDownloading: boolean;
  progress: DownloadProgress | null;
  error: Error | null;
}

export interface DownloadJob {
  model: DownloadableItem;
  jobId?: number; // For iOS downloads - RNFS uses number for jobId
  downloadId?: string; // For Android downloads - UUID returned by WorkManager
  state: {
    isDownloading: boolean;
    progress: DownloadProgress | null;
    error: Error | null;
  };
  destination: string;
  lastBytesWritten: number;
  lastUpdateTime: number;
}

export type DownloadMap = Map<string, DownloadJob>;

export interface DownloadEventCallbacks {
  onStart?: (modelId: string) => void;
  onProgress?: (modelId: string, progress: DownloadProgress) => void;
  onComplete?: (modelId: string) => void;
  onError?: (modelId: string, error: Error) => void;
}
