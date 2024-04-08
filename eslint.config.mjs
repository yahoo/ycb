import js from '@eslint/js';
import globals from 'globals';

export default [
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2023,
            globals: {
                ...globals.node,
            },
        },
        rules: {
            indent: [2, 4, { SwitchCase: 1 }],
            quotes: [0, 'single'],
            'dot-notation': [2, { allowKeywords: false }],
            'no-console': 0,
            'no-prototype-builtins': 0,
            'no-unexpected-multiline': 0,
        },
        ignores: ['artifacts', 'node_modules', '**/artifacts', '**/node_modules'],
    },
];
