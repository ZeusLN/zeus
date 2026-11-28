import { execFile, execFileSync } from 'child_process';
import fs from 'fs';
import http from 'http';
import { AddressInfo } from 'net';
import os from 'os';
import path from 'path';
import { promisify } from 'util';

// checkExternalMintQuote checks the mint URL's scheme and host once, before
// the request (project-loupe/audit-zeus#20). These tests check that its
// fetch does not follow a redirect to a destination that check never saw.
//
// The compiled case extracts the fetch helper from CashuDevKitModule.swift
// and runs it with swiftc against two loopback servers: the first answers
// 302 to the second. The whole module needs React Native and the CDK
// framework, so only the helper is compiled. Needs swiftc and the macOS
// SDK, so it is skipped on the Linux CI runners.

const execFileAsync = promisify(execFile);

const MODULE = path.join(__dirname, 'CashuDevKitModule.swift');
const source = fs.readFileSync(MODULE, 'utf8');

const BLOCK_START = '// MARK: - External quote fetch without redirects';
const BLOCK_END = '// MARK: - End external quote fetch without redirects';

const hasSwiftc = (() => {
    if (process.platform !== 'darwin') return false;
    try {
        execFileSync('xcrun', ['--find', 'swiftc'], { stdio: 'pipe' });
        return true;
    } catch {
        return false;
    }
})();

const extractFetchHelper = (): string => {
    const start = source.indexOf(BLOCK_START);
    const end = source.indexOf(BLOCK_END);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    return source.slice(start, end);
};

// Body of a method, up to the next exported method
const methodBody = (name: string): string => {
    const start = source.indexOf(`func ${name}(`);
    expect(start).toBeGreaterThanOrEqual(0);
    const end = source.indexOf('@objc(', start);
    expect(end).toBeGreaterThan(start);
    return source.slice(start, end);
};

const checkExternalMintQuoteBody = () => methodBody('checkExternalMintQuote');

// Runs one GET and prints the status, or the error, as JSON. "fixed" uses
// the module's helper, "shared" uses URLSession.shared as master did.
const PROBE = String.raw`
import Foundation

@main
struct Probe {
    static func main() async {
        let mode = CommandLine.arguments[1]
        let url = URL(string: CommandLine.arguments[2])!
        do {
            let (_, response) = mode == "shared"
                ? try await URLSession.shared.data(from: url)
                : try await CashuExternalQuoteFetch.data(from: url)
            let status = (response as? HTTPURLResponse)?.statusCode ?? -1
            print("{\"status\":\(status)}")
        } catch {
            print("{\"error\":\"\(error.localizedDescription)\"}")
        }
    }
}
`;

describe('iOS checkExternalMintQuote redirects', () => {
    it('fetches the quote through the helper that refuses redirects', () => {
        const body = checkExternalMintQuoteBody();
        expect(body).toContain('CashuExternalQuoteFetch.data(from: quoteUrl)');
        expect(body).not.toContain('URLSession.shared');
    });

    // Mint Discovery calls fetchMintInfo for mints from public Nostr
    // recommendations, checked only as URLs
    it('fetches mint info through the same helper', () => {
        const body = methodBody('fetchMintInfo');
        expect(body).toContain(
            'CashuExternalQuoteFetch.data(from: requestUrl)'
        );
        expect(body).not.toContain('URLSession.shared');
        expect(body).toMatch(
            /guard \(200\.\.\.299\)\.contains\(httpResponse\.statusCode\) else \{\s*reject\("HTTP_ERROR"/
        );
    });

    it('builds the helper session with a delegate that refuses every redirect', () => {
        const block = extractFetchHelper();
        expect(block).toMatch(
            /willPerformHTTPRedirection[\s\S]*?\{\s*completionHandler\(nil\)\s*\}/
        );
        expect(block).toMatch(
            /static let session = URLSession\([\s\S]*?delegate: CashuNoRedirectSessionDelegate\(\)/
        );
    });

    (hasSwiftc ? describe : describe.skip)('compiled', () => {
        let dir: string;
        let binary: string;
        let internal: http.Server;
        let mint: http.Server;
        let internalHits: string[];
        let mintUrl: string;

        const listen = (server: http.Server): Promise<number> =>
            new Promise((resolve) =>
                server.listen(0, '127.0.0.1', () =>
                    resolve((server.address() as AddressInfo).port)
                )
            );

        const run = async (mode: 'fixed' | 'shared') => {
            const { stdout } = await execFileAsync(
                binary,
                [mode, `${mintUrl}/v1/mint/quote/bolt11/q1`],
                { timeout: 30000 }
            );
            return JSON.parse(stdout.trim());
        };

        beforeAll(async () => {
            dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cashu-redirect-'));
            const helper = path.join(dir, 'Helper.swift');
            const probe = path.join(dir, 'Probe.swift');
            fs.writeFileSync(
                helper,
                `import Foundation\n${extractFetchHelper()}`
            );
            fs.writeFileSync(probe, PROBE);
            binary = path.join(dir, 'probe');
            await execFileAsync(
                'xcrun',
                ['swiftc', '-parse-as-library', '-o', binary, helper, probe],
                { timeout: 180000 }
            );

            internalHits = [];
            internal = http.createServer((req, res) => {
                internalHits.push(req.url ?? '');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end('{"quote":"q1","state":"PAID"}');
            });
            const internalPort = await listen(internal);

            mint = http.createServer((_req, res) => {
                res.writeHead(302, {
                    Location: `http://127.0.0.1:${internalPort}/admin/action`
                });
                res.end();
            });
            mintUrl = `http://127.0.0.1:${await listen(mint)}`;
        }, 240000);

        afterAll(() => {
            internal?.close();
            mint?.close();
            if (dir) fs.rmSync(dir, { recursive: true, force: true });
        });

        beforeEach(() => {
            internalHits.length = 0;
        });

        // Control: shows the servers redirect and the probe would see it
        it('URLSession.shared follows the 302 to the internal server', async () => {
            expect(await run('shared')).toEqual({ status: 200 });
            expect(internalHits).toEqual(['/admin/action']);
        }, 60000);

        it('returns the 302 without contacting the internal server', async () => {
            expect(await run('fixed')).toEqual({ status: 302 });
            expect(internalHits).toEqual([]);
        }, 60000);
    });
});
