/**
 * Skeleton Loading Components
 *
 * Animated shimmer skeleton placeholders that match the app's dark theme.
 * Built on react-native-reanimated + expo-linear-gradient (both already installed).
 *
 * Usage:
 *   <Skeleton width={120} height={16} />
 *   <Skeleton width="100%" height={180} borderRadius={12} />
 *   <Skeleton circle size={48} />
 */
import React, { useEffect } from "react";
import { View, StyleSheet, DimensionValue, ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

// ─── Theme tokens (matches app dark theme) ──────────────────────────────────
const SKELETON_BASE = "#1A1A1A";
const SKELETON_HIGHLIGHT = "#2A2A2A";
const SHIMMER_DURATION = 1200; // ms

// ─── Core Skeleton Element ──────────────────────────────────────────────────
interface SkeletonProps {
  /** Width — number (px) or string ("100%") */
  width?: DimensionValue;
  /** Height in px */
  height?: number;
  /** Border radius; defaults to 8 */
  borderRadius?: number;
  /** Render as a circle instead — `size` sets both width & height */
  circle?: boolean;
  /** Shortcut for circle diameter */
  size?: number;
  /** Extra styles on the wrapper */
  style?: ViewStyle;
}

export function Skeleton({
  width = "100%",
  height = 16,
  borderRadius = 8,
  circle = false,
  size,
  style,
}: SkeletonProps) {
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
          backgroundColor: SKELETON_BASE,
          overflow: "hidden",
        },
        animatedStyle,
        style,
      ]}
    >
      <LinearGradient
        colors={[SKELETON_BASE, SKELETON_HIGHLIGHT, SKELETON_BASE]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

// ─── Preset: Project Card ───────────────────────────────────────────────────
/**
 * Mimics the project card in the Projects (index) tab.
 */
export function ProjectCardSkeleton() {
  return (
    <View style={presets.projectCard}>
      {/* Title */}
      <Skeleton width="60%" height={18} style={{ marginBottom: 10 }} />
      {/* Description line 1 */}
      <Skeleton width="90%" height={14} style={{ marginBottom: 6 }} />
      {/* Description line 2 */}
      <Skeleton width="70%" height={14} style={{ marginBottom: 14 }} />
      {/* Meta row */}
      <View style={presets.metaRow}>
        <Skeleton width={120} height={12} />
      </View>
    </View>
  );
}

/**
 * Renders N project card skeletons in a vertical list.
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
 * Mimics the Overview tab layout: welcome section + 3 project cards + quick actions.
 */
export function OverviewSkeleton() {
  return (
    <View style={presets.overviewContainer}>
      {/* Welcome section */}
      <View style={presets.welcomeSection}>
        <Skeleton width="55%" height={24} style={{ marginBottom: 8 }} />
        <Skeleton width="75%" height={14} />
      </View>

      {/* Recent Projects header */}
      <View style={presets.sectionHeader}>
        <Skeleton width={140} height={18} />
        <Skeleton width={50} height={14} />
      </View>

      {/* Project cards */}
      {Array.from({ length: 3 }).map((_, i) => (
        <View key={i} style={presets.overviewCard}>
          {/* Header row */}
          <View style={presets.cardHeaderRow}>
            <Skeleton width="50%" height={16} />
            <Skeleton width={40} height={12} />
          </View>
          {/* Description */}
          <Skeleton
            width="80%"
            height={13}
            style={{ marginTop: 8, marginBottom: 10 }}
          />
          {/* Timeline section */}
          <Skeleton width={100} height={12} style={{ marginBottom: 8 }} />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Skeleton width={100} height={60} borderRadius={10} />
            <Skeleton width={100} height={60} borderRadius={10} />
            <Skeleton width={100} height={60} borderRadius={10} />
          </View>
          {/* Footer */}
          <View style={{ marginTop: 12 }}>
            <Skeleton width={100} height={12} />
          </View>
        </View>
      ))}

      {/* Quick Actions header */}
      <View style={[presets.sectionHeader, { marginTop: 8 }]}>
        <Skeleton width={120} height={18} />
        <Skeleton width={55} height={14} />
      </View>

      {/* Quick action buttons */}
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
 * Mimics the note detail screen (icon + title card + content card).
 */
export function NoteDetailSkeleton() {
  return (
    <View style={presets.noteDetailContainer}>
      {/* Header icon circle */}
      <View style={{ alignItems: "center", marginBottom: 16 }}>
        <Skeleton circle size={56} />
      </View>

      {/* Title card */}
      <View style={presets.noteCard}>
        <Skeleton width={60} height={12} style={{ marginBottom: 8 }} />
        <Skeleton width="70%" height={20} />
      </View>

      {/* Content card */}
      <View style={presets.noteCard}>
        <Skeleton width={70} height={12} style={{ marginBottom: 12 }} />
        <Skeleton width="100%" height={14} style={{ marginBottom: 8 }} />
        <Skeleton width="95%" height={14} style={{ marginBottom: 8 }} />
        <Skeleton width="85%" height={14} style={{ marginBottom: 8 }} />
        <Skeleton width="60%" height={14} />
      </View>

      {/* Meta card */}
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
 * Mimics the artefact grid (square preview cards in a 2-col wrap).
 */
export function ArtefactGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View style={presets.artefactGrid}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={presets.artefactCard}>
          {/* Square preview */}
          <Skeleton
            width="100%"
            height={0}
            style={{ aspectRatio: 1, marginBottom: 6 }}
            borderRadius={8}
          />
          {/* Title */}
          <Skeleton width="70%" height={14} style={{ marginBottom: 4 }} />
          {/* Meta number */}
          <Skeleton width={30} height={12} />
        </View>
      ))}
    </View>
  );
}

