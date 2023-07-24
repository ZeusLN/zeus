import LNC from '../lnc';
import { subscriptionMethods } from '@lightninglabs/lnc-core';

// capitalize the first letter in the string
const capitalize = (s: string) => s && s[0].toUpperCase() + s.slice(1);

/**
 * Creates a typed Proxy object which calls the request or subscribe
 * methods depending on which function is called on the object
 */
export function createRpc<T extends object>(packageName: string, lnc: LNC): T {
    const rpc = {};
    return new Proxy(rpc, {
        get(target, key, c) {
            const methodName = capitalize(key.toString());
            // the full name of the method (ex: lnrpc.Lightning.OpenChannel)
            const method = `${packageName}.${methodName}`;

            if (subscriptionMethods.includes(method)) {
                // call subscribe for streaming methods
                return (request: object): string => {
                    return lnc.subscribe(method, request);
                };
            } else {
                // call request for unary methods
                return async (request: object): Promise<any> => {
                    return await lnc.request(method, request);
                };
            }
        }
    }) as T;
}

export default createRpc;
