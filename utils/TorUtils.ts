import { Tor } from 'react-native-nitro-tor';
import type { HttpMethod } from 'react-native-nitro-tor';
import RNFS from 'react-native-fs';
import {
    grpcErrorCode,
    markJsonRpcCode,
    markRequestNotSent,
    markRestErrorResponse
} from './PaymentLookupUtils';
import { restErrorMessage } from './ErrorUtils';

const SOCKS_PORT = 9056;
// nitro-tor 1.x resolves start() only once bootstrap reaches 100%. A
// cold bootstrap took about 52 s on an Android 15 emulator, so leave
// room for slower networks
const START_TIMEOUT_MS = 90000;
const REQUEST_TIMEOUT_MS = 60000;
const TOR_DATA_PATH = `${RNFS.DocumentDirectoryPath}/tor_data`;

enum RequestMethod {
    GET = 'get',
    POST = 'post',
    DELETE = 'delete'
}

const HTTP_METHODS: { [key in RequestMethod]: HttpMethod } = {
    [RequestMethod.GET]: 'GET',
    [RequestMethod.POST]: 'POST',
    [RequestMethod.DELETE]: 'DELETE'
};

// nitro-tor 1.x takes headers as an object of string values. Callers
// pass either an object or, as with 0.6.x, a JSON string.
const normalizeHeaders = (headers?: any): Record<string, string> => {
    if (!headers) return {};
    const parsed = typeof headers === 'string' ? JSON.parse(headers) : headers;
    const result: Record<string, string> = {};
    Object.keys(parsed).forEach((key) => {
        const value = parsed[key];
        if (value !== undefined && value !== null) {
            result[key] = String(value);
        }
    });
    return result;
};

// Whether a URL targets a Tor v3 hidden service over HTTPS. For such
// endpoints the .onion address itself authenticates the peer at the
// Tor protocol layer, so TLS hostname/CA validation against the
// upstream daemon's (typically self-signed) cert is redundant and
// can be safely bypassed.
//
// Returns false for clearnet hosts routed via Tor — TLS validation
// there still matters because exit nodes can MITM. Returns false on
// any URL that won't parse, so the caller defaults to strict TLS.
const isOnionHttpsUrl = (url: string): boolean => {
    try {
        const u = new URL(url);
        return (
            u.protocol === 'https:' &&
            u.hostname.toLowerCase().endsWith('.onion')
        );
    } catch {
        return false;
    }
};

// Directories Tor state can be in: the current daemon's data directory, and
// the one react-native-tor (replaced in a58b4cefc) created under the app's
// cache directory on Android and its temporary directory on iOS
const torDataDirectories = (): string[] =>
    Array.from(
        new Set([
            TOR_DATA_PATH,
            `${RNFS.CachesDirectoryPath}/sifir_sdk`,
            `${RNFS.TemporaryDirectoryPath}/sifir_sdk`
        ])
    );

// How long clearTorData waits for a start in progress and for the daemon to
// stop before it deletes the data directories anyway
export const TOR_STOP_TIMEOUT_MS = 5000;

// Deletes each Tor data directory that exists. A directory that cannot be
// deleted is logged and does not keep the others from being deleted.
const deleteTorDirs = async (): Promise<void> => {
    for (const dir of torDataDirectories()) {
        try {
            if (await RNFS.exists(dir)) {
                await RNFS.unlink(dir);
            }
        } catch (e) {
            console.warn(`[TorUtils] Error deleting ${dir}:`, e);
        }
    }
};

// Stops the daemon if this JS context started it, then deletes Tor's data
// directories (guard and consensus state, which show Tor was used). Each
// step is best effort, so one failure does not keep the others from running.
export const clearTorData = async (): Promise<void> => {
    const pending = startPromise;
    if (pending) {
        startPromise = null;
        // Let a start in progress finish first: a shutdown that runs before
        // the daemon is up can leave it running, writing new state after
        // the directories are gone. The wait and the shutdown are bounded so
        // that a daemon that does not respond cannot keep the directories
        // from being deleted.
        let timer: ReturnType<typeof setTimeout> | undefined;
        let timedOut = false;
        const stop = (async () => {
            await pending.catch(() => {});
            await Tor.daemon.stop();
        })();
        try {
            await Promise.race([
                stop,
                new Promise<void>((resolve) => {
                    timer = setTimeout(() => {
                        console.warn(
                            '[TorUtils] Tor did not stop in time, deleting its data anyway'
                        );
                        timedOut = true;
                        resolve();
                    }, TOR_STOP_TIMEOUT_MS);
                })
            ]);
        } catch (e) {
            console.warn('[TorUtils] Error stopping Tor:', e);
        } finally {
            clearTimeout(timer);
        }
        if (timedOut) {
            // The start or the shutdown is still running and Tor may write
            // to its data directory until it stops, so delete again once the
            // stop settles. This is not awaited: the wipe must not wait on it.
            stop.catch(() => {}).then(deleteTorDirs);
        }
    }
    await deleteTorDirs();
};

let startPromise: Promise<void> | null = null;

