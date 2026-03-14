#!/usr/bin/env bash
set -e

# Build Android release APK and install on a connected device.
# Use this for on-device testing: release build reflects real performance
# (no Metro, no __DEV__ overhead) and is the right mode for testing Whisper ASR on device.
# Note: OPENAI_API_KEY and other .env vars are baked in at build time—re-run this script after changing .env.

# Resolve project root (directory containing android/ and package.json)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ANDROID_DIR="$PROJECT_ROOT/android"
APK_PATH="$ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"

echo "Project root: $PROJECT_ROOT"
echo "Building Android release APK..."
echo ""

cd "$ANDROID_DIR"
./gradlew assembleRelease

if [ ! -f "$APK_PATH" ]; then
  echo "Error: Release APK not found at $APK_PATH"
  exit 1
fi

echo ""
echo "Checking for connected Android device..."
DEVICES=$(adb devices -l | grep -w "device" || true)
if [ -z "$DEVICES" ]; then
  echo "No Android device found. Connect a device with USB debugging enabled, then run:"
  echo "  adb install -r $APK_PATH"
  exit 1
fi

echo "Installing release APK on device..."
adb install -r "$APK_PATH"

echo ""
echo "Done. Release build installed on your Android phone."
