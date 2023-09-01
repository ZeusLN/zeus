import { SwapClient } from '../types/proto/loop/client';
import { Debug } from '../types/proto/loop/debug';
import { serviceNames as sn } from '../types/proto/schema';

/**
 * An API wrapper to communicate with the Loop node via GRPC
 */
class LoopApi {
    swapClient: SwapClient;
    debug: Debug;

    constructor(createRpc: Function, lnc: any) {
        this.swapClient = createRpc(sn.looprpc.SwapClient, lnc);
        this.debug = createRpc(sn.looprpc.Debug, lnc);
    }
}

export default LoopApi;
