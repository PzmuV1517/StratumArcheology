#!/bin/bash
# Patch @blazejkustra/react-native-onboarding image size
# The library hardcodes images at 300x600 which is too small for screenshots.
# This patches them to use screenWidth-based responsive sizing.

DIR="$(cd "$(dirname "$0")/.." && pwd)"
python3 "$DIR/scripts/patch-onboarding.py" "$DIR/node_modules/@blazejkustra/react-native-onboarding/lib/module/spill-onboarding/components/OnboardingImageContainer.js" 2>/dev/null && echo "[INFO] Patched onboarding image size" || echo "[INFO]  Onboarding library not found, skipping patch"

# Patch chromium-edge-launcher to use fs.rm instead of rimraf
# (rimraf@3→6 override changes export shape; fs.rm is built-in since Node 16)
EDGE_LAUNCHER="$DIR/node_modules/chromium-edge-launcher/dist/edge-launcher.js"
if [ -f "$EDGE_LAUNCHER" ]; then
  sed -i.bak \
    -e 's|const rimraf = require("rimraf");|const { rm: _fsRm } = require("fs"); const rimraf = (p, cb) => _fsRm(p, { recursive: true, force: true }, cb);|' \
    "$EDGE_LAUNCHER" && rm -f "${EDGE_LAUNCHER}.bak" \
    && echo "[INFO] Patched chromium-edge-launcher (fs.rm)" \
    || echo "[INFO] chromium-edge-launcher patch skipped"
fi

# Patch expo-2d-context test file to use native DOMException (Node 17+)
DOMEX_FILE="$DIR/node_modules/expo-2d-context/test/lib/expo/web-platform-assertions.js"
if [ -f "$DOMEX_FILE" ]; then
  sed -i.bak \
    -e 's|const DOMException = require("domexception");|const DOMException = globalThis.DOMException;|' \
    "$DOMEX_FILE" && rm -f "${DOMEX_FILE}.bak" \
    && echo "[INFO] Patched expo-2d-context DOMException" \
    || echo "[INFO] expo-2d-context DOMException patch skipped"
fi
