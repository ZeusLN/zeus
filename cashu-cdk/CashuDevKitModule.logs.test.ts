// Lockstep scan of the native CDK modules' log calls (Kotlin and Swift are
// not exercised by Jest).
//
// A mint quote without a NUT-20 pubkey lock can be minted by anyone who
// knows its id, so quote ids, quote URLs (which embed the id) and raw mint
// response bodies (which echo it) must not reach logcat or the device log.
// Release builds keep these calls: ProGuard does not strip android.util.Log.

import fs from 'fs';
import path from 'path';

const ANDROID_PATH =
    '../android/app/src/main/java/com/zeus/cashudevkit/CashuDevKitModule.kt';
const IOS_PATH = '../ios/CashuDevKit/CashuDevKitModule.swift';

const read = (p: string) => fs.readFileSync(path.join(__dirname, p), 'utf8');

const KOTLIN_LOG = /\b(?:Log\.(?:v|d|i|w|e|wtf)|println|print)\(/g;
const SWIFT_LOG = /\b(?:print|debugPrint|NSLog|os_log)\(/g;

interface LogCall {
    line: number;
    text: string;
    // Identifiers the call reads: code outside string literals plus
    // string-template interpolations
    identifiers: string[];
}

// Walks one call's argument list from the opening paren, keeping string
// literal text out of the identifier list but descending into Kotlin
// `$name` / `${expr}` and Swift `\(expr)` interpolations.
function scanCall(source: string, open: number): { end: number; code: string } {
    let code = '';
    let i = open + 1;
    // Stack of contexts: 'p' paren, 'b' template brace, 's' string
    const stack: string[] = ['p'];
    while (i < source.length && stack.length > 0) {
        const c = source[i];
        const top = stack[stack.length - 1];
        if (top === 's') {
            if (c === '\\' && source[i + 1] === '(') {
                stack.push('p');
                code += ' ';
                i += 2;
                continue;
            }
            if (c === '\\') {
                i += 2;
                continue;
            }
            if (c === '$' && source[i + 1] === '{') {
                stack.push('b');
                code += ' ';
                i += 2;
                continue;
            }
            if (c === '$' && /[A-Za-z_]/.test(source[i + 1])) {
                const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(source.slice(i + 1));
                code += ` ${m![0]} `;
                i += 1 + m![0].length;
                continue;
            }
            if (c === '"') stack.pop();
            i++;
            continue;
        }
        if (c === '"') {
            stack.push('s');
            code += ' ';
        } else if (c === '(') {
            stack.push('p');
            code += c;
        } else if (c === '{') {
            stack.push('{');
            code += c;
        } else if (c === ')' && top === 'p') {
            stack.pop();
            code += c;
        } else if (c === '}' && (top === 'b' || top === '{')) {
            stack.pop();
            code += c;
        } else {
            code += c;
        }
        i++;
    }
    return { end: i, code };
}

function logCalls(source: string, pattern: RegExp): LogCall[] {
    const calls: LogCall[] = [];
    for (const match of source.matchAll(pattern)) {
        const open = match.index! + match[0].length - 1;
        const { end, code } = scanCall(source, open);
        calls.push({
            line: source.slice(0, match.index).split('\n').length,
            text: source.slice(match.index, end),
            identifiers: code.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []
        });
    }
    return calls;
}

// Anything named for a quote (quoteId, quoteUrl, quote.id, meltQuote), and
// the locals that hold raw mint response bodies
const isSensitive = (identifier: string) =>
    /quote/i.test(identifier) ||
    ['response', 'errorStream', 'errorBody', 'body', 'json'].includes(
        identifier
    );

const leaks = (calls: LogCall[]) =>
    calls
        .filter((call) => call.identifiers.some(isSensitive))
        .map((call) => `line ${call.line}: ${call.text}`);

describe('Cashu native module log scanner', () => {
    it('reads template interpolations and skips literal text', () => {
        const kotlin =
            'Log.d(TAG, "quote (x) $quoteId ${a.b(c)} \\"q\\"")\n' +
            'Log.e(TAG, "Fetching quote")';
        const [first, second] = logCalls(kotlin, KOTLIN_LOG);
        expect(first.identifiers).toEqual(['TAG', 'quoteId', 'a', 'b', 'c']);
        expect(second.identifiers).toEqual(['TAG']);

        const swift = 'print("quote \\(quoteId) for \\(url)")';
        const [call] = logCalls(swift, SWIFT_LOG);
        expect(call.identifiers).toEqual(['quoteId', 'url']);
    });
});

describe('Android CashuDevKitModule logging', () => {
    const source = read(ANDROID_PATH);
    const calls = logCalls(source, KOTLIN_LOG);

    it('finds the module log calls', () => {
        expect(calls.length).toBeGreaterThan(50);
    });

    it('never logs a quote id, quote URL or mint response body', () => {
        expect(leaks(calls)).toEqual([]);
    });

    it('does not log the exception from checkExternalMintQuote', () => {
        // JSONException messages quote the text that failed to parse, and
        // URL exceptions can carry the quote URL
        const start = source.indexOf('fun checkExternalMintQuote');
        const body = source.slice(start, source.indexOf('@ReactMethod', start));
        const bodyCalls = logCalls(body, KOTLIN_LOG);
        expect(bodyCalls.length).toBeGreaterThan(0);
        for (const call of bodyCalls) {
            // The exception class name is allowed, its message is not
            const ids = call.identifiers;
            const usesException = ids.some(
                (id, i) => id === 'e' && ids[i + 1] !== 'javaClass'
            );
            expect(usesException ? call.text : null).toBeNull();
        }
    });
});

describe('iOS CashuDevKitModule logging', () => {
    it('never logs a quote id, quote URL or mint response body', () => {
        expect(leaks(logCalls(read(IOS_PATH), SWIFT_LOG))).toEqual([]);
    });
});
