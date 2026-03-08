/* eslint-disable */
import type { SendPaymentRequest as SendPaymentRequest1 } from '../routerrpc/router';
import type {
    PeerAcceptedSellQuote,
    PeerAcceptedBuyQuote
} from '../rfqrpc/rfq';
import type {
    Payment,
    Invoice,
    AddInvoiceResponse as AddInvoiceResponse2,
    PayReq
} from '../lightning';
import type { DecimalDisplay, AssetGroup, GenesisInfo } from '../taprootassets';

export interface FundChannelRequest {
    /**
     * The asset amount to fund the channel with. The BTC amount is fixed and
     * cannot be customized (for now).
     */
    assetAmount: string;
    /** The asset ID to use for the channel funding. */
    assetId: Uint8Array | string;
    /**
     * The public key of the peer to open the channel with. Must already be
     * connected to this peer.
     */
    peerPubkey: Uint8Array | string;
    /** The channel funding fee rate in sat/vByte. */
    feeRateSatPerVbyte: number;
    /**
     * The number of satoshis to give the remote side as part of the initial
     * commitment state. This is equivalent to first opening a channel and then
     * sending the remote party funds, but all done in one step. Therefore, this
     * is equivalent to a donation to the remote party, unless they reimburse
     * the funds in another way (outside the protocol).
     */
    pushSat: string;
    /**
     * The group key to use for the channel. This can be used instead of the
     * asset_id to allow assets from a fungible group to be used for the channel
     * funding instead of just assets from a single minting tranche (asset_id).
     */
    groupKey: Uint8Array | string;
}

export interface FundChannelResponse {
    /** The channel funding transaction ID. */
    txid: string;
    /** The index of the channel funding output in the funding transaction. */
    outputIndex: number;
}

export interface RouterSendPaymentData {
    /**
     * The string encoded asset ID to amount mapping. Instructs the router to
     * use these assets in the given amounts for the payment. Can be empty for
     * a payment of an invoice, if the RFQ ID is set instead.
     */
    assetAmounts: { [key: string]: string };
    /**
     * The RFQ ID to use for the payment. Can be empty for a direct keysend
     * payment that doesn't involve any conversion (and thus no RFQ).
     */
    rfqId: Uint8Array | string;
}

export interface RouterSendPaymentData_AssetAmountsEntry {
    key: string;
    value: string;
}

export interface EncodeCustomRecordsRequest {
    /** The custom records to encode for a payment request. */
    routerSendPayment: RouterSendPaymentData | undefined;
}

export interface EncodeCustomRecordsResponse {
    /** The encoded custom records in TLV format. */
    customRecords: { [key: string]: Uint8Array | string };
}

export interface EncodeCustomRecordsResponse_CustomRecordsEntry {
    key: string;
    value: Uint8Array | string;
}

export interface SendPaymentRequest {
    /**
     * The asset ID to use for the payment. This must be set for both invoice
     * and keysend payments, unless RFQ negotiation was already done beforehand
     * and payment_request.first_hop_custom_records already contains valid RFQ
     * data. Mutually exclusive to group_key.
     */
    assetId: Uint8Array | string;
    /**
     * The asset amount to send in a keysend payment. This amount is ignored for
     * invoice payments as the asset amount is negotiated through RFQ with the
     * peer, depending on the invoice amount. This can also be left unset if RFQ
     * negotiation was already done beforehand and
     * payment_request.first_hop_custom_records already contains valid RFQ data.
     */
    assetAmount: string;
    /**
     * The node identity public key of the peer to ask for a quote for sending
     * out the assets and converting them to satoshis. If set, only a quote with
     * this peer may be negotiated to carry out the payment.
     */
    peerPubkey: Uint8Array | string;
    /**
     * The full lnd payment request to send. All fields behave the same way as
     * they do for lnd's routerrpc.SendPaymentV2 RPC method (see the API docs
     * at https://lightning.engineering/api-docs/api/lnd/router/send-payment-v2
     * for more details).
     * To send a keysend payment, the payment_request.dest_custom_records must
     * contain a valid keysend record (key 5482373484 and a 32-byte preimage
     * that corresponds to the payment hash).
     */
    paymentRequest: SendPaymentRequest1 | undefined;
    /**
     * The rfq id to use for this payment. If the user sets this value then the
     * payment will immediately be dispatched, skipping the rfq negotiation
     * phase, and using the following rfq id instead.
     */
    rfqId: Uint8Array | string;
    /**
     * If a small invoice should be paid that is below the amount that always
     * needs to be sent out to carry a single asset unit, then by default the
     * payment is rejected. If this flag is set, then the payment will be
     * allowed to proceed, even if it is uneconomical, meaning that more sats
     * are sent out to the network than the invoice amount plus routing fees
     * require to be paid.
     */
    allowOverpay: boolean;
    /**
     * The group key which dictates which assets may be used for this payment.
     * Mutually exclusive to asset_id.
     */
    groupKey: Uint8Array | string;
    /**
     * An optional text field that can be used to provide additional metadata
     * about the payment to the price oracle. This can include information
     * about the wallet end user that initiated the transaction, or any
     * authentication information that the price oracle can use to give out a
     * more accurate (or discount) asset rate. Though not verified or enforced
     * by tapd, the suggested format for this field is a JSON string.
     * This field is optional and can be left empty if no metadata is available.
     * The maximum length of this field is 32'768 bytes.
     */
    priceOracleMetadata: string;
}

