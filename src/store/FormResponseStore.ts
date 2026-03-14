import {makeAutoObservable, runInAction} from 'mobx';
import {makePersistable} from 'mobx-persist-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Persisted store for form fill responses keyed by formId and widget/field id.
 * Used by FormFillScreen and written by InterviewScreen when returning from voice.
 */

export type FormValues = Record<string, unknown>;

class FormResponseStore {
  forms: Record<string, FormValues> = {};

  constructor() {
    makeAutoObservable(this);
    makePersistable(this, {
      name: 'FormResponseStore',
      properties: ['forms'],
      storage: AsyncStorage,
    }).catch(() => {
      // Non-fatal if persistence setup fails; store will still work in-memory.
    });
  }

  getFormValues(formId: string): FormValues {
    return this.forms[formId] ? {...this.forms[formId]} : {};
  }

  setResponse(formId: string, fieldId: string, value: unknown): void {
    const existing = this.forms[formId] ?? {};
    runInAction(() => {
      this.forms = {
        ...this.forms,
        [formId]: {
          ...existing,
          [fieldId]: value,
        },
      };
    });
  }

  setResponses(formId: string, values: FormValues): void {
    const existing = this.forms[formId] ?? {};
    runInAction(() => {
      this.forms = {
        ...this.forms,
        [formId]: {
          ...existing,
          ...values,
        },
      };
    });
  }

  clearForm(formId: string): void {
    runInAction(() => {
      const {[formId]: _removed, ...rest} = this.forms;
      this.forms = rest;
    });
  }

  clearAll(): void {
    runInAction(() => {
      this.forms = {};
    });
  }
}

export const formResponseStore = new FormResponseStore();
