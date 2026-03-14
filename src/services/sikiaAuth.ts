/**
 * Sikia backend + Firebase auth (matches Flutter flow).
 * POST /api/v1/mobile/auth/login with enum_id + password → custom_token → Firebase signInWithCustomToken.
 */
import {makeAutoObservable, runInAction} from 'mobx';
import auth, {FirebaseAuthTypes} from '@react-native-firebase/auth';

const DEFAULT_AUTH_BASE_URL =
  'https://sikia-backend-888018102762.us-central1.run.app';

function getConfig(): Record<string, string | undefined> {
  try {
    const Config = require('react-native-config').default;
    return Config ?? {};
  } catch {
    return {};
  }
}

export function getSikiaAuthBaseUrl(): string {
  const url = getConfig().AUTH_BASE_URL?.trim();
  return url || DEFAULT_AUTH_BASE_URL;
}

export function isSikiaAuthConfigured(): boolean {
  return !!getConfig().AUTH_BASE_URL?.trim();
}

function extractToken(data: Record<string, unknown>): string | null {
  const get = (obj: Record<string, unknown>, key: string) => {
    const v = obj[key];
    return typeof v === 'string' && v.length > 0 ? v : null;
  };
  let token =
    get(data, 'custom_token') ??
    get(data, 'access_token') ??
    get(data, 'token') ??
    get(data, 'accessToken') ??
    get(data, 'jwt');
  if (!token && data.data && typeof data.data === 'object') {
    const nested = data.data as Record<string, unknown>;
    token =
      get(nested, 'custom_token') ??
      get(nested, 'access_token') ??
      get(nested, 'token') ??
      get(nested, 'accessToken');
  }
  return token;
}

export interface SikiaAuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

class SikiaAuthService {
  isLoading = false;
  error: string | null = null;
  private _firebaseUser: FirebaseAuthTypes.User | null = null;

  constructor() {
    makeAutoObservable(this);
    auth().onAuthStateChanged(user => {
      runInAction(() => {
        this._firebaseUser = user;
      });
    });
  }

  get isAuthenticated(): boolean {
    return this._firebaseUser != null;
  }

  get authState(): SikiaAuthState {
    return {
      isAuthenticated: this.isAuthenticated,
      isLoading: this.isLoading,
      error: this.error,
    };
  }

  clearError() {
    runInAction(() => {
      this.error = null;
    });
  }

  async login(enumId: string, password: string): Promise<void> {
    const baseUrl = getSikiaAuthBaseUrl().replace(/\/$/, '');
    const url = `${baseUrl}/api/v1/mobile/auth/login`;

    runInAction(() => {
      this.isLoading = true;
      this.error = null;
    });

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({enum_id: enumId.trim(), password}),
      });

      const data = (await res.json()) as Record<string, unknown>;

      if (!res.ok) {
        const msg =
          (data.detail as string) ||
          (typeof data.message === 'string' ? data.message : res.statusText) ||
          'Login failed';
        runInAction(() => {
          this.error = msg;
        });
        throw new Error(msg);
      }

      const customToken = extractToken(data);
      if (!customToken) {
        const msg = 'No token in response';
        runInAction(() => {
          this.error = msg;
        });
        throw new Error(msg);
      }

      await auth().signInWithCustomToken(customToken);
      const user = auth().currentUser;
      if (!user) {
        runInAction(() => {
          this.error = 'Firebase sign-in failed';
        });
        throw new Error('Firebase sign-in failed');
      }

      runInAction(() => {
        this.error = null;
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      if (!this.error) {
        runInAction(() => {
          this.error = message;
        });
      }
      throw err;
    } finally {
      runInAction(() => {
        this.isLoading = false;
      });
    }
  }

  async signOut(): Promise<void> {
    try {
      await auth().signOut();
      runInAction(() => {
        this.error = null;
      });
    } catch (err) {
      console.warn('Sikia signOut error:', err);
    }
  }

  async getIdToken(forceRefresh = false): Promise<string | null> {
    const user = auth().currentUser;
    if (!user) return null;
    try {
      const token = await user.getIdToken(forceRefresh);
      return token || null;
    } catch {
      return null;
    }
  }
}

export const sikiaAuthService = new SikiaAuthService();