export interface AcceptedSellQuotes {
    /**
     * If swapping of assets is necessary to carry out the payment, a number of
     * RFQ quotes may be negotiated for that purpose. The following field
     * contains all the sell orders that were negotiated with our peers.
     */
    acceptedSellOrders: PeerAcceptedSellQuote[];
}

export interface SendPaymentResponse {
    /**
     * In case channel assets need to be swapped to another asset, an asset
     * sell order is negotiated with the channel peer. The result will be
     * the first message in the response stream. If no swap is needed, the
     * payment results will be streamed directly.
     * Deprecated. This will now only contain the first quote that was
     * negotiated. Since the introduction of multi-rfq we now negotiate
     * multiple quotes in the context of a payment. Use the new field named
     * "accepted_sell_orders" to retrieve all of them.
     */
    acceptedSellOrder: PeerAcceptedSellQuote | undefined;
    /**
     * If swapping of assets is necessary to carry out the payment, a number
     * of RFQ quotes may be negotiated for that purpose. The following field
     * contains all the sell orders that were negotiated with our peers.
     */
    acceptedSellOrders: AcceptedSellQuotes | undefined;
    /**
     * The payment result of a single payment attempt. Multiple attempts
     * may be returned per payment request until either the payment
     * succeeds or the payment times out.
     */
    paymentResult: Payment | undefined;
}

export interface HodlInvoice {
    /** The payment hash of the HODL invoice to be created. */
    paymentHash: Uint8Array | string;
}

export interface AddInvoiceRequest {
    /** The asset ID to use for the invoice. Mutually exclusive to group_key. */
    assetId: Uint8Array | string;
    /** The asset amount to receive. */
    assetAmount: string;
    /**
     * The node identity public key of the peer to ask for a quote for receiving
     * assets and converting them from satoshis. When specified only quotes with
     * this peer will be negotiated.
     */
    peerPubkey: Uint8Array | string;
    /**
     * The full lnd invoice request to send. All fields behave the same way as
     * they do for lnd's lnrpc.AddInvoice RPC method (see the API docs at
     * https://lightning.engineering/api-docs/api/lnd/lightning/add-invoice
     * for more details).
     *
     * Only one of the asset_amount/value/value_msat may be set to dictate the
     * value of the invoice. When using asset_amount, the value/value_msat
     * fields will be overwritten by the satoshi (or milli-satoshi) equivalent
     * of the asset amount, after negotiating a quote with a peer that supports
     * the given asset ID.
     *
     * If the value/value_msat are used, we still receive assets, but they will
     * exactly evaluate to the defined amount in sats/msats.
     */
    invoiceRequest: Invoice | undefined;
    /**
     * If set, then this will make the invoice created a hodl invoice, which
     * won't be settled automatically. Instead, users will need to use the
     * invoicesrpc.SettleInvoice call to manually settle the invoice.
     */
    hodlInvoice: HodlInvoice | undefined;
    /**
     * The group key which dictates which assets may be accepted for this
     * invoice. If set, any asset that belongs to this group may be accepted to
     * settle this invoice. Mutually exclusive to asset_id.
     */
    groupKey: Uint8Array | string;
    /**
     * An optional text field that can be used to provide additional metadata
     * about the invoice to the price oracle. This can include information
     * about the wallet end user that initiated the transaction, or any
     * authentication information that the price oracle can use to give out a
     * more accurate (or discount) asset rate. Though not verified or enforced
     * by tapd, the suggested format for this field is a JSON string.
     * This field is optional and can be left empty if no metadata is available.
     * The maximum length of this field is 32'768 bytes.
     */
    priceOracleMetadata: string;
}

