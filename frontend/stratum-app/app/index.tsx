/**
 * @file
 * Application entry screen.
 *
 * Redirects to the main tabs or authentication flow based
 * on the user's login state.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  useWindowDimensions,
  Linking,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { useColorScheme } from "@/hooks/use-color-scheme";

// Only import these on web to avoid native compilation issues
/* eslint-disable @typescript-eslint/no-require-imports */
const ColorBends =
  Platform.OS === "web"
    ? require("../src/components/effects/ColorBends.jsx").default
    : null;
const StarBorder =
  Platform.OS === "web"
    ? require("../src/components/effects/StarBorder.jsx").default
    : null;
const DotGrid =
  Platform.OS === "web"
    ? require("../src/components/effects/DotGrid.jsx").default
    : null;
const GradualBlur =
  Platform.OS === "web"
    ? require("../src/components/effects/GradualBlur.jsx").default
    : null;
const CardSwapModule =
  Platform.OS === "web" ? require("../src/components/effects/CardSwap.jsx") : null;
/* eslint-enable @typescript-eslint/no-require-imports */
const CardSwap = CardSwapModule?.default || CardSwapModule;
const Card = CardSwapModule?.Card;

// Load component CSS only on web to avoid native errors
if (Platform.OS === "web") {
  /* eslint-disable @typescript-eslint/no-require-imports */
  require("../src/components/effects/ColorBends.css");
  require("../src/components/effects/DotGrid.css");
  require("../src/components/effects/StarBorder.css");
  require("../src/components/effects/CardSwap.css");
  /* eslint-enable @typescript-eslint/no-require-imports */
}

