/**
 * Join Project Screen
 * Clean design with iOS Liquid Glass support
 */
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Keyboard,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { projectService } from "../src/services/projectService";
import { showAlert } from "../src/utils/alert";

const isIOS = Platform.OS === "ios";

type JoinMethod = "link" | "code";

export default function JoinProjectScreen() {
  const router = useRouter();
  const [method, setMethod] = useState<JoinMethod>("code");
  const [linkInput, setLinkInput] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [loading, setLoading] = useState(false);

  // Extract token from invite link
  const extractTokenFromLink = (link: string): string | null => {
    try {
      const trimmed = link.trim();
      if (trimmed.includes("token=")) {
        const match = trimmed.match(/token=([^&\s]+)/);
        if (match) return match[1];
      }
      if (!trimmed.includes("/") && !trimmed.includes("?") && trimmed.length > 10) {
        return trimmed;
      }
      return null;
    } catch {
      return null;
    }
  };

  const handleJoinByLink = async () => {
    if (!linkInput.trim()) {
      showAlert("Error", "Please enter an invite link");
      return;
    }

    const token = extractTokenFromLink(linkInput);
    if (!token) {
      showAlert(
        "Invalid Link",
        "Could not find a valid invite token. Please check and try again.",
      );
      return;
    }

    setLoading(true);
    Keyboard.dismiss();

    try {
      const result = await projectService.acceptInvite(token);
      const projectId = result?.project_id;

      if (projectId) {
        router.replace(`/project/${projectId}`);
      } else {
        showAlert("Welcome!", "You have successfully joined the project.", [
          { text: "View Projects", onPress: () => router.replace("/(tabs)") },
        ]);
      }
    } catch (error: unknown) {
      let message =
        (error as { detail?: string })?.detail ||
        (error as Error)?.message ||
        "Failed to join project";
      if (message.includes("already a member")) {
        message = "You are already a member of this project.";
      } else if (message.includes("expired")) {
        message = "This invite link has expired.";
      } else if (message.includes("not found")) {
        message = "Invalid invite link.";
      }
      showAlert("Cannot Join Project", message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinByCode = async () => {
    if (!codeInput.trim()) {
      showAlert("Error", "Please enter an invite code");
      return;
    }

    setLoading(true);
    Keyboard.dismiss();

    try {
      const result = await projectService.joinByCode(codeInput.trim().toUpperCase());
      const projectId = result?.project_id;

      if (projectId) {
        router.replace(`/project/${projectId}`);
      } else {
        showAlert("Welcome!", "You have successfully joined the project.", [
          { text: "View Projects", onPress: () => router.replace("/(tabs)") },
        ]);
      }
    } catch (error: unknown) {
      let message =
        (error as { detail?: string })?.detail ||
        (error as Error)?.message ||
        "Invalid or expired invite code";
      if (message.includes("already a member")) {
        message = "You are already a member of this project.";
      } else if (message.includes("expired")) {
        message = "This invite code has expired.";
      }
      showAlert("Cannot Join Project", message);
    } finally {
      setLoading(false);
    }
  };

  // Glass Card wrapper
  const GlassCard = ({
    children,
    style,
  }: {
    children: React.ReactNode;
    style?: object;
  }) => {
    return <View style={[styles.solidCard, style]}>{children}</View>;
  };

  // Tab Selector with glass effect
  const TabSelector = () => {
    const tabContent = (
      <View style={styles.tabInner}>
        <TouchableOpacity
          style={[styles.tab, method === "code" && styles.tabActive]}
          onPress={() => setMethod("code")}
        >
          <Ionicons
            name="keypad"
            size={18}
            color={method === "code" ? "#FF2A2A" : "#666"}
          />
          <Text style={[styles.tabText, method === "code" && styles.tabTextActive]}>
            By Code
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, method === "link" && styles.tabActive]}
          onPress={() => setMethod("link")}
        >
          <Ionicons
            name="link"
            size={18}
            color={method === "link" ? "#FF2A2A" : "#666"}
          />
          <Text style={[styles.tabText, method === "link" && styles.tabTextActive]}>
            By Link
          </Text>
        </TouchableOpacity>
      </View>
    );

    return <View style={styles.tabContainer}>{tabContent}</View>;
  };

  // Glass Button
  const GlassButton = ({
    onPress,
    title,
    icon,
    disabled,
  }: {
    onPress: () => void;
    title: string;
    icon?: string;
    disabled?: boolean;
  }) => {
    const buttonContent = (
      <>
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            {icon && (
              <Ionicons
                name={icon as keyof typeof Ionicons.glyphMap}
                size={20}
                color="#FFFFFF"
                style={{ marginRight: 8 }}
              />
            )}
            <Text style={styles.buttonText}>{title}</Text>
          </>
        )}
      </>
    );

    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled || loading}
        activeOpacity={0.7}
        style={[styles.buttonSolid, disabled && styles.disabledButton]}
      >
        {buttonContent}
      </TouchableOpacity>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={isIOS ? "padding" : "height"}
    >
      <Stack.Screen
        options={{
          title: "Join Project",
          headerTransparent: isIOS,
          headerBlurEffect: isIOS ? "systemChromeMaterial" : undefined,
          headerStyle: isIOS ? {} : { backgroundColor: "#111111" },
          headerTintColor: "#FF2A2A",
          headerTitleStyle: { color: "#F5F5F5", fontWeight: "600" },
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.headerIcon}>
          <Ionicons name="people" size={48} color="#FF2A2A" />
        </View>

        <Text style={styles.title}>Join a Project</Text>
        <Text style={styles.subtitle}>
          Enter an invite code or link shared by the project leader
        </Text>

        {/* Method Tabs */}
        <TabSelector />

        {/* Join by Code */}
        {method === "code" && (
          <GlassCard style={styles.formCard}>
            <Text style={styles.label}>
              <Ionicons name="keypad" size={14} color="#9A9A9A" /> Invite Code
            </Text>
            <Text style={styles.hint}>Enter the short code (e.g., ABC-123456)</Text>
            <TextInput
              style={[styles.input, styles.codeInput]}
              placeholder="ABC-123456"
              placeholderTextColor="#555"
              value={codeInput}
              onChangeText={(text) => setCodeInput(text.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={15}
              autoFocus
            />
            <GlassButton
              onPress={handleJoinByCode}
              title="Join Project"
              icon="enter"
              disabled={!codeInput.trim()}
            />
          </GlassCard>
        )}

        {/* Join by Link */}
        {method === "link" && (
          <GlassCard style={styles.formCard}>
            <Text style={styles.label}>
              <Ionicons name="link" size={14} color="#9A9A9A" /> Invite Link
            </Text>
            <Text style={styles.hint}>
              Paste the full invite link from the project leader
            </Text>
            <TextInput
              style={[styles.input, styles.linkInput]}
              placeholder="https://stratum.app/invite?token=..."
              placeholderTextColor="#555"
              value={linkInput}
              onChangeText={setLinkInput}
              autoCapitalize="none"
              autoCorrect={false}
              multiline
              autoFocus
            />
            <GlassButton
              onPress={handleJoinByLink}
              title="Join Project"
              icon="enter"
              disabled={!linkInput.trim()}
            />
          </GlassCard>
        )}

        {/* Info Section */}
        <GlassCard style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="information-circle" size={20} color="#9A9A9A" />
            <Text style={styles.infoText}>
              Ask the project leader for an invite code or link. Once you join,
              you&apos;ll be able to view and contribute based on your assigned role.
            </Text>
          </View>
        </GlassCard>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111111",
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingTop: 24,
    paddingBottom: 48,
  },
  headerIcon: {
    alignItems: "center",
    marginBottom: 16,
    marginTop: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#9A9A9A",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  // Tab styles
  tabContainerGlass: {
    borderRadius: 16,
    marginBottom: 24,
    overflow: "hidden",
  },
  tabContainerBlur: {
    borderRadius: 16,
    marginBottom: 24,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  tabContainer: {
    borderRadius: 16,
    marginBottom: 24,
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  tabInner: {
    flexDirection: "row",
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  tabActive: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  tabText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#666",
  },
  tabTextActive: {
    color: "#F5F5F5",
  },
  // Card styles
  formCard: {
    marginBottom: 16,
  },
  glassCard: {
    borderRadius: 20,
    padding: 20,
    overflow: "hidden",
  },
  blurCard: {
    borderRadius: 20,
    padding: 20,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  solidCard: {
    borderRadius: 20,
    padding: 20,
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#9A9A9A",
    marginBottom: 4,
  },
  hint: {
    fontSize: 13,
    color: "#666",
    marginBottom: 16,
  },
  input: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    marginBottom: 20,
  },
  codeInput: {
    textAlign: "center",
    fontSize: 20,
    fontWeight: "600",
    letterSpacing: 3,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  linkInput: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  // Button styles
  buttonTouchable: {
    borderRadius: 14,
    overflow: "hidden",
  },
  buttonGlass: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: "rgba(255, 42, 42, 0.4)",
  },
  buttonBlur: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: "rgba(255, 42, 42, 0.3)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  buttonSolid: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF2A2A",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  // Info card
  infoCard: {
    marginTop: 8,
  },
  infoRow: {
    flexDirection: "row",
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: "#9A9A9A",
    lineHeight: 20,
  },
});
