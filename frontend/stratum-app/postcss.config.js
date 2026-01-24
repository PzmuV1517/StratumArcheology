// Make PostCSS resilient: run without Tailwind if native lightningcss is missing
module.exports = (() => {
  const plugins = [];
  try {
    plugins.push(require("@tailwindcss/postcss"));
  } catch {}
  try {
    plugins.push(require("autoprefixer"));
  } catch {}
  return { plugins };
})();
