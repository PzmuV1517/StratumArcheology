import React from 'react';
import { useState } from 'react';
import { View, Text, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
// Use React Bits components directly (no wrappers)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ColorBends = require('../components/ColorBends.jsx').default;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const StarBorder = require('../components/StarBorder.jsx').default;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const DotGrid = require('../components/DotGrid.jsx').default;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const GradualBlur = require('../components/GradualBlur.jsx').default;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const CardSwapModule = require('../components/CardSwap.jsx');
const CardSwap = CardSwapModule.default || CardSwapModule;
const Card = CardSwapModule.Card;


// Load component CSS only on web to avoid native errors
if (Platform.OS === 'web') {
  // @ts-ignore - CSS handled by web bundler
  require('../components/ColorBends.css');
  // @ts-ignore - CSS handled by web bundler
  require('../components/DotGrid.css');
  // @ts-ignore - CSS handled by web bundler
  require('../components/StarBorder.css');
  // @ts-ignore - CSS handled by web bundler
  require('../components/CardSwap.css');
}

export default function LandingPage() {
  const router = useRouter();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const toggleFaq = (idx: number) => setOpenFaq(prev => (prev === idx ? null : idx));
  const { width } = useWindowDimensions();
  const isNarrow = width < 900;

  return (

<section style={{position: 'relative',overflow: 'hidden'}}>
    {/* Fixed DotGrid background that appears below hero (hero covers via z-index) */}

      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', inset: 0 }}>
            {React.createElement(DotGrid, {
            dotSize: 5,
            gap: 15,
            baseColor: '#000000ff',
            activeColor: '#ff0000',
            proximity: 120,
            shockRadius: 250,
            shockStrength: 5,
            resistance: 750,
            returnDuration: 1.5,
              style: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: '#000' },
          })}
        </div>
      </div>

    {/* Fixed top fade to blend DotGrid into hero */}
    {Platform.OS === 'web' ? <div className="dotgrid-fade-top" /> : null}

    <div style={{ height: '100%',overflowY: 'auto'}}>

            <View style={styles.container}>
      <View style={[styles.hero, Platform.OS === 'web' ? ({ minHeight: '100vh' } as any) : null]}>
                {/* Animated background */}
                <View style={styles.bg}>
        <ColorBends
                    colors={["#ff0000", "#ff1717ff", "#9d0000ff"]}
                    rotation={19}
                    autoRotate={0}
                    speed={0.35}
                    scale={1}
                    frequency={1}
                    warpStrength={1}
                    mouseInfluence={1}
                    parallax={0.5}
                    noise={0.1}
          transparent={false}
                />
                </View>

        {/* Web-only bottom fade to blend ColorBends into page background */}
        {Platform.OS === 'web' ? <div className="colorbends-fade-bottom" /> : null}

                {/* Content overlay */}
                <View style={styles.center}>
                <Text style={styles.logo}>STRATUM</Text>
                <Text style={styles.title}>Organize research. Share results.</Text>
                <Text style={styles.subtitle}>Projects, artefacts, and notes in one streamlined workspace.</Text>
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
                    Begin
                    </StarBorder>
                </View>
                </View>

            </View>
            {/* Informational section */}
            <View style={styles.infoSection}>
                <Text style={styles.sectionHeading}>Why STRATUM?</Text>
                <View style={styles.cards}>
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Artefacts, not files</Text>
                    <Text style={styles.cardBody}>Group results, notes, and assets with a living manifest that stays in sync.</Text>
                </View>
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Collaborate safely</Text>
                    <Text style={styles.cardBody}>Role-based access, history, and site-styled confirmations prevent mistakes.</Text>
                </View>
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Edit anything</Text>
                    <Text style={styles.cardBody}>CSV, Excel, Markdown, and JSON with a unified preview and quick saves.</Text>
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
                    <Text style={styles.cardBody}>Every artefact carries its origin, linked notes, and related assets—so results aren’t just files, they’re stories.</Text>
                  </View>
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Instant previews</Text>
                    <Text style={styles.cardBody}>Open large CSVs, JSON, and Markdown with a fast, consistent UI on web and mobile.</Text>
                  </View>
                </View>
                <View style={styles.mosaicCol}>
                  <View style={styles.cardAccent}>
                    <Text style={styles.cardBadge}>NEW</Text>
                    <Text style={styles.cardTitle}>Live manifests</Text>
                    <Text style={styles.cardBody}>artefact.json updates automatically as your project grows, keeping everything coherent.</Text>
                  </View>
                  <View style={[styles.card, styles.cardInset]}>
                    <Text style={styles.cardTitle}>Safe collaboration</Text>
                    <Text style={styles.cardBody}>Role-based access and confirmations reduce mistakes without slowing you down.</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Stats row */}
            <View style={[styles.sectionBlock, { paddingTop: 20, paddingBottom: 0 }]}>
              <View style={[styles.statsRow, isNarrow ? { flexDirection: 'column' } : null]}>
                <View style={styles.statCard}><Text style={styles.statNumber}>10×</Text><Text style={styles.statLabel}>Faster setup</Text></View>
                <View style={styles.statCard}><Text style={styles.statNumber}>1 place</Text><Text style={styles.statLabel}>for notes & data</Text></View>
                <View style={styles.statCard}><Text style={styles.statNumber}>Zero</Text><Text style={styles.statLabel}>context loss</Text></View>
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
                      {React.createElement(CardSwap, {
                        cardDistance: 60,
                        verticalDistance: 70,
                        delay: 5000,
                        pauseOnHover: false,
                        children: [
                          React.createElement(Card, { key: 0 }),
                          React.createElement(Card, { key: 1 }),
                          React.createElement(Card, { key: 2 }),
                        ],
                      })}
                    </div>
                  ) : null}
                </View>
              </View>
            </View>

                        {/* Comparison */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionHeading}>Why teams switch</Text>
              <View style={[styles.compareRow, isNarrow ? { flexDirection: 'column' } : null]}>
                <View style={[styles.card, styles.compareHalf]}>
                  <Text style={styles.cardTitle}>Without STRATUM</Text>
                  <Text style={styles.cardBody}>• Files scattered across drives{"\n"}• Unclear provenance{"\n"}• Manual previews & copy-paste notes</Text>
                </View>
                <View style={[styles.cardAccent, styles.compareHalf]}>
                  <Text style={styles.cardTitle}>With STRATUM</Text>
                  <Text style={styles.cardBody}>• Artefacts with manifests{"\n"}• Linked notes and previews{"\n"}• Safer actions and quick sharing</Text>
                </View>
              </View>
            </View>   

            {/* How it works */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionHeading}>How it works</Text>
              <View style={styles.stepList}>
                <View style={styles.stepItem}>
                  <Text style={styles.stepNumber}>1</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Create a project</Text>
                    <Text style={styles.cardBody}>Spin up a new workspace for your experiment or investigation.</Text>
                  </View>
                </View>
                <View style={styles.stepItem}>
                  <Text style={styles.stepNumber}>2</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Add artefacts and notes</Text>
                    <Text style={styles.cardBody}>Upload datasets, results, and images. Keep notes close to the data they describe.</Text>
                  </View>
                </View>
                <View style={styles.stepItem}>
                  <Text style={styles.stepNumber}>3</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Share and iterate</Text>
                    <Text style={styles.cardBody}>Invite collaborators, review history, and iterate safely with tracked changes.</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Closing CTA */}
            <View style={[styles.ctaSection, { paddingTop: 20, paddingBottom: 400 }]}>
              <Text style={styles.ctaHeading}>Start your next discovery</Text>
              <Text style={styles.ctaSub}>Spin up a project and ship your first artefact in minutes.</Text>
              <View style={{ marginTop: 20 }}>
                <StarBorder
                  as="button"
                  color="white"
                  speed="5s"
                  className="thin-border"
                  thickness={1}
                  onClick={() => router.push('/(auth)/register')}
                  onPress={() => router.push('/(auth)/register')}
                >
                  Create an account
                </StarBorder>
              </View>
            </View>
            </View>


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
    

