const { RuleTester } = require('eslint');
const tsParser = require('@typescript-eslint/parser');
const rule = require('./no-negative-layout-offset');

const ruleTester = new RuleTester({
    languageOptions: {
        parserOptions: { ecmaFeatures: { jsx: true } }
    }
});

const error = { messageId: 'negativeOffset' };

ruleTester.run('no-negative-layout-offset', rule, {
    valid: [
        'const s = { marginTop: 10 };',
        'const s = { marginTop: 0, left: 5 };',
        'const s = { top: offset - 5 };',
        'const s = { marginLeft: i > 0 ? 8 : 0 };',
        'const s = { transform: [{ translateY: -5 }] };',
        'const s = { paddingTop: -5 };',
        'const s = { marginTop: { value: -5 } };',
        'const s = { [key]: -5 };',
        'const { top = -1 } = props;',
        'const x = -5;',
        'const s = { end: addr.slice(-6) };',
        'const s = { right: arr.indexOf(x) !== -1 ? 10 : 0 };',
        'const s = { left: () => -5 };',
        'const s = { top: Math.max(-5, y) };',
        "const s = { marginTop: '10%' };",
        "const s = { start: '-' };",
        'const s = { start: `-` };',
        'const s = { end: `${a}-${b}` };',
        '<Pressable hitSlop={{ top: -5, bottom: -5 }} />;',
        '<Pressable pressRetentionOffset={{ left: -10 }} />;',
        '<Pressable hitSlop={small ? { top: -5 } : undefined} />;',
        'const p = { hitSlop: { top: -5 } };'
    ],
    invalid: [
        { code: 'const s = { marginTop: -10 };', errors: [error] },
        { code: 'const s = { margin: -4 };', errors: [error] },
        {
            code: 'const s = { left: -10000, top: -10000 };',
            errors: [error, error]
        },
        { code: 'const s = { marginLeft: i > 0 ? -8 : 0 };', errors: [error] },
        { code: 'const s = { top: -(1 + t * 1.5) };', errors: [error] },
        { code: 'const s = { top: a ? -1 : -2 };', errors: [error] },
        {
            code: 'const s = {\n    marginLeft:\n        -10\n};',
            errors: [{ messageId: 'negativeOffset', line: 2 }]
        },
        { code: 'const s = { marginTop: -insets.top };', errors: [error] },
        { code: "const s = { 'marginTop': -10 };", errors: [error] },
        { code: 'const s = { insetInlineStart: -2 };', errors: [error] },
        { code: 'const s = { marginBlockEnd: -2 };', errors: [error] },
        {
            code: 'const s = StyleSheet.create({ row: { marginRight: -8 } });',
            errors: [error]
        },
        {
            code: '<View style={{ marginTop: 20, marginLeft: -24 }} />;',
            errors: [error]
        },
        { code: 'const s = { top: x ?? -5 };', errors: [error] },
        {
            code: 'const s = { top: -1 as number };',
            languageOptions: { parser: tsParser },
            errors: [error]
        },
        {
            code: 'const s = { top: (-5)! };',
            languageOptions: { parser: tsParser },
            errors: [error]
        },
        {
            code: 'const s = { top: -5 satisfies number };',
            languageOptions: { parser: tsParser },
            errors: [error]
        },
        { code: "const s = { marginTop: '-10%' };", errors: [error] },
        { code: 'const s = { marginTop: `-10%` };', errors: [error] },
        { code: 'const s = { marginTop: `-${x}%` };', errors: [error] },
        { code: "const s = { top: cond ? '-10%' : 0 };", errors: [error] },
        {
            code: '<Pressable hitSlop={{ top: 5 }} style={{ top: -5 }} />;',
            errors: [error]
        },
        {
            code: 'const p = { hitSlop: { top: 5 }, style: { top: -5 } };',
            errors: [error]
        }
    ]
});
