import {Alert} from 'react-native';

import {computed, makeAutoObservable, runInAction} from 'mobx';
import {makePersistable} from 'mobx-persist-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as RNFS from '@dr.pogodin/react-native-fs';

import {downloadManager} from '../services/downloads';
import {createErrorState, ErrorState} from '../utils/errors';
import {hfStore} from './HFStore';
import {uiStore} from './UIStore';
import {t} from '../locales';

import {AsrModel, AsrModelOrigin, HuggingFaceModel, ModelFile} from '../utils/types';

const TAG = 'AsrModelStore';

// Default presets: ndizi Whisper small GGUF from Hugging Face.
// https://huggingface.co/smutuvi/ndizi-whisper-small-GGUF
const NDIZI_WHISPER_SMALL_MODEL_ID = 'smutuvi/ndizi-whisper-small-GGUF';
const NDIZI_WHISPER_SMALL_REPO = 'ndizi-whisper-small-GGUF';

const NDIZI_WHISPER_Q4_FILE = 'ggml-model-q4_0.bin';
const NDIZI_WHISPER_Q4_SIZE = 145_458_032;
const PRESET_ASR_MODEL_SMALL: AsrModel = {
  id: `${NDIZI_WHISPER_SMALL_MODEL_ID}/${NDIZI_WHISPER_Q4_FILE}`,
  name: 'Whisper small (ndizi, q4_0)',
  author: 'smutuvi',
  repo: NDIZI_WHISPER_SMALL_REPO,
  filename: NDIZI_WHISPER_Q4_FILE,
  size: NDIZI_WHISPER_Q4_SIZE,
  isDownloaded: false,
  progress: 0,
  origin: AsrModelOrigin.HF,
  downloadUrl: `https://huggingface.co/${NDIZI_WHISPER_SMALL_MODEL_ID}/resolve/main/${NDIZI_WHISPER_Q4_FILE}`,
  hfUrl: `https://huggingface.co/${NDIZI_WHISPER_SMALL_MODEL_ID}`,
};

const NDIZI_WHISPER_Q5_FILE = 'ggml-model-q5_0.bin';
const NDIZI_WHISPER_Q5_SIZE = 183_500_800; // ~175 MB
const PRESET_ASR_MODEL_SMALL_Q5: AsrModel = {
  id: `${NDIZI_WHISPER_SMALL_MODEL_ID}/${NDIZI_WHISPER_Q5_FILE}`,
  name: 'Whisper small (ndizi, q5_0)',
  author: 'smutuvi',
  repo: NDIZI_WHISPER_SMALL_REPO,
  filename: NDIZI_WHISPER_Q5_FILE,
  size: NDIZI_WHISPER_Q5_SIZE,
  isDownloaded: false,
  progress: 0,
  origin: AsrModelOrigin.HF,
  downloadUrl: `https://huggingface.co/${NDIZI_WHISPER_SMALL_MODEL_ID}/resolve/main/${NDIZI_WHISPER_Q5_FILE}`,
  hfUrl: `https://huggingface.co/${NDIZI_WHISPER_SMALL_MODEL_ID}`,
};

// Whisper Base.en (English-only, q5_1) from ggerganov/whisper.cpp on Hugging Face
const GGERGANOV_WHISPER_MODEL_ID = 'ggerganov/whisper.cpp';
const WHISPER_BASE_EN_Q5_1_FILE = 'ggml-base.en-q5_1.bin';
const WHISPER_BASE_EN_Q5_1_SIZE = 148_897_792; // ~142 MB
const PRESET_ASR_MODEL_BASE_EN_Q5_1: AsrModel = {
  id: `${GGERGANOV_WHISPER_MODEL_ID}/${WHISPER_BASE_EN_Q5_1_FILE}`,
  name: 'Whisper Base.en (English, q5_1)',
  author: 'ggerganov',
  repo: 'whisper.cpp',
  filename: WHISPER_BASE_EN_Q5_1_FILE,
  size: WHISPER_BASE_EN_Q5_1_SIZE,
  isDownloaded: false,
  progress: 0,
  origin: AsrModelOrigin.HF,
  downloadUrl: `https://huggingface.co/${GGERGANOV_WHISPER_MODEL_ID}/resolve/main/${WHISPER_BASE_EN_Q5_1_FILE}`,
  hfUrl: `https://huggingface.co/${GGERGANOV_WHISPER_MODEL_ID}`,
};

