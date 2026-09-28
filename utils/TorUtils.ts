import { Tor, TorError } from 'react-native-nitro-tor';
import type {
    HttpMethod,
    TorStatus,
    TorStatusListener
} from 'react-native-nitro-tor';
import RNFS from 'react-native-fs';

const SOCKS_PORT = 9056;
// start() resolves only once Tor reaches 100% bootstrap, which can take
// well over 30s on a cold start over a slow mobile link
const BOOTSTRAP_TIMEOUT_MS = 60000;
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

// Error codes that mean the request never got an answer over Tor, as
// opposed to the remote end answering with an error
const TRANSPORT_ERROR_CODES = [
    'HTTP_TIMEOUT',
    'HTTP_TRANSPORT_ERROR',
    'NOT_RUNNING',
    'TOR_STOPPED'
];

const normalizeHeaders = (headers?: any): Record<string, string> => {
    if (!headers) return {};
    const parsed =
        typeof headers === 'string' ? JSON.parse(headers || '{}') : headers;
    const result: Record<string, string> = {};
    Object.keys(parsed).forEach((key) => {
        if (parsed[key] !== undefined && parsed[key] !== null) {
            result[key] = String(parsed[key]);
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

const isTorTransportError = (error: any): boolean =>
    error instanceof TorError && TRANSPORT_ERROR_CODES.includes(error.code);

// NOT_RUNNING means the request never left, so any method can be resent.
// TOR_STOPPED means it may already have reached the node, so only resend
// GETs: resending a POST could, for example, pay an invoice twice.
const isRetryableAfterStop = (error: any, method: RequestMethod): boolean =>
    error instanceof TorError &&
    (error.code === 'NOT_RUNNING' ||
        (error.code === 'TOR_STOPPED' && method === RequestMethod.GET));

type RequestOutcomeListener = (ok: boolean, url: string) => void;
let requestOutcomeListener: RequestOutcomeListener | null = null;

// Lets TorStore count consecutive transport failures, which catches
// stale circuits that the daemon still reports as running
const setTorRequestOutcomeListener = (
    listener: RequestOutcomeListener | null
) => {
    requestOutcomeListener = listener;
};

const reportOutcome = (ok: boolean, url: string) => {
    try {
        requestOutcomeListener?.(ok, url);
    } catch (e) {
        console.warn('Tor request outcome listener threw', e);
    }
};

// Shares one start() between concurrent callers. Cleared once it
// settles so a daemon that later dies or is stopped gets started again
// on the next request instead of every request failing until relaunch.
let startPromise: Promise<void> | null = null;

const ensureTorStarted = async (): Promise<void> => {
    if (startPromise) return startPromise;
    const status = await Tor.daemon.getStatus();
    if (status.state === 'running') return;
    if (!startPromise) {
        startPromise = Tor.daemon
            .start({
                dataDirectory: TOR_DATA_PATH,
                socksPort: SOCKS_PORT,
                bootstrapTimeoutMs: BOOTSTRAP_TIMEOUT_MS
            })
            .then(() => undefined)
            .finally(() => {
                startPromise = null;
            });
    }
    return startPromise;
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

    const send = () =>
        Tor.http.request({
            url,
            method: httpMethod,
            headers: normalizeHeaders(headers),
            body: method === RequestMethod.POST ? data || '' : undefined,
            timeoutMs,
            allowInvalidCertificates: effectiveTrustInvalidCerts
        });

    let response;
    try {
        try {
            response = await send();
        } catch (e) {
            if (!isRetryableAfterStop(e, method)) throw e;
            // The daemon went away under us (Restart Tor, or it died).
            // Start it again and resend once instead of failing the
            // caller, which for the wallet means its error screen.
            await ensureTorStarted();
            response = await send();
        }
    } catch (e) {
        if (isTorTransportError(e)) reportOutcome(false, url);
        throw e;
    }
    reportOutcome(true, url);

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
        throw new Error(message);
    }

    return parsedBody;
};

const restartTor = async () => {
    await Tor.daemon.stop();
    await ensureTorStarted();
};

const requestNewTorIdentity = () => Tor.daemon.requestNewIdentity();

const getTorStatus = (): Promise<TorStatus> => Tor.daemon.getStatus();

const subscribeTorStatus = (listener: TorStatusListener): (() => void) =>
    Tor.daemon.subscribe(listener);

export {
    doTorRequest,
    restartTor,
    requestNewTorIdentity,
    getTorStatus,
    subscribeTorStatus,
    setTorRequestOutcomeListener,
    isOnionHttpsUrl,
    RequestMethod
};
export type { TorStatus };
