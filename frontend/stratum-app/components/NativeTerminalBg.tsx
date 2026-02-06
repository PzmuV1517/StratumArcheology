/**
 * Lightweight native terminal-style animated background for mobile.
 * Mimics the red-tinted FaultyTerminal WebGL look using React Native Animated API.
 * Shows columns of scrolling characters with random glitch flickers.
 */
import React, { useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

const CHARS = "ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩαβγδεζηθικλμνξοπρστυφχψω⟁⏃⏅☥⊿∑∏≡⌬⏣";
const COL_WIDTH = 18;
const CHAR_HEIGHT = 20;

interface ColumnProps {
  index: number;
  screenHeight: number;
  delay: number;
  speed: number;
  chars: string[];
}

const Column = React.memo(({ index, screenHeight, delay, speed, chars }: ColumnProps) => {
  // The strip is 2x the char list: when the first copy scrolls away the second
  // is already visible, so the loop reset is invisible.
  const stripHeight = chars.length * CHAR_HEIGHT;
  const translateY = useRef(new Animated.Value(-stripHeight)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const fadeIn = Animated.timing(opacity, {
      toValue: 1,
      duration: 800,
      delay,
      useNativeDriver: true,
    });

    // Scroll exactly one strip-height downward so the loop is seamless
    const scroll = Animated.loop(
      Animated.timing(translateY, {
        toValue: 0,
        duration: speed,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    fadeIn.start();
    const t = setTimeout(() => scroll.start(), delay);
    return () => {
      clearTimeout(t);
      fadeIn.stop();
      scroll.stop();
    };
  }, [delay, speed, stripHeight, translateY, opacity]);

  // Render chars twice so scrolling wraps seamlessly
  const charElements = useMemo(() => {
    const doubled = [...chars, ...chars];
    const opacities = doubled.map(() => 0.15 + Math.random() * 0.35);
    return doubled.map((char, i) => (
      <Text
        key={i}
        style={[
          styles.char,
          { opacity: opacities[i] },
        ]}
      >
        {char}
      </Text>
    ));
  }, [chars]);

  return (
    <Animated.View
      style={[
        styles.column,
        {
          left: index * COL_WIDTH,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      {charElements}
    </Animated.View>
  );
});

// Scanline overlay
const Scanlines = React.memo(() => (
  <View style={[StyleSheet.absoluteFill, styles.scanlineContainer]} pointerEvents="none">
    {Array.from({ length: 60 }).map((_, i) => (
      <View key={i} style={styles.scanline} />
    ))}
  </View>
));

export default function NativeTerminalBg() {
  const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
  const numCols = Math.ceil(screenWidth / COL_WIDTH);
  const charsPerCol = Math.ceil(screenHeight / CHAR_HEIGHT) + 10;

  const columns = useMemo(() => {
    return Array.from({ length: numCols }).map((_, colIdx) => {
      const chars = Array.from({ length: charsPerCol }).map(
        () => CHARS[Math.floor(Math.random() * CHARS.length)],
      );
      return {
        index: colIdx,
        delay: Math.random() * 3000,
        speed: 6000 + Math.random() * 8000,
        chars,
      };
    });
  }, [numCols, charsPerCol]);

  return (
    <View style={[StyleSheet.absoluteFill, styles.container]} pointerEvents="none">
      {columns.map((col) => (
        <Column
          key={col.index}
          index={col.index}
          screenHeight={screenHeight}
          delay={col.delay}
          speed={col.speed}
          chars={col.chars}
        />
      ))}
      <Scanlines />
      {/* Fade-out edges so columns dissolve instead of clipping */}
      <LinearGradient
        colors={["#050505", "transparent"]}
        style={styles.fadeTop}
        pointerEvents="none"
      />
      <LinearGradient
        colors={["transparent", "#050505"]}
        style={styles.fadeBottom}
        pointerEvents="none"
      />
      {/* Dark vignette overlay */}
      <View style={[StyleSheet.absoluteFill, styles.vignette]} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#050505",
    overflow: "hidden",
  },
  column: {
    position: "absolute",
    top: 0,
  },
  char: {
    color: "#ff2020",
    fontSize: 14,
    fontFamily: "monospace",
    lineHeight: CHAR_HEIGHT,
    textAlign: "center",
    width: COL_WIDTH,
  },
  scanlineContainer: {
    justifyContent: "space-evenly",
  },
  scanline: {
    height: 1,
    backgroundColor: "rgba(0,0,0,0.15)",
    width: "100%",
  },
  vignette: {
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  fadeTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  fadeBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
  },
});
