// eslint.config.js
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,

  {
    ignores: ['dist/*'],

    plugins: ['prettier', 'simple-import-sort', 'import'],

    rules: {
      // ---------------- Prettier ----------------
      'prettier/prettier': [
        'error',
        {
          singleQuote: true,
          semi: true,
          trailingComma: 'all',
          printWidth: 85,
          tabWidth: 2,
        },
      ],

      // ---------------- React / JSX ----------------
      'react/no-unescaped-entities': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // ---------------- TypeScript ----------------
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],

      // ---------------- Imports ----------------
      'import/no-unresolved': 'off', // if you have TS path aliases
      'import/no-named-as-default': 'warn',
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
    },
  },
]);