import { Autopilot, Firewall, Sessions } from '../types/proto/litrpc';
/**
 * An API wrapper to communicate with the LiT node via GRPC
 */
declare class LitApi {
    autopilot: Autopilot;
    firewall: Firewall;
    sessions: Sessions;
    constructor(createRpc: Function, lnc: any);
}
export default LitApi;
//# sourceMappingURL=lit.d.ts.map