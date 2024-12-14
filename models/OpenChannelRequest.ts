/* eslint-disable import/no-unresolved */
import {
    CommitmentType,
    OutPoint
} from '@lightninglabs/lnc-core/dist/types/proto/lnrpc';
import BaseModel from './BaseModel';

export interface AdditionalChannel {
    node_pubkey_string: string;
    host: string;
    local_funding_amount: string;
    satAmount: string | number;
}

export default class OpenChannelRequest extends BaseModel {
    public minConfs: number;
    public spendUnconfirmed: boolean;
    public remoteCsvDelay: number;
    public nodePubkeyString: string;
    public nodePubkey?: any;
    public pushSat: string;
    public targetConf: number;
    public satPerByte: string; // deprecated
    public satPerVbyte: string;
    public private?: boolean;
    public minHtlcMsat: string;
    public localFundingAmount: string;
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
    public outpoints?: OutPoint[];
    public commitmentType: CommitmentType;
    public remoteMaxHtlcs: number;
    public closeAddress: string;
    public remoteMaxValueInFlightMsat: string;
    public maxLocalCsv: number;
    public baseFee: string;
    public feeRate: string;
    public zeroConf: boolean;
    // external accoutn funding
    public account?: string;
    public fundingShim: {
        psbtShim: {
            pendingChanId: Uint8Array | string;
            basePsbt: Uint8Array | string;
            noPublish: boolean;
        };
    };
    public additionalChannels?: Array<AdditionalChannel>;

    constructor(data?: any) {
        super(data);
        this.id = data.node_pubkey_string || data.node_pubkey;
        this.satoshis = data.local_funding_amount;
    }
}
