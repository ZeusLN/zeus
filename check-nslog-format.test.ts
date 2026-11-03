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

type Literal = { end: number; interpolated: boolean };

// Lexes comments and string literals so that calls in comments are not
// reported and the format literal can be found. Returns the source with
// comments and literal contents blanked (newlines kept, so line numbers
// still match), and the literals by start index. Throws on anything it
// cannot lex, so the scan fails instead of skipping code.
//
// Swift: "...", multi-line """...""", raw #"..."# (any number of #),
// interpolation \( ) and \#( ), nested /* */ comments.
// C, Objective-C: "...", @"...", character literals ('"', '\''), C++14
// digit separators (1'000). C++ raw strings (R"(...)") are not supported.
const lex = (source: string, swift: boolean) => {
    const code = source.split('');
    const literals = new Map<number, Literal>();
    const blank = (from: number, to: number) => {
        for (let k = from; k < to; k++) {
            if (code[k] !== '\n') code[k] = ' ';
        }
    };
    const fail = (i: number, problem: string): never => {
        const line = source.slice(0, i).split('\n').length;
        throw new Error(`line ${line}: ${problem}`);
    };

    const blockComment = (start: number): number => {
        let depth = 0;
        let i = start;
        while (i < source.length) {
            if (source.startsWith('/*', i)) {
                // Swift block comments nest, C ones do not
                depth = swift ? depth + 1 : 1;
                i += 2;
            } else if (source.startsWith('*/', i)) {
                depth--;
                i += 2;
                if (depth === 0) break;
            } else {
                i++;
            }
        }
        if (depth !== 0) fail(start, 'unterminated block comment');
        blank(start, i);
        return i;
    };

    // C string or character literal starting at `start` (at '@' or the quote)
    const cLiteral = (start: number, quote: string): number => {
        let i = source[start] === '@' ? start + 2 : start + 1;
        const bodyStart = i;
        while (source[i] !== quote) {
            if (i >= source.length || source[i] === '\n') {
                fail(start, 'unterminated literal');
            }
            i += source[i] === '\\' ? 2 : 1;
        }
        blank(bodyStart, i);
        if (quote === '"') {
            literals.set(start, { end: i + 1, interpolated: false });
        }
        return i + 1;
    };

    // Swift string literal starting at `start` (at the first '#' or quote)
    const swiftLiteral = (start: number): number => {
        let hashes = 0;
        while (source[start + hashes] === '#') hashes++;
        const pounds = '#'.repeat(hashes);
        const multiLine = source.startsWith('"""', start + hashes);
        const close = (multiLine ? '"""' : '"') + pounds;
        const escape = '\\' + pounds;
        let i = start + hashes + (multiLine ? 3 : 1);
        let interpolated = false;
        for (;;) {
            if (i >= source.length) fail(start, 'unterminated string');
            if (source.startsWith(escape, i)) {
                const after = i + escape.length;
                blank(i, after + 1);
                if (source[after] === '(') {
                    interpolated = true;
                    i = scan(after + 1, true) + 1;
                } else {
                    i = after + 1;
                }
            } else if (source.startsWith(close, i)) {
                break;
            } else {
                if (!multiLine && source[i] === '\n') {
                    fail(start, 'unterminated string');
                }
                blank(i, i + 1);
                i++;
            }
        }
        const end = i + close.length;
        literals.set(start, { end, interpolated });
        return end;
    };

    // Lexes code from `start`. In an interpolation, returns the index of
    // the ')' that closes it.
    const scan = (start: number, interpolation: boolean): number => {
        let depth = 0;
        let i = start;
        while (i < source.length) {
            const c = source[i];
            if (source.startsWith('//', i)) {
                let end = source.indexOf('\n', i);
                if (end === -1) end = source.length;
                blank(i, end);
                i = end;
            } else if (source.startsWith('/*', i)) {
                i = blockComment(i);
            } else if (swift && /^#*"/.test(source.slice(i, i + 16))) {
                i = swiftLiteral(i);
            } else if (swift && /^#+\//.test(source.slice(i, i + 16))) {
                fail(i, 'Swift regex literals are not supported');
            } else if (!swift && (c === '"' || source.startsWith('@"', i))) {
                i = cLiteral(i, '"');
            } else if (
                !swift &&
                /^(?:u8|[LuU])?R"/.test(source.slice(i, i + 4)) &&
                !/[A-Za-z0-9_]/.test(source[i - 1] ?? '')
            ) {
                fail(i, 'C++ raw strings are not supported');
            } else if (!swift && c === "'") {
                // A quote inside a number (1'000, 0xFF'FF) separates digits
                const before = /[A-Za-z0-9_.]*$/.exec(source.slice(0, i))![0];
                i = /^[0-9.]/.test(before) ? i + 1 : cLiteral(i, "'");
            } else if (interpolation && c === '(') {
                depth++;
                i++;
            } else if (interpolation && c === ')') {
                if (depth === 0) return i;
                depth--;
                i++;
            } else {
                i++;
            }
        }
        if (interpolation) fail(start, 'unterminated interpolation');
        return i;
    };

    scan(0, false);
    return { code: code.join(''), literals };
};

const skipSpace = (code: string, i: number): number => {
    while (i < code.length && /\s/.test(code[i])) i++;
    return i;
};

