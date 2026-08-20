/**
 * @file
 * Delayed loading indicator hook.
 *
 * Shows a loading indicator only after a brief delay to
 * avoid flickering for fast operations.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
import { useState, useEffect } from "react";

/**
 * Delays showing a loading indicator to prevent flicker on fast operations.
 * @param loading - Whether the underlying data is still loading
 * @param delay - Milliseconds to wait before showing the skeleton (default 400)
 * @returns Whether the skeleton/loading indicator should be displayed
 */
export function useDelayedLoading(loading: boolean, delay = 400): boolean {
  const [showSkeleton, setShowSkeleton] = useState(false);

  useEffect(() => {
    if (!loading) {
      // Data arrived - hide skeleton immediately
      setShowSkeleton(false);
      return;
    }

    // Still loading - only reveal skeleton after the delay threshold
    const timer = setTimeout(() => setShowSkeleton(true), delay);
    return () => clearTimeout(timer);
  }, [loading, delay]);

  return showSkeleton;
}
