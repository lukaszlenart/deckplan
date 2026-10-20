import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'
import globals from 'globals'

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/pwa/sw.js'],
    languageOptions: { globals: globals.serviceworker },
  },
  {
    // Domain logic must stay independent of the UI layer.
    files: ['src/domain/**', 'src/storage/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/ui/**', '../ui', '../../ui'],
              message: 'Domain code must not import from ui/.',
            },
          ],
        },
      ],
    },
  },
  prettier,
)
