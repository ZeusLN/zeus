import BaseModel from './BaseModel';

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
    public host: string;
    public id?: string;
    public satoshis?: string;
    public utxos?: string[];
    public privateChannel?: boolean;
    public scidAlias?: boolean;

    constructor(data?: any) {
        super(data);
        this.id = data.node_pubkey_string || data.node_pubkey;
        this.satoshis = data.local_funding_amount;
    }
}
