#!/bin/bash
# Patch @blazejkustra/react-native-onboarding image size
# The library hardcodes images at 300x600 which is too small for screenshots.
# This patches them to use screenWidth-based responsive sizing.

DIR="$(cd "$(dirname "$0")/.." && pwd)"
python3 "$DIR/scripts/patch-onboarding.py" "$DIR/node_modules/@blazejkustra/react-native-onboarding/lib/module/spill-onboarding/components/OnboardingImageContainer.js" 2>/dev/null && echo "[INFO] Patched onboarding image size" || echo "[INFO]  Onboarding library not found, skipping patch"
