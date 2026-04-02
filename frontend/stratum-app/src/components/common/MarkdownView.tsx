/**
 * @file
 * Markdown rendering component.
 *
 * Renders Markdown content with proper styling for
 * both web and native platforms.
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
import { Platform, View, Text, StyleSheet, ScrollView, Linking } from "react-native";
import { useColorScheme } from "@/hooks/use-color-scheme";

let ReactMarkdown: any = null;
let remarkGfm: any = null;
let remarkMath: any = null;
let rehypeKatex: any = null;
let rehypeRaw: any = null;
let MarkdownDisplayNative: any = null;

/**
 * MarkdownView - Cross-platform markdown renderer
 *
 * On web: Uses react-markdown with remark/rehype plugins
 * On native: Uses react-native-markdown-display or fallback text rendering
 */
export default function MarkdownView({ content }: { content: string }) {
  const [ready, setReady] = useState(false);
  const isDarkMode = (useColorScheme() ?? "light") === "dark";
  const nativeStyles = useMemo(() => createNativeStyles(isDarkMode), [isDarkMode]);
  const markdownStyles = useMemo(
    () => createMarkdownStyles(isDarkMode),
    [isDarkMode],
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (Platform.OS === "web") {
          if (!ReactMarkdown)
            ReactMarkdown = (await import("react-markdown")).default;
          if (!remarkGfm) remarkGfm = (await import("remark-gfm")).default;
          try {
            if (!rehypeRaw) rehypeRaw = (await import("rehype-raw")).default;
          } catch {}
          try {
            if (!remarkMath) remarkMath = (await import("remark-math")).default;
          } catch {}
          try {
            if (!rehypeKatex) rehypeKatex = (await import("rehype-katex")).default;
          } catch {}
        } else {
          // Native: try to load react-native-markdown-display
          try {
            // eslint-disable-next-line import/no-unresolved
            const mdModule = await import("react-native-markdown-display");
            MarkdownDisplayNative = mdModule.default;
          } catch {
            console.log(
              "[MarkdownView] react-native-markdown-display not available, using fallback",
            );
          }
        }
      } finally {
        if (mounted) setReady(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Native platform rendering
  if (Platform.OS !== "web") {
    if (!ready) {
      return <Text style={nativeStyles.loadingText}>Loading...</Text>;
    }

    // If native markdown library is available, use it
    if (MarkdownDisplayNative) {
      return (
        <ScrollView style={nativeStyles.container}>
          <MarkdownDisplayNative
            style={markdownStyles}
            onLinkPress={(url: string) => {
              Linking.openURL(url);
              return false;
            }}
          >
            {content}
          </MarkdownDisplayNative>
        </ScrollView>
      );
    }

    // Fallback: Simple styled text rendering for native
    return (
      <ScrollView style={nativeStyles.container}>
        <Text style={nativeStyles.content}>{content}</Text>
      </ScrollView>
    );
  }

  // Web platform rendering
  if (!ready || !ReactMarkdown) {
    return <Text style={nativeStyles.loadingText}>Loading...</Text>;
  }

  return (
    <View style={{ width: "100%" }}>
      <ReactMarkdown
        className="markdown-body"
        remarkPlugins={[remarkGfm, remarkMath].filter(Boolean)}
        rehypePlugins={[rehypeRaw, rehypeKatex].filter(Boolean)}
        skipHtml={false}
      >
        {content}
      </ReactMarkdown>
    </View>
  );
}

const createNativeStyles = (isDarkMode: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDarkMode ? "#0C0C0E" : "#F7F7F7",
    },
    content: {
      color: isDarkMode ? "#EAEAEA" : "#1A1A1A",
      fontSize: 15,
      lineHeight: 24,
      padding: 16,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    },
    loadingText: {
      color: isDarkMode ? "#9A9A9A" : "#666666",
      padding: 16,
    },
  });

const createMarkdownStyles = (isDarkMode: boolean) => ({
  body: {
    color: isDarkMode ? "#EAEAEA" : "#1A1A1A",
    fontSize: 15,
    lineHeight: 24,
  },
  heading1: {
    color: isDarkMode ? "#FFFFFF" : "#111111",
    fontSize: 28,
    fontWeight: "bold" as const,
    marginBottom: 12,
    marginTop: 24,
  },
  heading2: {
    color: isDarkMode ? "#FFFFFF" : "#111111",
    fontSize: 24,
    fontWeight: "bold" as const,
    marginBottom: 10,
    marginTop: 20,
  },
  heading3: {
    color: isDarkMode ? "#FFFFFF" : "#111111",
    fontSize: 20,
    fontWeight: "bold" as const,
    marginBottom: 8,
    marginTop: 16,
  },
  heading4: {
    color: isDarkMode ? "#FFFFFF" : "#111111",
    fontSize: 18,
    fontWeight: "bold" as const,
    marginBottom: 6,
    marginTop: 14,
  },
  paragraph: {
    color: isDarkMode ? "#EAEAEA" : "#1A1A1A",
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 12,
  },
  code_inline: {
    backgroundColor: isDarkMode ? "#2A2A2A" : "#EFEFEF",
    color: isDarkMode ? "#FF7B72" : "#B42318",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 13,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  fence: {
    backgroundColor: isDarkMode ? "#1A1A1A" : "#F1F1F1",
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
  },
  code_block: {
    backgroundColor: isDarkMode ? "#1A1A1A" : "#F1F1F1",
    color: isDarkMode ? "#EAEAEA" : "#1A1A1A",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 13,
    lineHeight: 20,
  },
  blockquote: {
    backgroundColor: isDarkMode ? "#1A1A1A" : "#F3F3F3",
    borderLeftWidth: 4,
    borderLeftColor: "#FF2A2A",
    paddingLeft: 12,
    paddingVertical: 8,
    marginVertical: 8,
  },
  list_item: {
    color: isDarkMode ? "#EAEAEA" : "#1A1A1A",
    fontSize: 15,
    lineHeight: 24,
  },
  link: {
    color: isDarkMode ? "#58A6FF" : "#0A7EA4",
    textDecorationLine: "underline" as const,
  },
  strong: {
    color: isDarkMode ? "#FFFFFF" : "#111111",
    fontWeight: "bold" as const,
  },
  em: {
    color: isDarkMode ? "#EAEAEA" : "#1A1A1A",
    fontStyle: "italic" as const,
  },
  hr: {
    backgroundColor: isDarkMode ? "#3A3A3A" : "#D9D9D9",
    height: 1,
    marginVertical: 16,
  },
  table: {
    borderWidth: 1,
    borderColor: isDarkMode ? "#3A3A3A" : "#D9D9D9",
    marginVertical: 8,
  },
  th: {
    backgroundColor: isDarkMode ? "#1A1A1A" : "#F1F1F1",
    padding: 8,
    borderWidth: 1,
    borderColor: isDarkMode ? "#3A3A3A" : "#D9D9D9",
    color: isDarkMode ? "#FFFFFF" : "#1A1A1A",
    fontWeight: "bold" as const,
  },
  td: {
    padding: 8,
    borderWidth: 1,
    borderColor: isDarkMode ? "#3A3A3A" : "#D9D9D9",
    color: isDarkMode ? "#EAEAEA" : "#1A1A1A",
  },
});
