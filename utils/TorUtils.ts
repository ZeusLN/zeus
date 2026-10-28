import { Tor } from 'react-native-nitro-tor';
import type { HttpMethod } from 'react-native-nitro-tor';
import RNFS from 'react-native-fs';
import { grpcErrorCode, markRestErrorResponse } from './PaymentLookupUtils';

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
                throw e;
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
    // the location header before following it. Defaults to true.
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
    followRedirects = true
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
        timeoutMs
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
            (parsedBody &&
                typeof parsedBody === 'object' &&
                (parsedBody.error?.message ||
                    parsedBody.message ||
                    parsedBody.error)) ||
            (typeof parsedBody === 'string' && parsedBody) ||
            `HTTP ${response.statusCode}`;
        throw markRestErrorResponse(
            new Error(message),
            grpcErrorCode(parsedBody)
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
    torHttpRequest,
    restartTor,
    isOnionHttpsUrl,
    RequestMethod
};
export type { TorHttpRequest, TorHttpResponse };
