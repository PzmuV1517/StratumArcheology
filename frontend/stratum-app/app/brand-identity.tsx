/**
 * @file
 * STRATUM Brand Identity reference page.
 *
 * Hidden internal page (no nav links) at /brand-identity that documents
 * the visual system: wordmark, logo variants, colour palette, and
 * typography. Web-only — mirrors the landing page treatment.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
import React, { useEffect, useMemo } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import { useColorScheme } from "@/hooks/use-color-scheme";

const DISPLAY_FONT =
  '"Space Grotesk", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const BODY_FONT =
  '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const SERIF_FONT =
  '"Fraunces", "Source Serif Pro", "Iowan Old Style", Georgia, serif';
const MONO_FONT = '"JetBrains Mono", Menlo, "SF Mono", Consolas, monospace';

const RED = "#FF2A2A";
const RED_DEEP = "#9D0000";
const RED_BRIGHT = "#FF0000";

type Swatch = {
  name: string;
  hex: string;
  role: string;
  light?: boolean;
};

const PALETTE_PRIMARY: Swatch[] = [
  { name: "Stratum Black", hex: "#000000", role: "Primary background, hero" },
  { name: "Bedrock", hex: "#0A0A0A", role: "Page background (dark)" },
  { name: "Sediment", hex: "#111111", role: "Card surface (dark)" },
  { name: "Stratum Red", hex: RED, role: "Primary accent, links" },
  { name: "Excavation", hex: RED_BRIGHT, role: "Active states, hero gradient" },
  { name: "Ochre", hex: RED_DEEP, role: "Deep gradient, pressed states" },
];

const PALETTE_NEUTRALS: Swatch[] = [
  { name: "Bone", hex: "#F7F7F7", role: "Page background (light)", light: true },
  { name: "Limestone", hex: "#FFFFFF", role: "Card surface (light)", light: true },
  { name: "Charcoal", hex: "#2A2A2A", role: "Borders (dark)" },
  { name: "Silt", hex: "#D9D9D9", role: "Borders (light)", light: true },
  { name: "Ash", hex: "#9A9A9A", role: "Secondary text (dark)" },
  { name: "Slate", hex: "#666666", role: "Secondary text (light)" },
];

export default function BrandIdentityScreen() {
  const isDarkMode = (useColorScheme() ?? "dark") === "dark";
  const styles = useMemo(() => createStyles(isDarkMode), [isDarkMode]);
  const router = useRouter();

  // Load Google Fonts on web only
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const id = "stratum-brand-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700;800&family=Fraunces:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=JetBrains+Mono:wght@400;500;700&display=swap";
    document.head.appendChild(link);
  }, []);

  if (Platform.OS !== "web") {
    return (
      <View style={styles.container}>
        <Text style={styles.paragraph}>
          The brand identity reference is web-only.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.frame}>
        <View style={styles.topbar}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backLink}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.eyebrow}>BRAND IDENTITY · v1.0 · INTERNAL</Text>
        </View>

        {/* HERO — primary wordmark */}
        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>The wordmark</Text>
          <StratumWordmark style={styles.heroLogo} />
          <View style={styles.heroRule} />
          <Text style={styles.heroTagline}>Dig deeper. Document smarter.</Text>
        </View>

        <View style={styles.captionRow}>
          <Caption label="WORDMARK" value="STRATUM" />
          <Caption label="TYPEFACE" value="Space Grotesk · 700" />
          <Caption label="TRACKING" value="+0.32em" />
          <Caption label="CASE" value="UPPERCASE" />
        </View>

        {/* SECTION — Logo variants */}
        <Section
          number="01"
          title="Logo variants"
          subtitle="Six approved expressions of the wordmark for different surfaces."
        >
          <View style={styles.variantGrid}>
            {/* Primary — red on black */}
            <View style={[styles.variantCell, { backgroundColor: "#000000" }]}>
              <StratumWordmark style={[styles.variantWordmark, { color: RED }]} />
              <Text style={styles.variantCaption}>Primary · Red on Black</Text>
            </View>

            {/* Inverted — white on black */}
            <View style={[styles.variantCell, { backgroundColor: "#000000" }]}>
              <StratumWordmark
                style={[styles.variantWordmark, { color: "#FFFFFF" }]}
              />
              <Text style={styles.variantCaption}>Mono · White on Black</Text>
            </View>

            {/* Black on white */}
            <View style={[styles.variantCell, { backgroundColor: "#FFFFFF" }]}>
              <StratumWordmark
                style={[styles.variantWordmark, { color: "#000000" }]}
              />
              <Text style={[styles.variantCaption, { color: "#666" }]}>
                Mono · Black on Light
              </Text>
            </View>

            {/* Black on red */}
            <View style={[styles.variantCell, { backgroundColor: RED }]}>
              <StratumWordmark
                style={[styles.variantWordmark, { color: "#000000" }]}
              />
              <Text style={[styles.variantCaption, { color: "#1A0000" }]}>
                Inverse · Black on Red
              </Text>
            </View>

            {/* Stacked lockup with tagline */}
            <View style={[styles.variantCell, { backgroundColor: "#000000" }]}>
              <StratumWordmark
                style={[styles.variantWordmark, { color: "#FFFFFF" }]}
              />
              <View style={styles.lockupRule} />
              <Text style={styles.lockupTagline}>archaeological field platform</Text>
              <Text style={styles.variantCaption}>Lockup · with descriptor</Text>
            </View>

            {/* Monogram — S */}
            <View
              style={[
                styles.variantCell,
                styles.monogramCell,
                { backgroundColor: "#000000" },
              ]}
            >
              <View style={styles.monogramBox}>
                <Text style={styles.monogramS}>S</Text>
                <View style={styles.monogramBar} />
              </View>
              <Text style={styles.variantCaption}>Monogram · favicon, app icon</Text>
            </View>
          </View>
        </Section>

        {/* SECTION — Construction */}
        <Section
          number="02"
          title="Construction"
          subtitle="The wordmark is built on a strict ratio. Tracking, weight, and case are not negotiable."
        >
          <View style={styles.constructionRow}>
            <View style={styles.constructionStage}>
              <StratumWordmark style={styles.constructionWord} />
              <View style={styles.constructionLine} />
              <View style={styles.constructionTicks}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <View key={i} style={styles.constructionTick} />
                ))}
              </View>
            </View>
            <View style={styles.constructionMeta}>
              <MetaRow label="Letterspacing" value="0.32em" />
              <MetaRow label="Weight" value="700 · Bold" />
              <MetaRow label="Optical alignment" value="Centred to baseline" />
              <MetaRow label="Minimum size" value="48px web · 14pt print" />
              <MetaRow label="Clear space" value="Cap-height × 1 on all sides" />
            </View>
          </View>
        </Section>

        {/* SECTION — Palette */}
        <Section
          number="03"
          title="Colour"
          subtitle="Two reds. Two blacks. Five neutrals. Nothing else."
        >
          <Text style={styles.subheading}>Primary</Text>
          <View style={styles.swatchGrid}>
            {PALETTE_PRIMARY.map((s) => (
              <SwatchTile key={s.hex} swatch={s} isDarkMode={isDarkMode} />
            ))}
          </View>

          <Text style={[styles.subheading, { marginTop: 24 }]}>Neutrals</Text>
          <View style={styles.swatchGrid}>
            {PALETTE_NEUTRALS.map((s) => (
              <SwatchTile key={s.hex} swatch={s} isDarkMode={isDarkMode} />
            ))}
          </View>

          {/* Gradient demonstration matching landing hero */}
          <div
            style={{
              marginTop: 32,
              height: 64,
              borderRadius: 4,
              backgroundImage: `linear-gradient(95deg, ${RED_BRIGHT} 0%, ${RED} 50%, ${RED_DEEP} 100%)`,
              display: "flex",
              alignItems: "center",
              paddingLeft: 20,
              paddingRight: 20,
              color: "#FFFFFF",
              fontFamily: MONO_FONT,
              fontSize: 11,
              letterSpacing: 1.6,
            }}
          >
            Hero gradient · ColorBends
          </div>
        </Section>

        {/* SECTION — Typography */}
        <Section
          number="04"
          title="Typography"
          subtitle="A two-typeface system. Geometric sans for the surface, contemporary serif for the substrate."
        >
          {/* Display */}
          <View style={styles.typeBlock}>
            <View style={styles.typeMeta}>
              <Text style={styles.typeRole}>DISPLAY · UI</Text>
              <Text style={styles.typeName}>Space Grotesk</Text>
              <Text style={styles.typeNote}>
                Geometric sans-serif. Used for the wordmark, headlines, navigation,
                and any surface element. Tight, architectural, modern.
              </Text>
              <View style={styles.weightList}>
                <Text
                  style={[
                    styles.weightItem,
                    { fontFamily: DISPLAY_FONT, fontWeight: "300" },
                  ]}
                >
                  Light · 300
                </Text>
                <Text
                  style={[
                    styles.weightItem,
                    { fontFamily: DISPLAY_FONT, fontWeight: "400" },
                  ]}
                >
                  Regular · 400
                </Text>
                <Text
                  style={[
                    styles.weightItem,
                    { fontFamily: DISPLAY_FONT, fontWeight: "500" },
                  ]}
                >
                  Medium · 500
                </Text>
                <Text
                  style={[
                    styles.weightItem,
                    { fontFamily: DISPLAY_FONT, fontWeight: "700" },
                  ]}
                >
                  Bold · 700
                </Text>
              </View>
            </View>
            <View style={styles.typeSpecimen}>
              <Text style={[styles.specimenAa, { fontFamily: DISPLAY_FONT }]}>
                Aa
              </Text>
              <Text style={[styles.specimenGlyphs, { fontFamily: DISPLAY_FONT }]}>
                ABCDEFGHIJKLMNOPQRSTUVWXYZ{"\n"}
                abcdefghijklmnopqrstuvwxyz{"\n"}
                0123456789 — & · ° / →
              </Text>
            </View>
          </View>

          <View style={styles.typeDivider} />

          {/* Body / Sans */}
          <View style={styles.typeBlock}>
            <View style={styles.typeMeta}>
              <Text style={styles.typeRole}>BODY · INTERFACE</Text>
              <Text style={styles.typeName}>Inter</Text>
              <Text style={styles.typeNote}>
                Workhorse for paragraph copy, form fields, and metadata. Reads
                cleanly at 14–16px on every screen.
              </Text>
              <View style={styles.weightList}>
                <Text
                  style={[
                    styles.weightItem,
                    { fontFamily: BODY_FONT, fontWeight: "400" },
                  ]}
                >
                  Regular · 400
                </Text>
                <Text
                  style={[
                    styles.weightItem,
                    { fontFamily: BODY_FONT, fontWeight: "500" },
                  ]}
                >
                  Medium · 500
                </Text>
                <Text
                  style={[
                    styles.weightItem,
                    { fontFamily: BODY_FONT, fontWeight: "700" },
                  ]}
                >
                  Bold · 700
                </Text>
              </View>
            </View>
            <View style={styles.typeSpecimen}>
              <Text style={[styles.specimenSentence, { fontFamily: BODY_FONT }]}>
                Strata are layers of sediment laid down over time. Each one is a
                chapter.
              </Text>
              <Text style={[styles.specimenSmall, { fontFamily: BODY_FONT }]}>
                The quick brown fox jumps over the lazy dog. 0123456789.
              </Text>
            </View>
          </View>

          <View style={styles.typeDivider} />

          {/* Serif accent */}
          <View style={styles.typeBlock}>
            <View style={styles.typeMeta}>
              <Text style={styles.typeRole}>SERIF · NARRATIVE</Text>
              <Text style={styles.typeName}>Fraunces</Text>
              <Text style={styles.typeNote}>
                A contemporary serif with archaeological gravitas — used for
                long-form site histories, publication views, and printed reports.
              </Text>
              <View style={styles.weightList}>
                <Text
                  style={[
                    styles.weightItem,
                    { fontFamily: SERIF_FONT, fontWeight: "400" },
                  ]}
                >
                  Regular · 400
                </Text>
                <Text
                  style={[
                    styles.weightItem,
                    { fontFamily: SERIF_FONT, fontStyle: "italic" },
                  ]}
                >
                  Italic
                </Text>
                <Text
                  style={[
                    styles.weightItem,
                    { fontFamily: SERIF_FONT, fontWeight: "700" },
                  ]}
                >
                  Bold · 700
                </Text>
              </View>
            </View>
            <View style={styles.typeSpecimen}>
              <Text
                style={[styles.specimenSentenceSerif, { fontFamily: SERIF_FONT }]}
              >
                The site sits where three valleys meet — a quiet seam in the
                limestone.
              </Text>
              <Text style={[styles.specimenSmallSerif, { fontFamily: SERIF_FONT }]}>
                Excavated 2024. Catalogue I–IV. — Andrei Banu &amp; Mircea
                Levin-Constantin
              </Text>
            </View>
          </View>

          <View style={styles.typeDivider} />

          {/* Mono */}
          <View style={styles.typeBlock}>
            <View style={styles.typeMeta}>
              <Text style={styles.typeRole}>MONO · DATA</Text>
              <Text style={styles.typeName}>JetBrains Mono</Text>
              <Text style={styles.typeNote}>
                Used for IDs, hashes, GPS coordinates, JSON manifests, and anything
                that should look like a record, not a sentence.
              </Text>
            </View>
            <View style={styles.typeSpecimen}>
              <Text style={[styles.specimenMono, { fontFamily: MONO_FONT }]}>
                {"45.943161° N · 24.966761° E\n"}
                {"artefact_id: SXR-024-A12\n"}
                {"sha256: 7f3c…b91e"}
              </Text>
            </View>
          </View>

          {/* Type scale */}
          <Text style={[styles.subheading, { marginTop: 32 }]}>Type scale</Text>
          <View style={styles.scaleList}>
            <ScaleRow size={48} label="Display" usage="Hero · landing" />
            <ScaleRow size={34} label="Title 1" usage="Page heading" />
            <ScaleRow size={26} label="Title 2" usage="Section heading" />
            <ScaleRow size={20} label="Title 3" usage="Card heading" />
            <ScaleRow size={16} label="Body" usage="Default body" />
            <ScaleRow size={14} label="Body S" usage="Captions, metadata" />
            <ScaleRow size={11} label="Eyebrow" usage="Tracked uppercase labels" />
          </View>
        </Section>

        {/* SECTION — Voice */}
        <Section
          number="05"
          title="Voice"
          subtitle="Three principles, no exceptions."
        >
          <View style={styles.voiceGrid}>
            <View style={styles.voiceCard}>
              <Text style={styles.voiceNumber}>I.</Text>
              <Text style={styles.voiceTitle}>Precise</Text>
              <Text style={styles.voiceBody}>
                We name things by their archaeological reality. Not “stuff” —
                artefacts. Not “folder” — context. Not “file” — record.
              </Text>
            </View>
            <View style={styles.voiceCard}>
              <Text style={styles.voiceNumber}>II.</Text>
              <Text style={styles.voiceTitle}>Quiet</Text>
              <Text style={styles.voiceBody}>
                The interface should feel like field paper: matte, calm, slow to
                react, trustworthy. No exclamations. No celebratory copy.
              </Text>
            </View>
            <View style={styles.voiceCard}>
              <Text style={styles.voiceNumber}>III.</Text>
              <Text style={styles.voiceTitle}>Layered</Text>
              <Text style={styles.voiceBody}>
                Like the stratigraphy that gives us our name — meaning sits in
                layers. Headline first; detail beneath; provenance always within
                reach.
              </Text>
            </View>
          </View>
        </Section>

        {/* Footer */}
        <View style={styles.footer}>
          <StratumWordmark style={styles.footerLogo} />
          <Text style={styles.footerNote}>
            Brand system maintained by Ferritworks S.R.L. · Internal reference, not
            for distribution.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

