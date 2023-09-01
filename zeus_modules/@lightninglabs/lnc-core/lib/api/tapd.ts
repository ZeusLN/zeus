import { serviceNames as sn } from '../types/proto/schema';
import { AssetWallet } from '../types/proto/tapd/assetwalletrpc/assetwallet';
import { Mint } from '../types/proto/tapd/mintrpc/mint';
import { TaprootAssets } from '../types/proto/tapd/taprootassets';
import { Universe } from '../types/proto/tapd/universerpc/universe';

/**
 * An API wrapper to communicate with the Taproot Assets node via GRPC
 */
class TaprootAssetsApi {
    taprootAssets: TaprootAssets;
    assetWallet: AssetWallet;
    mint: Mint;
    universe: Universe;

    constructor(createRpc: Function, lnc: any) {
        this.taprootAssets = createRpc(sn.taprpc.TaprootAssets, lnc);
        this.mint = createRpc(sn.mintrpc.Mint, lnc);
        this.assetWallet = createRpc(sn.assetwalletrpc.AssetWallet, lnc);
        this.universe = createRpc(sn.universerpc.Universe, lnc);
    }
}

export default TaprootAssetsApi;
