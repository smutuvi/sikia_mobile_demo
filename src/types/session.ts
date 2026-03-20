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
  /** Per-question follow-up cap from interview_config.widget_configs[max_follow_ups]. */
  maxFollowUps?: number;
  /** Allow capturing extended verbatim text for this question. */
  allowExtendedCapture?: boolean;
  /** Dynamic probing goal text. */
  dynamicPromptGoal?: string;
  /** Dynamic probing instructions. */
  dynamicPromptInstructions?: string;
  /** Conversation tone hint. */
  conversationTone?: string;
  /** Researcher notes for the interviewer/LLM. */
  aiNotes?: string;
  /** Auto-fill: source widget id, if this question should be derived from another. */
  autoFillSource?: string;
  /** Auto-fill instructions used to derive this question's value. */
  autoFillInstructions?: string;
}

/** Survey definition loaded from JSON (e.g. CIMMYT format). */
export interface SurveyDefinition {
  id: string;
  name: string;
  language: string;
  /** Global researcher instructions for the interview. */
  globalInstructions?: string;
  /** Language guidance (style, simplicity, etc.). */
  languageInstructions?: string;
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
  /** True if this turn is stored as part of extended capture. */
  isExtended?: boolean;
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
  /** Global researcher instructions (per form). */
  globalInstructions?: string;
  /** Language style instructions (per form). */
  languageInstructions?: string;
  /** Dynamic goal and instructions (per question). */
  dynamicPromptGoal?: string;
  dynamicPromptInstructions?: string;
  /** Tone and researcher notes (per question). */
  conversationTone?: string;
  aiNotes?: string;
  /** Follow-ups already taken for this question, and the per-question cap. */
  followUpsTaken?: number;
  maxFollowUps?: number;
}

/** API response for follow-up suggestion. */
export interface FollowUpSuggestionResponse {
  type: FollowUpSuggestionType;
  text: string;
  rationale?: string;
}
