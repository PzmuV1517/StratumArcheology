/**
 * @file
 * Invite acceptance screen.
 *
 * Handles accepting project invitations via deep link
 * or token URL.
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
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { projectService } from "@/services/projectService";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function InviteAcceptScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";
  const isDarkMode = colorScheme === "dark";
  const styles = useMemo(() => createStyles(isDarkMode), [isDarkMode]);
  const pageBackground = isDarkMode ? "#111111" : "#F7F7F7";
  const textPrimary = isDarkMode ? "#F5F5F5" : "#1A1A1A";
  const textSecondary = isDarkMode ? "#9A9A9A" : "#666666";
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
    <View style={[styles.container, { backgroundColor: pageBackground }]}>
      <Text style={[styles.title, { color: textPrimary }]}>Project Invitation</Text>
      <Text style={[styles.text, { color: textSecondary }]}>
        {message || "Processing invite…"}
      </Text>
      {status !== "accepting" && (
        <TouchableOpacity style={styles.button} onPress={() => router.replace("/")}>
          <Text style={[styles.buttonText, { color: textPrimary }]}>Go Home</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const createStyles = (isDarkMode: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDarkMode ? "#111111" : "#F7F7F7",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    },
    title: {
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      fontSize: 22,
      fontWeight: "700",
      marginBottom: 12,
    },
    text: {
      color: isDarkMode ? "#9A9A9A" : "#666666",
      fontSize: 14,
      textAlign: "center",
      marginBottom: 16,
    },
    button: {
      backgroundColor: "#FF2A2A",
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 10,
    },
    buttonText: { color: isDarkMode ? "#F5F5F5" : "#1A1A1A", fontWeight: "600" },
  });
