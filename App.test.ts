import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

// App.tsx imports every screen and cannot be loaded under the Jest config,
// so these checks read its source.
const appConstructor = () => {
    const filename = path.resolve(__dirname, 'App.tsx');
    const source = ts.createSourceFile(
        filename,
        fs.readFileSync(filename, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX
    );
    const app = source.statements.find(
        (node): node is ts.ClassDeclaration =>
            ts.isClassDeclaration(node) && node.name?.text === 'App'
    );
    return app?.members.find(ts.isConstructorDeclaration);
};

describe('App', () => {
    // On Android a persistent node or NWC service keeps the JS runtime and
    // its stores alive after the activity is swiped away. A new App root
    // must not inherit the previous login session.
    it('ends the login session when a new App root is created', () => {
        const constructor = appConstructor();

        expect(constructor).toBeDefined();
        const statements = constructor!.body!.statements.map((statement) =>
            statement.getText().replace(/\s+/g, '')
        );
        expect(statements).toContain('settingsStore.setLoginStatus(false);');
    });
});
