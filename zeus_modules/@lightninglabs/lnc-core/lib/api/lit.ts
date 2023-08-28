import { Autopilot, Firewall, Sessions } from '../types/proto/litrpc';
import { serviceNames as sn } from '../types/proto/schema';

/**
 * An API wrapper to communicate with the LiT node via GRPC
 */
class LitApi {
    autopilot: Autopilot;
    firewall: Firewall;
    sessions: Sessions;

    constructor(createRpc: Function, lnc: any) {
        this.autopilot = createRpc(sn.litrpc.Autopilot, lnc);
        this.firewall = createRpc(sn.litrpc.Firewall, lnc);
        this.sessions = createRpc(sn.litrpc.Sessions, lnc);
    }
}

export default LitApi;
