import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";

import { useColorScheme } from "@/hooks/use-color-scheme";

const EFFECTIVE_DATE = "April 6, 2026";

export default function TermsOfServiceScreen() {
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

        <Text style={styles.title}>Terms of Service</Text>
        <Text style={styles.meta}>Effective date: {EFFECTIVE_DATE}</Text>

        <Text style={styles.heading}>1. Acceptance</Text>
        <Text style={styles.paragraph}>
          By accessing or using STRATUM, you agree to these Terms of Service and
          the Privacy Policy.
        </Text>

        <Text style={styles.heading}>2. Mandatory Cookies and Session Controls</Text>
        <Text style={styles.paragraph}>
          STRATUM requires essential cookies and similar storage for
          authentication and security. These controls are mandatory. If they are
          disabled, you cannot use the service.
        </Text>

        <Text style={styles.heading}>3. Accounts and Security</Text>
        <Text style={styles.paragraph}>
          You are responsible for maintaining the confidentiality of your account
          credentials and for activity performed under your account.
        </Text>

        <Text style={styles.heading}>4. Acceptable Use</Text>
        <Text style={styles.paragraph}>
          You agree not to misuse the platform, attempt unauthorized access,
          interfere with service operation, or upload unlawful content.
        </Text>

        <Text style={styles.heading}>5. User Content</Text>
        <Text style={styles.paragraph}>
          You retain rights to your content where applicable, but you grant the
          service the permissions needed to store, process, and display it for
          product operation.
        </Text>

        <Text style={styles.heading}>6. Availability and Changes</Text>
        <Text style={styles.paragraph}>
          Features may change, pause, or be removed. We may update these terms,
          and continued use after updates indicates acceptance.
        </Text>

        <Text style={styles.heading}>7. Disclaimer</Text>
        <Text style={styles.paragraph}>
          STRATUM is provided on an as-is basis without warranties of uninterrupted
          or error-free operation.
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
