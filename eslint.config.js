const reactNativeConfig = require('@react-native/eslint-config/flat');
const importPlugin = require('eslint-plugin-import');
const prettierPlugin = require('eslint-plugin-prettier');
const noNegativeLayoutOffset = require('./eslint-rules/no-negative-layout-offset');

module.exports = [
    // Ignore patterns (must be first for ESLint 9 global ignores)
    {
        ignores: [
            'node_modules/**',
            'zeus_modules/**',
            'android/**',
            'ios/**',
            'proto/**',
            'shim.js',
            'babel.config.js',
            'metro.config.js',
            'react-native.config.js',
            'index.js'
        ]
    },

    // Base React Native flat config (includes prettier conflict resolution)
    ...reactNativeConfig,

    // Disable ft-flow rules globally (Zeus uses TypeScript, not Flow;
    // eslint-plugin-ft-flow@2.x is incompatible with ESLint 9)
    {
        files: ['**/*.js'],
        rules: {
            'ft-flow/define-flow-type': 'off',
            'ft-flow/use-flow-type': 'off',
            'ft-flow/boolean-style': 'off',
            'ft-flow/no-dupe-keys': 'off',
            'ft-flow/no-primitive-constructor-types': 'off',
            'ft-flow/no-types-missing-file-annotation': 'off',
            'ft-flow/no-unused-expressions': 'off',
            'ft-flow/no-weak-types': 'off',
            'ft-flow/require-valid-file-annotation': 'off'
        }
    },

    // Import plugin for all files
    {
        files: ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx'],
        plugins: {
            import: importPlugin
        },
        settings: {
            'import/resolver': {
                typescript: true,
                node: true
            }
        },
        rules: {
            'import/default': 'off',
            'import/named': 'off',
            'import/namespace': 'off',
            'import/no-duplicates': 'error',
            'import/no-named-as-default': 'off',
            'import/no-named-as-default-member': 'off',
            'import/no-unresolved': ['error', { commonjs: true, amd: true }]
        }
    },

    // TypeScript-specific overrides
    {
        files: ['**/*.ts', '**/*.tsx'],
        languageOptions: {
            parserOptions: {
                project: true,
                tsconfigRootDir: __dirname
            },
            globals: {
                JSX: 'readonly',
                Buffer: 'readonly'
            }
        },
        rules: {
            '@typescript-eslint/await-thenable': 'error',
            '@typescript-eslint/ban-ts-comment': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-non-null-assertion': 'off',
            '@typescript-eslint/no-shadow': 'off',
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrors: 'none'
                }
            ],
            '@typescript-eslint/no-require-imports': 'off',
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/explicit-module-boundary-types': 'off'
        }
    },

    // Global rule overrides for all files
    {
        files: ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx'],
        languageOptions: {
            globals: {
                JSX: 'readonly',
                Buffer: 'readonly'
            }
        },
        rules: {
            'comma-dangle': 'off',
            curly: 'off',
            camelcase: 'off',
            'no-case-declarations': 'off',
            'no-control-regex': 'off',
            'no-undef': 'error',
            'no-unused-vars': 'off',
            'no-const-assign': 'error',
            'object-shorthand': ['error', 'always'],
            'prefer-spread': 'off',

            'react/no-string-refs': 'off',
            'react/prop-types': 'off',
            'react/react-in-jsx-scope': 'off',
            'react-native/no-inline-styles': 'off',
            'react/no-unstable-nested-components': 'off',
            'react/self-closing-comp': 'off',
            'react-hooks/exhaustive-deps': 'off',

            // TODO re-evaluate
            'dot-notation': 'off',
            eqeqeq: 'off',
            'no-bitwise': 'off',
            'no-div-regex': 'off',
            'no-lone-blocks': 'off',
            'no-void': 'off',
            radix: 'off',
            semi: 'off',
            quotes: 'off',

            'prettier/prettier': ['error', { endOfLine: 'auto' }]
        },
        plugins: {
            prettier: prettierPlugin
        }
    },

    // Test files: fail on focused or disabled tests so an accidental
    // it.only or xit cannot silently shrink the suite. The jest plugin is
    // registered globally by @react-native/eslint-config, which sets these
    // rules to 'warn'; registering the root eslint-plugin-jest copy under
    // the same name would be a redefinition error, so only rules are set.
    {
        files: ['**/*.test.js', '**/*.test.ts', '**/*.test.tsx'],
        rules: {
            'jest/no-focused-tests': 'error',
            'jest/no-disabled-tests': 'error',
            'jest/no-identical-title': 'error',
            'jest/valid-expect': 'error'
        }
    },

    // Fail on disable directives that no longer suppress anything (e.g. after
    // a negative layout offset has been fixed)
    {
        linterOptions: {
            reportUnusedDisableDirectives: 'error'
        }
    },

    // Zeus-specific rules
    {
        files: ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx'],
        plugins: {
            zeus: {
                rules: {
                    'no-negative-layout-offset': noNegativeLayoutOffset
                }
            }
        },
        rules: {
            'zeus/no-negative-layout-offset': 'error'
        }
    }
];
