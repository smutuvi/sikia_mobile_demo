// Navigation route names
export const ROUTES = {
  // Main app routes
  CHAT: 'Chat',
  MODELS: 'Models',
  PALS: 'Pals (experimental)',
  BENCHMARK: 'Benchmark',
  SETTINGS: 'Settings',
  APP_INFO: 'App Info',

  // Whisper / ASR test screen (separate menu)
  WHISPER_TEST: 'Whisper Test',

  // Survey interviews with dynamic follow-up (Flutter-style stack)
  SESSION: 'Interviews',
  SESSION_LIST: 'SessionList',
  NEW_SESSION: 'NewSession',
  QUESTION_LIST: 'QuestionList',
  INTERVIEW: 'Interview',
  SESSION_REVIEW: 'SessionReview',

  // Sync
  SYNC: 'Sync',

  // Dev tools route. Only available in debug mode.
  DEV_TOOLS: 'Dev Tools',
};

// Feature flags — Pals and Benchmark are disabled for this deployment.
// Re-enable by adding their screens back to App.tsx and setting these to true.
export const FEATURE_FLAGS = {
  ENABLE_PALS: false,
  ENABLE_BENCHMARK: false,
};
