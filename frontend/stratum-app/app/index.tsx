import React from 'react';
import { View, Text, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
// Use React Bits components directly (no wrappers)
import StarBorder from '../components/StarBorder.jsx';
import DotGrid from '../components/DotGrid.jsx';
import GradualBlur from '../components/GradualBlur.jsx';
import * as CardSwapModule from '../components/CardSwap.jsx';

const CardSwap = CardSwapModule.default || CardSwapModule;
const Card = CardSwapModule.Card;

// Load component CSS only on web to avoid native errors
if (Platform.OS === 'web') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('../components/ColorBends.css');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('../components/DotGrid.css');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('../components/StarBorder.css');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('../components/CardSwap.css');
}

export default function LandingPage() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isNarrow = width < 900;

  if (Platform.OS !== 'web') {
    // Native: don't render anything, just redirect
    return null;
  }

  // Web: render landing page
  return (
    <>
      <div
        className="main-landing"
        style={{
          minHeight: '100vh',
          width: '100vw',
          overflowX: 'hidden',
          overflowY: 'auto',
          position: 'relative',
          background: '#000000',
        }}
      >
        <section style={{ position: 'relative' }}>
          {/* Fixed DotGrid background that appears below hero (hero covers via z-index) */}
          <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', inset: 0 }}>
              {/* @ts-expect-error - DotGrid is a JSX component with flexible props */}
              <DotGrid
                dotSize={4}
                gap={20}
                baseColor="#220000"
                activeColor="#ff0000"
                proximity={200}
              />
            </div>
          </div>
          {/* Hero section - takes full viewport height on load */}
          <section
            className="hero-section"
            style={{
              position: 'relative',
              zIndex: 2,
              minHeight: '100vh',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View style={styles.hero}>
              <Text style={styles.title}>Organize research. Share results.</Text>
              <Text style={styles.subtitle}>
                Projects, artefacts, and notes in one streamlined workspace.
              </Text>
              <View style={{ marginTop: 24 }}>
                <StarBorder
                  as="button"
                  color="white"
                  speed="5s"
                  className="thin-border"
                  thickness={1}
                  onClick={() => router.push('/(auth)/login')}
                  onPress={() => router.push('/(auth)/login')}
                >
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Begin</Text>
                </StarBorder>
              </View>
            </View>
          </section>
          {/* Informational section */}
          <View style={styles.infoSection}>
            <Text style={styles.sectionHeading}>Why STRATUM?</Text>
            <View style={styles.cards}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Artefacts, not files</Text>
                <Text style={styles.cardBody}>
                  Group results, notes, and assets with a living manifest that stays in sync.
                </Text>
              </View>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Collaborate safely</Text>
                <Text style={styles.cardBody}>
                  Role-based access, history, and site-styled confirmations prevent mistakes.
                </Text>
              </View>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Edit or view anything</Text>
                <Text style={styles.cardBody}>
                  CSV, Excel, Markdown, PNG, text files, Pointcloud, Mesh and JSON with a unified
                  preview and quick saves.
                </Text>
              </View>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Harris Matrix</Text>
                <Text style={styles.cardBody}>
                  Visualize and manage complex stratigraphic relationships with our built-in Harris
                  Matrix tool.
                </Text>
              </View>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Cross-platform</Text>
                <Text style={styles.cardBody}>
                  Access your projects from both web and mobile with a consistent experience.
                </Text>
              </View>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Offline support</Text>
                <Text style={styles.cardBody}>
                  Work seamlessly without an internet connection, with automatic syncing when
                  you&apos;re back online.
                </Text>
              </View>
            </View>
          </View>

          {/* Mosaic highlights (visual variety) */}
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionHeading}>What makes STRATUM different</Text>
            <View style={[styles.mosaicRow, isNarrow ? { flexDirection: 'column' } : null]}>
              <View style={styles.mosaicCol}>
                <View style={[styles.card, styles.cardTall]}>
                  <Text style={styles.cardTitle}>Context-rich artefacts</Text>
                  <Text style={styles.cardBody}>
                    Every artefact carries its origin, linked notes, and related assets—so results
                    aren’t just files, they’re stories.
                  </Text>
                </View>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Instant previews</Text>
                  <Text style={styles.cardBody}>
                    Open large CSVs, JSON, and Markdown with a fast, consistent UI on web and
                    mobile.
                  </Text>
                </View>
              </View>
              <View style={styles.mosaicCol}>
                <View style={styles.cardAccent}>
                  <Text style={styles.cardBadge}>NEW</Text>
                  <Text style={styles.cardTitle}>Live manifests</Text>
                  <Text style={styles.cardBody}>
                    artefact.json updates automatically as your project grows, keeping everything
                    coherent.
                  </Text>
                </View>
                <View style={[styles.card, styles.cardInset]}>
                  <Text style={styles.cardTitle}>Safe collaboration</Text>
                  <Text style={styles.cardBody}>
                    Role-based access and confirmations reduce mistakes without slowing you down.
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Stats row */}
          <View style={[styles.sectionBlock, { paddingTop: 20, paddingBottom: 0 }]}>
            <View style={[styles.statsRow, isNarrow ? { flexDirection: 'column' } : null]}>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>10×</Text>
                <Text style={styles.statLabel}>Faster setup</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>1 place</Text>
                <Text style={styles.statLabel}>for notes & data</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>Zero</Text>
                <Text style={styles.statLabel}>context loss</Text>
              </View>
            </View>
          </View>

          {/* CardSwap row */}
          <View style={[styles.sectionBlock, { paddingTop: 0, paddingBottom: 150 }]}>
            <View style={[styles.cardSwapRow, isNarrow ? { flexDirection: 'column' } : null]}>
              <View style={styles.cardSwapLeft}>
                <Text style={styles.sectionHeading}>Intuitive at every step</Text>
              </View>
              <View style={styles.cardSwapRight}>
                {Platform.OS === 'web' ? (
                  <div style={{ height: '600px', position: 'relative' }}>
                    <CardSwap
                      cardDistance={60}
                      verticalDistance={70}
                      delay={5000}
                      pauseOnHover={false}
                      onCardClick={() => {}}
                    >
                      <Card key={0} />
                      <Card key={1} />
                      <Card key={2} />
                    </CardSwap>
                  </div>
                ) : null}
              </View>
            </View>
          </View>
        </section>
      </div>
      <GradualBlur
        target="screen"
        position="bottom"
        height="6rem"
        strength={5}
        divCount={10}
        curve="bezier"
        exponential={true}
        opacity={1}
        reactive={true}
      />
      <GradualBlur
        target="screen"
        position="top"
        height="3rem"
        strength={2}
        divCount={5}
        curve="bezier"
        exponential={true}
        opacity={1}
        reactive={true}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    position: 'relative',
    zIndex: 2,
  },
  hero: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    zIndex: 10,
    backgroundColor: 'transparent',
    paddingVertical: 80,
    paddingHorizontal: 24,
  },
  bg: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  center: {
    width: '100%',
    maxWidth: 960,
    paddingHorizontal: 24,
    alignItems: 'center',
    zIndex: 2,
  },
  logo: {
    color: '#ffffff',
    opacity: 0.9,
    fontSize: 14,
    letterSpacing: 6,
    fontWeight: '800',
    marginBottom: 12,
  },
  title: {
    color: '#ffffff',
    fontSize: 34,
    lineHeight: 40,
    textAlign: 'center',
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  subtitle: {
    color: '#e5e5e5',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginTop: 12,
    maxWidth: 720,
  },
  infoSection: {
    backgroundColor: 'transparent',
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 80,
    paddingHorizontal: 24,
  },
  sectionHeading: {
    color: '#F5F5F5',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.4,
    marginBottom: 24,
  },
  cards: {
    width: '100%',
    maxWidth: 1040,
  },
  mosaicRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    maxWidth: 1040,
  },
  mosaicCol: {
    flex: 1,
    gap: 12,
  },
  sectionBlock: {
    backgroundColor: 'transparent',
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 60,
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
  },
  cardTall: {
    minHeight: 140,
  },
  cardInset: {
    backgroundColor: '#0C0C0C',
  },
  cardAccent: {
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: '#fb00007a',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
  },
  cardBadge: {
    alignSelf: 'flex-start',
    color: '#fff',
    backgroundColor: '#ff0000c7',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    maxWidth: 1040,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  statNumber: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },
  statLabel: {
    color: '#CFCFCF',
    marginTop: 4,
    fontSize: 13,
  },
  compareRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    maxWidth: 1040,
  },
  compareHalf: {
    flex: 1,
  },

  cardSwapRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    maxWidth: 1040,
    alignItems: 'stretch',
  },
  cardSwapLeft: {
    flex: 1,
    justifyContent: 'center',
  },
  cardSwapRight: {
    flex: 1,
    minHeight: 600,
    width: '100%',
    alignItems: 'stretch',
  },
  stepList: {
    width: '100%',
    maxWidth: 1040,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    textAlign: 'center',
    textAlignVertical: 'center',
    color: '#fff',
    backgroundColor: '#2A2A2A',
    marginRight: 12,
    fontWeight: '800',
    lineHeight: 32,
  },
  ctaSection: {
    alignItems: 'center',
    paddingVertical: 64,
    paddingHorizontal: 24,
  },
  ctaHeading: {
    color: '#F5F5F5',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.4,
    marginBottom: 8,
    textAlign: 'center',
  },
  ctaSub: {
    color: '#CFCFCF',
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 720,
  },
  cardTitle: {
    color: '#F5F5F5',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  cardBody: {
    color: '#CFCFCF',
    fontSize: 14,
    lineHeight: 20,
  },
});
