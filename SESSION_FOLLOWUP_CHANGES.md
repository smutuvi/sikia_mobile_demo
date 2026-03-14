# Session follow-up changes (sikia_mobile)

This document captures the recent adjustments made to the **Session** module’s follow-up generation, focusing on latency and UX when using on-device models only.

## Short summary of the latest changes

1. **Session follow-up prompt/context trimming**
   - Reduced stored recent Q&A pairs per question from 5 to 3, and the prompt now only includes the last 2 pairs.
   - Truncates long respondent answers (to 400 characters) and previous answers (to 200 characters) so very long responses don’t slow the model.
   - Limits probe-bank hints in the prompt to at most 2 items and uses shorter labels (Survey, Question, Answer, Target) to keep the prompt compact.

2. **Local completion tuned for speed in Session**
   - `runTextCompletion` now has a “Session follow-up” mode: when enabled it sets `n_predict = 128` and `enable_thinking = false`, so the model generates fewer tokens and doesn’t output internal reasoning, reducing latency.

3. **Session uses the low-latency preset**
   - The Interview screen’s follow-up call now explicitly uses this Session follow-up preset, so every follow-up generation uses the trimmed prompt plus the faster completion settings on the currently loaded on-device model.

