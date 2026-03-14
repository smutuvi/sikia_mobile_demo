/**
 * Load survey from CIMMYT-style JSON (bundle or URL).
 * Deduplicates by question_id and normalizes probe_bank to an array.
 */
import type {SurveyDefinition, SurveyQuestion} from '../types/session';
import type {CimmytSurveyRaw, CimmytQuestionRaw} from '../types/cimmytSurvey';

function normalizeProbeBank(probeBank?: Record<string, string>): string[] {
  if (!probeBank || typeof probeBank !== 'object') return [];
  const entries = Object.entries(probeBank)
    .filter(([, v]) => typeof v === 'string' && v.trim() !== '' && v.toUpperCase() !== 'NONE')
    .map(([k, v]) => ({ key: k, text: (v as string).trim() }));
  entries.sort((a, b) => {
    const na = parseInt(a.key, 10);
    const nb = parseInt(b.key, 10);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return String(a.key).localeCompare(String(b.key));
  });
  return entries.map(e => e.text);
}

function rawToSurveyQuestion(raw: CimmytQuestionRaw): SurveyQuestion {
  return {
    questionId: raw.question_id,
    mainQuestion: raw.main_question ?? '',
    targetOutcome: raw.target_outcome,
    probeBank: normalizeProbeBank(raw.probe_bank),
  };
}

/**
 * Convert raw CIMMYT JSON to SurveyDefinition.
 * Deduplicates questions by question_id (keeps first occurrence).
 */
export function parseCimmytSurvey(raw: CimmytSurveyRaw): SurveyDefinition {
  const seen = new Set<string>();
  const questions: SurveyQuestion[] = [];
  for (const q of raw.questions ?? []) {
    if (!q.question_id || seen.has(q.question_id)) continue;
    seen.add(q.question_id);
    questions.push(rawToSurveyQuestion(q));
  }
  const name = raw.benchmark_name ?? 'Survey';
  const lang = raw.language ?? 'en';
  return {
    id: `${name}_${lang}`.replace(/\s+/g, '_'),
    name,
    language: lang,
    questions,
  };
}

/**
 * Load survey from a bundled JSON asset.
 * Use keys: 'cimmyt_en' (requires bundled cimmyt_en.json in assets/surveys).
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const BUNDLED_SURVEYS: Record<string, CimmytSurveyRaw> = {
  cimmyt_en: require('../assets/surveys/cimmyt_en.json') as CimmytSurveyRaw,
};

export async function loadSurveyFromBundle(bundleKey: string): Promise<SurveyDefinition> {
  const raw = BUNDLED_SURVEYS[bundleKey];
  if (!raw) {
    throw new Error(
      `Unknown bundled survey: ${bundleKey}. Available: ${Object.keys(BUNDLED_SURVEYS).join(', ')}`,
    );
  }
  if (!Array.isArray(raw.questions)) {
    throw new Error(`Invalid survey bundle: ${bundleKey}`);
  }
  return parseCimmytSurvey(raw);
}

/**
 * Load survey from a URL (e.g. file on server or local path via fetch).
 */
export async function loadSurveyFromUrl(url: string): Promise<SurveyDefinition> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load survey: ${res.status} ${res.statusText}`);
  }
  const raw = (await res.json()) as CimmytSurveyRaw;
  if (!raw || !Array.isArray(raw.questions)) {
    throw new Error('Invalid survey JSON: missing questions array');
  }
  return parseCimmytSurvey(raw);
}

/**
 * Load survey by bundle key or URL.
 * If input looks like a URL (http/https or file path), fetch from URL; otherwise use bundle.
 */
export async function loadSurvey(surveyIdOrUrl: string): Promise<SurveyDefinition> {
  const trimmed = surveyIdOrUrl.trim();
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('file://')
  ) {
    return loadSurveyFromUrl(trimmed);
  }
  return loadSurveyFromBundle(trimmed);
}

export const BUNDLED_SURVEY_KEYS = Object.keys(BUNDLED_SURVEYS);
