import { RnTor } from 'react-native-nitro-tor';
import RNFS from 'react-native-fs';

const SOCKS_PORT = 19050;
const TARGET_PORT = 19051;
const TIMEOUT_MS = 60000;
const REQUEST_TIMEOUT_MS = 60000;

enum RequestMethod {
    GET = 'get',
    POST = 'post',
    DELETE = 'delete'
}

const getDataDir = (): string => {
    const base = RNFS.DocumentDirectoryPath;
    return `${base}/tor_data`;
};

let torStarted = false;

const ensureTorStarted = async () => {
    if (torStarted) {
        const status = await RnTor.getServiceStatus();
        if (status === 1) return; // already running
    }
    const result = await RnTor.startTorIfNotRunning({
        data_dir: getDataDir(),
        socks_port: SOCKS_PORT,
        target_port: TARGET_PORT,
        timeout_ms: TIMEOUT_MS
    });
    if (!result.is_success) {
        throw new Error(
            `Failed to start Tor: ${result.error_message || 'unknown error'}`
        );
    }
    torStarted = true;
};

const headersToString = (headers?: any): string => {
    if (!headers) return '{}';
    if (typeof headers === 'string') return headers;
    return JSON.stringify(headers);
};

const doTorRequest = async (
    url: string,
    method: RequestMethod,
    data?: string,
    headers?: any,
    // TODO: trustSSL is not yet supported by react-native-nitro-tor
    _trustSSL = true
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

    if (response?.error) {
        throw new Error(response.error);
    }

    if (response?.body) {
        try {
            return JSON.parse(response.body);
        } catch {
            return response.body;
        }
    }
};

const restartTor = async () => {
    await RnTor.shutdownService();
    torStarted = false;
    await ensureTorStarted();
};

export { doTorRequest, restartTor, RequestMethod };
