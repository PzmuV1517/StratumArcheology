import { Platform } from "react-native";
import WebImpl from "./MapEditor.web";
import NativeImpl from "./MapEditor.native";

type Props = { projectId: string; canEdit?: boolean };

export default function MapEditor(props: Props) {
  const Impl: any = Platform.OS === "web" ? WebImpl : NativeImpl;
  return <Impl {...props} />;
}
