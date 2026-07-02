/**
 * generate-sitemap.js
 *
 * Generates dist/sitemap.xml from exported web routes.
 *
 * Run after: expo export --platform web
 */

const fs = require("fs");
const path = require("path");

const DIST = path.resolve(__dirname, "../dist");
const SITE_URL = (process.env.SITE_URL || "https://stratumarcheology.com").replace(/\/+$/, "");
const URLSET_OUTPUT = path.join(DIST, "sitemap.xml");
const INDEX_OUTPUT = path.join(DIST, "sitemap_index.xml");

function listHtmlFiles(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      listHtmlFiles(fullPath, out);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".html")) {
      out.push(fullPath);
    }
  }
  return out;
}

function htmlFileToRoute(filePath) {
  const relative = path.relative(DIST, filePath).split(path.sep).join("/");

  if (relative === "index.html") return "/";
  if (relative.endsWith("/index.html")) {
    return `/${relative.slice(0, -"/index.html".length)}`;
  }
  if (relative.endsWith(".html")) {
    return `/${relative.slice(0, -".html".length)}`;
  }

  return null;
}

function normalizeRoute(route) {
  const segments = route
    .split("/")
    .filter(Boolean)
    .filter((segment) => !(segment.startsWith("(") && segment.endsWith(")")));

  if (segments.length === 0) return "/";
  return `/${segments.join("/")}`;
}

function shouldIncludeRoute(route) {
  if (!route) return false;
  if (route.includes("[") || route.includes("]")) return false;
  if (route.startsWith("/_expo")) return false;
  if (route === "/+not-found") return false;
  if (route === "/_sitemap") return false;
  if (route === "/sitemap") return false;
  if (route === "/sitemap.xml") return false;
  if (route === "/sitemap_index.xml") return false;
  if (/[A-Z]/.test(route)) return false;
  if (/[^a-z0-9/_-]/.test(route)) return false;
  return true;
}

function routePriority(route) {
  if (route === "/") return "1.0";
  if (route === "/sitemap") return "0.3";
  return "0.7";
}

function toAbsoluteUrl(route) {
  if (route === "/") return `${SITE_URL}/`;
  return `${SITE_URL}${route}`;
}

function buildXml(routes) {
  const lastmod = new Date().toISOString().slice(0, 10);
  const urls = routes
    .map((route) => {
      const loc = toAbsoluteUrl(route);
      const priority = routePriority(route);
      return [
        "  <url>",
        `    <loc>${loc}</loc>`,
        `    <lastmod>${lastmod}</lastmod>`,
        "    <changefreq>weekly</changefreq>",
        `    <priority>${priority}</priority>`,
        "  </url>",
      ].join("\n");
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    "</urlset>",
    "",
  ].join("\n");
}

function buildSitemapIndex() {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    "  <sitemap>",
    `    <loc>${SITE_URL}/sitemap.xml</loc>`,
    `    <lastmod>${new Date().toISOString().slice(0, 10)}</lastmod>`,
    "  </sitemap>",
    "</sitemapindex>",
    "",
  ].join("\n");
}

function main() {
  if (!fs.existsSync(DIST)) {
    console.error("Dist directory not found. Run expo export first.");
    process.exit(1);
  }

  const routes = Array.from(
    new Set(
      listHtmlFiles(DIST)
        .map(htmlFileToRoute)
        .map(normalizeRoute)
        .filter(shouldIncludeRoute),
    ),
  ).sort((a, b) => {
    if (a === "/") return -1;
    if (b === "/") return 1;
    return a.localeCompare(b);
  });

  const urlsetXml = buildXml(routes);
  fs.writeFileSync(URLSET_OUTPUT, urlsetXml, "utf8");

  const indexXml = buildSitemapIndex();
  fs.writeFileSync(INDEX_OUTPUT, indexXml, "utf8");

  console.log(`Generated sitemap with ${routes.length} routes -> dist/sitemap.xml`);
  console.log("Generated sitemap index -> dist/sitemap_index.xml");
}

main();
