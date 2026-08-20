/**
 * @file
 * Skeleton loading placeholder component.
 *
 * Displays animated placeholder shapes while content
 * is loading.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
import React, { useEffect, useMemo } from "react";
import { DimensionValue, StyleSheet, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useColorScheme } from "@/hooks/use-color-scheme";

// ─── Theme tokens ───────────────────────────────────────────────────────────
const SKELETON_DARK_BASE = "#1A1A1A";
const SKELETON_DARK_HIGHLIGHT = "#2A2A2A";
const SKELETON_LIGHT_BASE = "#E8E8E8";
const SKELETON_LIGHT_HIGHLIGHT = "#F3F3F3";
const SHIMMER_DURATION = 1200; // ms

// ─── Core Skeleton Element ──────────────────────────────────────────────────
interface SkeletonProps {
  /** Width - number (px) or percentage string */
  width?: DimensionValue;
  /** Height in px */
  height?: number;
  /** Border radius; defaults to 8 */
  borderRadius?: number;
  /** Render as a circle instead - `size` sets both width & height */
  circle?: boolean;
  /** Shortcut for circle diameter */
  size?: number;
  /** Extra styles on the wrapper */
  style?: ViewStyle;
}

/**
 * Animated skeleton loading placeholder element.
 * @param props - Component props
 * @returns The rendered component
 */
export function Skeleton({
  width = "100%",
  height = 16,
  borderRadius = 8,
  circle = false,
  size,
  style,
}: SkeletonProps) {
  const isDarkMode = (useColorScheme() ?? "light") === "dark";
  const skeletonBase = isDarkMode ? SKELETON_DARK_BASE : SKELETON_LIGHT_BASE;
  const skeletonHighlight = isDarkMode
    ? SKELETON_DARK_HIGHLIGHT
    : SKELETON_LIGHT_HIGHLIGHT;

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, {
        duration: SHIMMER_DURATION,
        easing: Easing.inOut(Easing.ease),
      }),
      -1, // infinite
      true, // reverse
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0.4, 1]),
  }));

  const resolvedWidth: DimensionValue = circle && size ? size : width;
  const resolvedHeight = circle && size ? size : height;
  const resolvedRadius = circle && size ? size / 2 : borderRadius;

  return (
    <Animated.View
      style={[
        {
          width: resolvedWidth,
          height: resolvedHeight,
          borderRadius: resolvedRadius,
          backgroundColor: skeletonBase,
          overflow: "hidden",
        },
        animatedStyle,
        style,
      ]}
    >
      <LinearGradient
        colors={[skeletonBase, skeletonHighlight, skeletonBase]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

// ─── Preset: Project Card ───────────────────────────────────────────────────
/**
 * Skeleton placeholder for a project card.
 * @returns The rendered component
 */
export function ProjectCardSkeleton() {
  const presets = useSkeletonPresetStyles();

  return (
    <View style={presets.projectCard}>
      <Skeleton width="60%" height={18} style={{ marginBottom: 10 }} />
      <Skeleton width="90%" height={14} style={{ marginBottom: 6 }} />
      <Skeleton width="70%" height={14} style={{ marginBottom: 14 }} />
      <View style={presets.metaRow}>
        <Skeleton width={120} height={12} />
      </View>
    </View>
  );
}

/**
 * Skeleton placeholder for a list of project cards.
 * @param props - Component props
 * @returns The rendered component
 */
export function ProjectListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View style={{ padding: 16 }}>
      {Array.from({ length: count }).map((_, i) => (
        <ProjectCardSkeleton key={i} />
      ))}
    </View>
  );
}

// ─── Preset: Overview Screen ────────────────────────────────────────────────
/**
 * Skeleton placeholder for the overview screen layout.
 * @returns The rendered component
 */
