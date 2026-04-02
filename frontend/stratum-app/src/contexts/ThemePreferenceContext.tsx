/**
 * @file
 * Theme preference context.
 *
 * Stores the user's app-level theme mode selection and exposes
 * the resolved light/dark scheme used across the app.
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
