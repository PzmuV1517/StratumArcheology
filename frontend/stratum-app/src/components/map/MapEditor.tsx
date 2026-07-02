/**
 * @file
 * Map editor component (platform-agnostic entry point).
 *
 * STRATUM - Proprietary and Confidential
 * Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
 * All rights reserved.
 * No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
 * Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
 */
import { Platform } from "react-native";
import WebImpl from "./MapEditor.web";
import NativeImpl from "./MapEditor.native";

type Props = { projectId: string; canEdit?: boolean };

export default function MapEditor(props: Props) {
  const Impl: any = Platform.OS === "web" ? WebImpl : NativeImpl;
  return <Impl {...props} />;
}
