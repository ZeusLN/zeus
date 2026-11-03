import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

// The native spending-condition parsers must never turn caller-supplied
// conditions into "no conditions": CDK reads nil/null as a request for an
// ordinary, unlocked bearer proof.
//
// The Swift parser is compiled out of CashuDevKitModule.swift against stub
// CDK types and run on each payload. That needs swiftc, so it is skipped on
// the Linux CI runners. The Kotlin module cannot be built without the CDK
// aar and an Android toolchain, so it is covered by a source scan.

const IOS_SOURCE = fs.readFileSync(
    path.join(__dirname, '../ios/CashuDevKit/CashuDevKitModule.swift'),
    'utf8'
);
const ANDROID_SOURCE = fs.readFileSync(
    path.join(
        __dirname,
        '../android/app/src/main/java/com/zeus/cashudevkit/CashuDevKitModule.kt'
    ),
    'utf8'
);

const PUBKEY =
    '02a9acc1e48c25eeeb9289b5031cc57da9fe72f3fe2861d264bdc074209b107ba2';
const HASH = 'ec4916dd28fc4c10d78e287ca5d9cc51ee1ae73cbfde08c6b37324cbfaac8bc5';

const UNSUPPORTED: Array<[string, any]> = [
    ['an HTLC condition', { kind: 'HTLC', data: { hash: HASH } }],
    ['a missing kind', { data: { pubkey: PUBKEY } }],
    ['P2PK without data', { kind: 'P2PK' }],
    ['P2PK without a pubkey', { kind: 'P2PK', data: {} }],
    ['P2PK with an empty pubkey', { kind: 'P2PK', data: { pubkey: '' } }]
];

const between = (source: string, start: string, end: string) => {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from + 1);
    expect(from).toBeGreaterThanOrEqual(0);
    expect(to).toBeGreaterThan(from);
    return source.slice(from, to);
};

const hasSwiftc = (() => {
    if (process.platform !== 'darwin') return false;
    try {
        execFileSync('xcrun', ['--find', 'swiftc'], { stdio: 'pipe' });
        return true;
    } catch {
        return false;
    }
})();

const HARNESS = (parser: string) => `import Foundation

struct Conditions {
    let locktime: UInt64?
    let pubkeys: [String]
    let refundKeys: [String]
    let numSigs: UInt64?
    let sigFlag: UInt8
    let numSigsRefund: UInt64?
}

enum SpendingConditions {
    case p2pk(pubkey: String, conditions: Conditions?)
    case htlc(hash: String, conditions: Conditions?)
}

final class Module {
${parser}

    func run(_ json: String) -> String {
        let parsed = try! JSONSerialization.jsonObject(
            with: json.data(using: .utf8)!
        ) as! [String: Any]
        do {
            let result: SpendingConditions? = try parseP2PKConditions(from: parsed)
            switch result {
            case .p2pk(let pubkey, let conditions)?:
                return "p2pk \\(pubkey) \\(conditions?.locktime ?? 0)"
            case .htlc(let hash, _)?:
                return "htlc \\(hash)"
            case nil:
                return "none"
            }
        } catch {
            return "error \\(error.localizedDescription)"
        }
    }
}

let module = Module()
for arg in CommandLine.arguments.dropFirst() {
    print(module.run(arg))
}
`;

(hasSwiftc ? describe : describe.skip)('iOS parseP2PKConditions', () => {
    let dir: string;
    let binary: string;

    beforeAll(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdk-conditions-'));
        const parser = between(
            IOS_SOURCE,
            '    /// Parse P2PK spending conditions',
            '    private func parseMeltOptions'
        );
        const file = path.join(dir, 'main.swift');
        fs.writeFileSync(file, HARNESS(parser));
        binary = path.join(dir, 'parse');
        execFileSync('xcrun', ['swiftc', '-O', '-o', binary, file], {
            stdio: 'pipe'
        });
    }, 120000);

    afterAll(() => {
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });

    const run = (...payloads: any[]) =>
        execFileSync(
            binary,
            payloads.map((p) => JSON.stringify(p)),
            {
                encoding: 'utf8'
            }
        )
            .trim()
            .split('\n');

    it.each(UNSUPPORTED)('rejects %s', (_label, payload) => {
        expect(run(payload)[0]).toMatch(/^error /);
    });

    it('names the unsupported kind', () => {
        expect(run(UNSUPPORTED[0][1])).toEqual([
            'error Unsupported spending condition kind: HTLC'
        ]);
    });

    it('converts a P2PK condition with its locktime', () => {
        expect(
            run({
                kind: 'P2PK',
                data: { pubkey: PUBKEY, locktime: 1900000000 }
            })
        ).toEqual([`p2pk ${PUBKEY} 1900000000`]);
    });
});

describe('iOS CashuDevKitModule condition call sites', () => {
    it('rejects mint conditions that are not a JSON object', () => {
        const mint = between(IOS_SOURCE, 'func mint(_ mintUrl', 'wallet.mint(');
        expect(mint).toContain('if let json = conditionsJson {');
        expect(mint).toMatch(
            /guard let data = json\.data[\s\S]*?else \{\s*throw makeP2PKValidationError/
        );
    });

    it('rejects send conditions that are not a JSON object', () => {
        const send = between(
            IOS_SOURCE,
            'func prepareSend(_ mintUrl',
            'let sendOptions = SendOptions('
        );
        expect(send).toContain(
            'if let cond = parsed["conditions"], !(cond is NSNull) {'
        );
        expect(send).toMatch(
            /guard let condDict = cond as\? \[String: Any\] else \{\s*throw makeP2PKValidationError/
        );
    });
});

describe('Android CashuDevKitModule conditions', () => {
    const parser = between(
        ANDROID_SOURCE,
        'private fun parseP2PKConditions',
        'private fun optionalPositiveULong'
    );

    it('returns a non-null SpendingConditions or throws', () => {
        expect(parser).toContain(
            'private fun parseP2PKConditions(json: JSONObject): SpendingConditions {'
        );
        expect(parser).not.toMatch(/return null/);
        expect(parser).toContain(
            'require(kind == "P2PK") { "Unsupported spending condition kind: $kind" }'
        );
        expect(parser).toMatch(
            /requireNotNull\(json\.optJSONObject\("data"\)\)/
        );
        expect(parser).toContain('require(pubkeyHex.isNotEmpty())');
    });

    it('does not mint unlocked when the conditions JSON is malformed', () => {
        const mint = between(
            ANDROID_SOURCE,
            'fun mint(mintUrl: String, quoteId: String, conditionsJson',
            'wallet.mint('
        );
        expect(mint).not.toContain('runCatching');
        expect(mint).toContain('parseP2PKConditions(JSONObject(json))');
    });

    it('does not drop send conditions that are not an object', () => {
        const send = between(
            ANDROID_SOURCE,
            'fun prepareSend(mintUrl: String',
            'val sendOptions = SendOptions('
        );
        expect(send).not.toContain('optJSONObject("conditions")');
        expect(send).toContain(
            'if (parsed.has("conditions") && !parsed.isNull("conditions")) {'
        );
        expect(send).toContain(
            'parseP2PKConditions(parsed.getJSONObject("conditions"))'
        );
    });
});
