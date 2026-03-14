import {makeAutoObservable, runInAction} from 'mobx';
import {makePersistable} from 'mobx-persist-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {v4 as uuidv4} from 'uuid';

import type {
  Session,
  SurveyDefinition,
  InterviewTurn,
  AnswerCaptureMethod,
  SessionContextForFollowUp,
} from '../types/session';
import {loadSurvey} from '../services/surveyLoader';
import {
  requestFollowUpSuggestion,
  type LocalCompletionRunner,
} from '../services/followUpService';

const RECENT_QA_PAIRS = 3;
const MAX_TURNS_PER_QUESTION = 4;
const STORAGE_KEY = 'SessionStore_sessions_v1';

/** Flutter-style session store: list of sessions, turns per question, LLM follow-up. */
class SessionStore {
  /** All sessions (persisted). Most recent first. */
  sessions: Session[] = [];

  /** Survey loaded for current session flow (in-memory). */
  currentSurvey: SurveyDefinition | null = null;

  /** When requesting LLM follow-up. */
  isRequestingFollowUp = false;

  /** Last error message. */
  error: string | null = null;

  constructor() {
    makeAutoObservable(this);
    makePersistable(this, {
      name: STORAGE_KEY,
      properties: ['sessions'],
      storage: AsyncStorage,
    });
  }

  clearError() {
    this.error = null;
  }

  /** Create session and load survey. Returns sessionId.
   *
   * When `survey` is provided, it is used directly (API-loaded form).
   * Otherwise, falls back to loading by `surveyIdOrUrl` (bundle or URL).
   */
  async createSession(details: {
    respondentName?: string;
    location?: string;
    enumeratorName?: string;
    surveyIdOrUrl?: string;
    survey?: SurveyDefinition;
    surveySource?: string;
  }): Promise<string> {
    this.clearError();
    let survey;
    try {
      if (details.survey) {
        survey = details.survey;
      } else {
        const idOrUrl = details.surveyIdOrUrl?.trim() || 'cimmyt_en';
        survey = await loadSurvey(idOrUrl);
      }
    } catch (e) {
      runInAction(() => {
        this.error = e instanceof Error ? e.message : String(e);
      });
      throw e;
    }
    runInAction(() => {
      this.currentSurvey = survey;
    });
    const now = Date.now();
    const sessionId = uuidv4();
    const session: Session = {
      sessionId,
      respondentName: details.respondentName?.trim() || undefined,
      location: details.location?.trim() || undefined,
      enumeratorName: details.enumeratorName?.trim() || undefined,
      surveyId: survey.id,
      surveyName: survey.name,
      surveyBundleKeyOrUrl:
        details.surveySource?.trim() ??
        details.surveyIdOrUrl?.trim() ??
        survey.id,
      status: 'in_progress',
      createdAt: now,
      updatedAt: now,
      turns: [],
    };
    runInAction(() => {
      this.sessions = [session, ...this.sessions.filter(s => s.sessionId !== sessionId)];
    });
    return sessionId;
  }

  getSession(sessionId: string): Session | null {
    return this.sessions.find(s => s.sessionId === sessionId) ?? null;
  }

  /** Ensure survey for a session is loaded (e.g. when opening QuestionList or Interview). */
  async ensureSurveyForSession(session: Session): Promise<SurveyDefinition | null> {
    if (this.currentSurvey?.id === session.surveyId) return this.currentSurvey;
    try {
      // For API-based sessions we don't have a reloadable survey URL/bundle key yet.
      // In that case, rely on in-memory currentSurvey only.
      if (
        !session.surveyBundleKeyOrUrl ||
        session.surveyBundleKeyOrUrl.startsWith('api:')
      ) {
        return this.currentSurvey;
      }
      const survey = await loadSurvey(session.surveyBundleKeyOrUrl);
      runInAction(() => {
        this.currentSurvey = survey;
      });
      return survey;
    } catch {
      return null;
    }
  }

