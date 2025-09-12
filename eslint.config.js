import js from '@eslint/js'
import typescript from '@typescript-eslint/eslint-plugin'
import typescriptParser from '@typescript-eslint/parser'
import vue from 'eslint-plugin-vue'
import vueParser from 'vue-eslint-parser'
import importPlugin from 'eslint-plugin-import'
import promise from 'eslint-plugin-promise'
import prettier from 'eslint-plugin-prettier'
import prettierConfig from 'eslint-config-prettier'
import globals from 'globals'
import jsoncParser from 'jsonc-eslint-parser'

export default [
  // 忽略的文件
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '*.min.js',
      'referense/**',
      'public/**',
      // ensure default.json is ignored across platforms and invocations
      'src/config/default.json',
      '**/src/config/default.json',
      'src\\config\\default.json',
      '*.yaml',
      'playwright-report/**',
      'test-results/**',
      'scripts/**',
      'src/config/buildFlags.ts',
      'src/content/utils/buildFLagsV2.ts',
      'server/**',
      '*.config.*s',
      '*.crx',
      '*.zip',
      '*.pem',
      '*.json'
    ]
  },

  // Defensive override: if eslint is invoked in a way that bypasses ignore patterns,
  // explicitly silence rules for the generated runtime JSON so lint won't fail CI.
  {
    files: ['src/config/default.json', 'src\\config\\default.json', '**/src/config/default.json'],
    // Use a JSON-compatible parser so ESLint won't throw a parsing error when --no-ignore is used
    languageOptions: {
      parser: jsoncParser
    },
    rules: {
      // defensive: if ignore patterns are bypassed, silence all rules for this generated JSON
      'prettier/prettier': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off'
    }
  },

  // JavaScript 基础配置
  js.configs.recommended,

  // TypeScript 文件配置
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    plugins: {
      '@typescript-eslint': typescript,
      import: importPlugin,
      promise: promise,
      prettier: prettier
    },
    rules: {
      // TypeScript 规则
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-var-requires': 'error',

      // Import 规则
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always'
        }
      ],
      'import/no-duplicates': 'error',

      // Promise 规则
      'promise/catch-or-return': 'error',
      'promise/no-nesting': 'warn',
      'promise/no-promise-in-callback': 'warn',

      // 通用规则
      'no-debugger': 'error',
      'no-alert': 'warn',
      'prefer-const': 'error',
      'no-var': 'error',

      // Prettier 规则
      'prettier/prettier': 'error'
    }
  },

  // Vue 文件配置
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: typescriptParser,
        ecmaVersion: 'latest',
        sourceType: 'module',
        extraFileExtensions: ['.vue']
      }
    },
    plugins: {
      vue: vue,
      '@typescript-eslint': typescript,
      import: importPlugin,
      promise: promise,
      prettier: prettier
    },
    rules: {
      // Vue 基础规则
      'vue/multi-word-component-names': 'off',
      'vue/no-v-html': 'warn',
      'vue/require-default-prop': 'off',
      'vue/require-explicit-emits': 'error',
      'vue/component-definition-name-casing': ['error', 'PascalCase'],
      'vue/component-name-in-template-casing': ['error', 'PascalCase'],
      'vue/custom-event-name-casing': ['error', 'camelCase'],
      'vue/no-empty-component-block': 'error',
      'vue/prefer-separate-static-class': 'error',
      'vue/prefer-true-attribute-shorthand': 'error',
      'vue/block-order': [
        'error',
        {
          order: ['script', 'template', 'style']
        }
      ],

      // TypeScript 规则 (在 Vue 中)
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',

      // Import 规则
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always'
        }
      ],

      // Promise 规则
      'promise/catch-or-return': 'error',

      // 通用规则
      'no-debugger': 'error',
      'prefer-const': 'error',
      'no-var': 'error',

      // Prettier 规则
      'prettier/prettier': 'error'
    }
  },

  // JavaScript 文件配置
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module'
    },
    plugins: {
      import: importPlugin,
      promise: promise,
      prettier: prettier
    },
    rules: {
      // Import 规则
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always'
        }
      ],
      'import/no-duplicates': 'error',

      // Promise 规则
      'promise/catch-or-return': 'error',
      'promise/no-nesting': 'warn',

      // 通用规则
      'no-debugger': 'error',
      'no-alert': 'warn',
      'prefer-const': 'error',
      'no-var': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

      // Prettier 规则
      'prettier/prettier': 'error'
    }
  },

  // 测试文件特殊配置
  {
    files: ['**/*.spec.ts', '**/*.test.ts', 'tests/**/*'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off'
    }
  },

  // 配置文件特殊配置
  {
    files: ['*.config.js', '*.config.ts', 'scripts/**/*'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-var-requires': 'off',
      // scripts often reference globals or build-time helpers
      'no-undef': 'off'
    }
  },

  // Temporarily allow console in backend, userscript and utility code to reduce noise
  // Note: we no longer globally allow console; instead prefer migrating to logger

  // Allow alert in userscript files
  {
    files: ['src/userscript/**'],
    rules: {
      'no-alert': 'off'
    }
  },

  // Allow console inside the logger implementation file itself
  {
    files: ['src/config/buildFlags.ts'],
    rules: {
      'no-console': 'off',
      'no-restricted-properties': 'off'
    }
  },

  // Allow console usage in content buildFlags (project uses console there during migration)
  {
    files: ['src/content/buildFlags.ts'],
    rules: {
      'no-console': 'off',
      'no-restricted-properties': 'off'
    }
  },

  // Temporarily relax @typescript-eslint/no-explicit-any for backend and utilities
  {
    files: ['src/background/**', 'src/utils/**', 'src/content/**', 'src/userscript/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off'
    }
  },

  // 全局变量配置
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2021,
        ...globals.node,
        // 项目中使用的额外全局
        chrome: 'readonly',
        NodeJS: 'readonly',
        // build-time flags used in code
        __ENABLE_LOGGING__: 'readonly',
        __ENABLE_INDEXEDDB__: 'readonly'
      }
    }
  },

  // Temporarily disable unused-variable checks project-wide (per user request)
  {
    files: ['**/*'],
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off'
    }
  },

  // Prettier 配置（必须放在最后）
  prettierConfig
]
