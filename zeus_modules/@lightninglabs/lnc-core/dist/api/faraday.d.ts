import { FaradayServer } from '../types/proto/faraday/faraday';
/**
 * An API wrapper to communicate with the Faraday node via GRPC
 */
declare class FaradayApi {
    faradayServer: FaradayServer;
    constructor(createRpc: Function, lnc: any);
}
export default FaradayApi;
//# sourceMappingURL=faraday.d.ts.map