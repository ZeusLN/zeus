import BaseModel from './BaseModel';

export interface AdditionalChannel {
    node_pubkey_string: string;
    host: string;
    local_funding_amount: string;
    satAmount: string | number;
}

export default class OpenChannelRequest extends BaseModel {
    public min_confs?: number;
    public spend_unconfirmed?: boolean;
    public remote_csv_delay?: number;
    public node_pubkey_string: string;
    public node_pubkey?: any;
    public push_sat?: string;
    public target_conf?: number;
    public sat_per_byte?: string; // deprecated
    public sat_per_vbyte?: string;
    public private?: boolean;
    public min_htlc_msat?: string;
    public local_funding_amount: string;
    public host?: string;
    public id?: string;
    public satoshis?: string;
    public utxos?: string[];
    public privateChannel?: boolean;
    public scidAlias?: boolean;
    public simpleTaprootChannel?: boolean;
    public fundMax?: boolean;
    public close_address?: string;
    // external accoutn funding
    public account?: string;
    public funding_shim?: {
        psbt_shim: {
            pending_chan_id: any;
            base_psbt: string;
            no_publish?: boolean;
        };
    };
    public additionalChannels?: Array<AdditionalChannel>;

    constructor(data?: any) {
        super(data);
        this.id = data.node_pubkey_string || data.node_pubkey;
        this.satoshis = data.local_funding_amount;
    }
}
