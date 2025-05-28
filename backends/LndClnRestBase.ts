import { AbortSignal } from 'abort-controller';
import ReactNativeBlobUtil, { StatefulPromise } from 'react-native-blob-util';
import { RequestMethod } from 'react-native-tor';

import { BackendRequestCancelledError } from '../utils/BackendUtils';
import { localeString } from '../utils/LocaleUtils';
import { doTorRequest } from '../utils/TorUtils';

export class LndClnRestBase {
    private defaultTimeout: number = 30000;

    // keep track of all active calls so we can cancel when appropriate
    private calls = new Map<
        string,
        {
            resultPromise: Promise<any>;
            cancellablePromise?: StatefulPromise<any>;
        }
    >();

    clearCachedCalls = () => {
        this.calls.forEach((call) => call.cancellablePromise?.cancel());
        this.calls.clear();
    };

    restReq = async (
        headers: Headers | any,
        url: string,
        method: any,
        data?: any,
        certVerification?: boolean,
        useTor?: boolean,
        timeout?: number,
        abortSignal?: AbortSignal
    ) => {
        // use body data as an identifier too, we don't want to cancel when we
        // are making multiples calls to get all the node names, for example
        const id = data ? `${url}${JSON.stringify(data)}` : url;
        if (this.calls.has(id)) {
            return this.calls.get(id)!.resultPromise;
        }
        // API is a bit of a mess but
        // If tor enabled in setting, start up the daemon here
        if (useTor === true) {
            this.calls.set(id, {
                resultPromise: doTorRequest(
                    url,
                    method as RequestMethod,
                    JSON.stringify(data),
                    headers
                )
                    .then((response: any) => {
                        if (this.calls.delete(id)) {
                            return response;
                        }
                        throw new BackendRequestCancelledError();
                    })
                    .catch((error: any) => {
                        if (this.calls.delete(id)) {
                            throw error;
                        }
                        throw new BackendRequestCancelledError();
                    })
            });
        } else {
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(
                    () => reject(new Error('Request timeout')),
                    timeout || this.defaultTimeout
                );
            });

            const fetchStatefulPromise = ReactNativeBlobUtil.config({
                trusty: !certVerification
            }).fetch(method, url, headers, data ? JSON.stringify(data) : data);

            const onAbort = () => fetchStatefulPromise.cancel();
            abortSignal?.addEventListener('abort', onAbort);

            const fetchPromise = fetchStatefulPromise.then((response: any) => {
                this.calls.delete(id);
                abortSignal?.removeEventListener('abort', onAbort);
                if (response.info().status < 300) {
                    // handle ws responses
                    if (response.data.includes('\n')) {
                        const split = response.data.split('\n');
                        const length = split.length;
                        // last instance is empty
                        return JSON.parse(split[length - 2]);
                    }
                    return response.json();
                } else {
                    try {
                        const errorInfo = response.json();
                        throw new Error(
                            (errorInfo.error && errorInfo.error.message) ||
                                errorInfo.message ||
                                errorInfo.error
                        );
                    } catch (e) {
                        if (
                            response.data &&
                            typeof response.data === 'string'
                        ) {
                            throw new Error(response.data);
                        } else {
                            throw new Error(
                                localeString(
                                    'backends.LND.restReq.connectionError'
                                )
                            );
                        }
                    }
                }
            });

            const racePromise = Promise.race([
                fetchPromise,
                timeoutPromise
            ]).catch((error) => {
                this.calls.delete(id);
                if (error.name === 'ReactNativeBlobUtilCanceledFetch') {
                    throw new BackendRequestCancelledError();
                }
                abortSignal?.removeEventListener('abort', onAbort);
                if (error.message === 'Request timeout') {
                    console.log('Request timed out for:', url);
                }
                throw error;
            });

            this.calls.set(id, {
                resultPromise: racePromise,
                cancellablePromise: fetchStatefulPromise
            });
        }

        return this.calls.get(id)?.resultPromise;
    };

    getURL = (
        host: string,
        port: string | number,
        route: string,
        ws?: boolean
    ) => {
        const hostPath = host.includes('://') ? host : `https://${host}`;
        let baseUrl = `${hostPath}${port ? ':' + port : ''}`;

        if (ws) {
            baseUrl = baseUrl.replace('https', 'wss').replace('http', 'ws');
        }

        if (baseUrl[baseUrl.length - 1] === '/') {
            baseUrl = baseUrl.slice(0, -1);
        }

        return `${baseUrl}${route}`;
    };
}
