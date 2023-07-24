import { ChannelAuctioneer } from '../types/proto/pool/auctioneerrpc/auctioneer';
import { HashMail } from '../types/proto/pool/auctioneerrpc/hashmail';
import { Trader } from '../types/proto/pool/trader';
/**
 * An API wrapper to communicate with the Pool node via GRPC
 */
declare class PoolApi {
    trader: Trader;
    channelAuctioneer: ChannelAuctioneer;
    hashmail: HashMail;
    constructor(createRpc: Function, lnc: any);
}
export default PoolApi;
//# sourceMappingURL=pool.d.ts.map