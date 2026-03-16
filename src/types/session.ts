/**
 * Session feature: survey definitions, session state, and LLM follow-up suggestions.
 */

/** Single question in a survey (from JSON: question_id, main_question, target_outcome, probe_bank). */
export interface SurveyQuestion {
  questionId: string;
  mainQuestion: string;
  targetOutcome?: string;
  /** Ordered list of possible follow-up prompts (probe bank entries). */
  probeBank: string[];
}

/** Survey definition loaded from JSON (e.g. CIMMYT format). */
export interface SurveyDefinition {
  id: string;
  name: string;
  language: string;
  questions: SurveyQuestion[];
}

/** How the answer was captured. */
export type AnswerCaptureMethod = 'speech' | 'typing';

/** One turn in an interview (one question asked + one answer). Flutter-style. */
export interface InterviewTurn {
  turnId: string;
  questionId: string;
  turnNumber: number;
  questionText: string;
  answerText: string;
  audioPath?: string;
  captureMethod: AnswerCaptureMethod;
  timestamp: number;
}

/** One answered question in the session (interviewer question + respondent answer). @deprecated Use InterviewTurn for Flutter-style sessions. */
export interface QuestionInstance {
  instanceId: string;
  questionId: string;
  questionText: string;
  /** Respondent's answer text. */
  answerText: string;
  captureMethod: AnswerCaptureMethod;
  /** Optional: transcription confidence or similar. */
  metadata?: { confidence?: number };
  answeredAt: number;
}

/** LLM-suggested follow-up: clarifying question or comment. */
export type FollowUpSuggestionType = 'clarifying_question' | 'comment' | 'none';

export interface FollowUpSuggestion {
  suggestionId: string;
  type: FollowUpSuggestionType;
  text: string;
  /** Question/answer context this was generated from. */
  fromQuestionId: string;
  fromAnswerText: string;
  /** Whether the interviewer accepted, rejected, or edited. */
  status: 'pending' | 'accepted' | 'rejected' | 'edited';
  /** If accepted/edited, final text used. */
  finalText?: string;
  createdAt: number;
}

export type SessionStatus =
  | 'not_started'
  | 'in_progress'
  | 'paused'
  | 'completed'
  | 'submitted';

/** Session metadata for list/review (Flutter-style). */
export interface SessionMeta {
  sessionId: string;
  respondentName?: string;
  location?: string;
  enumeratorName?: string;
  surveyId: string;
  surveyName: string;
  surveyBundleKeyOrUrl: string;
  status: 'in_progress' | 'completed';
  createdAt: number;
  updatedAt: number;
  turns: InterviewTurn[];
}

/** A single interview session: one survey, one respondent, ordered turns (Flutter-style). */
export interface Session extends SessionMeta {
  /** Alias for sessionId. */
  id?: string;
}

/** Legacy session shape (single linear survey with questionInstances). @deprecated Use Session with turns for Flutter-style. */
export interface LegacySession {
  sessionId: string;
  surveyId: string;
  surveyName: string;
  surveyBundleKeyOrUrl?: string;
  respondentId?: string;
  status: SessionStatus;
  questionInstances: QuestionInstance[];
  pendingSuggestion: FollowUpSuggestion | null;
  currentQuestionIndex: number;
  createdAt: number;
  updatedAt: number;
}

/** Slice of session state sent to the LLM for follow-up suggestion. */
export interface SessionContextForFollowUp {
  surveyName: string;
  currentQuestionId: string;
  currentQuestionText: string;
  targetOutcome?: string;
  probeBank: string[];
  respondentAnswer: string;
  /** Last N Q&A pairs for context. */
  recentQAPairs: Array<{ questionText: string; answerText: string }>;
  /** Full English name of the interview language (e.g. 'Swahili'). Used to instruct LLM response language. */
  languageName?: string;
}

/** API response for follow-up suggestion. */
export interface FollowUpSuggestionResponse {
  type: FollowUpSuggestionType;
  text: string;
  rationale?: string;
}
