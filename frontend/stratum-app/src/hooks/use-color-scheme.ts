/**
 * @file
 * Color scheme detection hook.
 *
 * Detects and returns the current system color scheme
 * (light or dark) for theme adaptation.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
import { useThemePreference } from "@/contexts/ThemePreferenceContext";

/**
 * Returns the app-resolved color scheme.
 *
 * If a user override is set in theme preferences, this returns that override.
 * Otherwise it follows the current system color scheme.
 */
export function useColorScheme() {
  const { resolvedColorScheme } = useThemePreference();
  return resolvedColorScheme;
}
