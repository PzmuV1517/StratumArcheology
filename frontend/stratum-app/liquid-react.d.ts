/**
 * @file
 * Module for liquid-react.d functionality.
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
declare module "liquid-react" {
  import type { ViewProps } from "react-native";
  import type { ReactNode, FC } from "react";

  // ─── Scalar types ──────────────────────────────────────────────────────────

  export type MaterialType =
    | "systemUltraThinMaterial"
    | "systemThinMaterial"
    | "systemMaterial"
    | "systemThickMaterial"
    | "systemChromeMaterial"
    | "systemUltraThinMaterialLight"
    | "systemThinMaterialLight"
    | "systemMaterialLight"
    | "systemThickMaterialLight"
    | "systemChromeMaterialLight"
    | "systemUltraThinMaterialDark"
    | "systemThinMaterialDark"
    | "systemMaterialDark"
    | "systemThickMaterialDark"
    | "systemChromeMaterialDark";

  export type ButtonStyle =
    | "filled"
    | "gray"
    | "tinted"
    | "plain"
    | "bordered"
    | "borderedTinted"
    | "borderedProminent";

  export type ToolbarSystemItem =
    | "done"
    | "cancel"
    | "edit"
    | "save"
    | "add"
    | "flexibleSpace"
    | "fixedSpace"
    | "compose"
    | "reply"
    | "action"
    | "organize"
    | "bookmarks"
    | "search"
    | "refresh"
    | "stop"
    | "camera"
    | "trash"
    | "play"
    | "pause"
    | "rewind"
    | "fastForward"
    | "undo"
    | "redo"
    | "close";

  export type TabBarSystemItem =
    | "more"
    | "favorites"
    | "featured"
    | "topRated"
    | "recents"
    | "contacts"
    | "history"
    | "bookmarks"
    | "search"
    | "downloads"
    | "mostRecent"
    | "mostViewed";

  export type StackAxis = "vertical" | "horizontal";
  export type StackAlignment =
    | "fill"
    | "leading"
    | "trailing"
    | "center"
    | "firstBaseline"
    | "lastBaseline";
  export type StackDistribution =
    | "fill"
    | "fillEqually"
    | "fillProportionally"
    | "equalSpacing"
    | "equalCentering";

  // ─── Shared item/event types ────────────────────────────────────────────────

  /** A toolbar bar-button-item (icon, title, or system glyph). */
  export interface ToolbarItem {
    icon?: string;
    title?: string;
    systemItem?: ToolbarSystemItem;
    disabled?: boolean;
  }

  /** A menu item (optionally containing sub-items). */
  export interface ToolbarMenuItem {
    id?: string;
    title: string;
    icon?: string;
    destructive?: boolean;
    disabled?: boolean;
    children?: ToolbarMenuItem[];
  }

  export interface TabBarItem {
    title: string;
    icon?: string;
    systemItem?: TabBarSystemItem;
  }

  // ─── Event payload types ────────────────────────────────────────────────────

  /** Payload for switch value-change events. */
  export interface ValueChangeEvent {
    value: boolean;
  }

  export interface SegmentedControlValueChangeEvent {
    selectedIndex: number;
  }

  export interface SearchBarChangeEvent {
    text: string;
  }

  export interface TabBarPressEvent {
    index: number;
  }

  export interface ToolbarMenuActionEvent {
    id: string;
    title: string;
  }

  /** Payload delivered when a NativeToolbarButton inside a NativeToolbar is tapped. */
  export interface ToolbarButtonPressEvent {
    icon: string;
    title: string;
  }

  // ─── Component prop types ───────────────────────────────────────────────────

  export interface NativeMaterialViewProps extends ViewProps {
    material?: MaterialType;
    onPress?: () => void;
  }

  export interface NativeButtonProps extends ViewProps {
    title: string;
    buttonStyle?: ButtonStyle;
    onPress?: () => void;
  }

  export interface NativeSwitchProps extends ViewProps {
    value?: boolean;
    onTintColor?: string;
    thumbTintColor?: string;
    disabled?: boolean;
    /** Payload is `{ value: boolean }` — NOT wrapped in `nativeEvent`. */
    onValueChange?: (event: ValueChangeEvent) => void;
  }

  export interface NativeSegmentedControlProps extends ViewProps {
    segments: string[];
    selectedIndex?: number;
    /** Payload is `{ selectedIndex: number }`. */
    onValueChange?: (event: SegmentedControlValueChangeEvent) => void;
  }

  export interface NativeSearchBarProps extends ViewProps {
    placeholder?: string;
    text?: string;
    onTextChanged?: (event: SearchBarChangeEvent) => void;
    onSearchPressed?: (event: SearchBarChangeEvent) => void;
    onCancelPressed?: () => void;
  }

  export interface NativeNavigationBarProps extends ViewProps {
    title?: string;
    translucent?: boolean;
  }

  export interface NativeToolbarProps extends ViewProps {
    translucent?: boolean;
    children?: ReactNode;
    /**
     * Fires when a NativeToolbarButton child is tapped.
     * Payload: `{ icon: string; title: string }`.
     */
    onToolbarButtonPress?: (event: ToolbarButtonPressEvent) => void;
    /**
     * Fires when a NativeToolbarMenu child action is selected.
     * Payload: `{ id: string; title: string }`.
     */
    onToolbarMenuAction?: (event: ToolbarMenuActionEvent) => void;
  }

  export interface NativeToolbarButtonProps extends ViewProps {
    icon?: string;
    title?: string;
    systemItem?: ToolbarSystemItem;
    disabled?: boolean;
    /** Only fires when the button is NOT inside a NativeToolbar. */
    onPress?: () => void;
  }

  export interface NativeToolbarMenuProps extends ViewProps {
    icon?: string;
    title?: string;
    /** The menu items to show in the pull-down menu. */
    menuItems: ToolbarMenuItem[];
    disabled?: boolean;
    /** Only fires when the menu is NOT inside a NativeToolbar. */
    onMenuAction?: (event: ToolbarMenuActionEvent) => void;
  }

  export interface NativeTabBarProps extends ViewProps {
    items: TabBarItem[];
    selectedIndex?: number;
    translucent?: boolean;
    onTabPress?: (event: TabBarPressEvent) => void;
  }

  export interface NativeGroupedContainerProps extends ViewProps {
    insetGrouped?: boolean;
  }

  export interface NativeCardContainerProps extends ViewProps {
    cornerRadius?: number;
  }

  export interface NativeStackViewProps extends ViewProps {
    axis?: StackAxis;
    spacing?: number;
    alignment?: StackAlignment;
    distribution?: StackDistribution;
  }

  export interface NativeMenuButtonProps extends ViewProps {
    icon?: string;
    tintColorHex?: string;
    menuItems: ToolbarMenuItem[];
    onMenuAction?: (event: ToolbarMenuActionEvent) => void;
  }

  // ─── Components ─────────────────────────────────────────────────────────────

  export const NativeMaterialView: FC<NativeMaterialViewProps>;
  export const NativeButton: FC<NativeButtonProps>;
  export const NativeSwitch: FC<NativeSwitchProps>;
  export const NativeSegmentedControl: FC<NativeSegmentedControlProps>;
  export const NativeSearchBar: FC<NativeSearchBarProps>;
  export const NativeNavigationBar: FC<NativeNavigationBarProps>;
  export const NativeToolbar: FC<NativeToolbarProps>;
  export const NativeToolbarButton: FC<NativeToolbarButtonProps>;
  export const NativeToolbarMenu: FC<NativeToolbarMenuProps>;
  export const NativeTabBar: FC<NativeTabBarProps>;
  export const NativeGroupedContainer: FC<NativeGroupedContainerProps>;
  export const NativeCardContainer: FC<NativeCardContainerProps>;
  export const NativeStackView: FC<NativeStackViewProps>;
  export const NativeMenuButton: FC<NativeMenuButtonProps>;
}
