const { RuleTester } = require('eslint');
const tsParser = require('@typescript-eslint/parser');
const rule = require('./no-themecolor-in-static-stylesheet');

const ruleTester = new RuleTester({
    languageOptions: {
        parserOptions: { ecmaFeatures: { jsx: true } }
    }
});

const error = { messageId: 'themeColorInStaticStyleSheet' };

ruleTester.run('no-themecolor-in-static-stylesheet', rule, {
    valid: [
        'const styles = StyleSheet.create({ a: { color: "red" } });',
        'const s = { color: themeColor("text") };',
        'function C() { const styles = StyleSheet.create({ a: { color: themeColor("text") } }); }',
        'const getStyles = () => StyleSheet.create({ a: { color: themeColor("text") } });',
        'export const getStyles = () => StyleSheet.create({ a: { color: themeColor("text") } });',
        'export default function () { return StyleSheet.create({ a: { color: themeColor("text") } }); }',
        'const C = () => <View style={{ color: themeColor("text") }} />;',
        'class C { render() { return StyleSheet.create({ a: { color: themeColor("text") } }); } }',
        'class C { styles = StyleSheet.create({ a: { color: themeColor("text") } }); }',
        'const styles = StyleSheet.create({ a: { color: "red" } });\nconst C = () => <Text style={{ color: themeColor("text") }} />;',
        'const styles = Other.create({ a: { color: themeColor("text") } });',
        'const styles = StyleSheet.flatten({ color: themeColor("text") });'
    ],
    invalid: [
        {
            code: 'const styles = StyleSheet.create({ a: { color: themeColor("text") } });',
            errors: [error]
        },
        {
            code: 'export const styles = StyleSheet.create({ a: { color: themeColor("text") } });',
            errors: [error]
        },
        {
            code: 'export default StyleSheet.create({ a: { color: themeColor("text") } });',
            errors: [error]
        },
        {
            code: 'const styles = RN.StyleSheet.create({ a: { color: themeColor("text") } });',
            errors: [error]
        },
        {
            code: 'const styles = StyleSheet.create({\n    a: { color: themeColor("text"), backgroundColor: themeColor("background") }\n});',
            errors: [error, error]
        },
        {
            code: 'const styles = StyleSheet.create({ a: { color: dark ? themeColor("text") : "red" } });',
            errors: [error]
        },
        {
            code: 'if (x) { var styles = StyleSheet.create({ a: { color: themeColor("text") } }); }',
            errors: [error]
        },
        {
            code: 'class C { static styles = StyleSheet.create({ a: { color: themeColor("text") } }); }',
            errors: [error]
        },
        {
            code: 'const styles = StyleSheet.create({ a: { color: themeColor("text") as string } });',
            languageOptions: { parser: tsParser },
            errors: [error]
        },
        {
            code: 'const styles = StyleSheet.create<Styles>({ a: { color: themeColor("text") } });',
            languageOptions: { parser: tsParser },
            errors: [error]
        }
    ]
});