export function OverviewSkeleton() {
  const presets = useSkeletonPresetStyles();

  return (
    <View style={presets.overviewContainer}>
      <View style={presets.welcomeSection}>
        <Skeleton width="55%" height={24} style={{ marginBottom: 8 }} />
        <Skeleton width="75%" height={14} />
      </View>

      <View style={presets.sectionHeader}>
        <Skeleton width={140} height={18} />
        <Skeleton width={50} height={14} />
      </View>

      {Array.from({ length: 3 }).map((_, i) => (
        <View key={i} style={presets.overviewCard}>
          <View style={presets.cardHeaderRow}>
            <Skeleton width="50%" height={16} />
            <Skeleton width={40} height={12} />
          </View>
          <Skeleton
            width="80%"
            height={13}
            style={{ marginTop: 8, marginBottom: 10 }}
          />
          <Skeleton width={100} height={12} style={{ marginBottom: 8 }} />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Skeleton width={100} height={60} borderRadius={10} />
            <Skeleton width={100} height={60} borderRadius={10} />
            <Skeleton width={100} height={60} borderRadius={10} />
          </View>
          <View style={{ marginTop: 12 }}>
            <Skeleton width={100} height={12} />
          </View>
        </View>
      ))}

      <View style={[presets.sectionHeader, { marginTop: 8 }]}>
        <Skeleton width={120} height={18} />
        <Skeleton width={55} height={14} />
      </View>

      <View style={{ flexDirection: "row", gap: 12 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} width={100} height={72} borderRadius={16} />
        ))}
      </View>
    </View>
  );
}

// ─── Preset: Note Detail ────────────────────────────────────────────────────
/**
 * Skeleton placeholder for the note detail view.
 * @returns The rendered component
 */
export function NoteDetailSkeleton() {
  const presets = useSkeletonPresetStyles();

  return (
    <View style={presets.noteDetailContainer}>
      <View style={{ alignItems: "center", marginBottom: 16 }}>
        <Skeleton circle size={56} />
      </View>

      <View style={presets.noteCard}>
        <Skeleton width={60} height={12} style={{ marginBottom: 8 }} />
        <Skeleton width="70%" height={20} />
      </View>

      <View style={presets.noteCard}>
        <Skeleton width={70} height={12} style={{ marginBottom: 12 }} />
        <Skeleton width="100%" height={14} style={{ marginBottom: 8 }} />
        <Skeleton width="95%" height={14} style={{ marginBottom: 8 }} />
        <Skeleton width="85%" height={14} style={{ marginBottom: 8 }} />
        <Skeleton width="60%" height={14} />
      </View>

      <View style={presets.noteCard}>
        <Skeleton width={40} height={12} style={{ marginBottom: 10 }} />
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Skeleton width="45%" height={12} />
          <Skeleton width="45%" height={12} />
        </View>
      </View>
    </View>
  );
}

// ─── Preset: Artefact Grid ──────────────────────────────────────────────────
/**
 * Skeleton placeholder for an artefact image grid.
 * @param props - Component props
 * @returns The rendered component
 */
export function ArtefactGridSkeleton({ count = 4 }: { count?: number }) {
  const presets = useSkeletonPresetStyles();

  return (
    <View style={presets.artefactGrid}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={presets.artefactCard}>
          <Skeleton
            width="100%"
            height={0}
            style={{ aspectRatio: 1, marginBottom: 6 }}
            borderRadius={8}
          />
          <Skeleton width="70%" height={14} style={{ marginBottom: 4 }} />
          <Skeleton width={30} height={12} />
        </View>
      ))}
    </View>
  );
}

// ─── Preset: Artefact Detail ────────────────────────────────────────────────
/**
 * Skeleton placeholder for the artefact detail view.
 * @returns The rendered component
 */
