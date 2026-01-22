// eslint.config.js
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,

  {
    ignores: [
      'dist/*',
      'node_modules/*',
      '.expo/*',
      'android/*',
      'ios/*',
      '*.lock',
      'babel.config.js',
      'metro.config.js',
    ],
  },

  {
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
          bracketSpacing: true,
          bracketSameLine: false,
          arrowParens: 'always',
        },
      ],

      // ---------------- React / JSX ----------------
      'react/no-unescaped-entities': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // ---------------- TypeScript ----------------
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',

      // ---------------- Imports ----------------
      'import/no-unresolved': 'off',
      'import/no-named-as-default': 'warn',
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
    },
  },
]);