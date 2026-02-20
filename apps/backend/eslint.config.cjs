const js = require('@eslint/js');
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const promisePlugin = require('eslint-plugin-promise');
const securityPlugin = require('eslint-plugin-security');
const importPlugin = require('eslint-plugin-import');
const globals = require('globals');

module.exports = [
  {
    ignores: ['dist/**', 'node_modules/**'],
    linterOptions: {
      reportUnusedDisableDirectives: false
    }
  },
  js.configs.recommended,
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: __dirname,
        sourceType: 'module'
      },
      globals: {
        ...globals.node,
        ...globals.es2022
      }
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      promise: promisePlugin,
      security: securityPlugin,
      import: importPlugin
    },
    rules: {
      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      'import/no-duplicates': 'error',
      'promise/no-return-wrap': 'error',
      'security/detect-object-injection': 'off'
    }
  },
  {
    files: ['src/routes/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/db/prisma'],
              message: 'Import domain repositories instead of prisma in routes.'
            },
            {
              group: ['**/legacy.router', '**/legacy.router.ts'],
              message: 'Legacy route modules are forbidden.'
            },
            {
              group: ['**/shared/legacyRouteProxy', '**/shared/legacyRouteProxy.ts'],
              message: 'Legacy route proxy is forbidden.'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['src/routes/auth/**/*.ts', 'src/routes/me/**/*.ts', 'src/routes/adminApi/**/*.ts'],
    rules: {
      'max-lines': ['error', { max: 400, skipBlankLines: true, skipComments: true }]
    }
  },
  {
    files: ['src/config/env.ts'],
    rules: {
      'no-console': 'off'
    }
  }
];