export function ArtefactDetailSkeleton() {
  const presets = useSkeletonPresetStyles();

  return (
    <View style={presets.noteDetailContainer}>
      <Skeleton
        width="100%"
        height={220}
        borderRadius={16}
        style={{ marginBottom: 16 }}
      />

      <View style={presets.noteCard}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <Skeleton width="45%" height={20} />
          <Skeleton width={50} height={16} borderRadius={10} />
        </View>
        <Skeleton width="70%" height={13} style={{ marginBottom: 6 }} />
        <Skeleton width="50%" height={13} />
      </View>

      <View style={presets.noteCard}>
        <Skeleton width={60} height={14} style={{ marginBottom: 12 }} />
        {Array.from({ length: 3 }).map((_, i) => (
          <View
            key={i}
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <Skeleton
              width={36}
              height={36}
              borderRadius={8}
              style={{ marginRight: 12 }}
            />
            <View style={{ flex: 1 }}>
              <Skeleton width="60%" height={14} style={{ marginBottom: 4 }} />
              <Skeleton width="30%" height={11} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Preset: Project Detail (tabs guard) ────────────────────────────────────
/**
 * Skeleton placeholder for the project detail view with tabs.
 * @returns The rendered component
 */
export function ProjectDetailSkeleton() {
  const presets = useSkeletonPresetStyles();

  return (
    <View style={presets.projectDetailContainer}>
      <View style={{ paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20 }}>
        <Skeleton width="50%" height={22} style={{ marginBottom: 8 }} />
        <Skeleton width="80%" height={14} style={{ marginBottom: 16 }} />
        <View style={{ flexDirection: "row", gap: 16 }}>
          <Skeleton width={70} height={28} borderRadius={14} />
          <Skeleton width={70} height={28} borderRadius={14} />
          <Skeleton width={70} height={28} borderRadius={14} />
          <Skeleton width={70} height={28} borderRadius={14} />
        </View>
      </View>

      <View style={{ paddingHorizontal: 20, gap: 16 }}>
        <View style={presets.projectCard}>
          <Skeleton width="60%" height={16} style={{ marginBottom: 10 }} />
          <Skeleton width="90%" height={14} style={{ marginBottom: 6 }} />
          <Skeleton width="75%" height={14} />
        </View>
        <View style={presets.projectCard}>
          <Skeleton width="55%" height={16} style={{ marginBottom: 10 }} />
          <Skeleton width="85%" height={14} style={{ marginBottom: 6 }} />
          <Skeleton width="65%" height={14} />
        </View>
      </View>
    </View>
  );
}

// ─── Preset: Activity Cards ──────────────────────────────────────────────────
/**
 * Skeleton placeholder for a single activity card.
 * @returns The rendered component
 */
export function ActivityCardSkeleton() {
  const presets = useSkeletonPresetStyles();

  return (
    <View style={presets.activityCard}>
      <View style={presets.activityHeader}>
        <Skeleton width={90} height={14} />
        <Skeleton width={50} height={12} />
      </View>
      <Skeleton width="85%" height={14} style={{ marginTop: 8, marginBottom: 6 }} />
      <Skeleton width={60} height={12} />
    </View>
  );
}

/**
 * Skeleton placeholder for a list of activity cards.
 * @param props - Component props
 * @returns The rendered component
 */
export function ActivityListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <ActivityCardSkeleton key={i} />
      ))}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────
function useSkeletonPresetStyles() {
  const isDarkMode = (useColorScheme() ?? "light") === "dark";
  return useMemo(() => createPresetStyles(isDarkMode), [isDarkMode]);
}

const createPresetStyles = (isDarkMode: boolean) => {
  const base = isDarkMode ? SKELETON_DARK_BASE : SKELETON_LIGHT_BASE;
  const border = isDarkMode ? "#2A2A2A" : "#D9D9D9";
  const page = isDarkMode ? "#0D0D0D" : "#F6F6F6";

  return StyleSheet.create({
    projectCard: {
      backgroundColor: base,
      padding: 16,
      borderRadius: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: border,
    },
    metaRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: border,
    },
    overviewContainer: {
      flex: 1,
      backgroundColor: page,
      padding: 20,
      paddingTop: 60,
    },
    welcomeSection: {
      marginBottom: 24,
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },
    overviewCard: {
      backgroundColor: base,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: border,
      padding: 16,
      marginBottom: 12,
    },
    cardHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    noteDetailContainer: {
      flex: 1,
      backgroundColor: page,
      paddingHorizontal: 20,
      paddingTop: 24,
    },
    noteCard: {
      backgroundColor: base,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: border,
      padding: 16,
      marginBottom: 12,
    },
    artefactGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
    },
    artefactCard: {
      width: 180,
      backgroundColor: base,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: border,
      padding: 8,
    },
    projectDetailContainer: {
      flex: 1,
      backgroundColor: page,
    },
    activityCard: {
      backgroundColor: base,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: border,
    },
    activityHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
  });
};