export interface AddInvoiceResponse {
    /** The quote for the purchase of assets that was accepted by the peer. */
    acceptedBuyQuote: PeerAcceptedBuyQuote | undefined;
    /** The result of the invoice creation. */
    invoiceResult: AddInvoiceResponse2 | undefined;
}

export interface AssetPayReq {
    /**
     * The asset ID that will be used to resolve the invoice's satoshi amount.
     * Mutually exclusive to group_key.
     */
    assetId: Uint8Array | string;
    /**
     * The normal LN invoice that whose amount will be mapped to units of the
     * asset ID.
     */
    payReqString: string;
    /**
     * The group key that will be used to resolve the invoice's satoshi amount.
     * Mutually exclusive to asset_id.
     */
    groupKey: Uint8Array | string;
    /**
     * An optional text field that can be used to provide additional metadata
     * about the invoice to the price oracle. This can include information
     * about the wallet end user that initiated the transaction, or any
     * authentication information that the price oracle can use to give out a
     * more accurate (or discount) asset rate. Though not verified or enforced
     * by tapd, the suggested format for this field is a JSON string.
     * This field is optional and can be left empty if no metadata is available.
     * The maximum length of this field is 32'768 bytes.
     */
    priceOracleMetadata: string;
}

export interface AssetPayReqResponse {
    /** The invoice amount, expressed in asset units. */
    assetAmount: string;
    /** The decimal display corresponding to the asset_id. */
    decimalDisplay: DecimalDisplay | undefined;
    /** The group the asset ID belong to, if applicable. */
    assetGroup: AssetGroup | undefined;
    /**
     * Genesis information for the asset ID which includes the meta hash, and
     * asset ID. This is only set if the payment request was decoded with an
     * asset ID and not with a group key (since a group can contain assets from
     * different minting events or genesis infos).
     */
    genesisInfo: GenesisInfo | undefined;
    /** The normal decoded payment request. */
    payReq: PayReq | undefined;
}

export interface TaprootAssetChannels {
    /**
     * litcli: `ln fundchannel`
     * FundChannel initiates the channel funding negotiation with a peer for the
     * creation of a channel that contains a specified amount of a given asset.
     */
    fundChannel(
        request?: DeepPartial<FundChannelRequest>
    ): Promise<FundChannelResponse>;
    /**
     * Deprecated.
     * EncodeCustomRecords allows RPC users to encode Taproot Asset channel related
     * data into the TLV format that is used in the custom records of the lnd
     * payment or other channel related RPCs. This RPC is completely stateless and
     * does not perform any checks on the data provided, other than pure format
     * validation.
     *
     * @deprecated
     */
    encodeCustomRecords(
        request?: DeepPartial<EncodeCustomRecordsRequest>
    ): Promise<EncodeCustomRecordsResponse>;
    /**
     * litcli: `ln sendpayment`
     * SendPayment is a wrapper around lnd's routerrpc.SendPaymentV2 RPC method
     * with asset specific parameters. It allows RPC users to send asset keysend
     * payments (direct payments) or payments to an invoice with a specified asset
     * amount.
     */
    sendPayment(
        request?: DeepPartial<SendPaymentRequest>,
        onMessage?: (msg: SendPaymentResponse) => void,
        onError?: (err: Error) => void
    ): void;
    /**
     * litcli: `ln addinvoice`
     * AddInvoice is a wrapper around lnd's lnrpc.AddInvoice method with asset
     * specific parameters. It allows RPC users to create invoices that correspond
     * to the specified asset amount. If a peer pubkey is specified, then only that
     * peer will be used for RFQ negotiations. If none is specified then RFQ quotes
     * for all peers with suitable asset channels will be created.
     */
    addInvoice(
        request?: DeepPartial<AddInvoiceRequest>
    ): Promise<AddInvoiceResponse>;
    /**
     * litcli: `ln decodeassetinvoice`
     * DecodeAssetPayReq is similar to lnd's lnrpc.DecodePayReq, but it accepts an
     * asset ID or group key and returns the invoice amount expressed in asset
     * units along side the normal information.
     */
    decodeAssetPayReq(
        request?: DeepPartial<AssetPayReq>
    ): Promise<AssetPayReqResponse>;
}

type Builtin =
    | Date
    | Function
    | Uint8Array
    | string
    | number
    | boolean
    | undefined;

type DeepPartial<T> = T extends Builtin
    ? T
    : T extends Array<infer U>
    ? Array<DeepPartial<U>>
    : T extends ReadonlyArray<infer U>
    ? ReadonlyArray<DeepPartial<U>>
    : T extends {}
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : Partial<T>;
