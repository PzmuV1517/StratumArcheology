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
