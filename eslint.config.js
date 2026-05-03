import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'src/routeTree.gen.ts']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Whitelist framework-canonical non-component exports so the rule stays
      // strict for genuinely HMR-breaking exports. {button,badge}Variants =
      // shadcn/ui cva() pattern; useTheme = context hook alongside
      // ThemeProvider. Route files use a file-level eslint-disable comment
      // instead (matches established project convention — see topics.tsx,
      // archive.tsx, admin/index.tsx). `Route` is deliberately NOT whitelisted
      // here because the rule still flags when an internal (non-exported)
      // route component coexists with non-component exports; the file-level
      // disable is the right tool for that case.
      'react-refresh/only-export-components': [
        'error',
        { allowExportNames: ['buttonVariants', 'badgeVariants', 'useTheme'] },
      ],
    },
  },
  {
    files: ['e2e/tests/**/*.spec.ts'],
    rules: {
      // E2E-SCOPE-1: list locators on the shared E2E DB drift unless they
      // filter to [E2E]-prefixed rows. The :has() walk catches a .filter()
      // call anywhere in the chain; bare counters/indexers are flagged.
      // Escape-hatch: `eslint-disable-next-line no-restricted-syntax -- WHY`
      // is permitted when the locator is already DOM-scoped (e.g. inside
      // a card boundary). PR review enforces WHY comment quality.
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.type='MemberExpression'][callee.property.name=/^(toHaveCount|first|nth|all|last)$/]" +
            ":not(:has(CallExpression[callee.property.name='filter']))",
          message:
            'E2E-SCOPE-1: filter to [E2E] prefix before counting/indexing list locators. ' +
            'Use .filter({ hasText: /\\[E2E\\]/ }) before .first/.nth/.last/.all/.toHaveCount, ' +
            'OR add `// eslint-disable-next-line no-restricted-syntax -- WHY` if the locator ' +
            'is already DOM-scoped. See e2e/README.md.',
        },
      ],
    },
  },
])
