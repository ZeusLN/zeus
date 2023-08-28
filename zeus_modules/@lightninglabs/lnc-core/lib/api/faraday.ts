import { FaradayServer } from '../types/proto/faraday/faraday';
import { serviceNames as sn } from '../types/proto/schema';

/**
 * An API wrapper to communicate with the Faraday node via GRPC
 */
class FaradayApi {
    faradayServer: FaradayServer;

    constructor(createRpc: Function, lnc: any) {
        this.faradayServer = createRpc(sn.frdrpc.FaradayServer, lnc);
    }
}

export default FaradayApi;
