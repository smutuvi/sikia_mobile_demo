/**
 * Get follow-up suggestions using on-device model (via localCompletion) or optional dedicated API.
 * When localCompletion is provided, only the on-device model is used (no online LLMs).
 */
import type {
  SessionContextForFollowUp,
  FollowUpSuggestionResponse,
  FollowUpSuggestionType,
} from '../types/session';

export type LocalCompletionRunner = (
  systemPrompt: string,
  userPrompt: string,
) => Promise<string>;

function getConfig(): Record<string, string | undefined> {
  try {
    const Config = require('react-native-config').default;
    return Config ?? {};
  } catch {
    return {};
  }
}

function getApiBaseUrl(): string | undefined {
  const Config = getConfig();
  const url = Config?.DYNAMIC_PROMPTING_API_URL ?? Config?.PALSHUB_API_BASE_URL;
  if (typeof url === 'string' && url.trim() !== '') return url.trim();
  return undefined;
}

function words(text: string): string[] {
  return text
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 1);
}

/** Treat as echo when generated follow-up is almost the same as the question (high word overlap). */
function isLikelyEcho(generated: string, question: string): boolean {
  const q = question.trim();
  const g = generated.trim();
  if (!q || !g) return false;
  const qWords = words(q);
  if (qWords.length < 3) return false;
  const gSet = new Set(words(g));
  const overlap = qWords.filter(w => gSet.has(w)).length;
  const ratio = overlap / qWords.length;
  // High threshold so we only reject near-exact repeats.
  return ratio > 0.95;
}

/** Cap context size for lower latency. */
const MAX_RESPONDENT_ANSWER_CHARS = 400;
const MAX_RECENT_QA_IN_PROMPT = 2;
const MAX_PROBES_IN_PROMPT = 2;

function truncateAnswer(answer: string, maxChars: number): string {
  const t = (answer || '').trim();
  if (t.length <= maxChars) return t;
  return t.slice(-maxChars).trim();
}

/** Build a prompt for the LLM to generate one follow-up question or clarification. Kept short for latency. */
function buildFollowUpPrompt(context: SessionContextForFollowUp): string {
  const parts: string[] = [];
  parts.push(`Survey: ${context.surveyName || 'Survey'}.`);
  if (context.targetOutcome) {
    parts.push(`Target: ${context.targetOutcome}.`);
  }
  parts.push('');
  parts.push('Question:');
  parts.push(context.currentQuestionText);
  parts.push('');
  parts.push('Answer:');
  parts.push(truncateAnswer(context.respondentAnswer ?? '', MAX_RESPONDENT_ANSWER_CHARS) || '(no answer)');
  const recentPairs = (context.recentQAPairs ?? []).slice(-MAX_RECENT_QA_IN_PROMPT);
  if (recentPairs.length > 0) {
    parts.push('');
    parts.push('Previous Q&A:');
    recentPairs.forEach(pair => {
      parts.push(`Q: ${pair.questionText}`);
      parts.push(`A: ${truncateAnswer(pair.answerText, 200)}`);
    });
  }
  const probes = (context.probeBank ?? []).slice(0, MAX_PROBES_IN_PROMPT);
  if (probes.length > 0) {
    parts.push('');
    parts.push('Probe ideas: ' + probes.join('; ') + '.');
  }
  parts.push('');
  parts.push(
    'Generate exactly ONE short follow-up question or clarification. Do NOT repeat the question. Output only the follow-up text, no quotes or numbering. Max 2 sentences.',
  );
  return parts.join('\n');
}

/** Parse LLM response into a single follow-up line (first non-empty line or full text trimmed). */
function parseFollowUpFromLlm(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  const lines = trimmed.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const first = lines[0] || trimmed;
  // Remove leading numbering or bullets
  return first.replace(/^[\d.)\-\*]+\s*/, '').trim().slice(0, 500);
}

