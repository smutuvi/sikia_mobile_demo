#!/usr/bin/env bash
# Run the app on Android (debug) for ASR testing.
# Usage: ./scripts/run-android-with-asr-logs.sh
#
# In the Metro terminal you'll see [ASR] logs when you:
# 1. Tap the mic (start) -> "[ASR] RealtimeTranscriber started..."
# 2. Speak, then tap mic again (stop) -> "[ASR] Stopped..." then "[ASR] onTranscribe event:" and "[ASR] sending to chat input: <text>"
# 3. For Online mode: "[ASR] Calling onRecordingFileReady:" then "[OnlineSTT] File exists, size: ..." and "[OnlineSTT] Uploading..." and "[OnlineSTT] Result:"
# 4. In ChatInput: "[ASR] ChatInput handleVoiceResult: <text>"
# If transcription never appears, check Metro for [ASR] / [OnlineSTT] and any errors.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

echo "Building and running on Android. Watch this terminal for [ASR] logs."
npx react-native run-android
