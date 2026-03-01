/**
 * generate-sw.js
 *
 * Generates a Workbox service worker into dist/sw.js after `expo export --platform web`.
 *
 * Run automatically via `npm run build:web`.
 *
 * Strategy:
 *  - Content-hashed JS/CSS (_expo/static/**):  CacheFirst  (immutable, safe to cache forever)
 *  - HTML pages:                               NetworkFirst (always try fresh copy, fall back on offline)
 *  - Images & fonts:                           CacheFirst   (large files, rarely change)
 */

const path = require("path");
const { generateSW } = require("workbox-build");

const DIST = path.resolve(__dirname, "../dist");

generateSW({
  // ── Source directory ─────────────────────────────────────────────────────
  globDirectory: DIST,

  // Precache everything we ship: pages, chunks, assets
  globPatterns: [
    "**/*.html",
    "_expo/static/**/*.{js,css,map}",
    "assets/**/*.{png,jpg,jpeg,svg,gif,webp,ico,woff,woff2,ttf,eot}",
    "favicon.ico",
  ],

  // Do not precache the SW itself or its source map
  globIgnores: ["sw.js", "sw.js.map"],

  // ── Output ────────────────────────────────────────────────────────────────
  swDest: path.join(DIST, "sw.js"),

  // Activate the new SW immediately without waiting for tabs to close
  skipWaiting: true,
  clientsClaim: true,

  // ── Runtime caching rules (applied to requests NOT in the precache) ───────
  runtimeCaching: [
    // Content-hashed JS / CSS bundles → CacheFirst (they never change once hashed)
    {
      urlPattern: /\/_expo\/static\/.+\.(js|css)$/,
      handler: "CacheFirst",
      options: {
        cacheName: "static-assets",
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
        },
      },
    },

    // Images and fonts → CacheFirst
    {
      urlPattern: /\.(png|jpg|jpeg|svg|gif|webp|ico|woff2?|ttf|eot)$/,
      handler: "CacheFirst",
      options: {
        cacheName: "media-assets",
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        },
      },
    },

    // HTML navigation → NetworkFirst: try fresh from server, fall back to cache
    {
      urlPattern: ({ request }) => request.mode === "navigate",
      handler: "NetworkFirst",
      options: {
        cacheName: "pages",
        networkTimeoutSeconds: 3,
        expiration: {
          maxEntries: 60,
          maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
        },
      },
    },
  ],
})
  .then(({ count, size }) => {
    const mb = (size / 1024 / 1024).toFixed(2);
    console.log(`✅  Service worker generated → dist/sw.js`);
    console.log(`   Precached ${count} files (${mb} MB)`);
  })
  .catch((err) => {
    console.error("❌  Failed to generate service worker:", err);
    process.exit(1);
  });
