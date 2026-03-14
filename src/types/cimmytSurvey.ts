/**
 * Raw CIMMYT survey JSON format (as in CIMMYT_ALL_questions_en.json).
 */
export interface CimmytQuestionRaw {
  question_id: string;
  main_question: string;
  target_outcome?: string;
  probe_bank?: Record<string, string>;
  cases?: unknown[];
}

export interface CimmytSurveyRaw {
  benchmark_name?: string;
  language?: string;
  notes?: string;
  questions: CimmytQuestionRaw[];
}
