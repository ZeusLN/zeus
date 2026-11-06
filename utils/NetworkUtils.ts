import ReactNativeBlobUtil from 'react-native-blob-util';

import { isPrivateHost, urlHost } from './HostUtils';
import { doTorRequestRaw, RequestMethod } from './TorUtils';

// A minimal subset of the ReactNativeBlobUtil fetch response that ancillary
// call sites rely on. Keeping the Tor branch shaped like a ReactNativeBlobUtil
// response lets callers keep their existing `.info().status` / `.json()` /
// `.text()` / `.data` handling unchanged across both transports. The `text`
// and `data` signatures are deliberately loose to stay structurally
// compatible with FetchBlobResponse.
export interface NetworkResponse {
    info: () => { status: number };
    json: () => any;
    text: () => string | Promise<any>;
    data: any;
}

type HttpMethod = 'GET' | 'POST' | 'DELETE' | 'get' | 'post' | 'delete';

const toRequestMethod = (method: HttpMethod): RequestMethod => {
    switch (method.toLowerCase()) {
        case 'get':
            return RequestMethod.GET;
        case 'post':
            return RequestMethod.POST;
        case 'delete':
            return RequestMethod.DELETE;
        default:
            throw new Error(`Unsupported method: ${method}`);
    }
};

interface NetworkFetchArgs {
    method: HttpMethod;
    url: string;
    headers?: any;
    body?: string;
    enableTor?: boolean;
}

// Whether a URL's host is a Tor onion service. Returns false on any URL that
// won't parse.
const isOnionUrl = (url: string): boolean => {
    try {
        return /\.onion\.?$/i.test(new URL(url).hostname);
    } catch {
        return false;
    }
};

const torFetch = async (
    method: HttpMethod,
    url: string,
    headers?: any,
    body?: string
): Promise<NetworkResponse> => {
    const { status, body: responseBody } = await doTorRequestRaw(
        url,
        toRequestMethod(method),
        body,
        headers
    );
    return {
        info: () => ({ status }),
        json: () => JSON.parse(responseBody),
        text: () => responseBody,
        data: responseBody
    };
};

// Transport-agnostic HTTP request for ancillary (non-node) service calls.
// When Tor is enabled for the active node, or the host is a .onion service,
// the request is routed through the embedded Tor daemon; otherwise it uses
// ReactNativeBlobUtil directly. A private or loopback host (a mempool
// instance on the LAN, say) goes direct even with Tor enabled: Tor exits
// cannot reach it, and the request stays on the local network. A .onion
// host is never handed to the system stack, which would resolve it through
// the local DNS resolver and send the request to whatever address comes
// back, so if Tor is unavailable the request fails rather than falling back
// to clearnet. In both cases the returned value exposes the same
// ReactNativeBlobUtil-compatible surface, so status-based branching and body
// parsing at the call site are identical regardless of transport.
// Not async: without Tor the caller gets ReactNativeBlobUtil's own promise,
// so a caller with a deadline can cancel() the request. A Tor request has no
// cancel and ends at the daemon's own timeout.
const networkFetch = ({
    method,
    url,
    headers,
    body,
    enableTor
}: NetworkFetchArgs): Promise<NetworkResponse> & { cancel?: () => void } => {
    if (isOnionUrl(url) || (enableTor && !isPrivateHost(urlHost(url)))) {
        return torFetch(method, url, headers, body);
    }

    return ReactNativeBlobUtil.fetch(method, url, headers, body);
};

export { isOnionUrl, networkFetch };
