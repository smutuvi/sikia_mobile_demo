import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

import type {Session} from '../types/session';

const KEY_SYNC_BASE_URL = 'sync_base_url';
const KEY_SYNC_API_KEY = 'sync_api_key';
const DEFAULT_BASE_URL = 'http://10.0.2.2:8001';

function toJsonSafe(obj: any): any {
  if (obj instanceof Date) {
    return obj.toISOString();
  }
  if (Array.isArray(obj)) {
    return obj.map(toJsonSafe);
  }
  if (obj && typeof obj === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'number' && (k === 'createdAt' || k === 'updatedAt' || k === 'timestamp')) {
        out[k] = new Date(v).toISOString();
      } else {
        out[k] = toJsonSafe(v);
      }
    }
    return out;
  }
  return obj;
}

export async function buildSessionPayload(session: Session): Promise<string | null> {
  if (!session) return null;
  const sessionMap = toJsonSafe({
    sessionId: session.sessionId,
    respondentName: session.respondentName,
    location: session.location,
    enumeratorName: session.enumeratorName,
    surveyId: session.surveyId,
    surveyName: session.surveyName,
    surveyBundleKeyOrUrl: session.surveyBundleKeyOrUrl,
    status: session.status,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  });
  const turnsList = toJsonSafe(session.turns ?? []);
  return JSON.stringify({session: sessionMap, turns: turnsList});
}

export type SyncResult = 'success' | 'failure' | 'skipped';

export async function syncPendingToServer(
  payloadJson: string,
  opts: {authToken?: string} = {},
): Promise<SyncResult> {
  const baseUrl = (await AsyncStorage.getItem(KEY_SYNC_BASE_URL)) ?? DEFAULT_BASE_URL;
  const apiKey = await AsyncStorage.getItem(KEY_SYNC_API_KEY);
  const headers: Record<string, string> = {'Content-Type': 'application/json'};
  if (apiKey) headers['X-API-Key'] = apiKey;
  if (opts.authToken) headers.Authorization = `Bearer ${opts.authToken}`;

  const client = axios.create({
    baseURL: baseUrl,
    timeout: 30000,
    headers,
  });

  try {
    const body = JSON.parse(payloadJson);
    const response = await client.post('/sync', body);
    if (response.status >= 200 && response.status < 300) {
      return 'success';
    }
    return 'failure';
  } catch {
    return 'failure';
  }
}

export async function getSyncBaseUrl(): Promise<string> {
  const baseUrl = await AsyncStorage.getItem(KEY_SYNC_BASE_URL);
  return baseUrl ?? DEFAULT_BASE_URL;
}

export async function setSyncBaseUrl(url: string): Promise<void> {
  await AsyncStorage.setItem(KEY_SYNC_BASE_URL, url.trim());
}

export async function getSyncApiKey(): Promise<string | null> {
  return AsyncStorage.getItem(KEY_SYNC_API_KEY);
}

export async function setSyncApiKey(key: string | null): Promise<void> {
  if (!key) {
    await AsyncStorage.removeItem(KEY_SYNC_API_KEY);
  } else {
    await AsyncStorage.setItem(KEY_SYNC_API_KEY, key.trim());
  }
}

