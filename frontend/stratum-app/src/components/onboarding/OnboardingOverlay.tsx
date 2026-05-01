/**
 * @file
 * Onboarding overlay component.
 *
 * Transparent overlay that highlights UI elements during
 * the onboarding tutorial.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
import React from "react";
import { useOnboarding } from "../../contexts/OnboardingContext";
import { OnboardingPrompt } from "./OnboardingPrompt";
import { OnboardingScreen } from "./OnboardingScreen";

/* ─────────────────────────────────────────────────────────────
 *  OnboardingOverlay
 *
 *  Renders the prompt popup and/or the onboarding swiper
 *  depending on context state.  Drop this into the root layout
 *  as a sibling of <RootLayoutNav />.
 * ────────────────────────────────────────────────────────────── */

export const OnboardingOverlay: React.FC = () => {
  const {
    showPrompt,
    showOnboarding,
    acceptOnboarding,
    declineOnboarding,
    completeOnboarding,
    skipOnboarding,
  } = useOnboarding();

  return (
    <>
      <OnboardingPrompt
        visible={showPrompt}
        onAccept={acceptOnboarding}
        onDecline={declineOnboarding}
      />
      <OnboardingScreen
        visible={showOnboarding}
        onComplete={completeOnboarding}
        onSkip={skipOnboarding}
      />
    </>
  );
};