// Reports each NSLog or NSLogv call whose format is not a string literal,
// or is a literal followed by more than the argument list ('+', a method
// call), or uses Swift interpolation. Adjacent C literals (@"a" "b") are
// allowed.
const nonConstantFormats = (
    source: string,
    swift: boolean
): { line: number; call: string }[] => {
    const { code, literals } = lex(source, swift);
    const offenders: { line: number; call: string }[] = [];
    const call = /\bNSLogv?\s*\(/g;
    let match;
    while ((match = call.exec(code)) !== null) {
        let i = skipSpace(code, match.index + match[0].length);
        let count = 0;
        let interpolated = false;
        let literal;
        while ((literal = literals.get(i)) !== undefined) {
            count++;
            interpolated = interpolated || literal.interpolated;
            i = skipSpace(code, literal.end);
        }
        if (
            count === 0 ||
            interpolated ||
            (code[i] !== ',' && code[i] !== ')')
        ) {
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
        ['swift', 'NSLog(url.relativeString)'],
        ['swift', 'NSLog("Read config: " + input)'],
        ['swift', 'NSLog("[" + tag + "] " + msg)'],
        ['swift', 'NSLog("FROM: \\(lndData.path)")'],
        ['swift', 'NSLog(saveUrl?.path ?? "")'],
        ['swift', 'NSLog(\n  error.localizedDescription\n)'],
        ['swift', 'NSLog(#"\\#(value)"#)'],
        ['swift', 'NSLog("""\n  \\(value)\n  """)'],
        ['swift', 'NSLog("a \\(f(")")) b")'],
        // A quote inside a raw or multi-line string does not end it
        ['swift', 'let s = #"say "hi"#\nNSLog(value)'],
        ['swift', 'let s = """\n  say "hi\n  """\nNSLog(value)'],
        ['objc', 'NSLog(@"%@".uppercaseString, x)'],
        ['objc', 'NSLog(message);'],
        ['objc', 'NSLogv(format, args);'],
        // A '"' character literal does not start a string
        ['objc', "char q = '\"';\nNSLog(value);\nchar r = '\"';"],
        ['objc', "char q = '\\'';\nNSLog(value);\nchar r = '\\'';"],
        ['objc', "int n = 1'000;\nNSLog(value);\nint m = 2'000;"]
    ])('flags %s: %s', (language, call) => {
        expect(nonConstantFormats(call, language === 'swift')).toHaveLength(1);
    });

    it.each([
        ['swift', 'NSLog("%@", url.relativeString)'],
        ['swift', 'NSLog("[%@] %@", tag, msg)'],
        ['swift', 'NSLog("%@", "FROM: \\(lndData.path)")'],
        ['swift', 'NSLog("Wrote config (%ld bytes)", config.utf8.count)'],
        ['swift', 'NSLog("--CHANNEL BACKUP RESTORE--")'],
        ['swift', 'NSLog("quote \\" and backslash \\\\")'],
        ['swift', 'NSLog(#"raw \\(not interpolated) "quoted""#, value)'],
        ['swift', 'NSLog("""\n  multi-line "quoted" %@\n  """, value)'],
        ['swift', 'NSLog("%@", "a \\(f(")")) b")'],
        ['swift', 'let s = "NSLog(value)"'],
        ['swift', 'let s = """\n  NSLog(value) // "\n  """'],
        ['swift', '/* outer /* inner */ NSLog(value) */'],
        ['swift', '// NSLog(url.relativeString)'],
        ['swift', 'let url = "https://example.com" // NSLog(url)'],
        ['objc', 'NSLog(@"[NWCAudio] %@", muted ? @"Muted" : @"Unmuted");'],
        ['objc', 'NSLog(@"first " "second %@",\n      value);'],
        ['objc', '/* NSLog(url.relativeString) */'],
        ['objc', 'char q = \'"\'; // NSLog(value)\nNSLog(@"%c", q);']
    ])('accepts %s: %s', (language, call) => {
        expect(nonConstantFormats(call, language === 'swift')).toEqual([]);
    });

    it.each([
        ['swift', 'let s = "unterminated\nNSLog(value)'],
        ['swift', 'let s = #"unterminated"\nNSLog(value)'],
        ['swift', 'let s = """\nNSLog(value)'],
        ['swift', 'let s = "\\(unterminated"'],
        ['swift', '/* unterminated'],
        ['swift', 'let r = #/a"b/#\nNSLog(value)'],
        ['objc', 'auto s = R"(a " b)";\nNSLog(value);'],
        ['objc', 'char q = \'"\nNSLog(value);']
    ])('throws on %s: %s', (language, source) => {
        expect(() => nonConstantFormats(source, language === 'swift')).toThrow(
            /line \d+: /
        );
    });

    it('reports the line of the call', () => {
        expect(
            nonConstantFormats('let a = 1\n\n  NSLog(a.description)\n', true)
        ).toEqual([{ line: 3, call: 'NSLog(a.description)' }]);
    });
});

describe('NSLog calls in ios/', () => {
    it('all use a string literal as the format', () => {
        const files = nativeFiles(NATIVE_DIR);
        expect(files.length).toBeGreaterThan(0);

        const offenders = files.flatMap((file) => {
            try {
                return nonConstantFormats(
                    fs.readFileSync(file, 'utf8'),
                    file.endsWith('.swift')
                ).map(({ line, call }) => `${file}:${line}: ${call}`);
            } catch (error: any) {
                throw new Error(`${file}: ${error.message}`);
            }
        });

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
