#!/usr/bin/env bash
set -e

# Deploy to a physical iPhone (build and run on device).
# Usage: ./scripts/run-ios-device.sh [ "Device Name" ]
# If device name is omitted, uses DEFAULT_UDID below.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
IOS_DIR="$PROJECT_ROOT/ios"

# Default iPhone UDID (use this device when no argument is passed)
DEFAULT_UDID="00008120-001A15242E90201E"

echo "Project root: $PROJECT_ROOT"
echo ""

# Ensure CocoaPods are installed
if [ ! -d "$IOS_DIR/Pods" ] || [ ! -f "$IOS_DIR/Podfile.lock" ]; then
  echo "Installing CocoaPods dependencies..."
  cd "$IOS_DIR"
  pod install
  cd "$PROJECT_ROOT"
  echo ""
fi

if [ -n "$1" ]; then
  echo "Target device: $1"
else
  echo "Target device: $DEFAULT_UDID (default UDID)"
fi

cd "$PROJECT_ROOT"
if [ -n "$1" ]; then
  npx react-native run-ios --device "$1"
else
  npx react-native run-ios --udid "$DEFAULT_UDID"
fi

echo ""
echo "Done. App should be running on your iPhone."
