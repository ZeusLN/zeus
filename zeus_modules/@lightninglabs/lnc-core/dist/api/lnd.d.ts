import { Autopilot } from '../types/proto/lnd/autopilotrpc/autopilot';
import { ChainNotifier } from '../types/proto/lnd/chainrpc/chainnotifier';
import { Invoices } from '../types/proto/lnd/invoicesrpc/invoices';
import { Lightning } from '../types/proto/lnd/lightning';
import { Router } from '../types/proto/lnd/routerrpc/router';
import { Signer } from '../types/proto/lnd/signrpc/signer';
import { WalletKit } from '../types/proto/lnd/walletrpc/walletkit';
import { WalletUnlocker } from '../types/proto/lnd/walletunlocker';
import { Watchtower } from '../types/proto/lnd/watchtowerrpc/watchtower';
import { WatchtowerClient } from '../types/proto/lnd/wtclientrpc/wtclient';
/**
 * An API wrapper to communicate with the LND node via GRPC
 */
declare class LndApi {
    autopilot: Autopilot;
    chainNotifier: ChainNotifier;
    invoices: Invoices;
    lightning: Lightning;
    router: Router;
    signer: Signer;
    walletKit: WalletKit;
    walletUnlocker: WalletUnlocker;
    watchtower: Watchtower;
    watchtowerClient: WatchtowerClient;
    constructor(createRpc: Function, lnc: any);
}
export default LndApi;
//# sourceMappingURL=lnd.d.ts.map