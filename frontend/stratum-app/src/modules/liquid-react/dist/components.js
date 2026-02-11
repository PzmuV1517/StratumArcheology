// @ts-nocheck
import React from 'react';
import { StyleSheet } from 'react-native';
import { RNNativeMaterialView, RNNativeButton, RNNativeSwitch, RNNativeSegmentedControl, RNNativeSearchBar, RNNativeNavigationBar, RNNativeToolbar, RNNativeToolbarButton, RNNativeToolbarMenu, RNNativeTabBar, RNNativeGroupedContainer, RNNativeCardContainer, RNNativeStackView, } from './nativeComponents';
/**
 * NativeMaterialView - Exposes UIVisualEffectView with system materials
 *
 * Uses Apple's blur, vibrancy, and depth rendering pipeline.
 * All visual properties controlled by iOS.
 */
export const NativeMaterialView = (props) => {
    return React.createElement(RNNativeMaterialView, Object.assign({}, props, { style: [styles.defaultContainer, props.style] }));
};
/**
 * NativeButton - Exposes UIButton with system configurations
 *
 * Uses native button styles and animations.
 */
export const NativeButton = (props) => {
    return React.createElement(RNNativeButton, Object.assign({}, props, { style: [styles.defaultButton, props.style] }));
};
/**
 * NativeSwitch - Exposes UISwitch
 *
 * Native iOS toggle control.
 */
export const NativeSwitch = (props) => {
    return React.createElement(RNNativeSwitch, Object.assign({}, props, { style: props.style }));
};
/**
 * NativeSegmentedControl - Exposes UISegmentedControl
 *
 * Native segmented control with system styling.
 */
export const NativeSegmentedControl = (props) => {
    return React.createElement(RNNativeSegmentedControl, Object.assign({}, props, { style: [styles.defaultSegmentedControl, props.style] }));
};
/**
 * NativeSearchBar - Exposes UISearchBar
 *
 * Native search bar with minimal style.
 */
export const NativeSearchBar = (props) => {
    return React.createElement(RNNativeSearchBar, Object.assign({}, props, { style: [styles.defaultSearchBar, props.style] }));
};
/**
 * NativeNavigationBar - Exposes UINavigationBar
 *
 * Native navigation bar with translucent material.
 */
export const NativeNavigationBar = (props) => {
    return React.createElement(RNNativeNavigationBar, Object.assign({}, props, { style: [styles.defaultNavigationBar, props.style] }));
};
/**
 * NativeToolbar - Exposes UIToolbar
 *
 * Native toolbar with support for buttons and menus as children.
 * Use with NativeToolbarButton and NativeToolbarMenu components.
 */
export const NativeToolbar = (props) => {
    return React.createElement(RNNativeToolbar, Object.assign({}, props, { style: [styles.defaultToolbar, props.style] }));
};
/**
 * NativeToolbarButton - Exposes UIBarButtonItem
 *
 * Native toolbar button. Must be used as a child of NativeToolbar.
 */
export const NativeToolbarButton = (props) => {
    return React.createElement(RNNativeToolbarButton, Object.assign({}, props, { style: props.style }));
};
/**
 * NativeToolbarMenu - Exposes UIBarButtonItem with UIMenu
 *
 * Native toolbar menu button with nested menu support.
 * Automatically handles cascading menus, animations, and platform differences.
 * Must be used as a child of NativeToolbar.
 */
export const NativeToolbarMenu = (props) => {
    return React.createElement(RNNativeToolbarMenu, Object.assign({}, props, { style: props.style }));
};
/**
 * NativeTabBar - Exposes UITabBar
 *
 * Native tab bar with system styling.
 */
export const NativeTabBar = (props) => {
    return React.createElement(RNNativeTabBar, Object.assign({}, props, { style: [styles.defaultTabBar, props.style] }));
};
/**
 * NativeGroupedContainer - UIView with system grouped background
 *
 * Uses system background colors for grouped list style.
 */
export const NativeGroupedContainer = (props) => {
    return React.createElement(RNNativeGroupedContainer, Object.assign({}, props, { style: [styles.defaultContainer, props.style] }));
};
/**
 * NativeCardContainer - UIView with continuous corner radius
 *
 * System background with native corner curve.
 */
export const NativeCardContainer = (props) => {
    return React.createElement(RNNativeCardContainer, Object.assign({}, props, { style: [styles.defaultCard, props.style] }));
};
/**
 * NativeStackView - Exposes UIStackView for automatic layout
 *
 * Native iOS stack layout with axis, spacing, alignment, and distribution.
 * Automatically arranges child views without manual positioning.
 */
export const NativeStackView = (props) => {
    return React.createElement(RNNativeStackView, Object.assign({}, props, { style: [styles.defaultStack, props.style] }));
};
const styles = StyleSheet.create({
    defaultContainer: {
        overflow: 'hidden',
    },
    defaultButton: {
        height: 44,
    },
    defaultSegmentedControl: {
        height: 32,
    },
    defaultSearchBar: {
        height: 56,
    },
    defaultNavigationBar: {
        height: 44,
    },
    defaultToolbar: {
        height: 44,
    },
    defaultTabBar: {
        height: 49,
    },
    defaultCard: {
        overflow: 'hidden',
    },
    defaultStack: {
    // No default styling - controlled by axis, spacing, alignment, distribution props
    },
});