// ─── Preset: Project Detail (tabs guard) ────────────────────────────────────
/**
 * Replaces the ProjectLoadingState spinner for all project sub-tabs.
 */
export function ProjectDetailSkeleton() {
  return (
    <View style={presets.projectDetailContainer}>
      {/* Project header area */}
      <View style={{ paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20 }}>
        <Skeleton width="50%" height={22} style={{ marginBottom: 8 }} />
        <Skeleton width="80%" height={14} style={{ marginBottom: 16 }} />
        {/* Tab bar placeholder */}
        <View style={{ flexDirection: "row", gap: 16 }}>
          <Skeleton width={70} height={28} borderRadius={14} />
          <Skeleton width={70} height={28} borderRadius={14} />
          <Skeleton width={70} height={28} borderRadius={14} />
          <Skeleton width={70} height={28} borderRadius={14} />
        </View>
      </View>

      {/* Content area — generic card skeletons */}
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

// ─── Preset: Activity Card ──────────────────────────────────────────────────
/**
 * Skeleton for an activity / timeline card.
 */
export function ActivityCardSkeleton() {
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
 * Renders N activity card skeletons.
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

// ─── Preset: Artefact Detail ────────────────────────────────────────────────
/**
 * Mimics the artefact detail screen (preview image + metadata cards + file list).
 */
export function ArtefactDetailSkeleton() {
  return (
    <View style={presets.noteDetailContainer}>
      {/* Preview image area */}
      <Skeleton
        width="100%"
        height={220}
        borderRadius={16}
        style={{ marginBottom: 16 }}
      />

      {/* Metadata card */}
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

      {/* Files card */}
      <View style={presets.noteCard}>
        <Skeleton width={60} height={14} style={{ marginBottom: 12 }} />
        {Array.from({ length: 3 }).map((_, i) => (
          <View
            key={i}
            style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}
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

// ─── Styles ─────────────────────────────────────────────────────────────────
const presets = StyleSheet.create({
  // -- Project card
  projectCard: {
    backgroundColor: SKELETON_BASE,
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#2A2A2A",
  },

  // -- Overview
  overviewContainer: {
    flex: 1,
    backgroundColor: "#0D0D0D",
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
    backgroundColor: SKELETON_BASE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    padding: 16,
    marginBottom: 12,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  // -- Note detail
  noteDetailContainer: {
    flex: 1,
    backgroundColor: "#0D0D0D",
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  noteCard: {
    backgroundColor: SKELETON_BASE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    padding: 16,
    marginBottom: 12,
  },

  // -- Artefact grid
  artefactGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  artefactCard: {
    width: 180,
    backgroundColor: SKELETON_BASE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    padding: 8,
  },

  // -- Project detail
  projectDetailContainer: {
    flex: 1,
    backgroundColor: "#0D0D0D",
  },

  // -- Activity card
  activityCard: {
    backgroundColor: SKELETON_BASE,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  activityHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});
