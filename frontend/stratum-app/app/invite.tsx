import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { projectService } from "../src/services/projectService";

export default function InviteAcceptScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "accepting" | "success" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    const run = async () => {
      if (!token) {
        setStatus("error");
        setMessage("Missing invite token.");
        return;
      }
      try {
        setStatus("accepting");
        await projectService.acceptInvite(token as string);
        setStatus("success");
        setMessage("Invite accepted. You now have access to the project.");
      } catch (e: any) {
        setStatus("error");
        const detail = e?.detail || e?.message || "Failed to accept invite.";
        setMessage(detail);
      }
    };
    run();
  }, [token]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Project Invitation</Text>
      <Text style={styles.text}>{message || "Processing invite…"}</Text>
      {status !== "accepting" && (
        <TouchableOpacity style={styles.button} onPress={() => router.replace("/")}>
          <Text style={styles.buttonText}>Go Home</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: { color: "#F5F5F5", fontSize: 22, fontWeight: "700", marginBottom: 12 },
  text: { color: "#9A9A9A", fontSize: 14, textAlign: "center", marginBottom: 16 },
  button: {
    backgroundColor: "#FF2A2A",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  buttonText: { color: "#F5F5F5", fontWeight: "600" },
});
