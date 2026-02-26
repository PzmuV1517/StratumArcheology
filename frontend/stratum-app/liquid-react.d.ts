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
  import type React from "react";

  // Material types for NativeMaterialView
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
    onValueChange?: (event: { nativeEvent: { value: boolean } }) => void;
  }

  export interface NativeToolbarProps extends ViewProps {
    translucent?: boolean;
  }

  export interface NativeToolbarButtonProps extends ViewProps {
    title?: string;
    icon?: string;
    systemItem?: ToolbarSystemItem;
    disabled?: boolean;
    onPress?: () => void;
  }

  export interface NativeToolbarMenuProps extends ViewProps {
    title?: string;
    icon?: string;
    items?: {
      id?: string;
      title: string;
      icon?: string;
      destructive?: boolean;
      disabled?: boolean;
    }[];
    onAction?: (event: { nativeEvent: { id: string; title: string } }) => void;
  }

  // Components
  export const NativeMaterialView: React.FC<NativeMaterialViewProps>;
  export const NativeButton: React.FC<NativeButtonProps>;
  export const NativeSwitch: React.FC<NativeSwitchProps>;
  export const NativeSegmentedControl: React.FC<any>;
  export const NativeSearchBar: React.FC<any>;
  export const NativeNavigationBar: React.FC<any>;
  export const NativeToolbar: React.FC<NativeToolbarProps>;
  export const NativeToolbarButton: React.FC<NativeToolbarButtonProps>;
  export const NativeToolbarMenu: React.FC<NativeToolbarMenuProps>;
  export const NativeTabBar: React.FC<any>;
  export const NativeGroupedContainer: React.FC<any>;
  export const NativeCardContainer: React.FC<any>;
  export const NativeStackView: React.FC<any>;

  export interface NativeMenuButtonProps extends ViewProps {
    icon?: string;
    tintColorHex?: string;
    menuItems?: {
      id?: string;
      title: string;
      icon?: string;
      destructive?: boolean;
      disabled?: boolean;
      children?: {
        id?: string;
        title: string;
        icon?: string;
        destructive?: boolean;
        disabled?: boolean;
      }[];
    }[];
    onMenuAction?: (event: { nativeEvent: { id: string; title: string } }) => void;
  }
  export const NativeMenuButton: React.FC<NativeMenuButtonProps>;
}
