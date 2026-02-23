/**
 * useDelayedLoading
 *
 * Returns `true` only when the `loading` input has been `true` for longer than
 * `delay` ms (default 400 ms). This prevents skeleton screens from flashing
 * on fast loads — the spinner/skeleton only appears for genuinely slow fetches.
 *
 * Usage:
 *   const showSkeleton = useDelayedLoading(loading);        // 400 ms default
 *   const showSkeleton = useDelayedLoading(loading, 500);   // custom delay
 */
import { useState, useEffect } from "react";

export function useDelayedLoading(loading: boolean, delay = 400): boolean {
  const [showSkeleton, setShowSkeleton] = useState(false);

  useEffect(() => {
    if (!loading) {
      // Data arrived — hide skeleton immediately
      setShowSkeleton(false);
      return;
    }

    // Still loading — only reveal skeleton after the delay threshold
    const timer = setTimeout(() => setShowSkeleton(true), delay);
    return () => clearTimeout(timer);
  }, [loading, delay]);

  return showSkeleton;
}
