// eslint.config.js
const expoConfig = require("eslint-config-expo/flat");
const prettierPlugin = require("eslint-plugin-prettier");

module.exports = [
  ...expoConfig,

  {
    ignores: [
      "dist/*",
      "node_modules/*",
      ".expo/*",
      "android/*",
      "ios/*",
      "*.lock",
      "babel.config.js",
      "metro.config.js",
    ],
  },

  {
    plugins: {
      prettier: prettierPlugin,
    },

    rules: {
      "prettier/prettier": [
        "error",
        {
          singleQuote: false,
          semi: true,
          trailingComma: "all",
          printWidth: 85,
          tabWidth: 2,
          bracketSpacing: true,
          bracketSameLine: false,
          arrowParens: "always",
        },
      ],
      "react/no-unescaped-entities": "off",
    },
  },
];
