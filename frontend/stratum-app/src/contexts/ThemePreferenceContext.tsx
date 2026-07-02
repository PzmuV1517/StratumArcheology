/**
 * @file
 * Theme preference context.
 *
 * Stores the user's app-level theme mode selection and exposes
 * the resolved light/dark scheme used across the app.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColorScheme as useSystemColorScheme } from "react-native";

export type ThemeMode = "system" | "light" | "dark";
export type ResolvedColorScheme = "light" | "dark";

type ThemePreferenceContextType = {
  themeMode: ThemeMode;
  resolvedColorScheme: ResolvedColorScheme;
  hydrated: boolean;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
};

const STORAGE_KEY = "stratum.themeMode";

const ThemePreferenceContext = createContext<ThemePreferenceContextType | undefined>(
  undefined,
);

export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useSystemColorScheme() ?? "light";
  const [themeMode, setThemeModeState] = useState<ThemeMode>("system");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadThemeMode = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (cancelled) return;

        if (stored === "system" || stored === "light" || stored === "dark") {
          setThemeModeState(stored);
        }
      } catch {
        // Keep default mode if storage read fails.
      } finally {
        if (!cancelled) {
          setHydrated(true);
        }
      }
    };

    void loadThemeMode();

    return () => {
      cancelled = true;
    };
  }, []);

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Keep in-memory preference if storage write fails.
    }
  }, []);

  const resolvedColorScheme: ResolvedColorScheme =
    themeMode === "system" ? systemColorScheme : themeMode;

  const value = useMemo(
    () => ({
      themeMode,
      resolvedColorScheme,
      hydrated,
      setThemeMode,
    }),
    [themeMode, resolvedColorScheme, hydrated, setThemeMode],
  );

  return (
    <ThemePreferenceContext.Provider value={value}>
      {children}
    </ThemePreferenceContext.Provider>
  );
}

export function useThemePreference(): ThemePreferenceContextType {
  const context = useContext(ThemePreferenceContext);
  const systemColorScheme = useSystemColorScheme() ?? "light";

  if (context) {
    return context;
  }

  return {
    themeMode: "system",
    resolvedColorScheme: systemColorScheme,
    hydrated: true,
    setThemeMode: async () => {},
  };
}
