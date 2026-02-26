/**
 * @file
 * Onboarding overlay component.
 *
 * Transparent overlay that highlights UI elements during
 * the onboarding tutorial.
 *
 * MIT License
 *
 * Copyright (c) 2025 Banu Andrei & Mircea Levin-Constantin
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
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
