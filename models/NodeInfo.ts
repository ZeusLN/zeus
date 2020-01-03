import { observable, computed } from 'mobx';
import BaseModel from './BaseModel.ts';

export default class NodeInfo extends BaseModel {
    chains?: Array<string>;
    uris?: Array<string>;
    alias?: string;
    num_active_channels?: number;
    num_inactive_channels?: number;
    version?: string;
    identity_pubkey?: string;
    num_peers?: number;
    synced_to_chain?: boolean;
    @observable testnet?: boolean;
    block_hash?: string;
    @observable block_height?: number;
    best_header_timestamp?: string;
    // c-lightning
    @observable network?: string;
    @observable blockheight?: number;

    @computed public get isTestNet(): boolean {
        return this.testnet || this.network === 'testnet';
    }
  
    @computed public get currentBlockHeight(): Number {
        return this.block_height || this.blockheight;
    }
}
