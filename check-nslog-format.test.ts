import * as fs from 'fs';
import * as path from 'path';

// NSLog reads its first argument as a printf-style format. A path, URL,
// error message or config passed there has any '%' in it read as a
// conversion, which reads missing arguments and can crash. Values have to
// go in as arguments to a constant format: NSLog("%@", value).
const NATIVE_DIR = 'ios';
const NATIVE_FILE = /\.(swift|m|mm|h)$/;
// CocoaPods, build output and the downloaded native libraries
const SKIPPED_DIR =
    /^(Pods|build|DerivedData|__MACOSX)$|\.xcframework$|LibZipFile$/;

const nativeFiles = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const entryPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            return SKIPPED_DIR.test(entry.name) ? [] : nativeFiles(entryPath);
        }
        return NATIVE_FILE.test(entry.name) ? [entryPath] : [];
    });

// Blanks out comments so commented-out calls are not reported, keeping
// string literals and newlines so line numbers still match.
const stripComments = (source: string): string => {
    let out = '';
    let i = 0;
    while (i < source.length) {
        const two = source.slice(i, i + 2);
        if (two === '//') {
            while (i < source.length && source[i] !== '\n') {
                out += ' ';
                i++;
            }
        } else if (two === '/*') {
            const end = source.indexOf('*/', i + 2);
            const stop = end === -1 ? source.length : end + 2;
            out += source.slice(i, stop).replace(/[^\n]/g, ' ');
            i = stop;
        } else if (source[i] === '"') {
            const start = i++;
            while (i < source.length && source[i] !== '"') {
                i += source[i] === '\\' ? 2 : 1;
            }
            i++;
            out += source.slice(start, i);
        } else {
            out += source[i++];
        }
    }
    return out;
};

// Returns the index after one string literal starting at `i` that has no
// Swift interpolation, or -1 if there is none.
const constantLiteralEnd = (source: string, i: number): number => {
    if (source[i] === '@') i++;
    if (source[i] !== '"' || source.startsWith('"""', i)) return -1;
    i++;
    while (i < source.length && source[i] !== '"') {
        if (source[i] === '\n') return -1;
        if (source[i] === '\\') {
            if (source[i + 1] === '(') return -1;
            i += 2;
        } else {
            i++;
        }
    }
    return i < source.length ? i + 1 : -1;
};

const skipSpace = (source: string, i: number): number => {
    while (i < source.length && /\s/.test(source[i])) i++;
    return i;
};

// Reports each NSLog or NSLogv call whose format is not a string literal,
// or is a literal followed by more than the argument list ('+', a method
// call, Swift interpolation). Adjacent C literals (@"a" "b") are allowed.
const nonConstantFormats = (
    source: string
): { line: number; call: string }[] => {
    const code = stripComments(source);
    const offenders: { line: number; call: string }[] = [];
    const call = /\bNSLogv?\s*\(/g;
    let match;
    while ((match = call.exec(code)) !== null) {
        let i = skipSpace(code, match.index + match[0].length);
        let literals = 0;
        for (;;) {
            const end = constantLiteralEnd(code, i);
            if (end === -1) break;
            literals++;
            i = skipSpace(code, end);
        }
        if (literals === 0 || (code[i] !== ',' && code[i] !== ')')) {
            const line = code.slice(0, match.index).split('\n').length;
            offenders.push({
                line,
                call: source.split('\n')[line - 1].trim()
            });
        }
    }
    return offenders;
};

describe('nonConstantFormats', () => {
    it.each([
        'NSLog(url.relativeString)',
        'NSLog("Read config: " + input)',
        'NSLog("[" + tag + "] " + msg)',
        'NSLog("FROM: \\(lndData.path)")',
        'NSLog(saveUrl?.path ?? "")',
        'NSLog(@"%@".uppercaseString, x)',
        'NSLog(message);',
        'NSLogv(format, args);',
        'NSLog(\n  error.localizedDescription\n)'
    ])('flags %s', (call) => {
        expect(nonConstantFormats(call)).toHaveLength(1);
    });

    it.each([
        'NSLog("%@", url.relativeString)',
        'NSLog("[%@] %@", tag, msg)',
        'NSLog("%@", "FROM: \\(lndData.path)")',
        'NSLog("Wrote config (%ld bytes)", config.utf8.count)',
        'NSLog("--CHANNEL BACKUP RESTORE--")',
        'NSLog("quote \\" and backslash \\\\")',
        'NSLog(@"[NWCAudio] %@", muted ? @"Muted" : @"Unmuted");',
        'NSLog(@"first " "second %@",\n      value);',
        '// NSLog(url.relativeString)',
        '/* NSLog(url.relativeString) */',
        'let url = "https://example.com" // NSLog(url)'
    ])('accepts %s', (call) => {
        expect(nonConstantFormats(call)).toEqual([]);
    });

    it('reports the line of the call', () => {
        expect(
            nonConstantFormats('let a = 1\n\n  NSLog(a.description)\n')
        ).toEqual([{ line: 3, call: 'NSLog(a.description)' }]);
    });
});

describe('NSLog calls in ios/', () => {
    it('all use a string literal as the format', () => {
        const files = nativeFiles(NATIVE_DIR);
        expect(files.length).toBeGreaterThan(0);

        const offenders = files.flatMap((file) =>
            nonConstantFormats(fs.readFileSync(file, 'utf8')).map(
                ({ line, call }) => `${file}:${line}: ${call}`
            )
        );

        if (offenders.length > 0) {
            throw new Error(
                'These NSLog calls build their format from a value, so a ' +
                    "'%' in it is read as a conversion. Use a constant " +
                    'format, such as NSLog("%@", value).\n' +
                    offenders.join('\n')
            );
        }
    });
});
