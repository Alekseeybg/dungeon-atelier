import js from '@eslint/js'
import globals from 'globals'
import pluginVue from 'eslint-plugin-vue'
import pluginQuasar from '@quasar/app-vite/eslint'
import tseslint from 'typescript-eslint'
import prettierSkipFormatting from '@vue/eslint-config-prettier/skip-formatting'
import { fileURLToPath } from 'node:url'

export default [
  ...pluginQuasar.configs.recommended(),
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: ['**/*.ts', '**/*.vue'],
  })),
  ...pluginVue.configs['flat/essential'],
  {
    files: ['**/*.ts', '**/*.vue'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: fileURLToPath(new URL('.', import.meta.url)),
        extraFileExtensions: ['.vue'],
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
    },
  },
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      'vue/v-slot-style': ['warn', 'shorthand'],
      'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',
    },
  },
  prettierSkipFormatting,
]
