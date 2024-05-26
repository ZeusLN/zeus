import { Autopilot, Firewall, Sessions, Status } from '../types/proto/litrpc';
import { serviceNames as sn } from '../types/proto/schema';

/**
 * An API wrapper to communicate with the LiT node via GRPC
 */
class LitApi {
    autopilot: Autopilot;
    firewall: Firewall;
    sessions: Sessions;
    status: Status;

    constructor(createRpc: Function, lnc: any) {
        this.autopilot = createRpc(sn.litrpc.Autopilot, lnc);
        this.firewall = createRpc(sn.litrpc.Firewall, lnc);
        this.sessions = createRpc(sn.litrpc.Sessions, lnc);
        this.status = createRpc(sn.litrpc.Status, lnc);
    }
}

export default LitApi;
