declare module "remark-math";
declare module "rehype-katex";
declare module "rehype-raw";
declare module "d3";
declare module "liquid-react" {
	export const LiquidReact: {
		setSidebarAdaptable: (forceSidebar: boolean) => void;
	};
	import * as React from "react";
	import type { StyleProp, ViewStyle } from "react-native";
	
	type ButtonInsets = {
		top?: number;
		left?: number;
		bottom?: number;
		right?: number;
	};

	export type LiquidButtonProps = {
		title?: string;
		titleColor?: string;
		backgroundColor?: string;
		systemImageName?: string;
		tintColor?: string;
		enabled?: boolean;
		highlighted?: boolean;
		selected?: boolean;
		adjustsImageWhenHighlighted?: boolean;
		adjustsImageWhenDisabled?: boolean;
		showsTouchWhenHighlighted?: boolean;
		contentHorizontalAlignment?: "center" | "left" | "right" | "fill" | "leading" | "trailing";
		contentVerticalAlignment?: "center" | "top" | "bottom" | "fill";
		cornerRadius?: number;
		fontSize?: number;
		fontWeight?: string;
		numberOfLines?: number;
		lineBreakMode?: "wordWrap" | "charWrap" | "clip" | "headTruncation" | "tailTruncation" | "middleTruncation";
		contentEdgeInsets?: ButtonInsets;
		titleEdgeInsets?: ButtonInsets;
		imageEdgeInsets?: ButtonInsets;
		accessibilityLabel?: string;
		accessibilityHint?: string;
		accessibilityIdentifier?: string;
		onPress?: () => void;
		style?: StyleProp<ViewStyle>;
	};

	export const LiquidButton: React.ComponentType<LiquidButtonProps>;

	export type LiquidSegmentedControlProps = {
		segments: string[];
		selectedIndex?: number;
		enabled?: boolean;
		momentary?: boolean;
		selectedSegmentTintColor?: string;
		tintColor?: string;
		topAnchor?: number;
		trailingAnchor?: number;
		onChange?: (event: { selectedIndex: number }) => void;
		style?: StyleProp<ViewStyle>;
	};

	export const LiquidSegmentedControl: React.ComponentType<LiquidSegmentedControlProps>;
}
