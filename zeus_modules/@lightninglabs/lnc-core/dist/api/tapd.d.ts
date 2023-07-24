import { AssetWallet } from '../types/proto/tapd/assetwalletrpc/assetwallet';
import { Mint } from '../types/proto/tapd/mintrpc/mint';
import { TaprootAssets } from '../types/proto/tapd/taprootassets';
import { Universe } from '../types/proto/tapd/universerpc/universe';
/**
 * An API wrapper to communicate with the Taproot Assets node via GRPC
 */
declare class TaprootAssetsApi {
    taprootAssets: TaprootAssets;
    assetWallet: AssetWallet;
    mint: Mint;
    universe: Universe;
    constructor(createRpc: Function, lnc: any);
}
export default TaprootAssetsApi;
//# sourceMappingURL=tapd.d.ts.map