import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import reactPlugin from 'eslint-plugin-react'
import tseslint from 'typescript-eslint'
import prettierConfig from 'eslint-config-prettier'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.recommendedTypeChecked,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      prettierConfig,
    ],
    plugins: {
      react: reactPlugin,
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      // Variables
      'no-var': 'error',
      'prefer-const': 'error',

      // Naming conventions
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'default',
          format: ['camelCase'],
          leadingUnderscore: 'forbid',
          trailingUnderscore: 'forbid',
        },
        {
          // PascalCase allowed for functions so React components are valid
          selector: 'function',
          format: ['camelCase', 'PascalCase'],
        },
        {
          selector: 'variable',
          modifiers: ['const', 'global'],
          format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
        },
        {
          selector: 'typeLike',
          format: ['PascalCase'],
        },
        {
          selector: 'enumMember',
          format: ['UPPER_CASE', 'PascalCase'],
        },
        {
          selector: 'interface',
          format: ['PascalCase'],
          custom: { regex: '^I[A-Z]', match: false },
        },
        {
          selector: 'variable',
          modifiers: ['destructured'],
          format: null,
        },
        {
          selector: 'objectLiteralProperty',
          format: null,
        },
        {
          selector: 'import',
          format: ['camelCase', 'PascalCase'],
        },
      ],

      // No #private fields — use TypeScript private keyword
      'no-restricted-syntax': [
        'error',
        {
          selector: "PropertyDefinition[key.type='PrivateName']",
          message: "Use TypeScript `private` keyword instead of # private fields.",
        },
      ],

      // No public modifier
      '@typescript-eslint/explicit-member-accessibility': [
        'error',
        {
          accessibility: 'no-public',
          overrides: { constructors: 'off', parameterProperties: 'explicit' },
        },
      ],

      // Prefer readonly on never-reassigned class members
      '@typescript-eslint/prefer-readonly': 'error',

      // No wrapper types (String, Boolean, Number)
      '@typescript-eslint/no-wrapper-object-types': 'error',

      // No Array() constructor
      '@typescript-eslint/no-array-constructor': 'error',

      // Strict equality
      eqeqeq: ['error', 'always'],

      // No parseInt / parseFloat — use Number()
      'no-restricted-globals': [
        'error',
        { name: 'parseInt', message: 'Use Number() instead.' },
        { name: 'parseFloat', message: 'Use Number() instead.' },
      ],

      // throw new Error(), not throw Error()
      '@typescript-eslint/only-throw-error': 'error',

      // No @ts-ignore; @ts-expect-error requires a description
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-ignore': true,
          'ts-expect-error': 'allow-with-description',
        },
      ],

      // Use "as Foo" syntax, not "<Foo>"
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        { assertionStyle: 'as' },
      ],

      // import type for type-only imports
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports' },
      ],

      // Warn on any
      '@typescript-eslint/no-explicit-any': 'warn',

      // No unary + coercion; allow !! for boolean coercion
      'no-implicit-coercion': ['error', { allow: ['!!'] }],

      // React
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
    },
  },
])