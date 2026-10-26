import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

// On iOS an RNRestart reload keeps the process, so Linking.getInitialURL()
// still returns the URL that launched the app. LinkingUtils skips it when
// RNRestart.getReason() is set (startedByInAppRestart), so every RNRestart
// call must pass IN_APP_RESTART. A call without it clears the reason, and
// the next JS runtime handles the launch URL again, even after a data wipe.
//
// The source is parsed rather than matched line by line, so calls split
// across lines, optional chaining and other import forms are seen too.

// Vendored, generated or native code that never calls react-native-restart
const SKIP_DIRS = [
    '.git',
    'android',
    'assets',
    'coverage',
    'docs',
    'ios',
    'locales',
    'metadata',
    'node_modules',
    'patches',
    'proto',
    'zeus_modules'
];

const SOURCE_FILE = /\.[jt]sx?$/;
const TEST_FILE = /\.test\.[jt]sx?$/;

const sourceFiles = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const file = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            return SKIP_DIRS.includes(entry.name) ? [] : sourceFiles(file);
        }
        return SOURCE_FILE.test(entry.name) && !TEST_FILE.test(entry.name)
            ? [file]
            : [];
    });

const RESTART_MODULE = 'react-native-restart';

const isRestartModule = (node: ts.Node) =>
    ts.isStringLiteralLike(node) && node.text === RESTART_MODULE;

// Returns a description of every use of react-native-restart in the file
// that is not `import RNRestart from 'react-native-restart'`,
// `RNRestart.Restart(IN_APP_RESTART)`, `RNRestart.restart(IN_APP_RESTART)`
// or `RNRestart.getReason()`
const restartOffenders = (file: string): string[] => {
    const text = fs.readFileSync(file).toString('utf8');
    if (!text.includes(RESTART_MODULE)) return [];

    const source = ts.createSourceFile(
        file,
        text,
        ts.ScriptTarget.Latest,
        true,
        file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );
    const offenders: string[] = [];
    const report = (node: ts.Node, reason: string) => {
        const { line } = source.getLineAndCharacterOfPosition(
            node.getStart(source)
        );
        offenders.push(
            `${file}:${line + 1}: ${node.getText(source)} (${reason})`
        );
    };

    const checkIdentifier = (node: ts.Identifier) => {
        const parent = node.parent;
        if (ts.isImportClause(parent)) return;
        if (
            ts.isPropertyAccessExpression(parent) &&
            parent.expression === node &&
            ts.isCallExpression(parent.parent) &&
            parent.parent.expression === parent
        ) {
            const method = parent.name.text;
            const args = parent.parent.arguments;
            if (method === 'getReason') return;
            if (method === 'Restart' || method === 'restart') {
                if (
                    args.length === 1 &&
                    ts.isIdentifier(args[0]) &&
                    args[0].text === 'IN_APP_RESTART'
                ) {
                    return;
                }
                report(parent.parent, 'missing IN_APP_RESTART');
                return;
            }
        }
        report(parent, 'unchecked use of RNRestart');
    };

    const visit = (node: ts.Node) => {
        if (
            ts.isImportDeclaration(node) &&
            isRestartModule(node.moduleSpecifier)
        ) {
            const clause = node.importClause;
            if (
                !clause ||
                clause.namedBindings ||
                clause.name?.text !== 'RNRestart'
            ) {
                report(node, `import it as RNRestart`);
            }
            return;
        }
        if (
            (ts.isExportDeclaration(node) &&
                node.moduleSpecifier &&
                isRestartModule(node.moduleSpecifier)) ||
            (ts.isCallExpression(node) &&
                node.arguments.length > 0 &&
                isRestartModule(node.arguments[0]))
        ) {
            report(node, `import it as RNRestart`);
            return;
        }
        if (ts.isIdentifier(node) && node.text === 'RNRestart') {
            checkIdentifier(node);
        }
        ts.forEachChild(node, visit);
    };
    visit(source);
    return offenders;
};

describe('in-app restarts', () => {
    it('pass IN_APP_RESTART to RNRestart', () => {
        const offenders = sourceFiles('.').flatMap(restartOffenders);

        if (offenders.length > 0) {
            throw new Error(
                'Import react-native-restart as RNRestart and pass ' +
                    'IN_APP_RESTART to every RNRestart.Restart() call, or ' +
                    'use restartApp(). Without the reason the next JS ' +
                    'runtime on iOS handles the launch URL again.\n' +
                    offenders.join('\n')
            );
        }
    });
});