  /** Turns for one question in a session (ordered by turnNumber). */
  getTurnsForQuestion(sessionId: string, questionId: string): InterviewTurn[] {
    const session = this.getSession(sessionId);
    if (!session) return [];
    return session.turns
      .filter(t => t.questionId === questionId)
      .sort((a, b) => a.turnNumber - b.turnNumber);
  }

  /** Next turn number for this question (1-based). */
  getNextTurnNumber(sessionId: string, questionId: string): number {
    const turns = this.getTurnsForQuestion(sessionId, questionId);
    return turns.length + 1;
  }

  /** Add a turn and bump session updatedAt. */
  addTurn(
    sessionId: string,
    questionId: string,
    questionText: string,
    answerText: string,
    captureMethod: AnswerCaptureMethod,
    audioPath?: string,
  ): void {
    const session = this.getSession(sessionId);
    if (!session) return;
    const turnNumber = this.getNextTurnNumber(sessionId, questionId);
    if (turnNumber > MAX_TURNS_PER_QUESTION) {
      return;
    }
    const turn: InterviewTurn = {
      turnId: uuidv4(),
      questionId,
      turnNumber,
      questionText,
      answerText,
      audioPath,
      captureMethod,
      timestamp: Date.now(),
    };
    runInAction(() => {
      session.turns = [...session.turns, turn];
      session.updatedAt = Date.now();
      this.sessions = [...this.sessions];
    });
  }

  updateSessionStatus(sessionId: string, status: 'in_progress' | 'completed'): void {
    const session = this.getSession(sessionId);
    if (!session) return;
    runInAction(() => {
      session.status = status;
      session.updatedAt = Date.now();
      this.sessions = [...this.sessions];
    });
  }

  deleteSession(sessionId: string): void {
    runInAction(() => {
      this.sessions = this.sessions.filter(s => s.sessionId !== sessionId);
      if (this.currentSurvey) {
        const stillNeeded = this.sessions.some(
          s => s.surveyId === this.currentSurvey!.id,
        );
        if (!stillNeeded) this.currentSurvey = null;
      }
    });
  }

  /** Build context for LLM from turns for this question. */
  buildFollowUpContext(
    sessionId: string,
    questionId: string,
    questionText: string,
    targetOutcome: string | undefined,
    probeBank: string[],
    respondentAnswer: string,
  ): SessionContextForFollowUp {
    const turns = this.getTurnsForQuestion(sessionId, questionId);
    const recentQAPairs = turns
      .slice(-RECENT_QA_PAIRS)
      .map(t => ({ questionText: t.questionText, answerText: t.answerText }));
    const session = this.getSession(sessionId);
    return {
      surveyName: session?.surveyName ?? '',
      currentQuestionId: questionId,
      currentQuestionText: questionText,
      targetOutcome,
      probeBank,
      respondentAnswer,
      recentQAPairs,
    };
  }

  /** Request follow-up; uses on-device model when localCompletion is provided, else dedicated API only. Returns suggested text or null. */
  async requestFollowUp(
    sessionId: string,
    questionId: string,
    questionText: string,
    targetOutcome: string | undefined,
    probeBank: string[],
    respondentAnswer: string,
    localCompletion?: LocalCompletionRunner,
  ): Promise<string | null> {
    runInAction(() => {
      this.isRequestingFollowUp = true;
    });
    try {
      const context = this.buildFollowUpContext(
        sessionId,
        questionId,
        questionText,
        targetOutcome,
        probeBank,
        respondentAnswer,
      );
      const res = await requestFollowUpSuggestion(context, {
        localCompletion,
      });
      if (res.type === 'none' || !res.text.trim()) return null;
      return res.text.trim();
    } finally {
      runInAction(() => {
        this.isRequestingFollowUp = false;
      });
    }
  }

  get maxTurnsPerQuestion(): number {
    return MAX_TURNS_PER_QUESTION;
  }
}

export const sessionStore = new SessionStore();
