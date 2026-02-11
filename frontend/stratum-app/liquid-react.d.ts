/**
 * Type declarations for the local liquid-react native module.
 * Declares the subset of components used in the app.
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
    items?: Array<{
      id?: string;
      title: string;
      icon?: string;
      destructive?: boolean;
      disabled?: boolean;
    }>;
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
    menuItems?: Array<{
      id?: string;
      title: string;
      icon?: string;
      destructive?: boolean;
      disabled?: boolean;
      children?: Array<{
        id?: string;
        title: string;
        icon?: string;
        destructive?: boolean;
        disabled?: boolean;
      }>;
    }>;
    onMenuAction?: (event: { nativeEvent: { id: string; title: string } }) => void;
  }
  export const NativeMenuButton: React.FC<NativeMenuButtonProps>;
}