export default function LandingPage() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDarkMode = (useColorScheme() ?? "light") === "dark";
  const styles = useMemo(() => createStyles(isDarkMode), [isDarkMode]);
  const dotGridBaseColor = isDarkMode ? "#1a0000" : "#e6d2d2";
  const dotGridBackground = isDarkMode ? "#000000" : "#F6F6F6";
  const isNarrow = width < 900;

  // Don't render on native - this is a web-only landing page
  if (Platform.OS !== "web") {
    return null;
  }

  return (
    <section style={{ position: "relative", overflow: "hidden" }}>
      {/* Fixed DotGrid background - interactive dots that respond to mouse */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "auto",
        }}
      >
        <DotGrid
          dotSize={4}
          gap={18}
          baseColor={dotGridBaseColor}
          activeColor="#ff0000"
          proximity={150}
          shockwaveSpeed={15}
          style={{
            width: "100%",
            height: "100%",
            backgroundColor: dotGridBackground,
          }}
        />
      </div>

      {/* Fixed top fade to blend DotGrid into hero */}
      <div className="dotgrid-fade-top" />

      <div
        style={{
          height: "100%",
          overflowY: "auto",
          position: "relative",
          zIndex: 1,
        }}
      >
        <View style={styles.container}>
          <View
            style={[
              styles.hero,
              Platform.OS === "web" ? ({ minHeight: "100vh" } as any) : null,
            ]}
          >
            {/* Animated background */}
            <View style={styles.bg}>
              <ColorBends
                colors={["#ff0000", "#ff1717ff", "#9d0000ff"]}
                rotation={19}
                autoRotate={0}
                speed={0.35}
                scale={1}
                frequency={1}
                warpStrength={1}
                mouseInfluence={1}
                parallax={0.5}
                noise={0.1}
                transparent={false}
              />
            </View>

            {/* Web-only bottom fade to blend ColorBends into page background */}
            <div className="colorbends-fade-bottom" />

            {/* Content overlay */}
            <View style={styles.center}>
              <Text style={styles.logo}>STRATUM</Text>
              <Text style={styles.title}>Dig deeper. Document smarter.</Text>
              <Text style={styles.subtitle}>
                The all-in-one platform for archaeological documentation, research
                management, and team collaboration.
              </Text>
              <View style={{ marginTop: 24 }}>
                <StarBorder
                  as="button"
                  color="white"
                  speed="5s"
                  className="thin-border"
                  thickness={1}
                  onClick={() => router.push("/(auth)/login")}
                  onPress={() => router.push("/(auth)/login")}
                >
                  Get Started
                </StarBorder>
              </View>
            </View>
          </View>

          {/* Informational section */}
          <View style={styles.infoSection}>
            <Text style={styles.sectionHeading}>Why STRATUM?</Text>
            <View style={styles.cards}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>📁 Artefacts, not files</Text>
                <Text style={styles.cardBody}>
                  Group finds, notes, photos, and 3D scans into structured artefacts
                  with automatic manifest tracking.
                </Text>
              </View>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>🔒 Collaborate safely</Text>
                <Text style={styles.cardBody}>
                  Role-based permissions, version history, and confirmation dialogs
                  prevent accidental data loss.
                </Text>
              </View>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>📊 View any format</Text>
                <Text style={styles.cardBody}>
                  CSV, Excel, Markdown, images, point clouds, 3D meshes, and JSON -
                  all with instant preview.
                </Text>
              </View>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>🗺️ Harris Matrix</Text>
                <Text style={styles.cardBody}>
                  Built-in stratigraphic visualization for complex archaeological
                  relationships.
                </Text>
              </View>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>📱 Cross-platform</Text>
                <Text style={styles.cardBody}>
                  Seamless experience on web, iOS, and Android - work from the field
                  or the lab.
                </Text>
              </View>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>📶 Offline-first</Text>
                <Text style={styles.cardBody}>
                  Keep working without internet. Changes sync automatically when you
                  reconnect.
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.docsCard}
              onPress={() => Linking.openURL("https://stratumapp.readthedocs.io")}
            >
              <Text style={styles.cardTitle}>📖 Documentation</Text>
              <Text style={styles.docsLink}>stratumapp.readthedocs.io</Text>
            </TouchableOpacity>
          </View>

          {/* Mosaic highlights (visual variety) */}
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionHeading}>What makes STRATUM different</Text>
            <View
              style={[
                styles.mosaicRow,
                isNarrow ? { flexDirection: "column" } : null,
              ]}
            >
              <View style={styles.mosaicCol}>
                <View style={[styles.card, styles.cardTall]}>
                  <Text style={styles.cardTitle}>Context-rich artefacts</Text>
                  <Text style={styles.cardBody}>
                    Every artefact carries its origin, linked notes, and related
                    assets - results
                    {" aren't"} just files, {"they're"} stories with provenance.
                  </Text>
                </View>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Instant previews</Text>
                  <Text style={styles.cardBody}>
                    Open large CSVs, JSON, point clouds, and Markdown with a fast,
                    consistent UI.
                  </Text>
                </View>
              </View>
              <View style={styles.mosaicCol}>
                <View style={styles.cardAccent}>
                  <Text style={styles.cardBadge}>NEW</Text>
                  <Text style={styles.cardTitle}>Live manifests</Text>
                  <Text style={styles.cardBody}>
                    artefact.json updates automatically as your project grows,
                    keeping everything coherent and traceable.
                  </Text>
                </View>
                <View style={[styles.card, styles.cardInset]}>
                  <Text style={styles.cardTitle}>Safe collaboration</Text>
                  <Text style={styles.cardBody}>
                    Role-based access and confirmations reduce mistakes without
                    slowing you down.
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Stats row */}
          <View style={[styles.sectionBlock, { paddingTop: 20, paddingBottom: 0 }]}>
            <View
              style={[
                styles.statsRow,
                isNarrow ? { flexDirection: "column" } : null,
              ]}
            >
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>10×</Text>
                <Text style={styles.statLabel}>Faster documentation</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>1 place</Text>
                <Text style={styles.statLabel}>for all your data</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>Zero</Text>
                <Text style={styles.statLabel}>data loss</Text>
              </View>
            </View>
          </View>

          {/* CardSwap row */}
          <View style={[styles.sectionBlock, { paddingTop: 0, paddingBottom: 150 }]}>
            <View
              style={[
                styles.cardSwapRow,
                isNarrow ? { flexDirection: "column" } : null,
              ]}
            >
              <View style={styles.cardSwapLeft}>
                <Text style={styles.sectionHeading}>Intuitive at every step</Text>
                <Text style={[styles.cardBody, { marginTop: 12 }]}>
                  From creating projects to sharing findings, STRATUM guides you with
                  a clean, modern interface designed for researchers.
                </Text>
              </View>
              <View style={styles.cardSwapRight}>
                <div style={{ height: "600px", position: "relative" }}>
                  {React.createElement(
                    CardSwap,
                    {
                      cardDistance: 60,
                      verticalDistance: 70,
                      delay: 5000,
                      pauseOnHover: false,
                    },
                    React.createElement(Card, { key: 0 }),
                    React.createElement(Card, { key: 1 }),
                    React.createElement(Card, { key: 2 }),
                  )}
                </div>
              </View>
            </View>
          </View>

          {/* Comparison */}
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionHeading}>Why teams switch</Text>
            <View
              style={[
                styles.compareRow,
                isNarrow ? { flexDirection: "column" } : null,
              ]}
            >
              <View style={[styles.card, styles.compareHalf]}>
                <Text style={styles.cardTitle}>Without STRATUM</Text>
                <Text style={styles.cardBody}>
                  • Files scattered across drives{"\n"}• Lost context and provenance
                  {"\n"}• Manual Excel sheets and copy-paste{"\n"}• No offline
                  capability
                </Text>
              </View>
              <View style={[styles.cardAccent, styles.compareHalf]}>
                <Text style={styles.cardTitle}>With STRATUM</Text>
                <Text style={styles.cardBody}>
                  • Organized artefacts with manifests{"\n"}• Linked notes and
                  instant previews
                  {"\n"}• Automatic sync and versioning{"\n"}• Full offline support
                </Text>
              </View>
            </View>
          </View>

          {/* How it works */}
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionHeading}>How it works</Text>
            <View style={styles.stepList}>
              <View style={styles.stepItem}>
                <Text style={styles.stepNumber}>1</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Create a project</Text>
                  <Text style={styles.cardBody}>
                    Set up a new excavation site, research project, or investigation
                    in seconds.
                  </Text>
                </View>
              </View>
              <View style={styles.stepItem}>
                <Text style={styles.stepNumber}>2</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Add artefacts and notes</Text>
                  <Text style={styles.cardBody}>
                    Upload finds, photos, 3D scans, and field notes. Everything stays
                    linked.
                  </Text>
                </View>
              </View>
              <View style={styles.stepItem}>
                <Text style={styles.stepNumber}>3</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Collaborate and share</Text>
                  <Text style={styles.cardBody}>
                    Invite team members, review changes, and export reports when
                    ready.
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Closing CTA */}
          <View style={[styles.ctaSection, { paddingTop: 20, paddingBottom: 400 }]}>
            <Text style={styles.ctaHeading}>Ready to streamline your research?</Text>
            <Text style={styles.ctaSub}>
              Join archaeologists and researchers who trust STRATUM for their
              documentation needs.
            </Text>
            <View style={{ marginTop: 20 }}>
              <StarBorder
                as="button"
                color="white"
                speed="5s"
                className="thin-border"
                thickness={1}
                onClick={() => router.push("/(auth)/register")}
                onPress={() => router.push("/(auth)/register")}
              >
                Create free account
              </StarBorder>
            </View>
          </View>
        </View>
      </div>
      <GradualBlur
        target="screen"
        position="bottom"
        height="6rem"
        strength={5}
        divCount={10}
        curve="bezier"
        exponential={true}
        opacity={1}
        reactive={true}
      />
      <GradualBlur
        target="screen"
        position="top"
        height="3rem"
        strength={2}
        divCount={5}
        curve="bezier"
        exponential={true}
        opacity={1}
        reactive={true}
      />
    </section>
  );
}

