import LNC from '../lnc';
/**
 * Creates a typed Proxy object which calls the request or subscribe
 * methods depending on which function is called on the object
 */
export declare function createRpc<T extends object>(packageName: string, lnc: LNC): T;
export default createRpc;
//# sourceMappingURL=createRpc.d.ts.map