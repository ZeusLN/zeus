import { RnTor } from 'react-native-nitro-tor';
import RNFS from 'react-native-fs';

const SOCKS_PORT = 9056;
const TARGET_PORT = 9057;
const START_TIMEOUT_MS = 30000;
const REQUEST_TIMEOUT_MS = 60000;
const TOR_DATA_PATH = `${RNFS.DocumentDirectoryPath}/tor_data`;

enum RequestMethod {
    GET = 'get',
    POST = 'post',
    DELETE = 'delete'
}

const headersToString = (headers?: any): string => {
    if (!headers) return '';
    if (typeof headers === 'string') return headers;
    return JSON.stringify(headers);
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

const ensureTorStarted = (): Promise<void> => {
    if (!startPromise) {
        startPromise = (async () => {
            const result = await RnTor.startTorIfNotRunning({
                data_dir: TOR_DATA_PATH,
                socks_port: SOCKS_PORT,
                target_port: TARGET_PORT,
                timeout_ms: START_TIMEOUT_MS
            });
            if (!result.is_success) {
                throw new Error(result.error_message || 'Failed to start Tor');
            }
        })().catch((e) => {
            startPromise = null;
            throw e;
        });
    }
    return startPromise;
};

const doTorRequest = async (
    url: string,
    method: RequestMethod,
    data?: string,
    headers?: any,
    trustInvalidCerts: boolean = false
) => {
    await ensureTorStarted();
    const headerStr = headersToString(headers);

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

    let response;
    switch (method) {
        case RequestMethod.GET:
            response = await RnTor.httpGet({
                url,
                headers: headerStr,
                timeout_ms: REQUEST_TIMEOUT_MS,
                trust_invalid_certs: effectiveTrustInvalidCerts
            });
            break;
        case RequestMethod.POST:
            response = await RnTor.httpPost({
                url,
                body: data || '',
                headers: headerStr,
                timeout_ms: REQUEST_TIMEOUT_MS,
                trust_invalid_certs: effectiveTrustInvalidCerts
            });
            break;
        case RequestMethod.DELETE:
            response = await RnTor.httpDelete({
                url,
                headers: headerStr,
                timeout_ms: REQUEST_TIMEOUT_MS,
                trust_invalid_certs: effectiveTrustInvalidCerts
            });
            break;
        default:
            throw new Error(`Unsupported method: ${method}`);
    }

    if (response.error) {
        throw new Error(response.error);
    }

    let parsedBody: any;
    if (response.body) {
        try {
            parsedBody = JSON.parse(response.body);
        } catch {
            parsedBody = response.body;
        }
    }

    if (response.status_code >= 300) {
        const message =
            (parsedBody &&
                typeof parsedBody === 'object' &&
                (parsedBody.error?.message ||
                    parsedBody.message ||
                    parsedBody.error)) ||
            (typeof parsedBody === 'string' && parsedBody) ||
            `HTTP ${response.status_code}`;
        throw new Error(message);
    }

    return parsedBody;
};

const restartTor = async () => {
    await RnTor.shutdownService();
    startPromise = null;
    await ensureTorStarted();
};

export { doTorRequest, restartTor, isOnionHttpsUrl, RequestMethod };
