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
    headers?: any
) => {
    await ensureTorStarted();
    const headerStr = headersToString(headers);

    let response;
    switch (method) {
        case RequestMethod.GET:
            response = await RnTor.httpGet({
                url,
                headers: headerStr,
                timeout_ms: REQUEST_TIMEOUT_MS
            });
            break;
        case RequestMethod.POST:
            response = await RnTor.httpPost({
                url,
                body: data || '',
                headers: headerStr,
                timeout_ms: REQUEST_TIMEOUT_MS
            });
            break;
        case RequestMethod.DELETE:
            response = await RnTor.httpDelete({
                url,
                headers: headerStr,
                timeout_ms: REQUEST_TIMEOUT_MS
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

export { doTorRequest, restartTor, RequestMethod };