// ─── Subcomponents ──────────────────────────────────────────────────────────

function Section({
  number,
  title,
  subtitle,
  children,
}: {
  number: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const isDarkMode = (useColorScheme() ?? "dark") === "dark";
  const styles = useMemo(() => createStyles(isDarkMode), [isDarkMode]);
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionNumber}>{number}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Caption({ label, value }: { label: string; value: string }) {
  const isDarkMode = (useColorScheme() ?? "dark") === "dark";
  const styles = useMemo(() => createStyles(isDarkMode), [isDarkMode]);
  return (
    <View style={styles.caption}>
      <Text style={styles.captionLabel}>{label}</Text>
      <Text style={styles.captionValue}>{value}</Text>
    </View>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  const isDarkMode = (useColorScheme() ?? "dark") === "dark";
  const styles = useMemo(() => createStyles(isDarkMode), [isDarkMode]);
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <View style={styles.metaDots} />
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function SwatchTile({
  swatch,
  isDarkMode,
}: {
  swatch: Swatch;
  isDarkMode: boolean;
}) {
  const styles = useMemo(() => createStyles(isDarkMode), [isDarkMode]);
  return (
    <View style={styles.swatchTile}>
      <View
        style={[
          styles.swatchChip,
          {
            backgroundColor: swatch.hex,
            borderColor: swatch.light ? "#D9D9D9" : "transparent",
            borderWidth: swatch.light ? 1 : 0,
          },
        ]}
      />
      <Text style={styles.swatchName}>{swatch.name}</Text>
      <Text style={styles.swatchHex}>{swatch.hex.toUpperCase()}</Text>
      <Text style={styles.swatchRole}>{swatch.role}</Text>
    </View>
  );
}

function ScaleRow({
  size,
  label,
  usage,
}: {
  size: number;
  label: string;
  usage: string;
}) {
  const isDarkMode = (useColorScheme() ?? "dark") === "dark";
  const styles = useMemo(() => createStyles(isDarkMode), [isDarkMode]);
  return (
    <View style={styles.scaleRow}>
      <Text style={[styles.scaleSize]}>{size}</Text>
      <Text
        style={[
          styles.scaleSample,
          { fontSize: size, lineHeight: size * 1.15, fontFamily: DISPLAY_FONT },
        ]}
      >
        Strata
      </Text>
      <View style={styles.scaleMeta}>
        <Text style={styles.scaleLabel}>{label}</Text>
        <Text style={styles.scaleUsage}>{usage}</Text>
      </View>
    </View>
  );
}

function StratumWordmark({ style }: { style: any }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignSelf: "stretch",
        alignItems: "center",
      }}
    >
      <View style={{ flex: 1, alignItems: "flex-end" }}>
        <Text style={style}>STR</Text>
      </View>
      <Text style={style}>A</Text>
      <View style={{ flex: 1, alignItems: "flex-start" }}>
        <Text style={style}>TUM</Text>
      </View>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const createStyles = (isDarkMode: boolean) => {
  const bg = isDarkMode ? "#0A0A0A" : "#F7F7F7";
  const surface = isDarkMode ? "#111111" : "#FFFFFF";
  const border = isDarkMode ? "#2A2A2A" : "#D9D9D9";
  const text = isDarkMode ? "#F5F5F5" : "#1A1A1A";
  const textMuted = isDarkMode ? "#9A9A9A" : "#666666";
  const textDim = isDarkMode ? "#666666" : "#999999";

  return StyleSheet.create({
    container: {
      flexGrow: 1,
      padding: 32,
      backgroundColor: bg,
    },
    frame: {
      width: "100%",
      maxWidth: 1100,
      alignSelf: "center",
      gap: 0,
    },
    topbar: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 64,
    },
    backLink: {
      color: RED,
      fontSize: 13,
      fontWeight: "600",
      letterSpacing: 0.4,
      fontFamily: DISPLAY_FONT,
    },
    eyebrow: {
      color: textDim,
      fontSize: 11,
      letterSpacing: 2,
      fontFamily: MONO_FONT,
    },

    // Hero
    hero: {
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: border,
      paddingVertical: 96,
      alignItems: "center",
      backgroundColor: "transparent",
      marginBottom: 0,
    },
    heroEyebrow: {
      color: textMuted,
      fontSize: 11,
      letterSpacing: 4,
      fontFamily: MONO_FONT,
      textTransform: "uppercase",
      marginBottom: 24,
    },
    heroLogo: {
      color: text,
      fontFamily: DISPLAY_FONT,
      fontSize: 96,
      fontWeight: "700",
      letterSpacing: 30,
      lineHeight: 100,
    } as any,
    heroRule: {
      width: 64,
      height: 2,
      backgroundColor: RED,
      marginVertical: 28,
    },
    heroTagline: {
      color: textMuted,
      fontFamily: SERIF_FONT,
      fontSize: 18,
      fontStyle: "italic",
      letterSpacing: 0.2,
    },

    captionRow: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderColor: border,
      paddingVertical: 20,
      gap: 0,
      marginBottom: 80,
    },
    caption: {
      flex: 1,
      paddingHorizontal: 16,
      borderRightWidth: 1,
      borderColor: border,
    },
    captionLabel: {
      color: textDim,
      fontSize: 10,
      letterSpacing: 1.6,
      fontFamily: MONO_FONT,
      marginBottom: 6,
    },
    captionValue: {
      color: text,
      fontSize: 14,
      fontFamily: DISPLAY_FONT,
      fontWeight: "500",
    },

    // Section scaffolding
    section: {
      marginBottom: 96,
    },
    sectionHeader: {
      flexDirection: "row",
      gap: 24,
      alignItems: "flex-start",
      marginBottom: 40,
      paddingBottom: 24,
      borderBottomWidth: 1,
      borderColor: border,
    },
    sectionNumber: {
      color: RED,
      fontSize: 11,
      letterSpacing: 2,
      fontFamily: MONO_FONT,
      width: 56,
      paddingTop: 6,
    },
    sectionTitle: {
      color: text,
      fontSize: 32,
      fontFamily: DISPLAY_FONT,
      fontWeight: "700",
      letterSpacing: -0.5,
      marginBottom: 8,
    },
    sectionSubtitle: {
      color: textMuted,
      fontSize: 15,
      fontFamily: SERIF_FONT,
      fontStyle: "italic",
      lineHeight: 22,
      maxWidth: 600,
    },
    sectionBody: {},
    subheading: {
      color: textMuted,
      fontSize: 11,
      letterSpacing: 2,
      fontFamily: MONO_FONT,
      textTransform: "uppercase",
      marginBottom: 16,
    },

    // Variants grid
    variantGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 16,
    },
    variantCell: {
      flexBasis: 320,
      flexGrow: 1,
      minWidth: 280,
      aspectRatio: 1.4,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: border,
      padding: 28,
      justifyContent: "center",
      alignItems: "center",
      position: "relative",
    },
    variantWordmark: {
      fontFamily: DISPLAY_FONT,
      fontSize: 28,
      fontWeight: "700",
      letterSpacing: 9,
    } as any,
    variantCaption: {
      position: "absolute",
      bottom: 14,
      left: 16,
      color: "#9A9A9A",
      fontSize: 10,
      letterSpacing: 1.4,
      fontFamily: MONO_FONT,
    },
    lockupRule: {
      width: 28,
      height: 1,
      backgroundColor: RED,
      marginVertical: 12,
    },
    lockupTagline: {
      color: "#9A9A9A",
      fontFamily: SERIF_FONT,
      fontStyle: "italic",
      fontSize: 12,
      letterSpacing: 0.3,
    },
    monogramCell: {},
    monogramBox: {
      width: 96,
      height: 96,
      borderWidth: 2,
      borderColor: RED,
      justifyContent: "center",
      alignItems: "center",
      position: "relative",
    },
    monogramS: {
      color: "#FFFFFF",
      fontFamily: DISPLAY_FONT,
      fontSize: 56,
      fontWeight: "700",
      lineHeight: 60,
    },
    monogramBar: {
      position: "absolute",
      bottom: -2,
      left: -2,
      right: -2,
      height: 6,
      backgroundColor: RED,
    },

    // Construction
    constructionRow: {
      flexDirection: "row",
      gap: 32,
      flexWrap: "wrap",
    },
    constructionStage: {
      flex: 1,
      minWidth: 360,
      backgroundColor: "#000000",
      borderRadius: 4,
      padding: 48,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: border,
    },
    constructionWord: {
      color: "#FFFFFF",
      fontFamily: DISPLAY_FONT,
      fontSize: 44,
      fontWeight: "700",
      letterSpacing: 14,
    } as any,
    constructionLine: {
      width: "100%",
      height: 1,
      backgroundColor: RED,
      marginTop: 24,
      opacity: 0.6,
    },
    constructionTicks: {
      flexDirection: "row",
      width: "100%",
      justifyContent: "space-between",
      marginTop: 6,
    },
    constructionTick: {
      width: 1,
      height: 8,
      backgroundColor: RED,
      opacity: 0.6,
    },
    constructionMeta: {
      flex: 1,
      minWidth: 320,
      gap: 0,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderColor: border,
    },
    metaLabel: {
      color: textMuted,
      fontSize: 13,
      fontFamily: DISPLAY_FONT,
    },
    metaDots: {
      flex: 1,
      borderBottomWidth: 1,
      borderStyle: "dotted",
      borderColor: border,
      marginHorizontal: 12,
      marginBottom: 4,
    },
    metaValue: {
      color: text,
      fontSize: 13,
      fontFamily: MONO_FONT,
    },

    // Swatches
    swatchGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 16,
    },
    swatchTile: {
      flexBasis: 240,
      flexGrow: 1,
      minWidth: 220,
    },
    swatchChip: {
      width: "100%",
      height: 120,
      borderRadius: 4,
      marginBottom: 12,
    },
    swatchName: {
      color: text,
      fontFamily: DISPLAY_FONT,
      fontSize: 14,
      fontWeight: "600",
      letterSpacing: 0.2,
    },
    swatchHex: {
      color: textMuted,
      fontFamily: MONO_FONT,
      fontSize: 12,
      marginTop: 2,
    },
    swatchRole: {
      color: textDim,
      fontSize: 12,
      fontFamily: SERIF_FONT,
      fontStyle: "italic",
      marginTop: 6,
    },
    // Typography
    typeBlock: {
      flexDirection: "row",
      gap: 32,
      paddingVertical: 24,
      flexWrap: "wrap",
    },
    typeMeta: {
      flex: 1,
      minWidth: 280,
      gap: 8,
    },
    typeRole: {
      color: RED,
      fontSize: 10,
      letterSpacing: 2,
      fontFamily: MONO_FONT,
      marginBottom: 4,
    },
    typeName: {
      color: text,
      fontSize: 28,
      fontFamily: DISPLAY_FONT,
      fontWeight: "500",
      letterSpacing: -0.3,
    },
    typeNote: {
      color: textMuted,
      fontSize: 14,
      fontFamily: SERIF_FONT,
      fontStyle: "italic",
      lineHeight: 22,
      marginTop: 4,
      maxWidth: 380,
    },
    weightList: {
      marginTop: 12,
      gap: 4,
    },
    weightItem: {
      color: text,
      fontSize: 16,
    },
    typeSpecimen: {
      flex: 1.4,
      minWidth: 320,
      borderLeftWidth: 1,
      borderColor: border,
      paddingLeft: 32,
      gap: 16,
    },
    specimenAa: {
      color: text,
      fontSize: 96,
      fontWeight: "500",
      lineHeight: 100,
    },
    specimenGlyphs: {
      color: textMuted,
      fontSize: 14,
      lineHeight: 22,
      letterSpacing: 0.3,
    },
    specimenSentence: {
      color: text,
      fontSize: 22,
      lineHeight: 30,
      fontWeight: "500",
    },
    specimenSmall: {
      color: textMuted,
      fontSize: 14,
      lineHeight: 22,
    },
    specimenSentenceSerif: {
      color: text,
      fontSize: 24,
      lineHeight: 32,
      fontWeight: "400",
    },
    specimenSmallSerif: {
      color: textMuted,
      fontSize: 14,
      lineHeight: 22,
      fontStyle: "italic",
    },
    specimenMono: {
      color: text,
      fontSize: 14,
      lineHeight: 22,
    },
    typeDivider: {
      height: 1,
      backgroundColor: border,
      marginVertical: 8,
    },

    // Type scale
    scaleList: {
      gap: 0,
    },
    scaleRow: {
      flexDirection: "row",
      alignItems: "baseline",
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderColor: border,
      gap: 24,
    },
    scaleSize: {
      width: 56,
      color: textDim,
      fontFamily: MONO_FONT,
      fontSize: 12,
    },
    scaleSample: {
      flex: 1,
      color: text,
      fontWeight: "500",
    },
    scaleMeta: {
      width: 200,
      alignItems: "flex-end",
    },
    scaleLabel: {
      color: text,
      fontSize: 13,
      fontFamily: DISPLAY_FONT,
      fontWeight: "600",
    },
    scaleUsage: {
      color: textMuted,
      fontSize: 12,
      fontFamily: SERIF_FONT,
      fontStyle: "italic",
      marginTop: 2,
    },

    // Voice
    voiceGrid: {
      flexDirection: "row",
      gap: 16,
      flexWrap: "wrap",
    },
    voiceCard: {
      flex: 1,
      minWidth: 260,
      borderWidth: 1,
      borderColor: border,
      borderRadius: 4,
      padding: 28,
      backgroundColor: surface,
      gap: 12,
    },
    voiceNumber: {
      color: RED,
      fontFamily: SERIF_FONT,
      fontSize: 28,
      fontStyle: "italic",
    },
    voiceTitle: {
      color: text,
      fontFamily: DISPLAY_FONT,
      fontSize: 22,
      fontWeight: "600",
      letterSpacing: -0.2,
    },
    voiceBody: {
      color: textMuted,
      fontFamily: SERIF_FONT,
      fontSize: 15,
      lineHeight: 24,
    },

    // Footer
    footer: {
      borderTopWidth: 1,
      borderColor: border,
      paddingTop: 48,
      paddingBottom: 16,
      alignItems: "center",
      gap: 16,
    },
    footerLogo: {
      color: text,
      fontFamily: DISPLAY_FONT,
      fontSize: 18,
      fontWeight: "700",
      letterSpacing: 6,
    } as any,
    footerNote: {
      color: textDim,
      fontSize: 12,
      fontFamily: SERIF_FONT,
      fontStyle: "italic",
    },

    // Generic
    paragraph: {
      color: text,
      fontSize: 14,
      lineHeight: 22,
    },
  });
};