// Whisper Base.en (English-only, q8_0) from ggerganov/whisper.cpp on Hugging Face
const WHISPER_BASE_EN_Q8_0_FILE = 'ggml-base.en-q8_0.bin';
// Approximate size based on upstream metadata (~81.8 MB)
const WHISPER_BASE_EN_Q8_0_SIZE = 85_782_016;
const PRESET_ASR_MODEL_BASE_EN_Q8_0: AsrModel = {
  id: `${GGERGANOV_WHISPER_MODEL_ID}/${WHISPER_BASE_EN_Q8_0_FILE}`,
  name: 'Whisper Base.en (English, q8_0)',
  author: 'ggerganov',
  repo: 'whisper.cpp',
  filename: WHISPER_BASE_EN_Q8_0_FILE,
  size: WHISPER_BASE_EN_Q8_0_SIZE,
  isDownloaded: false,
  progress: 0,
  origin: AsrModelOrigin.HF,
  downloadUrl: `https://huggingface.co/${GGERGANOV_WHISPER_MODEL_ID}/resolve/main/${WHISPER_BASE_EN_Q8_0_FILE}`,
  hfUrl: `https://huggingface.co/${GGERGANOV_WHISPER_MODEL_ID}`,
};

const PRESET_ASR_MODELS = [
  PRESET_ASR_MODEL_SMALL,
  PRESET_ASR_MODEL_SMALL_Q5,
  PRESET_ASR_MODEL_BASE_EN_Q5_1,
  PRESET_ASR_MODEL_BASE_EN_Q8_0,
];

export class AsrModelStore {
  models: AsrModel[] = [...PRESET_ASR_MODELS];

  activeModelId: string | undefined = undefined;
  lastUsedModelId: string | undefined = undefined;

  downloadError: ErrorState | null = null;

  constructor() {
    makeAutoObservable(this, {activeModel: computed});

    makePersistable(this, {
      name: 'AsrModelStore',
      properties: ['models', 'activeModelId', 'lastUsedModelId'],
      storage: AsyncStorage,
    }).then(async () => {
      runInAction(() => {
        this.models = this.models.filter(m => m.origin !== AsrModelOrigin.ASSET);
      });
      this.ensurePresetSmallModelPresent();
      await this.refreshDownloadStatuses();
    });

    // Listen to download lifecycle updates
    downloadManager.addCallbacks({
      onProgress: (modelId, progress) => {
        if (!progress || typeof progress !== 'object') {
          return;
        }
        const model = this.models.find(m => m.id === modelId);
        if (!model) {
          return;
        }
        runInAction(() => {
          model.progress = typeof progress.progress === 'number' ? progress.progress : 0;
          const speed = progress.speed != null ? String(progress.speed) : '';
          const eta = progress.eta != null ? String(progress.eta) : '';
          model.downloadSpeed = `${speed} ${uiStore.l10n.common.downloadETA}: ${eta}`.trim();
        });
      },
      onComplete: modelId => {
        const model = this.models.find(m => m.id === modelId);
        if (!model) {
          return;
        }
        runInAction(() => {
          model.progress = 100;
          model.isDownloaded = true;
        });
      },
      onError: (modelId, error) => {
        const model = this.models.find(m => m.id === modelId);
        if (model) {
          runInAction(() => {
            model.progress = 0;
            model.isDownloaded = false;
          });
        }

        runInAction(() => {
          this.downloadError = createErrorState(error, 'download', 'huggingface', {
            modelId,
          });
        });
      },
    });
  }

  private ensurePresetSmallModelPresent() {
    PRESET_ASR_MODELS.forEach(preset => {
      const exists = this.models.some(m => m.id === preset.id);
      if (!exists) {
        runInAction(() => {
          this.models.push(preset);
        });
      }
    });
  }

  get activeModel(): AsrModel | undefined {
    return this.activeModelId
      ? this.models.find(m => m.id === this.activeModelId)
      : undefined;
  }

  setActiveModel(modelId: string | undefined) {
    runInAction(() => {
      this.activeModelId = modelId;
      this.lastUsedModelId = modelId;
    });
  }

  getModelFullPath = async (model: AsrModel): Promise<string | undefined> => {
    if (!model || typeof model !== 'object') {
      return undefined;
    }
    if (model.fullPath) {
      return model.fullPath;
    }
    if (model.origin === AsrModelOrigin.HF) {
      const author = model.author || 'unknown';
      const repo = model.repo || 'unknown';
      return `${RNFS.DocumentDirectoryPath}/models/asr/hf/${author}/${repo}/${model.filename}`;
    }

    // LOCAL fallback (if ever used)
    return `${RNFS.DocumentDirectoryPath}/models/asr/local/${model.filename}`;
  };

  refreshDownloadStatuses = async () => {
    await Promise.all(
      this.models.map(async model => {
        const path = await this.getModelFullPath(model);
        if (!path) {
          return;
        }
        try {
          const exists = await RNFS.exists(path);
          runInAction(() => {
            model.isDownloaded = exists && !downloadManager.isDownloading(model.id);
            if (model.isDownloaded) {
              model.progress = 100;
            }
          });
        } catch (err) {
          console.warn(`${TAG}: Failed to check file existence:`, err);
        }
      }),
    );
  };

