import { SwapClient } from '../types/proto/loop/client';
import { Debug } from '../types/proto/loop/debug';
/**
 * An API wrapper to communicate with the Loop node via GRPC
 */
declare class LoopApi {
    swapClient: SwapClient;
    debug: Debug;
    constructor(createRpc: Function, lnc: any);
}
export default LoopApi;
//# sourceMappingURL=loop.d.ts.map