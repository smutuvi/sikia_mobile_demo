import {makeAutoObservable, runInAction} from 'mobx';
import {makePersistable} from 'mobx-persist-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type {Session} from '../types/session';
import {buildSessionPayload, syncPendingToServer} from '../services/syncService';
import {sessionStore} from './SessionStore';

const STORAGE_KEY = 'SyncStore_queue_v1';

export type SyncQueueStatus = 'pending' | 'uploading' | 'done';

export interface SyncQueueItem {
  id: string;
  sessionId: string;
  payloadJson: string;
  status: SyncQueueStatus;
  retryCount: number;
  lastError?: string;
}

class SyncStore {
  queue: SyncQueueItem[] = [];
  isSyncing = false;
  lastSuccessCount = 0;
  lastFailureCount = 0;
  lastSyncedAt: number | null = null;

  constructor() {
    makeAutoObservable(this);
    makePersistable(this, {
      name: STORAGE_KEY,
      properties: ['queue', 'lastSuccessCount', 'lastFailureCount', 'lastSyncedAt'],
      storage: AsyncStorage,
    });
  }

  get pendingCount(): number {
    return this.queue.filter(item => item.status !== 'done').length;
  }

  private findItem(sessionId: string): SyncQueueItem | undefined {
    return this.queue.find(item => item.sessionId === sessionId && item.status !== 'done');
  }

  async enqueueSession(session: Session): Promise<void> {
    const existing = this.findItem(session.sessionId);
    if (existing) return;
    const payloadJson = await buildSessionPayload(session);
    if (!payloadJson) return;
    const item: SyncQueueItem = {
      id: `${session.sessionId}-${Date.now()}`,
      sessionId: session.sessionId,
      payloadJson,
      status: 'pending',
      retryCount: 0,
    };
    runInAction(() => {
      this.queue = [...this.queue, item];
    });
  }

  private markUploading(id: string): void {
    runInAction(() => {
      const idx = this.queue.findIndex(q => q.id === id);
      if (idx === -1) return;
      this.queue[idx] = {...this.queue[idx], status: 'uploading', lastError: undefined};
    });
  }

  private markDone(id: string): void {
    runInAction(() => {
      const idx = this.queue.findIndex(q => q.id === id);
      if (idx === -1) return;
      this.queue[idx] = {...this.queue[idx], status: 'done'};
    });
  }

  private markFailed(id: string, error?: string): void {
    runInAction(() => {
      const idx = this.queue.findIndex(q => q.id === id);
      if (idx === -1) return;
      const item = this.queue[idx];
      this.queue[idx] = {
        ...item,
        status: 'pending',
        retryCount: item.retryCount + 1,
        lastError: error,
      };
    });
  }

  async syncAll(authToken?: string): Promise<{success: number; failure: number}> {
    if (this.isSyncing) {
      return {success: 0, failure: 0};
    }
    this.isSyncing = true;
    try {
      const pending = this.queue.filter(item => item.status !== 'done');
      let success = 0;
      let failure = 0;
      for (const item of pending) {
        this.markUploading(item.id);
        try {
          const result = await syncPendingToServer(item.payloadJson, {authToken});
          if (result === 'success') {
            this.markDone(item.id);
            const session = sessionStore.getSession(item.sessionId);
            if (session) {
              sessionStore.updateSessionStatus(item.sessionId, 'completed');
            }
            success += 1;
          } else if (result === 'skipped') {
            this.markFailed(item.id);
          } else {
            this.markFailed(item.id);
            failure += 1;
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          this.markFailed(item.id, msg);
          failure += 1;
        }
      }
      runInAction(() => {
        this.lastSuccessCount = success;
        this.lastFailureCount = failure;
        this.lastSyncedAt = Date.now();
      });
      return {success, failure};
    } finally {
      runInAction(() => {
        this.isSyncing = false;
      });
    }
  }
}

export const syncStore = new SyncStore();

