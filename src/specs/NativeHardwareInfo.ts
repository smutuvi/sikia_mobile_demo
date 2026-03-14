import type {TurboModule} from 'react-native';
import {NativeModules, Platform, TurboModuleRegistry} from 'react-native';

export interface CPUProcessor {
  processor?: string;
  'model name'?: string;
  'cpu MHz'?: string;
  vendor_id?: string;
}

export interface CPUInfo {
  cores: number;
  processors?: CPUProcessor[];
  features?: string[];
  hasFp16?: boolean;
  hasDotProd?: boolean;
  hasSve?: boolean;
  hasI8mm?: boolean;
  socModel?: string;
}

export interface GPUInfo {
  renderer: string;
  vendor: string;
  version: string;
  hasAdreno: boolean;
  hasMali: boolean;
  hasPowerVR: boolean;
  supportsOpenCL: boolean;
  gpuType: string;
}

export interface Spec extends TurboModule {
  getCPUInfo(): Promise<CPUInfo>;
  getGPUInfo(): Promise<GPUInfo>;
  getChipset?(): Promise<string>; // Android only
  /**
   * Get available memory in bytes from the operating system.
   * - Android: Uses ActivityManager.getMemoryInfo() to get availMem
   * - iOS: Uses os_proc_available_memory()
   * @returns Promise<number> Available memory in bytes
   */
  getAvailableMemory(): Promise<number>;
}

// Android: Turbo Module (NativeHardwareInfoSpec). iOS: bridge module (HardwareInfoModule.mm).
// Prefer Turbo Module; fall back to NativeModules for iOS where only the bridge is registered.
const turbo = TurboModuleRegistry.get<Spec>('HardwareInfo');
const bridge = NativeModules.HardwareInfo as Spec | undefined;
const NativeHardwareInfo: Spec =
  turbo ?? bridge ?? (() => {
    throw new Error(
      'HardwareInfo could not be found. Verify that a module by this name is registered in the native binary.',
    );
  })();

export default NativeHardwareInfo;
