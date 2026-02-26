// eslint.config.js
const expoConfig = require("eslint-config-expo/flat");
const prettierPlugin = require("eslint-plugin-prettier");
const tseslint = require("@typescript-eslint/eslint-plugin");

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
      "import/no-named-as-default": "off",
    },
  },

  // Override unused-vars rules to allow _-prefixed variables
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },

  {
    files: ["**/*.js", "**/*.jsx"],
    rules: {
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
];
