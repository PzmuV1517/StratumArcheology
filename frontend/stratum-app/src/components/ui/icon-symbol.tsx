/**
 * @file
 * Platform-agnostic icon component.
 *
 * Renders SF Symbols on iOS and Material Icons on other
 * platforms.
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
// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type MaterialIconName = ComponentProps<typeof MaterialIcons>["name"];
type IconSymbolName = SymbolViewProps["name"];

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING: Record<string, MaterialIconName> = {
  "house.fill": "home",
  "folder.fill": "folder",
  "globe.americas.fill": "public",
  "message.fill": "message",
  "gearshape.fill": "settings",
  "chevron.backward": "arrow-back",
  "chevron.left": "chevron-left",
  "paperplane.fill": "send",
  "note.text": "description",
  "bubble.left.and.bubble.right.fill": "forum",
  "photo.on.rectangle": "photo-library",
  "map": "map",
  "clock.arrow.circlepath": "history",
  "chart.bar.fill": "bar-chart",
  "chart.bar.doc.horizontal": "assessment",
  "cube.fill": "inventory-2",
  "dice": "casino",
  "ellipsis.circle": "more-horiz",
  "exclamationmark.triangle.fill": "warning",
  "mountain.2.fill": "terrain",
  "person.2.fill": "groups",
  "plus": "add",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
  "line.3.horizontal": "menu",
};

const FALLBACK_ICON: MaterialIconName = "help-outline";

function resolveMaterialName(name: string): MaterialIconName {
  const direct = MAPPING[name];
  if (direct) {
    return direct;
  }

  const withoutFill = name.replace(/\.fill$/u, "");
  if (MAPPING[withoutFill]) {
    return MAPPING[withoutFill];
  }

  // Common SF Symbol aliases used in app route/layout code.
  if (withoutFill.startsWith("chevron.")) {
    return withoutFill.includes("left") ? "chevron-left" : "chevron-right";
  }

  if (withoutFill.includes("message") || withoutFill.includes("bubble")) {
    return "message";
  }

  if (withoutFill.includes("folder")) {
    return "folder";
  }

  if (withoutFill.includes("gear")) {
    return "settings";
  }

  if (withoutFill.includes("chart")) {
    return "bar-chart";
  }

  return FALLBACK_ICON;
}

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={resolveMaterialName(name)} style={style} />;
}
