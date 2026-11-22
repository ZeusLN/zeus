import { execFile, execFileSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import https from 'https';
import net from 'net';
import os from 'os';
import path from 'path';
import { promisify } from 'util';
import zlib from 'zlib';

// fetchMintInfo and checkExternalMintQuote read a mint's HTTP response
// themselves. A mint must not be able to make the app hold more than a
// bounded amount of memory while they do (ZeusLN/zeus#5690).
//
// URLSession cannot give that bound: it decompresses a response inside
// CFNetwork before the app sees any of it, so a few hundred bytes of
// brotli arrive as hundreds of MB. CashuMintHTTP.swift reads the response
// from a raw connection instead and never decompresses it.
//
// The first block scans the Swift sources, so it also runs on the Linux CI
// runners. The compiled block builds CashuMintHTTP.swift with swiftc and
// runs it against local servers. It needs swiftc and the macOS SDK, so it
// is skipped on Linux.

const execFileAsync = promisify(execFile);

const HELPER = path.join(__dirname, 'CashuMintHTTP.swift');
const helperSource = fs.readFileSync(HELPER, 'utf8');
const moduleSource = fs.readFileSync(
    path.join(__dirname, 'CashuDevKitModule.swift'),
    'utf8'
);
const projectSource = fs.readFileSync(
    path.join(__dirname, '../zeus.xcodeproj/project.pbxproj'),
    'utf8'
);

const MIB = 1024 * 1024;
const MAX_RESPONSE_BYTES = MIB;
const MAX_ERROR_BODY_BYTES = 4096;
const MAX_HEADER_BYTES = 64 * 1024;

const hasSwiftc = (() => {
    if (process.platform !== 'darwin') return false;
    try {
        execFileSync('xcrun', ['--find', 'swiftc'], { stdio: 'pipe' });
        return true;
    } catch {
        return false;
    }
})();

// Body of an exported module method, up to the next exported method
const moduleMethod = (name: string): string => {
    const start = moduleSource.indexOf(`func ${name}(`);
    expect(start).toBeGreaterThanOrEqual(0);
    const end = moduleSource.indexOf('@objc(', start);
    expect(end).toBeGreaterThan(start);
    return moduleSource.slice(start, end);
};

describe('iOS mint HTTP fetch: sources', () => {
    it('fetchMintInfo reads the response through CashuMintHTTP', () => {
        const body = moduleMethod('fetchMintInfo');
        expect(body).toContain(
            'try await CashuMintHTTP.get(requestUrl, followRedirects: true)'
        );
        expect(body).toMatch(
            /guard response\.isSuccess, let data = response\.body else \{\s*reject\("HTTP_ERROR", "Mint returned HTTP \\\(response\.status\)", nil\)\s*return/
        );
    });

    // checkExternalMintQuote checks the mint URL's scheme and host once,
    // before the request (project-loupe/audit-zeus#20), so its fetch must
    // not follow a redirect to a destination that check never saw.
    it('checkExternalMintQuote reads the response through CashuMintHTTP without redirects', () => {
        const body = moduleMethod('checkExternalMintQuote');
        expect(body).toContain(
            'try await CashuMintHTTP.get(quoteUrl, followRedirects: false)'
        );
        expect(body).not.toContain('followRedirects: true');
        // The host filter runs before the request is built
        const filter = body.indexOf('!CashuMintHost.isDisallowed(host)');
        expect(filter).toBeGreaterThan(-1);
        expect(filter).toBeLessThan(body.indexOf('CashuMintHTTP.get('));
        expect(body).toMatch(
            /guard response\.isSuccess, let data = response\.body else \{\s*reject\("HTTP_ERROR", "Mint returned HTTP \\\(response\.status\): \\\(response\.errorText\)", nil\)\s*return/
        );
    });

    it('neither Swift file loads anything with URLSession', () => {
        // Comments name URLSession, so match uses of it
        const use = /URLSession(\.\w|\()|URLRequest\(/;
        expect(moduleSource).not.toMatch(use);
        expect(helperSource).not.toMatch(use);
    });

    it('asks the mint not to compress and sets the documented limits', () => {
        expect(helperSource).toContain('"Accept-Encoding: identity"');
        expect(helperSource).toContain(
            'static let maxResponseBytes = 1024 * 1024\n'
        );
        expect(helperSource).toContain('static let maxErrorBodyBytes = 4096\n');
    });

    it('leaves TLS verification to the system', () => {
        expect(helperSource).toContain('NWProtocolTLS.Options()');
        expect(helperSource).not.toMatch(/sec_protocol_options_/);
    });

    it('is compiled into the app target next to the module', () => {
        const sources = projectSource
            .split('isa = PBXSourcesBuildPhase;')
            .find((phase) =>
                phase
                    .slice(0, phase.indexOf('};'))
                    .includes('CashuDevKitModule.swift in Sources')
            );
        expect(sources).toBeDefined();
        expect(sources!.slice(0, sources!.indexOf('};'))).toContain(
            'CashuMintHTTP.swift in Sources'
        );
    });
});

// Runs one GET and prints the outcome as JSON. "follow" and "nofollow" use
// CashuMintHTTP; "urlsession" loads the URL the way master did. "hosts"
// prints CashuMintHost.isDisallowed for each argument.
const PROBE = String.raw`
import CryptoKit
import Foundation

func peakFootprintMB() -> Double {
    var info = task_vm_info_data_t()
    var count = mach_msg_type_number_t(
        MemoryLayout<task_vm_info_data_t>.size / MemoryLayout<integer_t>.size)
    let result = withUnsafeMutablePointer(to: &info) {
        $0.withMemoryRebound(to: integer_t.self, capacity: Int(count)) {
            task_info(mach_task_self_, task_flavor_t(TASK_VM_INFO), $0, &count)
        }
    }
    return result == KERN_SUCCESS ? Double(info.ledger_phys_footprint_peak) / 1048576 : -1
}

@main
struct Probe {
    static func main() async {
        let mode = CommandLine.arguments[1]
        if mode == "hosts" {
            var verdicts: [String: Bool] = [:]
            for host in CommandLine.arguments.dropFirst(2) {
                verdicts[host] = CashuMintHost.isDisallowed(host)
            }
            let json = try! JSONSerialization.data(withJSONObject: verdicts)
            print(String(data: json, encoding: .utf8)!)
            return
        }
        let url = URL(string: CommandLine.arguments[2])!
        let timeout = Double(CommandLine.arguments[3])!
        var out: [String: Any] = [:]
        do {
            if mode == "urlsession" {
                let (data, _) = try await URLSession.shared.data(from: url)
                out["bodyBytes"] = data.count
            } else {
                let response = try await CashuMintHTTP.get(
                    url, followRedirects: mode == "follow", timeout: timeout)
                out["status"] = response.status
                if response.isSuccess, let body = response.body {
                    out["bodyBytes"] = body.count
                    out["sha256"] = SHA256.hash(data: body)
                        .map { String(format: "%02x", $0) }.joined()
                } else {
                    out["errorText"] = response.errorText
                }
            }
        } catch {
            out["error"] = error.localizedDescription
        }
        out["peakMB"] = peakFootprintMB()
        let json = try! JSONSerialization.data(withJSONObject: out)
        print(String(data: json, encoding: .utf8)!)
    }
}
`;

interface ProbeResult {
    status?: number;
    bodyBytes?: number;
    sha256?: string;
    errorText?: string;
    error?: string;
    peakMB: number;
}

type Handler = (socket: net.Socket, request: string) => void;

// A server that hands each request to the current handler as a raw socket,
// so a test controls every byte of the response
class RawServer {
    handler: Handler = (socket) => socket.destroy();
    requests: string[] = [];
    private server = net.createServer((socket) => {
        let received = '';
        socket.on('error', () => undefined);
        socket.on('data', (chunk) => {
            if (received.includes('\r\n\r\n')) return;
            received += chunk.toString('latin1');
            if (received.includes('\r\n\r\n')) {
                this.requests.push(received);
                this.handler(socket, received);
            }
        });
    });

    listen(host = '127.0.0.1'): Promise<number> {
        return new Promise((resolve) =>
            this.server.listen(0, host, () =>
                resolve((this.server.address() as net.AddressInfo).port)
            )
        );
    }

    close() {
        this.server.close();
    }
}

const head = (statusLine: string, fields: string[] = []): string =>
    [`HTTP/1.1 ${statusLine}`, ...fields, '', ''].join('\r\n');

const sha256 = (data: Buffer | string): string =>
    crypto.createHash('sha256').update(data).digest('hex');

const toBuffer = (data: Buffer | string): Buffer =>
    typeof data === 'string' ? Buffer.from(data) : data;

const withLength = (statusLine: string, body: Buffer | string): Buffer => {
    const bytes = toBuffer(body);
    return Buffer.concat([
        Buffer.from(head(statusLine, [`Content-Length: ${bytes.length}`])),
        bytes
    ]);
};

const chunk = (data: Buffer | string): Buffer => {
    const bytes = toBuffer(data);
    return Buffer.concat([
        Buffer.from(`${bytes.length.toString(16)}\r\n`),
        bytes,
        Buffer.from('\r\n')
    ]);
};

const CHUNKED = head('200 OK', ['Transfer-Encoding: chunked']);

// Writes `total` bytes of body with backpressure, then ends the response.
// Resolves with the bytes the socket had accepted when it closed.
const stream = (socket: net.Socket, total: number): Promise<number> =>
    new Promise((resolve) => {
        const piece = Buffer.alloc(64 * 1024, 0x41);
        let left = total;
        socket.on('close', () => resolve(socket.bytesWritten));
        const pump = () => {
            while (left > 0 && !socket.destroyed) {
                const size = Math.min(left, piece.length);
                left -= size;
                if (!socket.write(piece.subarray(0, size))) {
                    socket.once('drain', pump);
                    return;
                }
            }
            if (!socket.destroyed) socket.end();
        };
        pump();
    });

// The header fields and body prefix that start a 256 MiB body in each of
// the three ways HTTP/1.1 delimits one
const HUGE = 256 * MIB;
const HUGE_FRAMES: [string, string[], string][] = [
    ['Content-Length', [`Content-Length: ${HUGE}`], ''],
    ['chunked', ['Transfer-Encoding: chunked'], `${HUGE.toString(16)}\r\n`],
    ['close-delimited', [], '']
];

const TOO_LARGE = 'Mint response too large';
const INVALID = 'Mint sent an invalid HTTP response';
const COMPRESSED = 'Mint sent a compressed response';
const TIMED_OUT = 'Mint request timed out';

(hasSwiftc ? describe : describe.skip)('iOS mint HTTP fetch: compiled', () => {
    let dir: string;
    let binary: string;
    let mint: RawServer;
    let other: RawServer;
    let mintUrl: string;
    let otherUrl: string;

    const run = async (
        mode: 'follow' | 'nofollow' | 'urlsession',
        url: string,
        timeoutSeconds = 20
    ): Promise<ProbeResult> => {
        const { stdout } = await execFileAsync(
            binary,
            [mode, url, String(timeoutSeconds)],
            { timeout: 60000 }
        );
        return JSON.parse(stdout.trim());
    };

    // GET the mint with the given raw response
    const fetchRaw = (
        response: Buffer | string,
        mode: 'follow' | 'nofollow' = 'nofollow'
    ): Promise<ProbeResult> => {
        mint.handler = (socket) => socket.end(response);
        return run(mode, `${mintUrl}/v1/info`);
    };

    beforeAll(async () => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cashu-mint-http-'));
        const probe = path.join(dir, 'Probe.swift');
        fs.writeFileSync(probe, PROBE);
        binary = path.join(dir, 'probe');
        await execFileAsync(
            'xcrun',
            ['swiftc', '-O', '-parse-as-library', '-o', binary, HELPER, probe],
            { timeout: 240000 }
        );

        mint = new RawServer();
        other = new RawServer();
        mintUrl = `http://127.0.0.1:${await mint.listen()}`;
        otherUrl = `http://127.0.0.1:${await other.listen()}`;
    }, 300000);

    afterAll(() => {
        mint?.close();
        other?.close();
        if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });

    beforeEach(() => {
        mint.requests.length = 0;
        other.requests.length = 0;
        mint.handler = (socket) => socket.destroy();
        other.handler = (socket) => socket.destroy();
    });

    describe('request', () => {
        it('sends an HTTP/1.1 GET that asks for an uncompressed body and a closed connection', async () => {
            mint.handler = (socket) => socket.end(withLength('200 OK', '{}'));
            await run(
                'nofollow',
                `${mintUrl}/v1/mint/quote/bolt11/a%2Fb%20c?x=1`
            );
            const port = new URL(mintUrl).port;
            expect(mint.requests).toEqual([
                [
                    'GET /v1/mint/quote/bolt11/a%2Fb%20c?x=1 HTTP/1.1',
                    `Host: 127.0.0.1:${port}`,
                    'User-Agent: zeus',
                    'Accept: application/json',
                    'Accept-Encoding: identity',
                    'Connection: close',
                    '',
                    ''
                ].join('\r\n')
            ]);
        }, 60000);

        it('requests "/" for a URL with no path', async () => {
            mint.handler = (socket) => socket.end(withLength('200 OK', '{}'));
            await run('nofollow', mintUrl);
            expect(mint.requests[0].split('\r\n')[0]).toBe('GET / HTTP/1.1');
        }, 60000);

        it('puts an IPv6 host back in brackets', async () => {
            const v6 = new RawServer();
            const port = await v6.listen('::1');
            v6.handler = (socket) => socket.end(withLength('200 OK', '{}'));
            try {
                const result = await run('nofollow', `http://[::1]:${port}/x`);
                expect(result.status).toBe(200);
                expect(v6.requests[0]).toContain(`\r\nHost: [::1]:${port}\r\n`);
            } finally {
                v6.close();
            }
        }, 60000);

        it.each([
            'ftp://127.0.0.1/v1/info',
            'http:///v1/info',
            'http://:8080/v1/info',
            // URL.host decodes this to a host with CR LF in it
            'http://ex%0d%0aample.com/v1/info',
            'http://127.0.0.1:70000/v1/info',
            'http://127.0.0.1:0/v1/info'
        ])(
            'rejects %s without connecting',
            async (url) => {
                expect((await run('nofollow', url)).error).toBe(
                    'Unsupported mint URL'
                );
            },
            60000
        );
    });

    describe('body framing', () => {
        const body = JSON.stringify({ name: 'mint', pubkey: '02ab' });

        it('reads a Content-Length body', async () => {
            const result = await fetchRaw(withLength('200 OK', body));
            expect(result).toMatchObject({
                status: 200,
                bodyBytes: body.length,
                sha256: sha256(body)
            });
        }, 60000);

        it('stops at Content-Length when the mint sends more', async () => {
            const result = await fetchRaw(
                head('200 OK', ['content-length: 4']) + 'abcdEXTRA'
            );
            expect(result).toMatchObject({
                bodyBytes: 4,
                sha256: sha256('abcd')
            });
        }, 60000);

        it('reads a body that ends when the mint closes the connection', async () => {
            const result = await fetchRaw(head('200 OK') + body);
            expect(result).toMatchObject({
                status: 200,
                sha256: sha256(body)
            });
        }, 60000);

        it('reads a body whose last bytes arrive together with the close', async () => {
            mint.handler = (socket) => {
                socket.setNoDelay(true);
                socket.write(head('200 OK') + 'first,');
                setTimeout(() => socket.end('last'), 200);
            };
            const result = await run('nofollow', `${mintUrl}/v1/info`);
            expect(result).toMatchObject({
                status: 200,
                sha256: sha256('first,last')
            });
        }, 60000);

        it('reads a chunked body with chunk extensions, padding and trailers', async () => {
            const result = await fetchRaw(
                Buffer.concat([
                    Buffer.from(head('200 OK', ['Transfer-Encoding: Chunked'])),
                    Buffer.from('5;name=value\r\nhello\r\n'),
                    Buffer.from('B  \r\n, chunked w\r\n'),
                    chunk('orld'),
                    Buffer.from('0\r\nTrailer: value\r\n\r\n')
                ])
            );
            expect(result).toMatchObject({
                status: 200,
                sha256: sha256('hello, chunked world')
            });
        }, 60000);

        it('reads a chunked body when the mint also sends a Content-Length', async () => {
            const result = await fetchRaw(
                head('200 OK', [
                    'Content-Length: 3',
                    'Transfer-Encoding: chunked'
                ]) + '5\r\nhello\r\n0\r\n\r\n'
            );
            expect(result).toMatchObject({
                status: 200,
                sha256: sha256('hello')
            });
        }, 60000);

        it('reassembles a response that arrives a few bytes at a time', async () => {
            const wire = Buffer.concat([
                Buffer.from(CHUNKED),
                chunk('{"name":'),
                chunk('"mint"}'),
                Buffer.from('0\r\n\r\n')
            ]);
            mint.handler = async (socket) => {
                socket.setNoDelay(true);
                for (let at = 0; at < wire.length; at += 3) {
                    socket.write(wire.subarray(at, at + 3));
                    await new Promise((resolve) => setTimeout(resolve, 2));
                }
                socket.end();
            };
            const result = await run('nofollow', `${mintUrl}/v1/info`);
            expect(result).toMatchObject({
                status: 200,
                sha256: sha256('{"name":"mint"}')
            });
        }, 60000);

        it('reads a full-size body sent as one-byte chunks', async () => {
            const one = Buffer.from('1\r\nA\r\n');
            const wire = Buffer.alloc(one.length * MAX_RESPONSE_BYTES);
            for (let at = 0; at < wire.length; at += one.length) {
                one.copy(wire, at);
            }
            const started = Date.now();
            const result = await fetchRaw(
                Buffer.concat([
                    Buffer.from(CHUNKED),
                    wire,
                    Buffer.from('0\r\n\r\n')
                ])
            );
            expect(result).toMatchObject({
                status: 200,
                bodyBytes: MAX_RESPONSE_BYTES
            });
            expect(Date.now() - started).toBeLessThan(15000);
        }, 60000);

        it.each([
            ['HTTP/1.0 200 OK', 'an HTTP/1.0 response'],
            ['HTTP/1.1 200', 'a status line with no reason phrase']
        ])(
            'accepts "%s", %s',
            async (statusLine) => {
                const result = await fetchRaw(
                    `${statusLine}\r\nContent-Length: 2\r\n\r\n{}`
                );
                expect(result).toMatchObject({ status: 200, bodyBytes: 2 });
            },
            60000
        );

        it.each([
            'SSH-2.0-OpenSSH_9.9',
            'HTTP/2 200 OK',
            'HTTP/1.1',
            'HTTP/1.1 OK',
            'HTTP/1.1 20 OK',
            'HTTP/1.1 0200 OK',
            'HTTP/1.1 099 OK',
            'HTTP/1.1 600 OK'
        ])(
            'rejects the status line "%s"',
            async (statusLine) => {
                const result = await fetchRaw(
                    `${statusLine}\r\nContent-Length: 2\r\n\r\n{}`
                );
                expect(result.error).toBe(INVALID);
            },
            60000
        );

        it.each([
            [
                'a header line with no colon',
                head('200 OK', ['Content-Length: 2', 'no colon here']) + '{}'
            ],
            [
                'a repeated Content-Length',
                head('200 OK', ['Content-Length: 2', 'Content-Length: 2']) +
                    '{}'
            ],
            [
                'a Content-Length that is not a number',
                head('200 OK', ['Content-Length: abc']) + 'abc'
            ],
            [
                'a negative Content-Length',
                head('200 OK', ['Content-Length: -1']) + 'abc'
            ],
            [
                'a body shorter than its Content-Length',
                head('200 OK', ['Content-Length: 10']) + 'abc'
            ],
            [
                'a chunk size that is not hex',
                CHUNKED + 'xyz\r\nabc\r\n0\r\n\r\n'
            ],
            ['a negative chunk size', CHUNKED + '-3\r\nabc\r\n0\r\n\r\n'],
            [
                'a chunk size that overflows',
                CHUNKED + 'ffffffffffffffffff\r\nabc\r\n0\r\n\r\n'
            ],
            ['a chunk with no CRLF after its data', CHUNKED + '3\r\nabcdef'],
            [
                'chunk data followed by a chunk size instead of CRLF',
                CHUNKED + '3\r\nabc0\r\n\r\n'
            ],
            [
                'bytes between chunk data and its CRLF',
                CHUNKED + '3\r\nabcJUNK\r\n0\r\n\r\n'
            ],
            ['a chunked body cut off mid-chunk', CHUNKED + 'a\r\nabc'],
            ['a chunked body with no last chunk', CHUNKED + '3\r\nabc\r\n'],
            [
                'a connection closed before the header ends',
                'HTTP/1.1 200 OK\r\n'
            ]
        ])(
            'rejects %s',
            async (_name, response) => {
                expect((await fetchRaw(response)).error).toBe(INVALID);
            },
            60000
        );
    });

    describe('response size', () => {
        const exact = Buffer.alloc(MAX_RESPONSE_BYTES, 0x42);
        const over = Buffer.alloc(MAX_RESPONSE_BYTES + 1, 0x42);

        it.each([
            ['Content-Length', (b: Buffer) => withLength('200 OK', b)],
            [
                'chunked',
                (b: Buffer) =>
                    Buffer.concat([
                        Buffer.from(CHUNKED),
                        chunk(b.subarray(0, 1000)),
                        chunk(b.subarray(1000)),
                        Buffer.from('0\r\n\r\n')
                    ])
            ],
            [
                'close-delimited',
                (b: Buffer) => Buffer.concat([Buffer.from(head('200 OK')), b])
            ]
        ])(
            'accepts exactly 1 MiB and rejects one byte more (%s)',
            async (_name, frame) => {
                expect(await fetchRaw(frame(exact))).toMatchObject({
                    status: 200,
                    bodyBytes: MAX_RESPONSE_BYTES,
                    sha256: sha256(exact)
                });
                expect((await fetchRaw(frame(over))).error).toBe(TOO_LARGE);
            },
            60000
        );

        it('rejects a chunk that declares more than the limit', async () => {
            mint.handler = (socket) => {
                socket.write(CHUNKED + '7fffffffffffffff\r\n');
                stream(socket, 64 * MIB);
            };
            const result = await run('nofollow', `${mintUrl}/v1/info`);
            expect(result.error).toBe(TOO_LARGE);
            expect(result.peakMB).toBeLessThan(32);
        }, 60000);

        it.each(HUGE_FRAMES)(
            'stops reading a 256 MiB body and closes the connection (%s)',
            async (_name, fields, prefix) => {
                let written = Promise.resolve(0);
                mint.handler = (socket) => {
                    socket.write(head('200 OK', fields) + prefix);
                    written = stream(socket, HUGE);
                };
                const result = await run('nofollow', `${mintUrl}/v1/info`);
                expect(result.error).toBe(TOO_LARGE);
                expect(result.peakMB).toBeLessThan(32);
                // The mint only got rid of what the socket buffers took
                expect(await written).toBeLessThan(32 * MIB);
            },
            60000
        );

        it('accepts a 64 KiB header block and rejects one byte more', async () => {
            // A response whose status line and header fields, with the
            // empty line that ends them, are `size` bytes
            const sized = (size: number) => {
                const start = head('200 OK', ['Content-Length: 2', 'X-Fill: ']);
                const fill = 'a'.repeat(size - start.length);
                return `${start.slice(0, -4)}${fill}\r\n\r\n{}`;
            };
            expect(await fetchRaw(sized(MAX_HEADER_BYTES))).toMatchObject({
                status: 200,
                bodyBytes: 2
            });
            expect((await fetchRaw(sized(MAX_HEADER_BYTES + 1))).error).toBe(
                INVALID
            );
        }, 60000);

        it('rejects a header block that never ends without waiting for the timeout', async () => {
            mint.handler = (socket) => {
                socket.write('HTTP/1.1 200 OK\r\nX-Fill: ');
                stream(socket, 64 * MIB);
            };
            const result = await run('nofollow', `${mintUrl}/v1/info`);
            expect(result.error).toBe(INVALID);
            expect(result.peakMB).toBeLessThan(32);
        }, 60000);

        it('rejects a chunk-size line that never ends without waiting for the timeout', async () => {
            mint.handler = (socket) => {
                socket.write(CHUNKED + '1;extension=');
                stream(socket, 64 * MIB);
            };
            const result = await run('nofollow', `${mintUrl}/v1/info`);
            expect(result.error).toBe(INVALID);
            expect(result.peakMB).toBeLessThan(32);
        }, 60000);

        it('accepts a 1 KiB chunk-size line and rejects one byte more', async () => {
            // "2;" + extension + CRLF
            const sized = (size: number) =>
                `${CHUNKED}2;${'e'.repeat(size - 4)}\r\n{}\r\n0\r\n\r\n`;
            expect(await fetchRaw(sized(1024))).toMatchObject({
                status: 200,
                bodyBytes: 2
            });
            expect((await fetchRaw(sized(1025))).error).toBe(INVALID);
        }, 60000);
    });

    describe('compressed responses', () => {
        const plain = Buffer.alloc(64 * MIB, 0x41);
        const bombs: [string, Buffer][] = [
            ['gzip', zlib.gzipSync(plain)],
            ['deflate', zlib.deflateSync(plain)],
            [
                'br',
                zlib.brotliCompressSync(plain, {
                    params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 }
                })
            ]
        ];
        const encoded = (statusLine: string, coding: string, body: Buffer) =>
            Buffer.concat([
                Buffer.from(
                    head(statusLine, [
                        `Content-Encoding: ${coding}`,
                        `Content-Length: ${body.length}`
                    ])
                ),
                body
            ]);

        // Control: the same response through URLSession is inflated in full
        it('URLSession inflates a brotli response of a few hundred bytes to 64 MiB', async () => {
            const [, body] = bombs[2];
            expect(body.length).toBeLessThan(1024);
            mint.handler = (socket) =>
                socket.end(encoded('200 OK', 'br', body));
            const result = await run('urlsession', `${mintUrl}/v1/info`);
            expect(result.bodyBytes).toBe(plain.length);
            expect(result.peakMB).toBeGreaterThan(64);
        }, 60000);

        it.each(bombs)(
            'rejects a %s response without inflating it',
            async (coding, body) => {
                const result = await fetchRaw(encoded('200 OK', coding, body));
                expect(result.error).toBe(COMPRESSED);
                expect(result.peakMB).toBeLessThan(32);
            },
            60000
        );

        it.each(['GZIP', 'zstd', 'gzip, identity', ''])(
            'rejects Content-Encoding "%s"',
            async (coding) => {
                const result = await fetchRaw(
                    encoded('200 OK', coding, Buffer.from('{}'))
                );
                expect(result.error).toBe(COMPRESSED);
            },
            60000
        );

        it('accepts Content-Encoding: identity', async () => {
            const result = await fetchRaw(
                encoded('200 OK', ' Identity ', Buffer.from('{}'))
            );
            expect(result).toMatchObject({ status: 200, bodyBytes: 2 });
        }, 60000);

        it.each(['gzip, chunked', 'gzip', 'identity'])(
            'rejects Transfer-Encoding "%s"',
            async (coding) => {
                const result = await fetchRaw(
                    head('200 OK', [`Transfer-Encoding: ${coding}`]) +
                        '2\r\n{}\r\n0\r\n\r\n'
                );
                expect(result.error).toBe(COMPRESSED);
            },
            60000
        );

        it('keeps the status of a compressed error response', async () => {
            const result = await fetchRaw(
                encoded('500 Internal Server Error', 'br', bombs[2][1])
            );
            expect(result).toMatchObject({
                status: 500,
                errorText: 'Unknown error'
            });
            expect(result.peakMB).toBeLessThan(32);
        }, 60000);
    });

    describe('error responses', () => {
        it('returns the body of a short error response', async () => {
            const body = '{"detail":"Unknown quote","code":50000}';
            const result = await fetchRaw(withLength('400 Bad Request', body));
            expect(result).toMatchObject({ status: 400, errorText: body });
        }, 60000);

        it('returns an empty body as an empty string', async () => {
            const result = await fetchRaw(withLength('404 Not Found', ''));
            expect(result).toMatchObject({ status: 404, errorText: '' });
        }, 60000);

        it.each([
            ['Content-Length', (b: string) => withLength('500 Oops', b)],
            [
                'chunked',
                (b: string) =>
                    Buffer.concat([
                        Buffer.from(
                            head('500 Oops', ['Transfer-Encoding: chunked'])
                        ),
                        chunk(b.slice(0, 100)),
                        chunk(b.slice(100)),
                        Buffer.from('0\r\n\r\n')
                    ])
            ],
            ['close-delimited', (b: string) => head('500 Oops') + b]
        ])(
            'keeps 4096 bytes of an error body and marks a longer one (%s)',
            async (_name, frame) => {
                const exact = 'e'.repeat(MAX_ERROR_BODY_BYTES);
                expect(await fetchRaw(frame(exact))).toMatchObject({
                    status: 500,
                    errorText: exact
                });
                expect(await fetchRaw(frame(exact + 'f'))).toMatchObject({
                    status: 500,
                    errorText: `${exact}... (truncated)`
                });
            },
            60000
        );

        it.each(HUGE_FRAMES)(
            'does not read the rest of a 256 MiB error body (%s)',
            async (_name, fields, prefix) => {
                let written = Promise.resolve(0);
                mint.handler = (socket) => {
                    socket.write(head('500 Oops', fields) + prefix);
                    written = stream(socket, HUGE);
                };
                const result = await run('nofollow', `${mintUrl}/v1/info`);
                expect(result.status).toBe(500);
                expect(result.errorText).toBe(
                    `${'A'.repeat(MAX_ERROR_BODY_BYTES)}... (truncated)`
                );
                expect(result.peakMB).toBeLessThan(32);
                expect(await written).toBeLessThan(32 * MIB);
            },
            60000
        );

        it('decodes an error body cut inside a UTF-8 sequence', async () => {
            const body = 'e'.repeat(MAX_ERROR_BODY_BYTES - 1) + 'é'.repeat(10);
            const result = await fetchRaw(withLength('500 Oops', body));
            expect(result.errorText).toBe(
                `${'e'.repeat(MAX_ERROR_BODY_BYTES - 1)}�... (truncated)`
            );
        }, 60000);

        it('keeps the status when the error body cannot be read', async () => {
            const result = await fetchRaw(
                head('502 Bad Gateway', ['Content-Length: 100']) + 'partial'
            );
            expect(result).toMatchObject({
                status: 502,
                errorText: 'Unknown error'
            });
        }, 60000);
    });

    describe('redirects', () => {
        const redirect = (status: number, location: string) =>
            head(`${status} Redirect`, [
                `Location: ${location}`,
                'Content-Length: 0'
            ]);

        beforeEach(() => {
            other.handler = (socket) =>
                socket.end(withLength('200 OK', '{"quote":"q1"}'));
        });

        it('returns the 302 without contacting the redirect target', async () => {
            const result = await fetchRaw(
                redirect(302, `${otherUrl}/admin/action`)
            );
            expect(result).toMatchObject({ status: 302, errorText: '' });
            expect(other.requests).toEqual([]);
        }, 60000);

        it.each([301, 302, 303, 307, 308])(
            'follows a %i when asked to',
            async (status) => {
                const result = await fetchRaw(
                    redirect(status, `${otherUrl}/v1/info`),
                    'follow'
                );
                expect(result).toMatchObject({
                    status: 200,
                    sha256: sha256('{"quote":"q1"}')
                });
                expect(other.requests[0].split('\r\n')[0]).toBe(
                    'GET /v1/info HTTP/1.1'
                );
            },
            60000
        );

        it.each([300, 304, 305])(
            'returns a %i even when following redirects',
            async (status) => {
                const result = await fetchRaw(
                    redirect(status, `${otherUrl}/v1/info`),
                    'follow'
                );
                expect(result.status).toBe(status);
                expect(other.requests).toEqual([]);
            },
            60000
        );

        it('resolves a relative Location against the request URL', async () => {
            mint.handler = (socket, request) =>
                socket.end(
                    request.startsWith('GET /v1/info ')
                        ? redirect(301, '../v2/info?x=1')
                        : withLength('200 OK', '{}')
                );
            const result = await run('follow', `${mintUrl}/v1/info`);
            expect(result.status).toBe(200);
            expect(mint.requests.map((r) => r.split('\r\n')[0])).toEqual([
                'GET /v1/info HTTP/1.1',
                'GET /v2/info?x=1 HTTP/1.1'
            ]);
        }, 60000);

        it('returns a redirect that has no Location', async () => {
            const result = await fetchRaw(
                head('302 Found', ['Content-Length: 0']),
                'follow'
            );
            expect(result.status).toBe(302);
        }, 60000);

        it('follows five redirects and gives up on the sixth', async () => {
            const hops =
                (count: number): Handler =>
                (socket, request) => {
                    const hop = Number(/GET \/hop\/(\d+)/.exec(request)![1]);
                    socket.end(
                        hop < count
                            ? redirect(302, `/hop/${hop + 1}`)
                            : withLength('200 OK', '{}')
                    );
                };
            mint.handler = hops(5);
            expect((await run('follow', `${mintUrl}/hop/0`)).status).toBe(200);
            expect(mint.requests).toHaveLength(6);

            mint.requests.length = 0;
            mint.handler = hops(6);
            expect((await run('follow', `${mintUrl}/hop/0`)).error).toBe(
                'Mint redirected too many times'
            );
            expect(mint.requests).toHaveLength(6);
        }, 60000);

        it('does not follow a redirect to another scheme', async () => {
            const result = await fetchRaw(
                redirect(302, 'ftp://127.0.0.1/v1/info'),
                'follow'
            );
            expect(result.error).toBe('Unsupported mint URL');
        }, 60000);
    });

    // checkExternalMintQuote gets its mint URL from a ZEUS Pay socket
    // event and refuses internal hosts before it sends anything
    describe('host filter', () => {
        const verdicts = async (hosts: string[]) => {
            const { stdout } = await execFileAsync(binary, ['hosts', ...hosts]);
            return JSON.parse(stdout.trim()) as Record<string, boolean>;
        };

        it('refuses loopback, private, link-local and other internal hosts in any spelling', async () => {
            const hosts = [
                '',
                '.',
                'localhost',
                'LOCALHOST',
                'localhost.',
                'mint.localhost',
                // 0/8, 10/8, 100.64/10, 127/8
                '0.0.0.0',
                '0.255.255.255',
                '10.0.0.0',
                '10.255.255.255',
                '100.64.0.0',
                '100.127.255.255',
                '127.0.0.0',
                '127.0.0.1',
                '127.0.0.1.',
                '127.255.255.255',
                // The spellings inet_aton accepts for 127.0.0.1
                '2130706433',
                '0x7f.1',
                '0177.0.0.1',
                '127.1',
                // 169.254/16, 172.16/12, 192.0.0/24, 192.168/16, 198.18/15
                '169.254.0.0',
                '169.254.169.254',
                '172.16.0.0',
                '172.31.255.255',
                '192.0.0.0',
                '192.0.0.255',
                '192.168.0.0',
                '192.168.255.255',
                '198.18.0.0',
                '198.19.255.255',
                // 224/4, 240/4
                '224.0.0.0',
                '239.255.255.255',
                '240.0.0.0',
                '255.255.255.255',
                // IPv6 loopback and unspecified
                '::1',
                '[::1]',
                '0:0:0:0:0:0:0:1',
                '::',
                // IPv4-mapped
                '::ffff:127.0.0.1',
                '::ffff:7f00:1',
                '::ffff:192.168.1.1',
                // fe80::/10, fec0::/10, fc00::/7
                'fe80::1',
                'febf::1',
                'fec0::1',
                'feff::1',
                'fc00::1',
                'fdff::1',
                // Has a colon and is not an IPv6 literal
                'mint.example.com:443',
                'fe80::1%en0'
            ];
            const result = await verdicts(hosts);
            expect(hosts.filter((host) => !result[host])).toEqual([]);
        }, 60000);

        it('allows public hosts, including the addresses next to each refused range', async () => {
            const hosts = [
                'mint.example.com',
                'mint.example.com.',
                'localhost.example.com',
                'notlocalhost',
                '1.0.0.0',
                '9.255.255.255',
                '11.0.0.0',
                '100.63.255.255',
                '100.128.0.0',
                '126.255.255.255',
                '128.0.0.0',
                '169.253.255.255',
                '169.255.0.0',
                '172.15.255.255',
                '172.32.0.0',
                '191.255.255.255',
                '192.0.1.0',
                '192.167.255.255',
                '192.169.0.0',
                '198.17.255.255',
                '198.20.0.0',
                '223.255.255.255',
                '8.8.8.8.',
                '::2',
                '::1:0',
                '::100',
                '::101',
                '::fffe:127.0.0.1',
                '::ffff:8.8.8.8',
                '2001:4860:4860::8888',
                '[2001:4860:4860::8888]',
                'fbff::1',
                'fe00::1',
                'fe7f::1'
            ];
            const result = await verdicts(hosts);
            expect(hosts.filter((host) => result[host])).toEqual([]);
        }, 60000);
    });

    describe('connection', () => {
        it('reports a refused connection', async () => {
            const closed = new RawServer();
            const port = await closed.listen();
            closed.close();
            const result = await run(
                'nofollow',
                `http://127.0.0.1:${port}/x`,
                5
            );
            expect(result.error).toBe(
                'Connection to the mint failed: Connection refused'
            );
        }, 60000);

        it('times out when the mint accepts the connection and never answers', async () => {
            mint.handler = () => undefined;
            const started = Date.now();
            const result = await run('nofollow', `${mintUrl}/v1/info`, 1);
            expect(result.error).toBe(TIMED_OUT);
            expect(Date.now() - started).toBeLessThan(10000);
        }, 60000);

        it('times out a TLS handshake that never completes', async () => {
            // The mint server does not speak TLS and never answers the hello
            const started = Date.now();
            const result = await run(
                'nofollow',
                `${mintUrl.replace('http:', 'https:')}/v1/info`,
                1
            );
            expect(result.error).toBe(TIMED_OUT);
            expect(Date.now() - started).toBeLessThan(10000);
        }, 60000);

        // URLSession's request timeout restarts whenever data arrives
        it('times out a body that keeps arriving slowly', async () => {
            mint.handler = (socket) => {
                socket.setNoDelay(true);
                socket.write(head('200 OK', ['Content-Length: 100000']));
                const timer = setInterval(() => socket.write('a'), 50);
                socket.on('close', () => clearInterval(timer));
            };
            const started = Date.now();
            const result = await run('nofollow', `${mintUrl}/v1/info`, 1);
            expect(result.error).toBe(TIMED_OUT);
            expect(Date.now() - started).toBeLessThan(10000);
        }, 60000);

        it('refuses a self-signed certificate before sending the request', async () => {
            execFileSync(
                'openssl',
                [
                    'req',
                    '-x509',
                    '-newkey',
                    'rsa:2048',
                    '-nodes',
                    '-days',
                    '1',
                    '-subj',
                    '/CN=127.0.0.1',
                    '-keyout',
                    path.join(dir, 'key.pem'),
                    '-out',
                    path.join(dir, 'cert.pem')
                ],
                { stdio: 'pipe' }
            );
            const requests: string[] = [];
            const server = https.createServer(
                {
                    key: fs.readFileSync(path.join(dir, 'key.pem')),
                    cert: fs.readFileSync(path.join(dir, 'cert.pem'))
                },
                (req, res) => {
                    requests.push(req.url ?? '');
                    res.end('{}');
                }
            );
            server.on('tlsClientError', () => undefined);
            const port = await new Promise<number>((resolve) =>
                server.listen(0, '127.0.0.1', () =>
                    resolve((server.address() as net.AddressInfo).port)
                )
            );
            try {
                const result = await run(
                    'nofollow',
                    `https://127.0.0.1:${port}/v1/info`
                );
                expect(result.error).toBe(
                    'Connection to the mint failed: secure connection failed'
                );
                expect(requests).toEqual([]);
            } finally {
                server.close();
            }
        }, 60000);
    });
});
