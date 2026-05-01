/**
 * @file
 * Web-specific color scheme detection hook.
 *
 * Uses CSS media queries to detect browser color scheme
 * preferences.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
import { useEffect, useState } from "react";
import { useThemePreference } from "@/contexts/ThemePreferenceContext";

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);
  const { resolvedColorScheme } = useThemePreference();

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  if (hasHydrated) {
    return resolvedColorScheme;
  }

  return "light";
}