  /**
   * Adds an ASR model reference from Hugging Face model + file.
   * This is analogous to `ModelStore.addHFModel` but much simpler (single file).
   */
  addHFModel = async (hfModel: HuggingFaceModel, modelFile: ModelFile) => {
    const author = hfModel.author || 'unknown';
    const repo = hfModel.id.split('/')[1] || 'unknown';
    const id = `${hfModel.id}/${modelFile.rfilename}`;

    const existing = this.models.find(m => m.id === id);
    if (existing) {
      return existing;
    }

    const newModel: AsrModel = {
      id,
      name: modelFile.rfilename,
      author,
      repo,
      size: modelFile.size || 0,
      filename: modelFile.rfilename.split('/').pop() || modelFile.rfilename,
      isDownloaded: false,
      downloadUrl: modelFile.url,
      hfUrl: hfModel.url,
      progress: 0,
      origin: AsrModelOrigin.HF,
    };

    // Precompute fullPath (destination)
    newModel.fullPath = await this.getModelFullPath(newModel);

    runInAction(() => {
      this.models.push(newModel);
    });

    return newModel;
  };

  downloadHFModel = async (hfModel: HuggingFaceModel, modelFile: ModelFile) => {
    try {
      const model = await this.addHFModel(hfModel, modelFile);
      if (!model) {
        throw new Error('Failed to add ASR model to store');
      }
      await this.checkSpaceAndDownload(model.id);
    } catch (error) {
      console.error(`${TAG}: Failed to set up ASR model download:`, error);
      Alert.alert(
        uiStore.l10n.errors.downloadSetupFailedTitle,
        t(uiStore.l10n.errors.downloadSetupFailedMessage, {
          message: (error as Error).message,
        }),
      );
    }
  };

  checkSpaceAndDownload = async (modelId: string) => {
    const model = this.models.find(m => m.id === modelId);
    if (!model) {
      throw new Error(`ASR model not found: ${modelId}`);
    }

    if (!model.downloadUrl) {
      throw new Error('Model has no download URL');
    }

    const destinationPath = (await this.getModelFullPath(model)) || '';
    if (!destinationPath) {
      throw new Error('Could not resolve destination path');
    }

    const authToken = hfStore.shouldUseToken ? hfStore.hfToken : null;
    await downloadManager.startDownload(
      {
        id: model.id,
        downloadUrl: model.downloadUrl,
        size: model.size,
        filename: model.filename,
      },
      destinationPath,
      authToken,
    );
  };

  cancelDownload = async (modelId: string) => {
    await downloadManager.cancelDownload(modelId);
  };

  isDownloading = (modelId: string) => downloadManager.isDownloading(modelId);

  deleteModel = async (model: AsrModel) => {
    const path = await this.getModelFullPath(model);
    if (!path) {
      return;
    }
    try {
      const exists = await RNFS.exists(path);
      if (exists) {
        await RNFS.unlink(path);
      }
      runInAction(() => {
        model.isDownloaded = false;
        model.progress = 0;
      });

      if (this.activeModelId === model.id) {
        this.setActiveModel(undefined);
      }
    } catch (error) {
      console.error(`${TAG}: Failed to delete ASR model:`, error);
      Alert.alert('Error', 'Failed to delete ASR model file.');
    }
  };

  removeModelFromList = (model: AsrModel) => {
    runInAction(() => {
      this.models = this.models.filter(m => m.id !== model.id);
    });

    if (this.activeModelId === model.id) {
      this.setActiveModel(undefined);
    }

    return true;
  };

  /**
   * Add an ASR model from a local file path (e.g. user picked a .bin file).
   * Copies the file to app storage under models/asr/local/ and adds it to the list.
   */
  addLocalModel = async (localFilePath: string): Promise<AsrModel> => {
    const filename = localFilePath.split('/').pop() || `asr_${Date.now()}.bin`;
    const permanentDir = `${RNFS.DocumentDirectoryPath}/models/asr/local`;
    const permanentPath = `${permanentDir}/${filename}`;

    const exists = await RNFS.exists(permanentDir);
    if (!exists) {
      await RNFS.mkdir(permanentDir, {recursive: true});
    }

    if (localFilePath !== permanentPath) {
      await RNFS.copyFile(localFilePath, permanentPath);
    }

    let size = 0;
    try {
      const stat = await RNFS.stat(permanentPath);
      size = stat?.size ?? 0;
    } catch {
      // ignore
    }

    const id = `local/${filename}`;
    const existing = this.models.find(m => m.id === id);
    if (existing) {
      await this.refreshDownloadStatuses();
      return existing;
    }

    const newModel: AsrModel = {
      id,
      name: filename,
      filename,
      size,
      isDownloaded: true,
      progress: 100,
      origin: AsrModelOrigin.LOCAL,
      fullPath: permanentPath,
    };

    runInAction(() => {
      this.models.push(newModel);
    });

    return newModel;
  };

  clearDownloadError() {
    runInAction(() => {
      this.downloadError = null;
    });
  }
}

export const asrModelStore = new AsrModelStore();