// Shares one start between concurrent callers. A failed start is
// cleared so the next request tries again.
const ensureTorStarted = (): Promise<void> => {
    if (!startPromise) {
        startPromise = Tor.daemon
            .start({
                dataDirectory: TOR_DATA_PATH,
                socksPort: SOCKS_PORT,
                bootstrapTimeoutMs: START_TIMEOUT_MS
            })
            .then(() => undefined)
            .catch((e) => {
                startPromise = null;
                // the request that needed Tor never went out
                throw markRequestNotSent(e);
            });
    }
    return startPromise;
};

interface TorHttpRequest {
    url: string;
    method: RequestMethod;
    data?: string;
    headers?: any;
    trustInvalidCerts?: boolean;
    timeoutMs?: number;
    // When false, 3xx responses come back as-is so the caller can vet
    // the location header before following it. Defaults to false:
    // reqwest keeps custom headers (macaroon, rune) on a cross-host
    // redirect, and the .onion certificate exception would apply to the
    // new host too, so a caller has to opt in.
    followRedirects?: boolean;
}

interface TorHttpResponse {
    statusCode: number;
    // lowercase header names, each with all of its values
    headers: Record<string, string[]>;
    body: string;
}

// Sends one request over Tor and returns the status, headers and raw
// body without interpreting them. Transport failures reject with the
// native error (a TorError carrying the native message).
const torHttpRequest = async ({
    url,
    method,
    data,
    headers,
    trustInvalidCerts = false,
    timeoutMs = REQUEST_TIMEOUT_MS,
    followRedirects = false
}: TorHttpRequest): Promise<TorHttpResponse> => {
    const httpMethod = HTTP_METHODS[method];
    if (!httpMethod) {
        throw new Error(`Unsupported method: ${method}`);
    }

    await ensureTorStarted();

    // Defense in depth: only honor trustInvalidCerts for HTTPS .onion
    // URLs. If a caller passes true for a clearnet URL we drop it on
    // the floor and warn, so that exit-node MITM defenses stay in
    // place even if a future call site forgets to gate the param.
    const effectiveTrustInvalidCerts =
        trustInvalidCerts && isOnionHttpsUrl(url);
    if (trustInvalidCerts && !effectiveTrustInvalidCerts) {
        console.warn(
            `doTorRequest: ignoring trust_invalid_certs=true for non-.onion URL (${url}) — clearnet-over-Tor must validate TLS to defend against exit-node MITM`
        );
    }

    const response = await Tor.http.request({
        url,
        method: httpMethod,
        headers: normalizeHeaders(headers),
        // GET and DELETE never sent a body with nitro-tor 0.6.x
        body: method === RequestMethod.POST ? data || '' : undefined,
        timeoutMs,
        allowInvalidCertificates: effectiveTrustInvalidCerts,
        followRedirects
    });

    return {
        statusCode: response.statusCode,
        headers: response.headers || {},
        body: response.body || ''
    };
};

// torHttpRequest reduced to the status and body, for
// NetworkUtils.networkFetch to map onto a ReactNativeBlobUtil-shaped
// response. Like torHttpRequest it does not throw on a non-2xx status and
// does not follow redirects; it rejects only on a transport failure.
const doTorRequestRaw = async (
    url: string,
    method: RequestMethod,
    data?: string,
    headers?: any,
    trustInvalidCerts: boolean = false,
    timeoutMs: number = REQUEST_TIMEOUT_MS
): Promise<{ status: number; body: string }> => {
    const { statusCode, body } = await torHttpRequest({
        url,
        method,
        data,
        headers,
        trustInvalidCerts,
        timeoutMs
    });
    return { status: statusCode, body };
};

const doTorRequest = async (
    url: string,
    method: RequestMethod,
    data?: string,
    headers?: any,
    trustInvalidCerts: boolean = false,
    // Callers with a request-scoped deadline (e.g. payments, where the
    // node holds the connection open for timeout_seconds) must pass a
    // longer timeout or the request dies before the node can answer.
    timeoutMs: number = REQUEST_TIMEOUT_MS
) => {
    const response = await torHttpRequest({
        url,
        method,
        data,
        headers,
        trustInvalidCerts,
        timeoutMs,
        // Callers pass node credentials (macaroon, rune) in custom
        // headers, which reqwest keeps on a cross-host redirect, and the
        // .onion certificate exception would apply to the new host too.
        // A 3xx is an error here anyway, so never follow one.
        followRedirects: false
    });

    let parsedBody: any;
    if (response.body) {
        try {
            parsedBody = JSON.parse(response.body);
        } catch {
            parsedBody = response.body;
        }
    }

    if (response.statusCode >= 300) {
        const message =
            restErrorMessage(parsedBody) ||
            (typeof parsedBody === 'string' && parsedBody) ||
            `HTTP ${response.statusCode}`;
        // also keeps a Core Lightning error body's JSON-RPC code, which
        // shows clnrest itself answered
        throw markJsonRpcCode(
            markRestErrorResponse(
                new Error(message),
                grpcErrorCode(parsedBody),
                response.statusCode
            ),
            parsedBody
        );
    }

    return parsedBody;
};

const restartTor = async () => {
    await Tor.daemon.stop();
    startPromise = null;
    await ensureTorStarted();
};

export {
    doTorRequest,
    doTorRequestRaw,
    torHttpRequest,
    restartTor,
    isOnionHttpsUrl,
    RequestMethod
};
export type { TorHttpRequest, TorHttpResponse };