const createStyles = (isDarkMode: boolean) => {
  const palette = {
    heroBackground: isDarkMode ? "#000000" : "#F6F6F6",
    logo: isDarkMode ? "#FFFFFF" : "#1A1A1A",
    textPrimary: isDarkMode ? "#F5F5F5" : "#1A1A1A",
    textSecondary: isDarkMode ? "#CFCFCF" : "#555555",
    subtitle: isDarkMode ? "#E5E5E5" : "#444444",
    cardBackground: isDarkMode ? "#0A0A0A" : "#FFFFFF",
    cardBackgroundAlt: isDarkMode ? "#0C0C0C" : "#F3F3F3",
    border: isDarkMode ? "#2A2A2A" : "#D9D9D9",
    docsLink: isDarkMode ? "#8BB4F0" : "#0A7EA4",
    statNumber: isDarkMode ? "#FFFFFF" : "#1A1A1A",
    badgeBackground: isDarkMode ? "#FF0000C7" : "#FF2A2A",
    badgeText: "#FFFFFF",
    stepNumberBackground: isDarkMode ? "#2A2A2A" : "#E5E5E5",
    stepNumberText: isDarkMode ? "#FFFFFF" : "#1A1A1A",
    accentBorder: isDarkMode ? "#FB00007A" : "#FF2A2A66",
  };

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "transparent",
      position: "relative",
      zIndex: 2,
    },
    hero: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      zIndex: 10,
      backgroundColor: palette.heroBackground,
    },
    bg: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 0,
    },
    center: {
      width: "100%",
      maxWidth: 960,
      paddingHorizontal: 24,
      alignItems: "center",
      zIndex: 2,
    },
    logo: {
      color: palette.logo,
      opacity: 0.9,
      fontSize: 14,
      letterSpacing: 6,
      fontWeight: "800",
      marginBottom: 12,
    },
    title: {
      color: palette.textPrimary,
      fontSize: 34,
      lineHeight: 40,
      textAlign: "center",
      fontWeight: "800",
      letterSpacing: 0.4,
    },
    subtitle: {
      color: palette.subtitle,
      fontSize: 16,
      lineHeight: 24,
      textAlign: "center",
      marginTop: 12,
      maxWidth: 720,
    },
    infoSection: {
      backgroundColor: "transparent",
      alignItems: "center",
      paddingTop: 48,
      paddingBottom: 80,
      paddingHorizontal: 24,
    },
    sectionHeading: {
      color: palette.textPrimary,
      fontSize: 28,
      fontWeight: "800",
      letterSpacing: 0.4,
      marginBottom: 24,
    },
    cards: {
      width: "100%",
      maxWidth: 1040,
    },
    docsCard: {
      backgroundColor: palette.cardBackground,
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 16,
      padding: 20,
      marginTop: 12,
      width: "100%",
      maxWidth: 1040,
    },
    docsLink: {
      color: palette.docsLink,
      fontSize: 14,
      lineHeight: 20,
      textDecorationLine: "underline",
    },
    mosaicRow: {
      flexDirection: "row",
      gap: 12,
      width: "100%",
      maxWidth: 1040,
    },
    mosaicCol: {
      flex: 1,
      gap: 12,
    },
    sectionBlock: {
      backgroundColor: "transparent",
      alignItems: "center",
      paddingTop: 40,
      paddingBottom: 60,
      paddingHorizontal: 24,
    },
    card: {
      backgroundColor: palette.cardBackground,
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 16,
      padding: 20,
      marginBottom: 12,
    },
    cardTall: {
      minHeight: 140,
    },
    cardInset: {
      backgroundColor: palette.cardBackgroundAlt,
    },
    cardAccent: {
      backgroundColor: palette.cardBackground,
      borderWidth: 1,
      borderColor: palette.accentBorder,
      borderRadius: 16,
      padding: 20,
      marginBottom: 12,
    },
    cardBadge: {
      alignSelf: "flex-start",
      color: palette.badgeText,
      backgroundColor: palette.badgeBackground,
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: 999,
      fontSize: 12,
      fontWeight: "700",
      marginBottom: 8,
    },
    statsRow: {
      flexDirection: "row",
      gap: 12,
      width: "100%",
      maxWidth: 1040,
    },
    statCard: {
      flex: 1,
      backgroundColor: palette.cardBackground,
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 16,
      paddingVertical: 18,
      paddingHorizontal: 16,
      alignItems: "center",
    },
    statNumber: {
      color: palette.statNumber,
      fontSize: 28,
      fontWeight: "800",
    },
    statLabel: {
      color: palette.textSecondary,
      marginTop: 4,
      fontSize: 13,
    },
    compareRow: {
      flexDirection: "row",
      gap: 12,
      width: "100%",
      maxWidth: 1040,
    },
    compareHalf: {
      flex: 1,
    },

    cardSwapRow: {
      flexDirection: "row",
      gap: 12,
      width: "100%",
      maxWidth: 1040,
      alignItems: "stretch",
    },
    cardSwapLeft: {
      flex: 1,
      justifyContent: "center",
    },
    cardSwapRight: {
      flex: 1,
      minHeight: 600,
      width: "100%",
      alignItems: "stretch",
    },
    stepList: {
      width: "100%",
      maxWidth: 1040,
    },
    stepItem: {
      flexDirection: "row",
      alignItems: "flex-start",
      backgroundColor: palette.cardBackground,
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
    },
    stepNumber: {
      width: 32,
      height: 32,
      borderRadius: 16,
      textAlign: "center",
      textAlignVertical: "center",
      color: palette.stepNumberText,
      backgroundColor: palette.stepNumberBackground,
      marginRight: 12,
      fontWeight: "800",
      lineHeight: 32,
    },
    ctaSection: {
      alignItems: "center",
      paddingVertical: 64,
      paddingHorizontal: 24,
    },
    ctaHeading: {
      color: palette.textPrimary,
      fontSize: 28,
      fontWeight: "800",
      letterSpacing: 0.4,
      marginBottom: 8,
      textAlign: "center",
    },
    ctaSub: {
      color: palette.textSecondary,
      fontSize: 16,
      lineHeight: 22,
      textAlign: "center",
      maxWidth: 720,
    },
    cardTitle: {
      color: palette.textPrimary,
      fontSize: 18,
      fontWeight: "700",
      marginBottom: 6,
      letterSpacing: 0.3,
    },
    cardBody: {
      color: palette.textSecondary,
      fontSize: 14,
      lineHeight: 20,
    },
  });
};
