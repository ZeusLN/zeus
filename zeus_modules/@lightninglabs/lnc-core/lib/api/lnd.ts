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
import { serviceNames as sn } from '../types/proto/schema';

/**
 * An API wrapper to communicate with the LND node via GRPC
 */
class LndApi {
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

    constructor(createRpc: Function, lnc: any) {
        this.autopilot = createRpc(sn.autopilotrpc.Autopilot, lnc);
        this.chainNotifier = createRpc(sn.chainrpc.ChainNotifier, lnc);
        this.invoices = createRpc(sn.invoicesrpc.Invoices, lnc);
        this.lightning = createRpc(sn.lnrpc.Lightning, lnc);
        this.router = createRpc(sn.routerrpc.Router, lnc);
        this.signer = createRpc(sn.signrpc.Signer, lnc);
        this.walletKit = createRpc(sn.walletrpc.WalletKit, lnc);
        this.walletUnlocker = createRpc(sn.lnrpc.WalletUnlocker, lnc);
        this.watchtower = createRpc(sn.watchtowerrpc.Watchtower, lnc);
        this.watchtowerClient = createRpc(sn.wtclientrpc.WatchtowerClient, lnc);
    }
}

export default LndApi;
