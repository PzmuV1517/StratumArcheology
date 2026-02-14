import React from "react";
import { Platform, View, Text, StyleSheet, TouchableOpacity, type ImageSourcePropType } from "react-native";
import Onboarding from "@blazejkustra/react-native-onboarding";

/* ─────────────────────────────────────────────────────────────
 *  OnboardingScreen
 *
 *  Full-screen swiper onboarding using @blazejkustra/react-native-onboarding.
 *  Renders only on web. Uses placeholder text & images for now —
 *  swap them out with real content later.
 * ────────────────────────────────────────────────────────────── */

interface Props {
  visible: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

/* Placeholder image component used for the intro panel (which accepts render fns) */
function PlaceholderImage({ label, color }: { label: string; color: string }) {
  return (
    <View style={[placeholderStyles.box, { backgroundColor: color }]}>
      <Text style={placeholderStyles.emoji}>
        {label}
      </Text>
    </View>
  );
}

const placeholderStyles = StyleSheet.create({
  box: {
    width: 280,
    height: 280,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: {
    fontSize: 72,
  },
});

/**
 * Generate an SVG data-URI placeholder image (colored rounded-rect + emoji).
 * Satisfies ImageSourcePropType via { uri: string }. Replace with real
 * require()/assets later.
 */
function placeholderSvg(color: string, emoji: string): ImageSourcePropType {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300">
    <rect width="300" height="300" rx="24" fill="${color}"/>
    <text x="150" y="180" font-size="80" text-anchor="middle">${emoji}</text>
  </svg>`;
  return { uri: `data:image/svg+xml,${encodeURIComponent(svg)}` };
}

const introStyles = StyleSheet.create({
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#F5F5F5",
    textAlign: "center",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: "400",
    color: "#999999",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 0,
  },
  button: {
    backgroundColor: "#FF2A2A",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    alignSelf: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
});

export const OnboardingScreen: React.FC<Props> = ({
  visible,
  onComplete,
  onSkip,
}) => {
  if (!visible || Platform.OS !== "web") return null;

  return (
    <View
      style={{
        position: "absolute" as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99998,
        backgroundColor: "#111111",
        // Web-only: behave like position:fixed
        ...(Platform.OS === "web" ? ({ position: "fixed" } as any) : {}),
      }}
    >
      <Onboarding
        introPanel={{
          title: <Text style={introStyles.title}>Welcome to STRATUM</Text>,
          subtitle: (
            <Text style={introStyles.subtitle}>
              Your all-in-one platform for archaeological excavation management. Let's take a quick tour!
            </Text>
          ),
          button: ({ onPressStart }) => (
            <TouchableOpacity
              style={introStyles.button}
              onPress={onPressStart}
              activeOpacity={0.8}
            >
              <Text style={introStyles.buttonText}>Get Started</Text>
            </TouchableOpacity>
          ),
        }}
        steps={[
          {
            label: "Step 1",
            title: "Create Projects",
            description:
              "Organize your excavation sites into projects. Invite team members and manage everything in one place.",
            buttonLabel: "Next",
            image: placeholderSvg("#1A2A1A", "📋"),
            position: "top",
          },
          {
            label: "Step 2",
            title: "Record Forms",
            description:
              "Fill in Context Features, Stratigraphic Units, and Artefact records following standard archaeological practices.",
            buttonLabel: "Next",
            image: placeholderSvg("#1A1A2A", "📝"),
            position: "top",
          },
          {
            label: "Step 3",
            title: "Upload Files",
            description:
              "Capture photos, drawings, and documents. Organize them in folders and link them to your records.",
            buttonLabel: "Next",
            image: placeholderSvg("#2A2A1A", "📸"),
            position: "top",
          },
          {
            label: "Step 4",
            title: "GPS & Mapping",
            description:
              "Pin excavation points on an interactive map. Track coordinates for every find and context.",
            buttonLabel: "Next",
            image: placeholderSvg("#1A2A2A", "🗺️"),
            position: "top",
          },
          {
            label: "Step 5",
            title: "Team Collaboration",
            description:
              "Work together in real-time. See live updates when colleagues add records or upload files.",
            buttonLabel: "Next",
            image: placeholderSvg("#2A1A2A", "👥"),
            position: "top",
          },
          {
            label: "Step 6",
            title: "Works Offline",
            description:
              "STRATUM queues your changes when offline and syncs automatically when you're back online. Perfect for remote sites.",
            buttonLabel: "Finish",
            image: placeholderSvg("#1A1A1A", "📡"),
            position: "top",
          },
        ]}
        onComplete={onComplete}
        onSkip={onSkip}
        showCloseButton={true}
        showBackButton={true}
        wrapInModalOnWeb={false}
        animationDuration={400}
        colors={{
          background: {
            primary: "#111111",
            secondary: "#1A1A1A",
            label: "#2A2A2A",
            accent: "#FF2A2A",
          },
          text: {
            primary: "#F5F5F5",
            secondary: "#999999",
            contrast: "#FFFFFF",
          },
        }}
      />
    </View>
  );
};
