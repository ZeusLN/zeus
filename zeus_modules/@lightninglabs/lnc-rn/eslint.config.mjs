import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
    {
        ignores: [
            'dist/**',
            'lib/types/**',
            'demos/**',
            'node_modules/**',
            '**/*.d.ts'
        ]
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ['lib/**/*.{ts,tsx}'],
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                ecmaVersion: 2020,
                sourceType: 'module'
            },
            globals: {
                ...globals.node,
                ...globals.browser
            }
        },
        plugins: {
            '@typescript-eslint': tseslint.plugin
        },
        rules: {
            'max-len': [
                'error',
                {
                    code: 120,
                    ignoreUrls: true,
                    ignoreStrings: true,
                    ignoreTemplateLiterals: true,
                    ignoreRegExpLiterals: true
                }
            ],
            'new-parens': 'error',
            'no-caller': 'error',
            'no-bitwise': 'error',
            'no-cond-assign': ['error', 'always'],
            'no-multiple-empty-lines': ['error', { max: 1 }],
            'no-console': [
                'warn',
                {
                    allow: [
                        'assert',
                        'clear',
                        'count',
                        'countReset',
                        'dir',
                        'dirxml',
                        'error',
                        'group',
                        'groupCollapsed',
                        'groupEnd',
                        'table',
                        'timeLog',
                        'warn'
                    ]
                }
            ],
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_' }
            ],
            // logger forwards arbitrary payloads to debug(); RPC responses are runtime-shaped
            '@typescript-eslint/no-explicit-any': 'off'
        }
    },
    prettier
);
