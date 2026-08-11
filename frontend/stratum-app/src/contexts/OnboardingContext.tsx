/**
 * @file
 * Onboarding context provider.
 *
 * Manages onboarding flow state and tracks user tutorial
 * completion status.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
import React, {
  createContext,
  useState,
  useContext,
  useCallback,
  ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import api from "../services/api";

/* ─────────────────────────────────────────────────────────────
 *  Onboarding Context  (web-only, swiper-based)
 *
 *  Manages two pieces of state:
 *    1. showPrompt  - the "Would you like a tour?" popup
 *    2. showOnboarding - the full-screen swiper onboarding
 *
 *  DEV_ALWAYS_SHOW_ONBOARDING (below) can be toggled to `true`
 *  to force the prompt on every page refresh regardless of
 *  the backend flag.
 * ────────────────────────────────────────────────────────────── */

/** 🔧  Dev toggle - set to `true` to see the prompt on every refresh */
export const DEV_ALWAYS_SHOW_ONBOARDING = false;

interface OnboardingContextType {
  /** Whether the initial "start onboarding?" prompt should show */
  showPrompt: boolean;
  /** Whether the full onboarding swiper is open */
  showOnboarding: boolean;
  /** User accepted - open the onboarding swiper */
  acceptOnboarding: () => void;
  /** User declined the initial prompt */
  declineOnboarding: () => Promise<void>;
  /** Called when the swiper is completed */
  completeOnboarding: () => Promise<void>;
  /** Called when the user skips mid-onboarding */
  skipOnboarding: () => Promise<void>;
  /** Trigger from Settings → Replay Tutorial */
  replayOnboarding: () => void;
  /** Dismiss the prompt without marking backend */
  dismissPrompt: () => void;
}

const OnboardingContext = createContext<OnboardingContextType>({
  showPrompt: false,
  showOnboarding: false,
  acceptOnboarding: () => {},
  declineOnboarding: async () => {},
  completeOnboarding: async () => {},
  skipOnboarding: async () => {},
  replayOnboarding: () => {},
  dismissPrompt: () => {},
});

/**
 * Provides onboarding flow state and actions to all child components.
 * @param props - Component props containing children to wrap
 * @returns A context provider wrapping children with onboarding state
 */
export const OnboardingProvider = ({ children }: { children: ReactNode }) => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { refreshUser } = useAuth();

  /** Show the initial prompt (called by projects screen) */
  const triggerPrompt = useCallback(() => {
    setShowPrompt(true);
  }, []);

  /** User said "Yes, show me" */
  const acceptOnboarding = useCallback(() => {
    setShowPrompt(false);
    setShowOnboarding(true);
  }, []);

  /** User said "Skip" on the initial prompt */
  const declineOnboarding = useCallback(async () => {
    setShowPrompt(false);
    try {
      await api.patch("/auth/me/onboarding?has_completed=true");
      await refreshUser();
    } catch (e) {
      console.warn("Failed to mark onboarding complete:", e);
    }
  }, [refreshUser]);

  const dismissPrompt = useCallback(() => {
    setShowPrompt(false);
  }, []);

  const markComplete = useCallback(async () => {
    setShowOnboarding(false);
    try {
      await api.patch("/auth/me/onboarding?has_completed=true");
      await refreshUser();
    } catch (e) {
      console.warn("Failed to mark onboarding complete:", e);
    }
  }, [refreshUser]);

  /** Swiper finished all steps */
  const completeOnboarding = useCallback(async () => {
    await markComplete();
  }, [markComplete]);

  /** User tapped X / skip inside the swiper */
  const skipOnboarding = useCallback(async () => {
    await markComplete();
  }, [markComplete]);

  /** Settings → Replay Tutorial */
  const replayOnboarding = useCallback(() => {
    setShowOnboarding(true);
  }, []);

  return (
    <OnboardingContext.Provider
      value={{
        showPrompt,
        showOnboarding,
        acceptOnboarding,
        declineOnboarding,
        completeOnboarding,
        skipOnboarding,
        replayOnboarding,
        dismissPrompt,
        // Expose triggerPrompt via context so projects screen can call it
        ...({ triggerPrompt } as any),
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
};

/**
 * Consumes the OnboardingContext to access onboarding state and actions.
 * @returns The onboarding context value including the triggerPrompt helper
 */
export const useOnboarding = () => {
  const ctx = useContext(OnboardingContext);
  return ctx as OnboardingContextType & { triggerPrompt: () => void };
};
