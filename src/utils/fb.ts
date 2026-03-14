import {getApp} from '@react-native-firebase/app';
import {
  ReactNativeFirebaseAppCheckProvider,
  initializeAppCheck as fbInitializeAppCheck,
} from '@react-native-firebase/app-check';

import {APPCHECK_DEBUG_TOKEN_ANDROID, APPCHECK_DEBUG_TOKEN_IOS} from '@env';

// Track initialization status
let isAppCheckInitialized = false;
let appCheckInstance: any;

export const initializeAppCheck = async () => {
  if (isAppCheckInitialized) {
    return;
  }

  try {
    // Ensure Firebase app is initialized first.
    // In local/dev builds without Firebase config, this may throw –
    // in that case we skip App Check initialization instead of crashing.
    let app;
    try {
      app = getApp();
    } catch (err) {
      console.warn(
        'Firebase app is not configured; skipping App Check initialization.',
        err,
      );
      return;
    }

    // Skip App Check initialization if debug tokens are not configured in dev mode
    if (
      __DEV__ &&
      (!APPCHECK_DEBUG_TOKEN_ANDROID || !APPCHECK_DEBUG_TOKEN_IOS)
    ) {
      console.warn(
        'Firebase App Check debug tokens not configured - skipping initialization in dev mode',
      );
      return;
    }

    // const rnfbProvider = appCheck().newReactNativeFirebaseAppCheckProvider();
    const rnfbProvider = new ReactNativeFirebaseAppCheckProvider();

    rnfbProvider.configure({
      android: {
        provider: __DEV__ ? 'debug' : 'playIntegrity',
        debugToken: APPCHECK_DEBUG_TOKEN_ANDROID,
      },
      apple: {
        provider: __DEV__ ? 'debug' : 'appAttestWithDeviceCheckFallback',
        debugToken: APPCHECK_DEBUG_TOKEN_IOS,
      },
    });
    appCheckInstance = await fbInitializeAppCheck(app, {
      provider: rnfbProvider,
      isTokenAutoRefreshEnabled: true,
    });

    isAppCheckInitialized = true;
  } catch (error) {
    console.error('Failed to initialize Firebase App Check:', error);
    // In non-store or misconfigured builds, just skip App Check instead of crashing.
    return;
  }
};

// Get a fresh App Check token
export const getAppCheckToken = async () => {
  try {
    if (!appCheckInstance) {
      throw new Error('App Check is not initialized');
    }
    const {token} = await appCheckInstance.getToken();
    return token;
  } catch (error) {
    console.error('Failed to get App Check token:', error);
    throw error;
  }
};
