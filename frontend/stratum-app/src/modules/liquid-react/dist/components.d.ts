import React from 'react';
import type { NativeMaterialViewProps, NativeButtonProps, NativeSwitchProps, NativeSegmentedControlProps, NativeSearchBarProps, NativeNavigationBarProps, NativeToolbarProps, NativeToolbarButtonProps, NativeToolbarMenuProps, NativeTabBarProps, NativeGroupedContainerProps, NativeCardContainerProps, NativeStackViewProps } from './types';
/**
 * NativeMaterialView - Exposes UIVisualEffectView with system materials
 *
 * Uses Apple's blur, vibrancy, and depth rendering pipeline.
 * All visual properties controlled by iOS.
 */
export declare const NativeMaterialView: React.FC<NativeMaterialViewProps>;
/**
 * NativeButton - Exposes UIButton with system configurations
 *
 * Uses native button styles and animations.
 */
export declare const NativeButton: React.FC<NativeButtonProps>;
/**
 * NativeSwitch - Exposes UISwitch
 *
 * Native iOS toggle control.
 */
export declare const NativeSwitch: React.FC<NativeSwitchProps>;
/**
 * NativeSegmentedControl - Exposes UISegmentedControl
 *
 * Native segmented control with system styling.
 */
export declare const NativeSegmentedControl: React.FC<NativeSegmentedControlProps>;
/**
 * NativeSearchBar - Exposes UISearchBar
 *
 * Native search bar with minimal style.
 */
export declare const NativeSearchBar: React.FC<NativeSearchBarProps>;
/**
 * NativeNavigationBar - Exposes UINavigationBar
 *
 * Native navigation bar with translucent material.
 */
export declare const NativeNavigationBar: React.FC<NativeNavigationBarProps>;
/**
 * NativeToolbar - Exposes UIToolbar
 *
 * Native toolbar with support for buttons and menus as children.
 * Use with NativeToolbarButton and NativeToolbarMenu components.
 */
export declare const NativeToolbar: React.FC<NativeToolbarProps>;
/**
 * NativeToolbarButton - Exposes UIBarButtonItem
 *
 * Native toolbar button. Must be used as a child of NativeToolbar.
 */
export declare const NativeToolbarButton: React.FC<NativeToolbarButtonProps>;
/**
 * NativeToolbarMenu - Exposes UIBarButtonItem with UIMenu
 *
 * Native toolbar menu button with nested menu support.
 * Automatically handles cascading menus, animations, and platform differences.
 * Must be used as a child of NativeToolbar.
 */
export declare const NativeToolbarMenu: React.FC<NativeToolbarMenuProps>;
/**
 * NativeTabBar - Exposes UITabBar
 *
 * Native tab bar with system styling.
 */
export declare const NativeTabBar: React.FC<NativeTabBarProps>;
/**
 * NativeGroupedContainer - UIView with system grouped background
 *
 * Uses system background colors for grouped list style.
 */
export declare const NativeGroupedContainer: React.FC<NativeGroupedContainerProps>;
/**
 * NativeCardContainer - UIView with continuous corner radius
 *
 * System background with native corner curve.
 */
export declare const NativeCardContainer: React.FC<NativeCardContainerProps>;
/**
 * NativeStackView - Exposes UIStackView for automatic layout
 *
 * Native iOS stack layout with axis, spacing, alignment, and distribution.
 * Automatically arranges child views without manual positioning.
 */
export declare const NativeStackView: React.FC<NativeStackViewProps>;
