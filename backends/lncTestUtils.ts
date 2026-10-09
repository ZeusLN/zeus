// Execute production Wallet/Settings methods without mounting React Native or
// importing the singleton store graph. Control flow is extracted verbatim;
// observable batching is not exercised by these direct calls.
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import ts from 'typescript';

export function sourceMethods(
    relativePath: string,
    className: string,
    names: string[],
    context: Record<string, any>
): any {
    const filename = path.resolve(__dirname, '..', relativePath);
    const source = ts.createSourceFile(
        filename,
        fs.readFileSync(filename, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX
    );
    const declaration = source.statements.find(
        (node): node is ts.ClassDeclaration =>
            ts.isClassDeclaration(node) && node.name?.text === className
    );
    if (!declaration) throw new Error(`Missing class ${className}`);
    const members = names.map((name) => {
        const member = declaration.members.find(
            (node) => node.name?.getText(source) === name
        );
        if (!member) throw new Error(`Missing member ${name}`);
        return member.getText(source);
    });
    const compiled = ts.transpileModule(
        `class Subject { ${members.join('\n')} }; Subject;`,
        {
            compilerOptions: {
                target: ts.ScriptTarget.ES2020,
                experimentalDecorators: true
            }
        }
    ).outputText;
    return vm.runInNewContext(compiled, {
        console,
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        action: (_target: any, _name: any, descriptor: any) => descriptor,
        runInAction: (fn: () => any) => fn(),
        ...context
    });
}
