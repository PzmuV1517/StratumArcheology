import React, { useEffect, useState } from 'react';
import { Platform, View, Text, StyleSheet, ScrollView, Linking } from 'react-native';

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

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (Platform.OS === 'web') {
          if (!ReactMarkdown) ReactMarkdown = (await import('react-markdown')).default;
          if (!remarkGfm) remarkGfm = (await import('remark-gfm')).default;
          try {
            if (!rehypeRaw) rehypeRaw = (await import('rehype-raw')).default;
          } catch {}
          try {
            if (!remarkMath) remarkMath = (await import('remark-math')).default;
          } catch {}
          try {
            if (!rehypeKatex) rehypeKatex = (await import('rehype-katex')).default;
          } catch {}
        } else {
          // Native: try to load react-native-markdown-display
          try {
            const mdModule = await import('react-native-markdown-display');
            MarkdownDisplayNative = mdModule.default;
          } catch {
            console.log(
              '[MarkdownView] react-native-markdown-display not available, using fallback'
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
  if (Platform.OS !== 'web') {
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
  if (!ready || !ReactMarkdown) return <Text style={{ color: '#9A9A9A' }}>Loading…</Text>;

  return (
    <View style={{ width: '100%' }}>
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

// Native styles
const nativeStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0C0C0E',
  },
  content: {
    color: '#EAEAEA',
    fontSize: 15,
    lineHeight: 24,
    padding: 16,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  loadingText: {
    color: '#9A9A9A',
    padding: 16,
  },
});

// Markdown display styles for native
const markdownStyles = {
  body: {
    color: '#EAEAEA',
    fontSize: 15,
    lineHeight: 24,
  },
  heading1: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: 'bold' as const,
    marginBottom: 12,
    marginTop: 24,
  },
  heading2: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold' as const,
    marginBottom: 10,
    marginTop: 20,
  },
  heading3: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold' as const,
    marginBottom: 8,
    marginTop: 16,
  },
  heading4: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold' as const,
    marginBottom: 6,
    marginTop: 14,
  },
  paragraph: {
    color: '#EAEAEA',
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 12,
  },
  code_inline: {
    backgroundColor: '#2A2A2A',
    color: '#FF7B72',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  fence: {
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
  },
  code_block: {
    backgroundColor: '#1A1A1A',
    color: '#EAEAEA',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    lineHeight: 20,
  },
  blockquote: {
    backgroundColor: '#1A1A1A',
    borderLeftWidth: 4,
    borderLeftColor: '#FF2A2A',
    paddingLeft: 12,
    paddingVertical: 8,
    marginVertical: 8,
  },
  list_item: {
    color: '#EAEAEA',
    fontSize: 15,
    lineHeight: 24,
  },
  link: {
    color: '#58A6FF',
    textDecorationLine: 'underline' as const,
  },
  strong: {
    color: '#FFFFFF',
    fontWeight: 'bold' as const,
  },
  em: {
    color: '#EAEAEA',
    fontStyle: 'italic' as const,
  },
  hr: {
    backgroundColor: '#3A3A3A',
    height: 1,
    marginVertical: 16,
  },
  table: {
    borderWidth: 1,
    borderColor: '#3A3A3A',
    marginVertical: 8,
  },
  th: {
    backgroundColor: '#1A1A1A',
    padding: 8,
    borderWidth: 1,
    borderColor: '#3A3A3A',
    color: '#FFFFFF',
    fontWeight: 'bold' as const,
  },
  td: {
    padding: 8,
    borderWidth: 1,
    borderColor: '#3A3A3A',
    color: '#EAEAEA',
  },
};
