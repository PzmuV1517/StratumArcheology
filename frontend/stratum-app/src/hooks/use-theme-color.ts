/**
 * @file
 * Theme color hook.
 *
 * Returns the appropriate color value from the current theme
 * for use in component styling.
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
// eslint-disable-next-line import/no-unresolved
import { Colors } from "@/config/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

/**
 * Returns a color value from the active theme, with optional per-scheme overrides.
 * @param props - Optional light/dark color overrides
 * @param colorName - Key of the color in the theme palette
 * @returns The resolved color string for the current scheme
 */
export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark,
) {
  const theme = useColorScheme() ?? "light";
  const colorFromProps = props[theme];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return Colors[theme][colorName];
  }
}
