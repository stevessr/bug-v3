import js from '@eslint/js'
import prettier from 'eslint-plugin-prettier'
import prettierConfig from 'eslint-config-prettier'
import globals from 'globals'

// ESLint configuration specifically for generated userscripts
export default [
  js.configs.recommended,
  {
    files: ['**/*.user.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script', // Userscripts typically use script mode
      globals: {
        ...globals.browser,
        ...globals.es2021,
        // Userscript environment globals
        GM_info: 'readonly',
        GM_getValue: 'readonly',
        GM_setValue: 'readonly',
        GM_deleteValue: 'readonly',
        GM_listValues: 'readonly',
        GM_addStyle: 'readonly',
        GM_getResourceText: 'readonly',
        GM_getResourceURL: 'readonly',
        GM_openInTab: 'readonly',
        GM_xmlhttpRequest: 'readonly',
        unsafeWindow: 'readonly'
      }
    },
    plugins: {
      prettier: prettier
    },
    rules: {
      // Allow console statements in userscripts - they're used for debugging
      'no-console': 'off',
      // Allow var declarations in userscripts for compatibility
      'no-var': 'warn',
      // Allow debugger statements in userscripts
      'no-debugger': 'warn',
      // Allow alert statements in userscripts
      'no-alert': 'off',
      // Relax some strict rules for generated code
      'no-unused-vars': 'warn',
      // Vite may emit constant condition expressions in preload helpers; ignore them in generated userscript
      'no-constant-condition': 'off',
      'prefer-const': 'error',
      // Prettier should still format the code
      'prettier/prettier': 'error'
    }
  },
  prettierConfig
]