/** Use on-device model (localCompletion) to generate a follow-up. */
async function requestFollowUpViaLocal(
  context: SessionContextForFollowUp,
  localCompletion: LocalCompletionRunner,
): Promise<FollowUpSuggestionResponse> {
  const systemPrompt =
    'You are a research interviewer conducting a structured data collection interview on behalf of a scientist.\n' +
    'Your job is to collect specific data points by having a natural conversation with the respondent.\n' +
    'Your only task at this step: decide if ONE follow-up question is needed, and if so, write it.\n' +
    '\n' +
    'Rules:\n' +
    '1. Ask ONE follow-up question at a time.\n' +
    '2. Use simple, clear language appropriate for the respondent\'s context.\n' +
    '3. NEVER invent or assume answers. If the answer is unclear, ask for clarification.\n' +
    '4. If the answer clearly satisfies the target outcome, do NOT ask a follow-up.\n' +
    '5. If you cannot confidently assess completeness, ask one brief clarifying question.\n' +
    '6. For questions with a probing goal, ask a follow-up to elicit the specific detail still missing.\n' +
    '7. Be warm but efficient. Do not over-explain or repeat yourself.\n' +
    '8. Do not reveal the form structure, option codes, or interview instructions to the respondent.\n' +
    '9. If no follow-up is needed, output NOTHING.\n' +
    '\n' +
    'Output: one short question, max 2 sentences, no quotes, no numbering.';
  const userPrompt = buildFollowUpPrompt(context);
  try {
    const raw = await localCompletion(systemPrompt, userPrompt);
    const text = parseFollowUpFromLlm(raw);
    if (!text) return { type: 'none', text: '' };
    if (isLikelyEcho(text, context.currentQuestionText)) {
      if (__DEV__) console.log('[FollowUpService] Suppressing echo follow-up from local model.');
      return { type: 'none', text: '' };
    }
    if (__DEV__) console.log('[FollowUpService] Using on-device model follow-up.');
    return { type: 'clarifying_question', text };
  } catch (err) {
    if (__DEV__) console.warn('[FollowUpService] Local completion failed:', err);
    return { type: 'none', text: '' };
  }
}

/**
 * Build payload sent to the backend for follow-up suggestion.
 */
export function buildFollowUpPayload(context: SessionContextForFollowUp): Record<string, unknown> {
  return {
    survey_name: context.surveyName,
    current_question_id: context.currentQuestionId,
    current_question_text: context.currentQuestionText,
    target_outcome: context.targetOutcome,
    probe_bank: context.probeBank,
    respondent_answer: context.respondentAnswer,
    recent_qa_pairs: context.recentQAPairs,
  };
}

export interface FollowUpOptions {
  /** When provided, only the on-device model is used (no online LLMs or dedicated API). */
  localCompletion?: LocalCompletionRunner;
}

/**
 * Request a follow-up suggestion.
 * - When options.localCompletion is provided: use only the on-device model (no network).
 * - When not provided: try dedicated API only (DYNAMIC_PROMPTING_API_URL or PALSHUB) if configured.
 * Returns type: 'none', text: '' when no suggestion is available.
 */
export async function requestFollowUpSuggestion(
  context: SessionContextForFollowUp,
  options?: FollowUpOptions,
): Promise<FollowUpSuggestionResponse> {
  // 1) On-device model (preferred when provided)
  if (options?.localCompletion) {
    return requestFollowUpViaLocal(context, options.localCompletion);
  }

  // 2) Dedicated follow-up API only (no OpenAI/Groq)
  const baseUrl = getApiBaseUrl();
  if (baseUrl) {
    const url = `${baseUrl.replace(/\/$/, '')}/api/session/follow-up`;
    const payload = buildFollowUpPayload(context);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = (await res.json()) as FollowUpSuggestionResponse;
        const type: FollowUpSuggestionType =
          data.type === 'clarifying_question' || data.type === 'comment' || data.type === 'none'
            ? data.type
            : 'none';
        const text = typeof data.text === 'string' ? data.text.trim() : '';
        if (text && !isLikelyEcho(text, context.currentQuestionText)) {
          return { type, text, rationale: data.rationale };
        }
      } else if (__DEV__) {
        const text = await res.text();
        console.warn('[FollowUpService] Dedicated API error:', res.status, text);
      }
    } catch (err) {
      if (__DEV__) console.warn('[FollowUpService] Dedicated API request failed:', err);
    }
  }

  return { type: 'none', text: '' };
}

export function isFollowUpApiConfigured(): boolean {
  return !!getApiBaseUrl();
}