</section>


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
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    zIndex: 10,
    backgroundColor: '#000',
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
  ctaRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  primary: {
    backgroundColor: '#FF2A2A',
    borderColor: '#FF2A2A',
  },
  secondary: {
    backgroundColor: 'transparent',
    borderColor: '#2A2A2A',
  },
  buttonText: {
    color: '#F5F5F5',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  buttonTextSecondary: {
    color: '#F5F5F5',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
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
  quoteCard: {
    width: '100%',
    maxWidth: 900,
    backgroundColor: '#0A0A0A',
    borderLeftWidth: 3,
    borderLeftColor: '#5227FF',
    borderRadius: 16,
    padding: 20,
  },
  quoteMark: {
    color: '#5227FF',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 6,
  },
  quoteText: {
    color: '#F5F5F5',
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 6,
  },
  quoteAuthor: {
    color: '#CFCFCF',
    fontSize: 14,
  },
  logoRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    maxWidth: 1040,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoPill: {
    color: '#E5E5E5',
    borderColor: '#2A2A2A',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 12,
    letterSpacing: 1.5,
    fontWeight: '700',
    backgroundColor: '#0A0A0A',
  },
  screensRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    maxWidth: 1040,
  },
  screenCard: {
    flex: 1,
    height: 220,
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 12,
  },
  screenCaption: {
    color: '#CFCFCF',
    fontSize: 13,
  },
  faqList: {
    width: '100%',
    maxWidth: 900,
  },
  faqItem: {
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  faqQuestion: {
    color: '#F5F5F5',
    fontSize: 16,
    fontWeight: '700',
  },
  faqAnswer: {
    color: '#CFCFCF',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
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
