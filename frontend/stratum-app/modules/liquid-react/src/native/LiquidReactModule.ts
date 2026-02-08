import { requireOptionalNativeModule } from "expo-modules-core";

type LiquidReactModule = {
  setSidebarAdaptable: (forceSidebar: boolean) => void;
};

const nativeModule = requireOptionalNativeModule<LiquidReactModule>("LiquidReact");

const LiquidReact: LiquidReactModule = nativeModule ?? {
  setSidebarAdaptable: () => {},
};

export default LiquidReact;
