// @ts-check
import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'tmp/**', 'db/*.sqlite'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      // The codebase (and the Remix framework's own docs/examples) use
      // `let` throughout, even for values that are never reassigned.
      'prefer-const': 'off',
      // The codebase intentionally uses snake_case for DB row properties
      // (they're raw column names) and this project doesn't enforce a
      // naming convention, so leave that to reviewers rather than lint.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },
)
