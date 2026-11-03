import { execFileSync, spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Compiles writeConfig and the log bridge out of LndMobileTools.swift with
// NSLog replaced by a function that formats with Foundation and records the
// result, and the application support directory pointed at a temp dir.
// Needs swiftc and the macOS SDK, so it is skipped on the Linux CI runners.
const hasSwiftc = (() => {
    if (process.platform !== 'darwin') return false;
    try {
        execFileSync('xcrun', ['--find', 'swiftc'], { stdio: 'pipe' });
        return true;
    } catch {
        return false;
    }
})();

const extractMethods = () => {
    const source = fs.readFileSync(
        path.join(__dirname, 'LndMobileTools.swift'),
        'utf8'
    );
    const start = source.indexOf('  @objc(writeConfig:');
    const end = source.indexOf('  @objc(DEBUG_getWalletPasswordFromKeychain:');
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const methods = source.slice(start, end);
    expect(methods).toContain('func log(level:');
    const appSupport =
        'FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)';
    expect(methods).toContain(appSupport);
    // The @objc selectors need an Objective-C class and are not under test
    return methods
        .replace(appSupport, '[root]')
        .replace(/^ *@objc\(.*\)\n/gm, '');
};

const HARNESS = (methods: string) => `import Foundation

typealias RCTPromiseResolveBlock = (Any?) -> Void
typealias RCTPromiseRejectBlock = (String?, String?, Error?) -> Void

var logged: [String] = []
func NSLog(_ format: String, _ args: CVarArg...) {
  logged.append(String(format: format, arguments: args))
}

// argv: <root> writeConfig <lndDir> <config> | <root> log <tag> <msg>
let root = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)

class Tools {
${methods}
}

var report: [String: Any] = [:]
if CommandLine.arguments[2] == "writeConfig" {
  let lndDir = CommandLine.arguments[3]
  let config = CommandLine.arguments[4]
  let dir = root.appendingPathComponent(lndDir, isDirectory: true)
  try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
  let url = dir.appendingPathComponent("lnd.conf", isDirectory: false)
  var outcome = "pending"
  Tools().writeConfig(
    config: config, lndDir: lndDir,
    resolver: { _ in outcome = "resolved" },
    rejecter: { _, _, _ in outcome = "rejected" })
  report["outcome"] = outcome
  report["url"] = url.relativeString
  report["saved"] = (try? String(contentsOf: url)) == config
} else {
  Tools().log(level: "info", tag: CommandLine.arguments[3], msg: CommandLine.arguments[4])
}
report["logs"] = logged
let json = try JSONSerialization.data(withJSONObject: report)
print(String(data: json, encoding: .utf8)!)
`;

const CONFIG = (feeUrl: string) => `[Application Options]
debuglevel=info

[fee]
fee.url=${feeUrl}
`;

(hasSwiftc ? describe : describe.skip)(
    'LndMobileTools writeConfig and log (compiled, macOS only)',
    () => {
        let dir: string;
        let binary: string;

        beforeAll(() => {
            dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lnd-write-config-'));
            const source = path.join(dir, 'main.swift');
            binary = path.join(dir, 'harness');
            fs.writeFileSync(source, HARNESS(extractMethods()));
            execFileSync('xcrun', ['swiftc', source, '-o', binary], {
                stdio: 'pipe'
            });
        }, 120000);

        afterAll(() => {
            if (dir) fs.rmSync(dir, { recursive: true, force: true });
        });

        const run = (...args: string[]) => {
            const root = fs.mkdtempSync(path.join(dir, 'case-'));
            const result = spawnSync(binary, [root, ...args], {
                encoding: 'utf8'
            });
            expect(result.signal).toBeNull();
            expect(result.status).toBe(0);
            return JSON.parse(result.stdout);
        };

        it('writes the config and logs its path', () => {
            const config = CONFIG(
                'https://nodes.lightning.computer/fees/v1/btc-fee-estimates.json'
            );
            const report = run('writeConfig', 'lnd', config);

            expect(report.outcome).toBe('resolved');
            expect(report.saved).toBe(true);
            expect(report.logs).toContain(report.url);
        });

        // relativeString escapes '%' as %25, and %25p is still a conversion
        it('logs a path containing % as written', () => {
            const report = run('writeConfig', 'x%p%x', CONFIG('https://a'));

            expect(report.url).toContain('x%25p%25x');
            expect(report.logs).toContain(report.url);
        });

        it('does not log the config contents', () => {
            const secret = 'api_key=fee-secret-8b7a0d';
            const config = CONFIG(`https://fees.invalid/estimates?${secret}`);
            const report = run('writeConfig', 'lnd', config);

            expect(report.outcome).toBe('resolved');
            expect(report.saved).toBe(true);
            expect(report.logs.join('\n')).not.toContain('fee-secret-8b7a0d');
            expect(report.logs.join('\n')).not.toContain('fees.invalid');
            expect(report.logs).toContain(
                `Wrote config (${Buffer.byteLength(config)} bytes)`
            );
        });

        it('logs a tag and message containing % as written', () => {
            expect(run('log', 'tag%p', 'message %x %p').logs).toEqual([
                '[tag%p] message %x %p'
            ]);
        });
    }
);
