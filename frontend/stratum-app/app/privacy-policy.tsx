import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";

import { useColorScheme } from "@/hooks/use-color-scheme";

const EFFECTIVE_DATE = "April 6, 2026";

export default function PrivacyPolicyScreen() {
  const isDarkMode = (useColorScheme() ?? "light") === "dark";
  const styles = useMemo(() => createStyles(isDarkMode), [isDarkMode]);
  const router = useRouter();

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.card}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Privacy Policy</Text>
        <Text style={styles.meta}>Effective date: {EFFECTIVE_DATE}</Text>

        <Text style={styles.heading}>1. Scope</Text>
        <Text style={styles.paragraph}>
          This Privacy Policy explains how STRATUM processes account, project, and
          usage data when you use the application.
        </Text>

        <Text style={styles.heading}>2. Mandatory Cookies</Text>
        <Text style={styles.paragraph}>
          STRATUM uses essential cookies and similar storage mechanisms for
          authentication, session integrity, and security controls. These cookies are
          mandatory. If cookies are disabled, sign-in and core features will not
          function.
        </Text>

        <Text style={styles.heading}>3. Data We Process</Text>
        <Text style={styles.paragraph}>
          We process data required to provide the service, including account
          identity, project content you submit, and operational telemetry needed for
          security and reliability.
        </Text>

        <Text style={styles.heading}>4. Data Retention</Text>
        <Text style={styles.paragraph}>
          Data is retained for operational, legal, and security purposes and may be
          removed or anonymized according to project policies.
        </Text>

        <Text style={styles.heading}>5. Your Responsibilities</Text>
        <Text style={styles.paragraph}>
          You are responsible for the lawfulness of data you upload, including
          obtaining any required permissions for personal or sensitive information.
        </Text>

        <Text style={styles.heading}>6. Policy Changes</Text>
        <Text style={styles.paragraph}>
          We may update this policy over time. Continued use of STRATUM after updates
          means you acknowledge the revised policy.
        </Text>
      </View>
    </ScrollView>
  );
}

const createStyles = (isDarkMode: boolean) =>
  StyleSheet.create({
    container: {
      flexGrow: 1,
      padding: 20,
      backgroundColor: isDarkMode ? "#0A0A0A" : "#F7F7F7",
    },
    card: {
      width: "100%",
      maxWidth: 860,
      alignSelf: "center",
      borderWidth: 1,
      borderColor: isDarkMode ? "#2A2A2A" : "#D9D9D9",
      borderRadius: 16,
      backgroundColor: isDarkMode ? "#111111" : "#FFFFFF",
      padding: 20,
      gap: 8,
    },
    backLink: {
      color: "#FF2A2A",
      fontSize: 13,
      fontWeight: "700",
      letterSpacing: 0.2,
      marginBottom: 4,
    },
    title: {
      color: isDarkMode ? "#F5F5F5" : "#1A1A1A",
      fontSize: 26,
      fontWeight: "800",
      letterSpacing: 0.4,
    },
    meta: {
      color: isDarkMode ? "#A0A0A0" : "#666666",
      fontSize: 13,
      marginBottom: 8,
    },
    heading: {
      color: isDarkMode ? "#FFFFFF" : "#1A1A1A",
      fontSize: 16,
      fontWeight: "700",
      marginTop: 10,
    },
    paragraph: {
      color: isDarkMode ? "#CCCCCC" : "#444444",
      fontSize: 14,
      lineHeight: 22,
    },
  });
