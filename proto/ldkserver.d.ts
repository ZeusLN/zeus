import * as $protobuf from 'protobufjs';
import Long = require('long');
/** Namespace api. */
export namespace api {
    /** Properties of a GetNodeInfoRequest. */
    interface IGetNodeInfoRequest {}

    /** Represents a GetNodeInfoRequest. */
    class GetNodeInfoRequest implements IGetNodeInfoRequest {
        /**
         * Constructs a new GetNodeInfoRequest.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IGetNodeInfoRequest);

        /**
         * Creates a new GetNodeInfoRequest instance using the specified properties.
         * @param [properties] Properties to set
         * @returns GetNodeInfoRequest instance
         */
        public static create(
            properties?: api.IGetNodeInfoRequest
        ): api.GetNodeInfoRequest;

        /**
         * Encodes the specified GetNodeInfoRequest message. Does not implicitly {@link api.GetNodeInfoRequest.verify|verify} messages.
         * @param message GetNodeInfoRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IGetNodeInfoRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified GetNodeInfoRequest message, length delimited. Does not implicitly {@link api.GetNodeInfoRequest.verify|verify} messages.
         * @param message GetNodeInfoRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IGetNodeInfoRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a GetNodeInfoRequest message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns GetNodeInfoRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.GetNodeInfoRequest;

        /**
         * Decodes a GetNodeInfoRequest message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns GetNodeInfoRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.GetNodeInfoRequest;

        /**
         * Verifies a GetNodeInfoRequest message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a GetNodeInfoRequest message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns GetNodeInfoRequest
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.GetNodeInfoRequest;

        /**
         * Creates a plain object from a GetNodeInfoRequest message. Also converts values to other types if specified.
         * @param message GetNodeInfoRequest
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.GetNodeInfoRequest,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this GetNodeInfoRequest to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for GetNodeInfoRequest
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a GetNodeInfoResponse. */
    interface IGetNodeInfoResponse {
        /** GetNodeInfoResponse node_id */
        node_id?: string | null;

        /** GetNodeInfoResponse current_best_block */
        current_best_block?: types.IBestBlock | null;

        /** GetNodeInfoResponse latest_lightning_wallet_sync_timestamp */
        latest_lightning_wallet_sync_timestamp?: Long | null;

        /** GetNodeInfoResponse latest_onchain_wallet_sync_timestamp */
        latest_onchain_wallet_sync_timestamp?: Long | null;

        /** GetNodeInfoResponse latest_fee_rate_cache_update_timestamp */
        latest_fee_rate_cache_update_timestamp?: Long | null;

        /** GetNodeInfoResponse latest_rgs_snapshot_timestamp */
        latest_rgs_snapshot_timestamp?: Long | null;

        /** GetNodeInfoResponse latest_node_announcement_broadcast_timestamp */
        latest_node_announcement_broadcast_timestamp?: Long | null;

        /** GetNodeInfoResponse listening_addresses */
        listening_addresses?: string[] | null;

        /** GetNodeInfoResponse announcement_addresses */
        announcement_addresses?: string[] | null;

        /** GetNodeInfoResponse node_alias */
        node_alias?: string | null;

        /** GetNodeInfoResponse node_uris */
        node_uris?: string[] | null;

        /** GetNodeInfoResponse network */
        network?: types.Network | null;
    }

    /** Represents a GetNodeInfoResponse. */
    class GetNodeInfoResponse implements IGetNodeInfoResponse {
        /**
         * Constructs a new GetNodeInfoResponse.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IGetNodeInfoResponse);

        /** GetNodeInfoResponse node_id. */
        public node_id: string;

        /** GetNodeInfoResponse current_best_block. */
        public current_best_block?: types.IBestBlock | null;

        /** GetNodeInfoResponse latest_lightning_wallet_sync_timestamp. */
        public latest_lightning_wallet_sync_timestamp?: Long | null;

        /** GetNodeInfoResponse latest_onchain_wallet_sync_timestamp. */
        public latest_onchain_wallet_sync_timestamp?: Long | null;

        /** GetNodeInfoResponse latest_fee_rate_cache_update_timestamp. */
        public latest_fee_rate_cache_update_timestamp?: Long | null;

        /** GetNodeInfoResponse latest_rgs_snapshot_timestamp. */
        public latest_rgs_snapshot_timestamp?: Long | null;

        /** GetNodeInfoResponse latest_node_announcement_broadcast_timestamp. */
        public latest_node_announcement_broadcast_timestamp?: Long | null;

        /** GetNodeInfoResponse listening_addresses. */
        public listening_addresses: string[];

        /** GetNodeInfoResponse announcement_addresses. */
        public announcement_addresses: string[];

        /** GetNodeInfoResponse node_alias. */
        public node_alias?: string | null;

        /** GetNodeInfoResponse node_uris. */
        public node_uris: string[];

        /** GetNodeInfoResponse network. */
        public network: types.Network;

        /**
         * Creates a new GetNodeInfoResponse instance using the specified properties.
         * @param [properties] Properties to set
         * @returns GetNodeInfoResponse instance
         */
        public static create(
            properties?: api.IGetNodeInfoResponse
        ): api.GetNodeInfoResponse;

        /**
         * Encodes the specified GetNodeInfoResponse message. Does not implicitly {@link api.GetNodeInfoResponse.verify|verify} messages.
         * @param message GetNodeInfoResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IGetNodeInfoResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified GetNodeInfoResponse message, length delimited. Does not implicitly {@link api.GetNodeInfoResponse.verify|verify} messages.
         * @param message GetNodeInfoResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IGetNodeInfoResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a GetNodeInfoResponse message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns GetNodeInfoResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.GetNodeInfoResponse;

        /**
         * Decodes a GetNodeInfoResponse message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns GetNodeInfoResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.GetNodeInfoResponse;

        /**
         * Verifies a GetNodeInfoResponse message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a GetNodeInfoResponse message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns GetNodeInfoResponse
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.GetNodeInfoResponse;

        /**
         * Creates a plain object from a GetNodeInfoResponse message. Also converts values to other types if specified.
         * @param message GetNodeInfoResponse
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.GetNodeInfoResponse,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this GetNodeInfoResponse to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for GetNodeInfoResponse
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of an OnchainReceiveRequest. */
    interface IOnchainReceiveRequest {}

    /** Represents an OnchainReceiveRequest. */
    class OnchainReceiveRequest implements IOnchainReceiveRequest {
        /**
         * Constructs a new OnchainReceiveRequest.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IOnchainReceiveRequest);

        /**
         * Creates a new OnchainReceiveRequest instance using the specified properties.
         * @param [properties] Properties to set
         * @returns OnchainReceiveRequest instance
         */
        public static create(
            properties?: api.IOnchainReceiveRequest
        ): api.OnchainReceiveRequest;

        /**
         * Encodes the specified OnchainReceiveRequest message. Does not implicitly {@link api.OnchainReceiveRequest.verify|verify} messages.
         * @param message OnchainReceiveRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IOnchainReceiveRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified OnchainReceiveRequest message, length delimited. Does not implicitly {@link api.OnchainReceiveRequest.verify|verify} messages.
         * @param message OnchainReceiveRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IOnchainReceiveRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes an OnchainReceiveRequest message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns OnchainReceiveRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.OnchainReceiveRequest;

        /**
         * Decodes an OnchainReceiveRequest message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns OnchainReceiveRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.OnchainReceiveRequest;

        /**
         * Verifies an OnchainReceiveRequest message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates an OnchainReceiveRequest message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns OnchainReceiveRequest
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.OnchainReceiveRequest;

        /**
         * Creates a plain object from an OnchainReceiveRequest message. Also converts values to other types if specified.
         * @param message OnchainReceiveRequest
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.OnchainReceiveRequest,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this OnchainReceiveRequest to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for OnchainReceiveRequest
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of an OnchainReceiveResponse. */
    interface IOnchainReceiveResponse {
        /** OnchainReceiveResponse address */
        address?: string | null;
    }

    /** Represents an OnchainReceiveResponse. */
    class OnchainReceiveResponse implements IOnchainReceiveResponse {
        /**
         * Constructs a new OnchainReceiveResponse.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IOnchainReceiveResponse);

        /** OnchainReceiveResponse address. */
        public address: string;

        /**
         * Creates a new OnchainReceiveResponse instance using the specified properties.
         * @param [properties] Properties to set
         * @returns OnchainReceiveResponse instance
         */
        public static create(
            properties?: api.IOnchainReceiveResponse
        ): api.OnchainReceiveResponse;

        /**
         * Encodes the specified OnchainReceiveResponse message. Does not implicitly {@link api.OnchainReceiveResponse.verify|verify} messages.
         * @param message OnchainReceiveResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IOnchainReceiveResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified OnchainReceiveResponse message, length delimited. Does not implicitly {@link api.OnchainReceiveResponse.verify|verify} messages.
         * @param message OnchainReceiveResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IOnchainReceiveResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes an OnchainReceiveResponse message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns OnchainReceiveResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.OnchainReceiveResponse;

        /**
         * Decodes an OnchainReceiveResponse message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns OnchainReceiveResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.OnchainReceiveResponse;

        /**
         * Verifies an OnchainReceiveResponse message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates an OnchainReceiveResponse message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns OnchainReceiveResponse
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.OnchainReceiveResponse;

        /**
         * Creates a plain object from an OnchainReceiveResponse message. Also converts values to other types if specified.
         * @param message OnchainReceiveResponse
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.OnchainReceiveResponse,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this OnchainReceiveResponse to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for OnchainReceiveResponse
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of an OnchainSendRequest. */
    interface IOnchainSendRequest {
        /** OnchainSendRequest address */
        address?: string | null;

        /** OnchainSendRequest amount_sats */
        amount_sats?: Long | null;

        /** OnchainSendRequest send_all */
        send_all?: boolean | null;

        /** OnchainSendRequest fee_rate_sat_per_vb */
        fee_rate_sat_per_vb?: Long | null;
    }

    /** Represents an OnchainSendRequest. */
    class OnchainSendRequest implements IOnchainSendRequest {
        /**
         * Constructs a new OnchainSendRequest.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IOnchainSendRequest);

        /** OnchainSendRequest address. */
        public address: string;

        /** OnchainSendRequest amount_sats. */
        public amount_sats?: Long | null;

        /** OnchainSendRequest send_all. */
        public send_all?: boolean | null;

        /** OnchainSendRequest fee_rate_sat_per_vb. */
        public fee_rate_sat_per_vb?: Long | null;

        /**
         * Creates a new OnchainSendRequest instance using the specified properties.
         * @param [properties] Properties to set
         * @returns OnchainSendRequest instance
         */
        public static create(
            properties?: api.IOnchainSendRequest
        ): api.OnchainSendRequest;

        /**
         * Encodes the specified OnchainSendRequest message. Does not implicitly {@link api.OnchainSendRequest.verify|verify} messages.
         * @param message OnchainSendRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IOnchainSendRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified OnchainSendRequest message, length delimited. Does not implicitly {@link api.OnchainSendRequest.verify|verify} messages.
         * @param message OnchainSendRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IOnchainSendRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes an OnchainSendRequest message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns OnchainSendRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.OnchainSendRequest;

        /**
         * Decodes an OnchainSendRequest message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns OnchainSendRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.OnchainSendRequest;

        /**
         * Verifies an OnchainSendRequest message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates an OnchainSendRequest message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns OnchainSendRequest
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.OnchainSendRequest;

        /**
         * Creates a plain object from an OnchainSendRequest message. Also converts values to other types if specified.
         * @param message OnchainSendRequest
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.OnchainSendRequest,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this OnchainSendRequest to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for OnchainSendRequest
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of an OnchainSendResponse. */
    interface IOnchainSendResponse {
        /** OnchainSendResponse txid */
        txid?: string | null;
    }

    /** Represents an OnchainSendResponse. */
    class OnchainSendResponse implements IOnchainSendResponse {
        /**
         * Constructs a new OnchainSendResponse.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IOnchainSendResponse);

        /** OnchainSendResponse txid. */
        public txid: string;

        /**
         * Creates a new OnchainSendResponse instance using the specified properties.
         * @param [properties] Properties to set
         * @returns OnchainSendResponse instance
         */
        public static create(
            properties?: api.IOnchainSendResponse
        ): api.OnchainSendResponse;

        /**
         * Encodes the specified OnchainSendResponse message. Does not implicitly {@link api.OnchainSendResponse.verify|verify} messages.
         * @param message OnchainSendResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IOnchainSendResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified OnchainSendResponse message, length delimited. Does not implicitly {@link api.OnchainSendResponse.verify|verify} messages.
         * @param message OnchainSendResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IOnchainSendResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes an OnchainSendResponse message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns OnchainSendResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.OnchainSendResponse;

        /**
         * Decodes an OnchainSendResponse message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns OnchainSendResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.OnchainSendResponse;

        /**
         * Verifies an OnchainSendResponse message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates an OnchainSendResponse message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns OnchainSendResponse
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.OnchainSendResponse;

        /**
         * Creates a plain object from an OnchainSendResponse message. Also converts values to other types if specified.
         * @param message OnchainSendResponse
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.OnchainSendResponse,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this OnchainSendResponse to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for OnchainSendResponse
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a Bolt11ReceiveRequest. */
    interface IBolt11ReceiveRequest {
        /** Bolt11ReceiveRequest amount_msat */
        amount_msat?: Long | null;

        /** Bolt11ReceiveRequest description */
        description?: types.IBolt11InvoiceDescription | null;

        /** Bolt11ReceiveRequest expiry_secs */
        expiry_secs?: number | null;
    }

    /** Represents a Bolt11ReceiveRequest. */
    class Bolt11ReceiveRequest implements IBolt11ReceiveRequest {
        /**
         * Constructs a new Bolt11ReceiveRequest.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IBolt11ReceiveRequest);

        /** Bolt11ReceiveRequest amount_msat. */
        public amount_msat?: Long | null;

        /** Bolt11ReceiveRequest description. */
        public description?: types.IBolt11InvoiceDescription | null;

        /** Bolt11ReceiveRequest expiry_secs. */
        public expiry_secs: number;

        /**
         * Creates a new Bolt11ReceiveRequest instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Bolt11ReceiveRequest instance
         */
        public static create(
            properties?: api.IBolt11ReceiveRequest
        ): api.Bolt11ReceiveRequest;

        /**
         * Encodes the specified Bolt11ReceiveRequest message. Does not implicitly {@link api.Bolt11ReceiveRequest.verify|verify} messages.
         * @param message Bolt11ReceiveRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IBolt11ReceiveRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified Bolt11ReceiveRequest message, length delimited. Does not implicitly {@link api.Bolt11ReceiveRequest.verify|verify} messages.
         * @param message Bolt11ReceiveRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IBolt11ReceiveRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a Bolt11ReceiveRequest message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Bolt11ReceiveRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.Bolt11ReceiveRequest;

        /**
         * Decodes a Bolt11ReceiveRequest message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Bolt11ReceiveRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.Bolt11ReceiveRequest;

        /**
         * Verifies a Bolt11ReceiveRequest message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a Bolt11ReceiveRequest message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Bolt11ReceiveRequest
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.Bolt11ReceiveRequest;

        /**
         * Creates a plain object from a Bolt11ReceiveRequest message. Also converts values to other types if specified.
         * @param message Bolt11ReceiveRequest
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.Bolt11ReceiveRequest,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this Bolt11ReceiveRequest to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Bolt11ReceiveRequest
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a Bolt11ReceiveResponse. */
    interface IBolt11ReceiveResponse {
        /** Bolt11ReceiveResponse invoice */
        invoice?: string | null;

        /** Bolt11ReceiveResponse payment_hash */
        payment_hash?: string | null;

        /** Bolt11ReceiveResponse payment_secret */
        payment_secret?: string | null;
    }

    /** Represents a Bolt11ReceiveResponse. */
    class Bolt11ReceiveResponse implements IBolt11ReceiveResponse {
        /**
         * Constructs a new Bolt11ReceiveResponse.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IBolt11ReceiveResponse);

        /** Bolt11ReceiveResponse invoice. */
        public invoice: string;

        /** Bolt11ReceiveResponse payment_hash. */
        public payment_hash: string;

        /** Bolt11ReceiveResponse payment_secret. */
        public payment_secret: string;

        /**
         * Creates a new Bolt11ReceiveResponse instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Bolt11ReceiveResponse instance
         */
        public static create(
            properties?: api.IBolt11ReceiveResponse
        ): api.Bolt11ReceiveResponse;

        /**
         * Encodes the specified Bolt11ReceiveResponse message. Does not implicitly {@link api.Bolt11ReceiveResponse.verify|verify} messages.
         * @param message Bolt11ReceiveResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IBolt11ReceiveResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified Bolt11ReceiveResponse message, length delimited. Does not implicitly {@link api.Bolt11ReceiveResponse.verify|verify} messages.
         * @param message Bolt11ReceiveResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IBolt11ReceiveResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a Bolt11ReceiveResponse message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Bolt11ReceiveResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.Bolt11ReceiveResponse;

        /**
         * Decodes a Bolt11ReceiveResponse message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Bolt11ReceiveResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.Bolt11ReceiveResponse;

        /**
         * Verifies a Bolt11ReceiveResponse message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a Bolt11ReceiveResponse message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Bolt11ReceiveResponse
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.Bolt11ReceiveResponse;

        /**
         * Creates a plain object from a Bolt11ReceiveResponse message. Also converts values to other types if specified.
         * @param message Bolt11ReceiveResponse
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.Bolt11ReceiveResponse,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this Bolt11ReceiveResponse to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Bolt11ReceiveResponse
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a Bolt11ReceiveForHashRequest. */
    interface IBolt11ReceiveForHashRequest {
        /** Bolt11ReceiveForHashRequest amount_msat */
        amount_msat?: Long | null;

        /** Bolt11ReceiveForHashRequest description */
        description?: types.IBolt11InvoiceDescription | null;

        /** Bolt11ReceiveForHashRequest expiry_secs */
        expiry_secs?: number | null;

        /** Bolt11ReceiveForHashRequest payment_hash */
        payment_hash?: string | null;
    }

    /** Represents a Bolt11ReceiveForHashRequest. */
    class Bolt11ReceiveForHashRequest implements IBolt11ReceiveForHashRequest {
        /**
         * Constructs a new Bolt11ReceiveForHashRequest.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IBolt11ReceiveForHashRequest);

        /** Bolt11ReceiveForHashRequest amount_msat. */
        public amount_msat?: Long | null;

        /** Bolt11ReceiveForHashRequest description. */
        public description?: types.IBolt11InvoiceDescription | null;

        /** Bolt11ReceiveForHashRequest expiry_secs. */
        public expiry_secs: number;

        /** Bolt11ReceiveForHashRequest payment_hash. */
        public payment_hash: string;

        /**
         * Creates a new Bolt11ReceiveForHashRequest instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Bolt11ReceiveForHashRequest instance
         */
        public static create(
            properties?: api.IBolt11ReceiveForHashRequest
        ): api.Bolt11ReceiveForHashRequest;

        /**
         * Encodes the specified Bolt11ReceiveForHashRequest message. Does not implicitly {@link api.Bolt11ReceiveForHashRequest.verify|verify} messages.
         * @param message Bolt11ReceiveForHashRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IBolt11ReceiveForHashRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified Bolt11ReceiveForHashRequest message, length delimited. Does not implicitly {@link api.Bolt11ReceiveForHashRequest.verify|verify} messages.
         * @param message Bolt11ReceiveForHashRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IBolt11ReceiveForHashRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a Bolt11ReceiveForHashRequest message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Bolt11ReceiveForHashRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.Bolt11ReceiveForHashRequest;

        /**
         * Decodes a Bolt11ReceiveForHashRequest message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Bolt11ReceiveForHashRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.Bolt11ReceiveForHashRequest;

        /**
         * Verifies a Bolt11ReceiveForHashRequest message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a Bolt11ReceiveForHashRequest message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Bolt11ReceiveForHashRequest
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.Bolt11ReceiveForHashRequest;

        /**
         * Creates a plain object from a Bolt11ReceiveForHashRequest message. Also converts values to other types if specified.
         * @param message Bolt11ReceiveForHashRequest
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.Bolt11ReceiveForHashRequest,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this Bolt11ReceiveForHashRequest to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Bolt11ReceiveForHashRequest
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a Bolt11ReceiveForHashResponse. */
    interface IBolt11ReceiveForHashResponse {
        /** Bolt11ReceiveForHashResponse invoice */
        invoice?: string | null;
    }

    /** Represents a Bolt11ReceiveForHashResponse. */
    class Bolt11ReceiveForHashResponse
        implements IBolt11ReceiveForHashResponse
    {
        /**
         * Constructs a new Bolt11ReceiveForHashResponse.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IBolt11ReceiveForHashResponse);

        /** Bolt11ReceiveForHashResponse invoice. */
        public invoice: string;

        /**
         * Creates a new Bolt11ReceiveForHashResponse instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Bolt11ReceiveForHashResponse instance
         */
        public static create(
            properties?: api.IBolt11ReceiveForHashResponse
        ): api.Bolt11ReceiveForHashResponse;

        /**
         * Encodes the specified Bolt11ReceiveForHashResponse message. Does not implicitly {@link api.Bolt11ReceiveForHashResponse.verify|verify} messages.
         * @param message Bolt11ReceiveForHashResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IBolt11ReceiveForHashResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified Bolt11ReceiveForHashResponse message, length delimited. Does not implicitly {@link api.Bolt11ReceiveForHashResponse.verify|verify} messages.
         * @param message Bolt11ReceiveForHashResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IBolt11ReceiveForHashResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a Bolt11ReceiveForHashResponse message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Bolt11ReceiveForHashResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.Bolt11ReceiveForHashResponse;

        /**
         * Decodes a Bolt11ReceiveForHashResponse message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Bolt11ReceiveForHashResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.Bolt11ReceiveForHashResponse;

        /**
         * Verifies a Bolt11ReceiveForHashResponse message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a Bolt11ReceiveForHashResponse message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Bolt11ReceiveForHashResponse
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.Bolt11ReceiveForHashResponse;

        /**
         * Creates a plain object from a Bolt11ReceiveForHashResponse message. Also converts values to other types if specified.
         * @param message Bolt11ReceiveForHashResponse
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.Bolt11ReceiveForHashResponse,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this Bolt11ReceiveForHashResponse to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Bolt11ReceiveForHashResponse
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a Bolt11ClaimForHashRequest. */
    interface IBolt11ClaimForHashRequest {
        /** Bolt11ClaimForHashRequest payment_hash */
        payment_hash?: string | null;

        /** Bolt11ClaimForHashRequest claimable_amount_msat */
        claimable_amount_msat?: Long | null;

        /** Bolt11ClaimForHashRequest preimage */
        preimage?: string | null;
    }

    /** Represents a Bolt11ClaimForHashRequest. */
    class Bolt11ClaimForHashRequest implements IBolt11ClaimForHashRequest {
        /**
         * Constructs a new Bolt11ClaimForHashRequest.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IBolt11ClaimForHashRequest);

        /** Bolt11ClaimForHashRequest payment_hash. */
        public payment_hash?: string | null;

        /** Bolt11ClaimForHashRequest claimable_amount_msat. */
        public claimable_amount_msat?: Long | null;

        /** Bolt11ClaimForHashRequest preimage. */
        public preimage: string;

        /**
         * Creates a new Bolt11ClaimForHashRequest instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Bolt11ClaimForHashRequest instance
         */
        public static create(
            properties?: api.IBolt11ClaimForHashRequest
        ): api.Bolt11ClaimForHashRequest;

        /**
         * Encodes the specified Bolt11ClaimForHashRequest message. Does not implicitly {@link api.Bolt11ClaimForHashRequest.verify|verify} messages.
         * @param message Bolt11ClaimForHashRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IBolt11ClaimForHashRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified Bolt11ClaimForHashRequest message, length delimited. Does not implicitly {@link api.Bolt11ClaimForHashRequest.verify|verify} messages.
         * @param message Bolt11ClaimForHashRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IBolt11ClaimForHashRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a Bolt11ClaimForHashRequest message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Bolt11ClaimForHashRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.Bolt11ClaimForHashRequest;

        /**
         * Decodes a Bolt11ClaimForHashRequest message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Bolt11ClaimForHashRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.Bolt11ClaimForHashRequest;

        /**
         * Verifies a Bolt11ClaimForHashRequest message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a Bolt11ClaimForHashRequest message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Bolt11ClaimForHashRequest
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.Bolt11ClaimForHashRequest;

        /**
         * Creates a plain object from a Bolt11ClaimForHashRequest message. Also converts values to other types if specified.
         * @param message Bolt11ClaimForHashRequest
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.Bolt11ClaimForHashRequest,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this Bolt11ClaimForHashRequest to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Bolt11ClaimForHashRequest
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a Bolt11ClaimForHashResponse. */
    interface IBolt11ClaimForHashResponse {}

    /** Represents a Bolt11ClaimForHashResponse. */
    class Bolt11ClaimForHashResponse implements IBolt11ClaimForHashResponse {
        /**
         * Constructs a new Bolt11ClaimForHashResponse.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IBolt11ClaimForHashResponse);

        /**
         * Creates a new Bolt11ClaimForHashResponse instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Bolt11ClaimForHashResponse instance
         */
        public static create(
            properties?: api.IBolt11ClaimForHashResponse
        ): api.Bolt11ClaimForHashResponse;

        /**
         * Encodes the specified Bolt11ClaimForHashResponse message. Does not implicitly {@link api.Bolt11ClaimForHashResponse.verify|verify} messages.
         * @param message Bolt11ClaimForHashResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IBolt11ClaimForHashResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified Bolt11ClaimForHashResponse message, length delimited. Does not implicitly {@link api.Bolt11ClaimForHashResponse.verify|verify} messages.
         * @param message Bolt11ClaimForHashResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IBolt11ClaimForHashResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a Bolt11ClaimForHashResponse message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Bolt11ClaimForHashResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.Bolt11ClaimForHashResponse;

        /**
         * Decodes a Bolt11ClaimForHashResponse message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Bolt11ClaimForHashResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.Bolt11ClaimForHashResponse;

        /**
         * Verifies a Bolt11ClaimForHashResponse message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a Bolt11ClaimForHashResponse message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Bolt11ClaimForHashResponse
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.Bolt11ClaimForHashResponse;

        /**
         * Creates a plain object from a Bolt11ClaimForHashResponse message. Also converts values to other types if specified.
         * @param message Bolt11ClaimForHashResponse
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.Bolt11ClaimForHashResponse,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this Bolt11ClaimForHashResponse to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Bolt11ClaimForHashResponse
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a Bolt11FailForHashRequest. */
    interface IBolt11FailForHashRequest {
        /** Bolt11FailForHashRequest payment_hash */
        payment_hash?: string | null;
    }

    /** Represents a Bolt11FailForHashRequest. */
    class Bolt11FailForHashRequest implements IBolt11FailForHashRequest {
        /**
         * Constructs a new Bolt11FailForHashRequest.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IBolt11FailForHashRequest);

        /** Bolt11FailForHashRequest payment_hash. */
        public payment_hash: string;

        /**
         * Creates a new Bolt11FailForHashRequest instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Bolt11FailForHashRequest instance
         */
        public static create(
            properties?: api.IBolt11FailForHashRequest
        ): api.Bolt11FailForHashRequest;

        /**
         * Encodes the specified Bolt11FailForHashRequest message. Does not implicitly {@link api.Bolt11FailForHashRequest.verify|verify} messages.
         * @param message Bolt11FailForHashRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IBolt11FailForHashRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified Bolt11FailForHashRequest message, length delimited. Does not implicitly {@link api.Bolt11FailForHashRequest.verify|verify} messages.
         * @param message Bolt11FailForHashRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IBolt11FailForHashRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a Bolt11FailForHashRequest message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Bolt11FailForHashRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.Bolt11FailForHashRequest;

        /**
         * Decodes a Bolt11FailForHashRequest message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Bolt11FailForHashRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.Bolt11FailForHashRequest;

        /**
         * Verifies a Bolt11FailForHashRequest message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a Bolt11FailForHashRequest message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Bolt11FailForHashRequest
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.Bolt11FailForHashRequest;

        /**
         * Creates a plain object from a Bolt11FailForHashRequest message. Also converts values to other types if specified.
         * @param message Bolt11FailForHashRequest
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.Bolt11FailForHashRequest,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this Bolt11FailForHashRequest to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Bolt11FailForHashRequest
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a Bolt11FailForHashResponse. */
    interface IBolt11FailForHashResponse {}

    /** Represents a Bolt11FailForHashResponse. */
    class Bolt11FailForHashResponse implements IBolt11FailForHashResponse {
        /**
         * Constructs a new Bolt11FailForHashResponse.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IBolt11FailForHashResponse);

        /**
         * Creates a new Bolt11FailForHashResponse instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Bolt11FailForHashResponse instance
         */
        public static create(
            properties?: api.IBolt11FailForHashResponse
        ): api.Bolt11FailForHashResponse;

        /**
         * Encodes the specified Bolt11FailForHashResponse message. Does not implicitly {@link api.Bolt11FailForHashResponse.verify|verify} messages.
         * @param message Bolt11FailForHashResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IBolt11FailForHashResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified Bolt11FailForHashResponse message, length delimited. Does not implicitly {@link api.Bolt11FailForHashResponse.verify|verify} messages.
         * @param message Bolt11FailForHashResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IBolt11FailForHashResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a Bolt11FailForHashResponse message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Bolt11FailForHashResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.Bolt11FailForHashResponse;

        /**
         * Decodes a Bolt11FailForHashResponse message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Bolt11FailForHashResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.Bolt11FailForHashResponse;

        /**
         * Verifies a Bolt11FailForHashResponse message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a Bolt11FailForHashResponse message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Bolt11FailForHashResponse
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.Bolt11FailForHashResponse;

        /**
         * Creates a plain object from a Bolt11FailForHashResponse message. Also converts values to other types if specified.
         * @param message Bolt11FailForHashResponse
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.Bolt11FailForHashResponse,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this Bolt11FailForHashResponse to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Bolt11FailForHashResponse
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a Bolt11ReceiveViaJitChannelRequest. */
    interface IBolt11ReceiveViaJitChannelRequest {
        /** Bolt11ReceiveViaJitChannelRequest amount_msat */
        amount_msat?: Long | null;

        /** Bolt11ReceiveViaJitChannelRequest description */
        description?: types.IBolt11InvoiceDescription | null;

        /** Bolt11ReceiveViaJitChannelRequest expiry_secs */
        expiry_secs?: number | null;

        /** Bolt11ReceiveViaJitChannelRequest max_total_lsp_fee_limit_msat */
        max_total_lsp_fee_limit_msat?: Long | null;
    }

    /** Represents a Bolt11ReceiveViaJitChannelRequest. */
    class Bolt11ReceiveViaJitChannelRequest
        implements IBolt11ReceiveViaJitChannelRequest
    {
        /**
         * Constructs a new Bolt11ReceiveViaJitChannelRequest.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IBolt11ReceiveViaJitChannelRequest);

        /** Bolt11ReceiveViaJitChannelRequest amount_msat. */
        public amount_msat: Long;

        /** Bolt11ReceiveViaJitChannelRequest description. */
        public description?: types.IBolt11InvoiceDescription | null;

        /** Bolt11ReceiveViaJitChannelRequest expiry_secs. */
        public expiry_secs: number;

        /** Bolt11ReceiveViaJitChannelRequest max_total_lsp_fee_limit_msat. */
        public max_total_lsp_fee_limit_msat?: Long | null;

        /**
         * Creates a new Bolt11ReceiveViaJitChannelRequest instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Bolt11ReceiveViaJitChannelRequest instance
         */
        public static create(
            properties?: api.IBolt11ReceiveViaJitChannelRequest
        ): api.Bolt11ReceiveViaJitChannelRequest;

        /**
         * Encodes the specified Bolt11ReceiveViaJitChannelRequest message. Does not implicitly {@link api.Bolt11ReceiveViaJitChannelRequest.verify|verify} messages.
         * @param message Bolt11ReceiveViaJitChannelRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IBolt11ReceiveViaJitChannelRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified Bolt11ReceiveViaJitChannelRequest message, length delimited. Does not implicitly {@link api.Bolt11ReceiveViaJitChannelRequest.verify|verify} messages.
         * @param message Bolt11ReceiveViaJitChannelRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IBolt11ReceiveViaJitChannelRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a Bolt11ReceiveViaJitChannelRequest message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Bolt11ReceiveViaJitChannelRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.Bolt11ReceiveViaJitChannelRequest;

        /**
         * Decodes a Bolt11ReceiveViaJitChannelRequest message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Bolt11ReceiveViaJitChannelRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.Bolt11ReceiveViaJitChannelRequest;

        /**
         * Verifies a Bolt11ReceiveViaJitChannelRequest message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a Bolt11ReceiveViaJitChannelRequest message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Bolt11ReceiveViaJitChannelRequest
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.Bolt11ReceiveViaJitChannelRequest;

        /**
         * Creates a plain object from a Bolt11ReceiveViaJitChannelRequest message. Also converts values to other types if specified.
         * @param message Bolt11ReceiveViaJitChannelRequest
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.Bolt11ReceiveViaJitChannelRequest,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this Bolt11ReceiveViaJitChannelRequest to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Bolt11ReceiveViaJitChannelRequest
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a Bolt11ReceiveViaJitChannelResponse. */
    interface IBolt11ReceiveViaJitChannelResponse {
        /** Bolt11ReceiveViaJitChannelResponse invoice */
        invoice?: string | null;
    }

    /** Represents a Bolt11ReceiveViaJitChannelResponse. */
    class Bolt11ReceiveViaJitChannelResponse
        implements IBolt11ReceiveViaJitChannelResponse
    {
        /**
         * Constructs a new Bolt11ReceiveViaJitChannelResponse.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IBolt11ReceiveViaJitChannelResponse);

        /** Bolt11ReceiveViaJitChannelResponse invoice. */
        public invoice: string;

        /**
         * Creates a new Bolt11ReceiveViaJitChannelResponse instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Bolt11ReceiveViaJitChannelResponse instance
         */
        public static create(
            properties?: api.IBolt11ReceiveViaJitChannelResponse
        ): api.Bolt11ReceiveViaJitChannelResponse;

        /**
         * Encodes the specified Bolt11ReceiveViaJitChannelResponse message. Does not implicitly {@link api.Bolt11ReceiveViaJitChannelResponse.verify|verify} messages.
         * @param message Bolt11ReceiveViaJitChannelResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IBolt11ReceiveViaJitChannelResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified Bolt11ReceiveViaJitChannelResponse message, length delimited. Does not implicitly {@link api.Bolt11ReceiveViaJitChannelResponse.verify|verify} messages.
         * @param message Bolt11ReceiveViaJitChannelResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IBolt11ReceiveViaJitChannelResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a Bolt11ReceiveViaJitChannelResponse message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Bolt11ReceiveViaJitChannelResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.Bolt11ReceiveViaJitChannelResponse;

        /**
         * Decodes a Bolt11ReceiveViaJitChannelResponse message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Bolt11ReceiveViaJitChannelResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.Bolt11ReceiveViaJitChannelResponse;

        /**
         * Verifies a Bolt11ReceiveViaJitChannelResponse message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a Bolt11ReceiveViaJitChannelResponse message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Bolt11ReceiveViaJitChannelResponse
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.Bolt11ReceiveViaJitChannelResponse;

        /**
         * Creates a plain object from a Bolt11ReceiveViaJitChannelResponse message. Also converts values to other types if specified.
         * @param message Bolt11ReceiveViaJitChannelResponse
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.Bolt11ReceiveViaJitChannelResponse,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this Bolt11ReceiveViaJitChannelResponse to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Bolt11ReceiveViaJitChannelResponse
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a Bolt11ReceiveVariableAmountViaJitChannelRequest. */
    interface IBolt11ReceiveVariableAmountViaJitChannelRequest {
        /** Bolt11ReceiveVariableAmountViaJitChannelRequest description */
        description?: types.IBolt11InvoiceDescription | null;

        /** Bolt11ReceiveVariableAmountViaJitChannelRequest expiry_secs */
        expiry_secs?: number | null;

        /** Bolt11ReceiveVariableAmountViaJitChannelRequest max_proportional_lsp_fee_limit_ppm_msat */
        max_proportional_lsp_fee_limit_ppm_msat?: Long | null;
    }

    /** Represents a Bolt11ReceiveVariableAmountViaJitChannelRequest. */
    class Bolt11ReceiveVariableAmountViaJitChannelRequest
        implements IBolt11ReceiveVariableAmountViaJitChannelRequest
    {
        /**
         * Constructs a new Bolt11ReceiveVariableAmountViaJitChannelRequest.
         * @param [properties] Properties to set
         */
        constructor(
            properties?: api.IBolt11ReceiveVariableAmountViaJitChannelRequest
        );

        /** Bolt11ReceiveVariableAmountViaJitChannelRequest description. */
        public description?: types.IBolt11InvoiceDescription | null;

        /** Bolt11ReceiveVariableAmountViaJitChannelRequest expiry_secs. */
        public expiry_secs: number;

        /** Bolt11ReceiveVariableAmountViaJitChannelRequest max_proportional_lsp_fee_limit_ppm_msat. */
        public max_proportional_lsp_fee_limit_ppm_msat?: Long | null;

        /**
         * Creates a new Bolt11ReceiveVariableAmountViaJitChannelRequest instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Bolt11ReceiveVariableAmountViaJitChannelRequest instance
         */
        public static create(
            properties?: api.IBolt11ReceiveVariableAmountViaJitChannelRequest
        ): api.Bolt11ReceiveVariableAmountViaJitChannelRequest;

        /**
         * Encodes the specified Bolt11ReceiveVariableAmountViaJitChannelRequest message. Does not implicitly {@link api.Bolt11ReceiveVariableAmountViaJitChannelRequest.verify|verify} messages.
         * @param message Bolt11ReceiveVariableAmountViaJitChannelRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IBolt11ReceiveVariableAmountViaJitChannelRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified Bolt11ReceiveVariableAmountViaJitChannelRequest message, length delimited. Does not implicitly {@link api.Bolt11ReceiveVariableAmountViaJitChannelRequest.verify|verify} messages.
         * @param message Bolt11ReceiveVariableAmountViaJitChannelRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IBolt11ReceiveVariableAmountViaJitChannelRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a Bolt11ReceiveVariableAmountViaJitChannelRequest message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Bolt11ReceiveVariableAmountViaJitChannelRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.Bolt11ReceiveVariableAmountViaJitChannelRequest;

        /**
         * Decodes a Bolt11ReceiveVariableAmountViaJitChannelRequest message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Bolt11ReceiveVariableAmountViaJitChannelRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.Bolt11ReceiveVariableAmountViaJitChannelRequest;

        /**
         * Verifies a Bolt11ReceiveVariableAmountViaJitChannelRequest message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a Bolt11ReceiveVariableAmountViaJitChannelRequest message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Bolt11ReceiveVariableAmountViaJitChannelRequest
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.Bolt11ReceiveVariableAmountViaJitChannelRequest;

        /**
         * Creates a plain object from a Bolt11ReceiveVariableAmountViaJitChannelRequest message. Also converts values to other types if specified.
         * @param message Bolt11ReceiveVariableAmountViaJitChannelRequest
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.Bolt11ReceiveVariableAmountViaJitChannelRequest,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this Bolt11ReceiveVariableAmountViaJitChannelRequest to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Bolt11ReceiveVariableAmountViaJitChannelRequest
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a Bolt11ReceiveVariableAmountViaJitChannelResponse. */
    interface IBolt11ReceiveVariableAmountViaJitChannelResponse {
        /** Bolt11ReceiveVariableAmountViaJitChannelResponse invoice */
        invoice?: string | null;
    }

    /** Represents a Bolt11ReceiveVariableAmountViaJitChannelResponse. */
    class Bolt11ReceiveVariableAmountViaJitChannelResponse
        implements IBolt11ReceiveVariableAmountViaJitChannelResponse
    {
        /**
         * Constructs a new Bolt11ReceiveVariableAmountViaJitChannelResponse.
         * @param [properties] Properties to set
         */
        constructor(
            properties?: api.IBolt11ReceiveVariableAmountViaJitChannelResponse
        );

        /** Bolt11ReceiveVariableAmountViaJitChannelResponse invoice. */
        public invoice: string;

        /**
         * Creates a new Bolt11ReceiveVariableAmountViaJitChannelResponse instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Bolt11ReceiveVariableAmountViaJitChannelResponse instance
         */
        public static create(
            properties?: api.IBolt11ReceiveVariableAmountViaJitChannelResponse
        ): api.Bolt11ReceiveVariableAmountViaJitChannelResponse;

        /**
         * Encodes the specified Bolt11ReceiveVariableAmountViaJitChannelResponse message. Does not implicitly {@link api.Bolt11ReceiveVariableAmountViaJitChannelResponse.verify|verify} messages.
         * @param message Bolt11ReceiveVariableAmountViaJitChannelResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IBolt11ReceiveVariableAmountViaJitChannelResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified Bolt11ReceiveVariableAmountViaJitChannelResponse message, length delimited. Does not implicitly {@link api.Bolt11ReceiveVariableAmountViaJitChannelResponse.verify|verify} messages.
         * @param message Bolt11ReceiveVariableAmountViaJitChannelResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IBolt11ReceiveVariableAmountViaJitChannelResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a Bolt11ReceiveVariableAmountViaJitChannelResponse message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Bolt11ReceiveVariableAmountViaJitChannelResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.Bolt11ReceiveVariableAmountViaJitChannelResponse;

        /**
         * Decodes a Bolt11ReceiveVariableAmountViaJitChannelResponse message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Bolt11ReceiveVariableAmountViaJitChannelResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.Bolt11ReceiveVariableAmountViaJitChannelResponse;

        /**
         * Verifies a Bolt11ReceiveVariableAmountViaJitChannelResponse message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a Bolt11ReceiveVariableAmountViaJitChannelResponse message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Bolt11ReceiveVariableAmountViaJitChannelResponse
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.Bolt11ReceiveVariableAmountViaJitChannelResponse;

        /**
         * Creates a plain object from a Bolt11ReceiveVariableAmountViaJitChannelResponse message. Also converts values to other types if specified.
         * @param message Bolt11ReceiveVariableAmountViaJitChannelResponse
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.Bolt11ReceiveVariableAmountViaJitChannelResponse,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this Bolt11ReceiveVariableAmountViaJitChannelResponse to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Bolt11ReceiveVariableAmountViaJitChannelResponse
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a Bolt11SendRequest. */
    interface IBolt11SendRequest {
        /** Bolt11SendRequest invoice */
        invoice?: string | null;

        /** Bolt11SendRequest amount_msat */
        amount_msat?: Long | null;

        /** Bolt11SendRequest route_parameters */
        route_parameters?: types.IRouteParametersConfig | null;
    }

    /** Represents a Bolt11SendRequest. */
    class Bolt11SendRequest implements IBolt11SendRequest {
        /**
         * Constructs a new Bolt11SendRequest.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IBolt11SendRequest);

        /** Bolt11SendRequest invoice. */
        public invoice: string;

        /** Bolt11SendRequest amount_msat. */
        public amount_msat?: Long | null;

        /** Bolt11SendRequest route_parameters. */
        public route_parameters?: types.IRouteParametersConfig | null;

        /**
         * Creates a new Bolt11SendRequest instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Bolt11SendRequest instance
         */
        public static create(
            properties?: api.IBolt11SendRequest
        ): api.Bolt11SendRequest;

        /**
         * Encodes the specified Bolt11SendRequest message. Does not implicitly {@link api.Bolt11SendRequest.verify|verify} messages.
         * @param message Bolt11SendRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IBolt11SendRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified Bolt11SendRequest message, length delimited. Does not implicitly {@link api.Bolt11SendRequest.verify|verify} messages.
         * @param message Bolt11SendRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IBolt11SendRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a Bolt11SendRequest message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Bolt11SendRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.Bolt11SendRequest;

        /**
         * Decodes a Bolt11SendRequest message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Bolt11SendRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.Bolt11SendRequest;

        /**
         * Verifies a Bolt11SendRequest message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a Bolt11SendRequest message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Bolt11SendRequest
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.Bolt11SendRequest;

        /**
         * Creates a plain object from a Bolt11SendRequest message. Also converts values to other types if specified.
         * @param message Bolt11SendRequest
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.Bolt11SendRequest,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this Bolt11SendRequest to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Bolt11SendRequest
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a Bolt11SendResponse. */
    interface IBolt11SendResponse {
        /** Bolt11SendResponse payment_id */
        payment_id?: string | null;
    }

    /** Represents a Bolt11SendResponse. */
    class Bolt11SendResponse implements IBolt11SendResponse {
        /**
         * Constructs a new Bolt11SendResponse.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IBolt11SendResponse);

        /** Bolt11SendResponse payment_id. */
        public payment_id: string;

        /**
         * Creates a new Bolt11SendResponse instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Bolt11SendResponse instance
         */
        public static create(
            properties?: api.IBolt11SendResponse
        ): api.Bolt11SendResponse;

        /**
         * Encodes the specified Bolt11SendResponse message. Does not implicitly {@link api.Bolt11SendResponse.verify|verify} messages.
         * @param message Bolt11SendResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IBolt11SendResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified Bolt11SendResponse message, length delimited. Does not implicitly {@link api.Bolt11SendResponse.verify|verify} messages.
         * @param message Bolt11SendResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IBolt11SendResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a Bolt11SendResponse message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Bolt11SendResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.Bolt11SendResponse;

        /**
         * Decodes a Bolt11SendResponse message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Bolt11SendResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.Bolt11SendResponse;

        /**
         * Verifies a Bolt11SendResponse message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a Bolt11SendResponse message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Bolt11SendResponse
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.Bolt11SendResponse;

        /**
         * Creates a plain object from a Bolt11SendResponse message. Also converts values to other types if specified.
         * @param message Bolt11SendResponse
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.Bolt11SendResponse,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this Bolt11SendResponse to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Bolt11SendResponse
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a Bolt12ReceiveRequest. */
    interface IBolt12ReceiveRequest {
        /** Bolt12ReceiveRequest description */
        description?: string | null;

        /** Bolt12ReceiveRequest amount_msat */
        amount_msat?: Long | null;

        /** Bolt12ReceiveRequest expiry_secs */
        expiry_secs?: number | null;

        /** Bolt12ReceiveRequest quantity */
        quantity?: Long | null;
    }

    /** Represents a Bolt12ReceiveRequest. */
    class Bolt12ReceiveRequest implements IBolt12ReceiveRequest {
        /**
         * Constructs a new Bolt12ReceiveRequest.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IBolt12ReceiveRequest);

        /** Bolt12ReceiveRequest description. */
        public description: string;

        /** Bolt12ReceiveRequest amount_msat. */
        public amount_msat?: Long | null;

        /** Bolt12ReceiveRequest expiry_secs. */
        public expiry_secs?: number | null;

        /** Bolt12ReceiveRequest quantity. */
        public quantity?: Long | null;

        /**
         * Creates a new Bolt12ReceiveRequest instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Bolt12ReceiveRequest instance
         */
        public static create(
            properties?: api.IBolt12ReceiveRequest
        ): api.Bolt12ReceiveRequest;

        /**
         * Encodes the specified Bolt12ReceiveRequest message. Does not implicitly {@link api.Bolt12ReceiveRequest.verify|verify} messages.
         * @param message Bolt12ReceiveRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IBolt12ReceiveRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified Bolt12ReceiveRequest message, length delimited. Does not implicitly {@link api.Bolt12ReceiveRequest.verify|verify} messages.
         * @param message Bolt12ReceiveRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IBolt12ReceiveRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a Bolt12ReceiveRequest message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Bolt12ReceiveRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.Bolt12ReceiveRequest;

        /**
         * Decodes a Bolt12ReceiveRequest message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Bolt12ReceiveRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.Bolt12ReceiveRequest;

        /**
         * Verifies a Bolt12ReceiveRequest message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a Bolt12ReceiveRequest message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Bolt12ReceiveRequest
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.Bolt12ReceiveRequest;

        /**
         * Creates a plain object from a Bolt12ReceiveRequest message. Also converts values to other types if specified.
         * @param message Bolt12ReceiveRequest
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.Bolt12ReceiveRequest,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this Bolt12ReceiveRequest to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Bolt12ReceiveRequest
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a Bolt12ReceiveResponse. */
    interface IBolt12ReceiveResponse {
        /** Bolt12ReceiveResponse offer */
        offer?: string | null;

        /** Bolt12ReceiveResponse offer_id */
        offer_id?: string | null;
    }

    /** Represents a Bolt12ReceiveResponse. */
    class Bolt12ReceiveResponse implements IBolt12ReceiveResponse {
        /**
         * Constructs a new Bolt12ReceiveResponse.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IBolt12ReceiveResponse);

        /** Bolt12ReceiveResponse offer. */
        public offer: string;

        /** Bolt12ReceiveResponse offer_id. */
        public offer_id: string;

        /**
         * Creates a new Bolt12ReceiveResponse instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Bolt12ReceiveResponse instance
         */
        public static create(
            properties?: api.IBolt12ReceiveResponse
        ): api.Bolt12ReceiveResponse;

        /**
         * Encodes the specified Bolt12ReceiveResponse message. Does not implicitly {@link api.Bolt12ReceiveResponse.verify|verify} messages.
         * @param message Bolt12ReceiveResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IBolt12ReceiveResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified Bolt12ReceiveResponse message, length delimited. Does not implicitly {@link api.Bolt12ReceiveResponse.verify|verify} messages.
         * @param message Bolt12ReceiveResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IBolt12ReceiveResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a Bolt12ReceiveResponse message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Bolt12ReceiveResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.Bolt12ReceiveResponse;

        /**
         * Decodes a Bolt12ReceiveResponse message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Bolt12ReceiveResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.Bolt12ReceiveResponse;

        /**
         * Verifies a Bolt12ReceiveResponse message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a Bolt12ReceiveResponse message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Bolt12ReceiveResponse
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.Bolt12ReceiveResponse;

        /**
         * Creates a plain object from a Bolt12ReceiveResponse message. Also converts values to other types if specified.
         * @param message Bolt12ReceiveResponse
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.Bolt12ReceiveResponse,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this Bolt12ReceiveResponse to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Bolt12ReceiveResponse
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a Bolt12SendRequest. */
    interface IBolt12SendRequest {
        /** Bolt12SendRequest offer */
        offer?: string | null;

        /** Bolt12SendRequest amount_msat */
        amount_msat?: Long | null;

        /** Bolt12SendRequest quantity */
        quantity?: Long | null;

        /** Bolt12SendRequest payer_note */
        payer_note?: string | null;

        /** Bolt12SendRequest route_parameters */
        route_parameters?: types.IRouteParametersConfig | null;
    }

    /** Represents a Bolt12SendRequest. */
    class Bolt12SendRequest implements IBolt12SendRequest {
        /**
         * Constructs a new Bolt12SendRequest.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IBolt12SendRequest);

        /** Bolt12SendRequest offer. */
        public offer: string;

        /** Bolt12SendRequest amount_msat. */
        public amount_msat?: Long | null;

        /** Bolt12SendRequest quantity. */
        public quantity?: Long | null;

        /** Bolt12SendRequest payer_note. */
        public payer_note?: string | null;

        /** Bolt12SendRequest route_parameters. */
        public route_parameters?: types.IRouteParametersConfig | null;

        /**
         * Creates a new Bolt12SendRequest instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Bolt12SendRequest instance
         */
        public static create(
            properties?: api.IBolt12SendRequest
        ): api.Bolt12SendRequest;

        /**
         * Encodes the specified Bolt12SendRequest message. Does not implicitly {@link api.Bolt12SendRequest.verify|verify} messages.
         * @param message Bolt12SendRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IBolt12SendRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified Bolt12SendRequest message, length delimited. Does not implicitly {@link api.Bolt12SendRequest.verify|verify} messages.
         * @param message Bolt12SendRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IBolt12SendRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a Bolt12SendRequest message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Bolt12SendRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.Bolt12SendRequest;

        /**
         * Decodes a Bolt12SendRequest message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Bolt12SendRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.Bolt12SendRequest;

        /**
         * Verifies a Bolt12SendRequest message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a Bolt12SendRequest message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Bolt12SendRequest
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.Bolt12SendRequest;

        /**
         * Creates a plain object from a Bolt12SendRequest message. Also converts values to other types if specified.
         * @param message Bolt12SendRequest
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.Bolt12SendRequest,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this Bolt12SendRequest to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Bolt12SendRequest
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a Bolt12SendResponse. */
    interface IBolt12SendResponse {
        /** Bolt12SendResponse payment_id */
        payment_id?: string | null;
    }

    /** Represents a Bolt12SendResponse. */
    class Bolt12SendResponse implements IBolt12SendResponse {
        /**
         * Constructs a new Bolt12SendResponse.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IBolt12SendResponse);

        /** Bolt12SendResponse payment_id. */
        public payment_id: string;

        /**
         * Creates a new Bolt12SendResponse instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Bolt12SendResponse instance
         */
        public static create(
            properties?: api.IBolt12SendResponse
        ): api.Bolt12SendResponse;

        /**
         * Encodes the specified Bolt12SendResponse message. Does not implicitly {@link api.Bolt12SendResponse.verify|verify} messages.
         * @param message Bolt12SendResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IBolt12SendResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified Bolt12SendResponse message, length delimited. Does not implicitly {@link api.Bolt12SendResponse.verify|verify} messages.
         * @param message Bolt12SendResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IBolt12SendResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a Bolt12SendResponse message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Bolt12SendResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.Bolt12SendResponse;

        /**
         * Decodes a Bolt12SendResponse message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Bolt12SendResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.Bolt12SendResponse;

        /**
         * Verifies a Bolt12SendResponse message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a Bolt12SendResponse message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Bolt12SendResponse
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.Bolt12SendResponse;

        /**
         * Creates a plain object from a Bolt12SendResponse message. Also converts values to other types if specified.
         * @param message Bolt12SendResponse
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.Bolt12SendResponse,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this Bolt12SendResponse to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Bolt12SendResponse
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a SpontaneousSendRequest. */
    interface ISpontaneousSendRequest {
        /** SpontaneousSendRequest amount_msat */
        amount_msat?: Long | null;

        /** SpontaneousSendRequest node_id */
        node_id?: string | null;

        /** SpontaneousSendRequest route_parameters */
        route_parameters?: types.IRouteParametersConfig | null;
    }

    /** Represents a SpontaneousSendRequest. */
    class SpontaneousSendRequest implements ISpontaneousSendRequest {
        /**
         * Constructs a new SpontaneousSendRequest.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.ISpontaneousSendRequest);

        /** SpontaneousSendRequest amount_msat. */
        public amount_msat: Long;

        /** SpontaneousSendRequest node_id. */
        public node_id: string;

        /** SpontaneousSendRequest route_parameters. */
        public route_parameters?: types.IRouteParametersConfig | null;

        /**
         * Creates a new SpontaneousSendRequest instance using the specified properties.
         * @param [properties] Properties to set
         * @returns SpontaneousSendRequest instance
         */
        public static create(
            properties?: api.ISpontaneousSendRequest
        ): api.SpontaneousSendRequest;

        /**
         * Encodes the specified SpontaneousSendRequest message. Does not implicitly {@link api.SpontaneousSendRequest.verify|verify} messages.
         * @param message SpontaneousSendRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.ISpontaneousSendRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified SpontaneousSendRequest message, length delimited. Does not implicitly {@link api.SpontaneousSendRequest.verify|verify} messages.
         * @param message SpontaneousSendRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.ISpontaneousSendRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a SpontaneousSendRequest message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns SpontaneousSendRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.SpontaneousSendRequest;

        /**
         * Decodes a SpontaneousSendRequest message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns SpontaneousSendRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.SpontaneousSendRequest;

        /**
         * Verifies a SpontaneousSendRequest message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a SpontaneousSendRequest message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns SpontaneousSendRequest
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.SpontaneousSendRequest;

        /**
         * Creates a plain object from a SpontaneousSendRequest message. Also converts values to other types if specified.
         * @param message SpontaneousSendRequest
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.SpontaneousSendRequest,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this SpontaneousSendRequest to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for SpontaneousSendRequest
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a SpontaneousSendResponse. */
    interface ISpontaneousSendResponse {
        /** SpontaneousSendResponse payment_id */
        payment_id?: string | null;
    }

    /** Represents a SpontaneousSendResponse. */
    class SpontaneousSendResponse implements ISpontaneousSendResponse {
        /**
         * Constructs a new SpontaneousSendResponse.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.ISpontaneousSendResponse);

        /** SpontaneousSendResponse payment_id. */
        public payment_id: string;

        /**
         * Creates a new SpontaneousSendResponse instance using the specified properties.
         * @param [properties] Properties to set
         * @returns SpontaneousSendResponse instance
         */
        public static create(
            properties?: api.ISpontaneousSendResponse
        ): api.SpontaneousSendResponse;

        /**
         * Encodes the specified SpontaneousSendResponse message. Does not implicitly {@link api.SpontaneousSendResponse.verify|verify} messages.
         * @param message SpontaneousSendResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.ISpontaneousSendResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified SpontaneousSendResponse message, length delimited. Does not implicitly {@link api.SpontaneousSendResponse.verify|verify} messages.
         * @param message SpontaneousSendResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.ISpontaneousSendResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a SpontaneousSendResponse message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns SpontaneousSendResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.SpontaneousSendResponse;

        /**
         * Decodes a SpontaneousSendResponse message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns SpontaneousSendResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.SpontaneousSendResponse;

        /**
         * Verifies a SpontaneousSendResponse message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a SpontaneousSendResponse message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns SpontaneousSendResponse
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.SpontaneousSendResponse;

        /**
         * Creates a plain object from a SpontaneousSendResponse message. Also converts values to other types if specified.
         * @param message SpontaneousSendResponse
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.SpontaneousSendResponse,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this SpontaneousSendResponse to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for SpontaneousSendResponse
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of an OpenChannelRequest. */
    interface IOpenChannelRequest {
        /** OpenChannelRequest node_pubkey */
        node_pubkey?: string | null;

        /** OpenChannelRequest address */
        address?: string | null;

        /** OpenChannelRequest channel_amount_sats */
        channel_amount_sats?: Long | null;

        /** OpenChannelRequest push_to_counterparty_msat */
        push_to_counterparty_msat?: Long | null;

        /** OpenChannelRequest channel_config */
        channel_config?: types.IChannelConfig | null;

        /** OpenChannelRequest announce_channel */
        announce_channel?: boolean | null;

        /** OpenChannelRequest disable_counterparty_reserve */
        disable_counterparty_reserve?: boolean | null;
    }

    /** Represents an OpenChannelRequest. */
    class OpenChannelRequest implements IOpenChannelRequest {
        /**
         * Constructs a new OpenChannelRequest.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IOpenChannelRequest);

        /** OpenChannelRequest node_pubkey. */
        public node_pubkey: string;

        /** OpenChannelRequest address. */
        public address: string;

        /** OpenChannelRequest channel_amount_sats. */
        public channel_amount_sats: Long;

        /** OpenChannelRequest push_to_counterparty_msat. */
        public push_to_counterparty_msat?: Long | null;

        /** OpenChannelRequest channel_config. */
        public channel_config?: types.IChannelConfig | null;

        /** OpenChannelRequest announce_channel. */
        public announce_channel: boolean;

        /** OpenChannelRequest disable_counterparty_reserve. */
        public disable_counterparty_reserve: boolean;

        /**
         * Creates a new OpenChannelRequest instance using the specified properties.
         * @param [properties] Properties to set
         * @returns OpenChannelRequest instance
         */
        public static create(
            properties?: api.IOpenChannelRequest
        ): api.OpenChannelRequest;

        /**
         * Encodes the specified OpenChannelRequest message. Does not implicitly {@link api.OpenChannelRequest.verify|verify} messages.
         * @param message OpenChannelRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IOpenChannelRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified OpenChannelRequest message, length delimited. Does not implicitly {@link api.OpenChannelRequest.verify|verify} messages.
         * @param message OpenChannelRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IOpenChannelRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes an OpenChannelRequest message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns OpenChannelRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.OpenChannelRequest;

        /**
         * Decodes an OpenChannelRequest message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns OpenChannelRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.OpenChannelRequest;

        /**
         * Verifies an OpenChannelRequest message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates an OpenChannelRequest message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns OpenChannelRequest
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.OpenChannelRequest;

        /**
         * Creates a plain object from an OpenChannelRequest message. Also converts values to other types if specified.
         * @param message OpenChannelRequest
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.OpenChannelRequest,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this OpenChannelRequest to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for OpenChannelRequest
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of an OpenChannelResponse. */
    interface IOpenChannelResponse {
        /** OpenChannelResponse user_channel_id */
        user_channel_id?: string | null;
    }

    /** Represents an OpenChannelResponse. */
    class OpenChannelResponse implements IOpenChannelResponse {
        /**
         * Constructs a new OpenChannelResponse.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IOpenChannelResponse);

        /** OpenChannelResponse user_channel_id. */
        public user_channel_id: string;

        /**
         * Creates a new OpenChannelResponse instance using the specified properties.
         * @param [properties] Properties to set
         * @returns OpenChannelResponse instance
         */
        public static create(
            properties?: api.IOpenChannelResponse
        ): api.OpenChannelResponse;

        /**
         * Encodes the specified OpenChannelResponse message. Does not implicitly {@link api.OpenChannelResponse.verify|verify} messages.
         * @param message OpenChannelResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IOpenChannelResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified OpenChannelResponse message, length delimited. Does not implicitly {@link api.OpenChannelResponse.verify|verify} messages.
         * @param message OpenChannelResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IOpenChannelResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes an OpenChannelResponse message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns OpenChannelResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.OpenChannelResponse;

        /**
         * Decodes an OpenChannelResponse message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns OpenChannelResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.OpenChannelResponse;

        /**
         * Verifies an OpenChannelResponse message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates an OpenChannelResponse message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns OpenChannelResponse
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.OpenChannelResponse;

        /**
         * Creates a plain object from an OpenChannelResponse message. Also converts values to other types if specified.
         * @param message OpenChannelResponse
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.OpenChannelResponse,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this OpenChannelResponse to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for OpenChannelResponse
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a SpliceInRequest. */
    interface ISpliceInRequest {
        /** SpliceInRequest user_channel_id */
        user_channel_id?: string | null;

        /** SpliceInRequest counterparty_node_id */
        counterparty_node_id?: string | null;

        /** SpliceInRequest splice_amount_sats */
        splice_amount_sats?: Long | null;
    }

    /** Represents a SpliceInRequest. */
    class SpliceInRequest implements ISpliceInRequest {
        /**
         * Constructs a new SpliceInRequest.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.ISpliceInRequest);

        /** SpliceInRequest user_channel_id. */
        public user_channel_id: string;

        /** SpliceInRequest counterparty_node_id. */
        public counterparty_node_id: string;

        /** SpliceInRequest splice_amount_sats. */
        public splice_amount_sats: Long;

        /**
         * Creates a new SpliceInRequest instance using the specified properties.
         * @param [properties] Properties to set
         * @returns SpliceInRequest instance
         */
        public static create(
            properties?: api.ISpliceInRequest
        ): api.SpliceInRequest;

        /**
         * Encodes the specified SpliceInRequest message. Does not implicitly {@link api.SpliceInRequest.verify|verify} messages.
         * @param message SpliceInRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.ISpliceInRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified SpliceInRequest message, length delimited. Does not implicitly {@link api.SpliceInRequest.verify|verify} messages.
         * @param message SpliceInRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.ISpliceInRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a SpliceInRequest message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns SpliceInRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.SpliceInRequest;

        /**
         * Decodes a SpliceInRequest message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns SpliceInRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.SpliceInRequest;

        /**
         * Verifies a SpliceInRequest message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a SpliceInRequest message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns SpliceInRequest
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.SpliceInRequest;

        /**
         * Creates a plain object from a SpliceInRequest message. Also converts values to other types if specified.
         * @param message SpliceInRequest
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.SpliceInRequest,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this SpliceInRequest to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for SpliceInRequest
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a SpliceInResponse. */
    interface ISpliceInResponse {}

    /** Represents a SpliceInResponse. */
    class SpliceInResponse implements ISpliceInResponse {
        /**
         * Constructs a new SpliceInResponse.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.ISpliceInResponse);

        /**
         * Creates a new SpliceInResponse instance using the specified properties.
         * @param [properties] Properties to set
         * @returns SpliceInResponse instance
         */
        public static create(
            properties?: api.ISpliceInResponse
        ): api.SpliceInResponse;

        /**
         * Encodes the specified SpliceInResponse message. Does not implicitly {@link api.SpliceInResponse.verify|verify} messages.
         * @param message SpliceInResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.ISpliceInResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified SpliceInResponse message, length delimited. Does not implicitly {@link api.SpliceInResponse.verify|verify} messages.
         * @param message SpliceInResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.ISpliceInResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a SpliceInResponse message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns SpliceInResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.SpliceInResponse;

        /**
         * Decodes a SpliceInResponse message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns SpliceInResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.SpliceInResponse;

        /**
         * Verifies a SpliceInResponse message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a SpliceInResponse message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns SpliceInResponse
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.SpliceInResponse;

        /**
         * Creates a plain object from a SpliceInResponse message. Also converts values to other types if specified.
         * @param message SpliceInResponse
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.SpliceInResponse,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this SpliceInResponse to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for SpliceInResponse
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a SpliceOutRequest. */
    interface ISpliceOutRequest {
        /** SpliceOutRequest user_channel_id */
        user_channel_id?: string | null;

        /** SpliceOutRequest counterparty_node_id */
        counterparty_node_id?: string | null;

        /** SpliceOutRequest address */
        address?: string | null;

        /** SpliceOutRequest splice_amount_sats */
        splice_amount_sats?: Long | null;
    }

    /** Represents a SpliceOutRequest. */
    class SpliceOutRequest implements ISpliceOutRequest {
        /**
         * Constructs a new SpliceOutRequest.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.ISpliceOutRequest);

        /** SpliceOutRequest user_channel_id. */
        public user_channel_id: string;

        /** SpliceOutRequest counterparty_node_id. */
        public counterparty_node_id: string;

        /** SpliceOutRequest address. */
        public address?: string | null;

        /** SpliceOutRequest splice_amount_sats. */
        public splice_amount_sats: Long;

        /**
         * Creates a new SpliceOutRequest instance using the specified properties.
         * @param [properties] Properties to set
         * @returns SpliceOutRequest instance
         */
        public static create(
            properties?: api.ISpliceOutRequest
        ): api.SpliceOutRequest;

        /**
         * Encodes the specified SpliceOutRequest message. Does not implicitly {@link api.SpliceOutRequest.verify|verify} messages.
         * @param message SpliceOutRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.ISpliceOutRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified SpliceOutRequest message, length delimited. Does not implicitly {@link api.SpliceOutRequest.verify|verify} messages.
         * @param message SpliceOutRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.ISpliceOutRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a SpliceOutRequest message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns SpliceOutRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.SpliceOutRequest;

        /**
         * Decodes a SpliceOutRequest message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns SpliceOutRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.SpliceOutRequest;

        /**
         * Verifies a SpliceOutRequest message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a SpliceOutRequest message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns SpliceOutRequest
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.SpliceOutRequest;

        /**
         * Creates a plain object from a SpliceOutRequest message. Also converts values to other types if specified.
         * @param message SpliceOutRequest
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.SpliceOutRequest,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this SpliceOutRequest to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for SpliceOutRequest
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a SpliceOutResponse. */
    interface ISpliceOutResponse {
        /** SpliceOutResponse address */
        address?: string | null;
    }

    /** Represents a SpliceOutResponse. */
    class SpliceOutResponse implements ISpliceOutResponse {
        /**
         * Constructs a new SpliceOutResponse.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.ISpliceOutResponse);

        /** SpliceOutResponse address. */
        public address: string;

        /**
         * Creates a new SpliceOutResponse instance using the specified properties.
         * @param [properties] Properties to set
         * @returns SpliceOutResponse instance
         */
        public static create(
            properties?: api.ISpliceOutResponse
        ): api.SpliceOutResponse;

        /**
         * Encodes the specified SpliceOutResponse message. Does not implicitly {@link api.SpliceOutResponse.verify|verify} messages.
         * @param message SpliceOutResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.ISpliceOutResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified SpliceOutResponse message, length delimited. Does not implicitly {@link api.SpliceOutResponse.verify|verify} messages.
         * @param message SpliceOutResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.ISpliceOutResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a SpliceOutResponse message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns SpliceOutResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.SpliceOutResponse;

        /**
         * Decodes a SpliceOutResponse message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns SpliceOutResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.SpliceOutResponse;

        /**
         * Verifies a SpliceOutResponse message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a SpliceOutResponse message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns SpliceOutResponse
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.SpliceOutResponse;

        /**
         * Creates a plain object from a SpliceOutResponse message. Also converts values to other types if specified.
         * @param message SpliceOutResponse
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.SpliceOutResponse,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this SpliceOutResponse to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for SpliceOutResponse
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of an UpdateChannelConfigRequest. */
    interface IUpdateChannelConfigRequest {
        /** UpdateChannelConfigRequest user_channel_id */
        user_channel_id?: string | null;

        /** UpdateChannelConfigRequest counterparty_node_id */
        counterparty_node_id?: string | null;

        /** UpdateChannelConfigRequest channel_config */
        channel_config?: types.IChannelConfig | null;
    }

    /** Represents an UpdateChannelConfigRequest. */
    class UpdateChannelConfigRequest implements IUpdateChannelConfigRequest {
        /**
         * Constructs a new UpdateChannelConfigRequest.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IUpdateChannelConfigRequest);

        /** UpdateChannelConfigRequest user_channel_id. */
        public user_channel_id: string;

        /** UpdateChannelConfigRequest counterparty_node_id. */
        public counterparty_node_id: string;

        /** UpdateChannelConfigRequest channel_config. */
        public channel_config?: types.IChannelConfig | null;

        /**
         * Creates a new UpdateChannelConfigRequest instance using the specified properties.
         * @param [properties] Properties to set
         * @returns UpdateChannelConfigRequest instance
         */
        public static create(
            properties?: api.IUpdateChannelConfigRequest
        ): api.UpdateChannelConfigRequest;

        /**
         * Encodes the specified UpdateChannelConfigRequest message. Does not implicitly {@link api.UpdateChannelConfigRequest.verify|verify} messages.
         * @param message UpdateChannelConfigRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IUpdateChannelConfigRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified UpdateChannelConfigRequest message, length delimited. Does not implicitly {@link api.UpdateChannelConfigRequest.verify|verify} messages.
         * @param message UpdateChannelConfigRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IUpdateChannelConfigRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes an UpdateChannelConfigRequest message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns UpdateChannelConfigRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.UpdateChannelConfigRequest;

        /**
         * Decodes an UpdateChannelConfigRequest message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns UpdateChannelConfigRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.UpdateChannelConfigRequest;

        /**
         * Verifies an UpdateChannelConfigRequest message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates an UpdateChannelConfigRequest message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns UpdateChannelConfigRequest
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.UpdateChannelConfigRequest;

        /**
         * Creates a plain object from an UpdateChannelConfigRequest message. Also converts values to other types if specified.
         * @param message UpdateChannelConfigRequest
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.UpdateChannelConfigRequest,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this UpdateChannelConfigRequest to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for UpdateChannelConfigRequest
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of an UpdateChannelConfigResponse. */
    interface IUpdateChannelConfigResponse {}

    /** Represents an UpdateChannelConfigResponse. */
    class UpdateChannelConfigResponse implements IUpdateChannelConfigResponse {
        /**
         * Constructs a new UpdateChannelConfigResponse.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IUpdateChannelConfigResponse);

        /**
         * Creates a new UpdateChannelConfigResponse instance using the specified properties.
         * @param [properties] Properties to set
         * @returns UpdateChannelConfigResponse instance
         */
        public static create(
            properties?: api.IUpdateChannelConfigResponse
        ): api.UpdateChannelConfigResponse;

        /**
         * Encodes the specified UpdateChannelConfigResponse message. Does not implicitly {@link api.UpdateChannelConfigResponse.verify|verify} messages.
         * @param message UpdateChannelConfigResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IUpdateChannelConfigResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified UpdateChannelConfigResponse message, length delimited. Does not implicitly {@link api.UpdateChannelConfigResponse.verify|verify} messages.
         * @param message UpdateChannelConfigResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IUpdateChannelConfigResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes an UpdateChannelConfigResponse message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns UpdateChannelConfigResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.UpdateChannelConfigResponse;

        /**
         * Decodes an UpdateChannelConfigResponse message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns UpdateChannelConfigResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.UpdateChannelConfigResponse;

        /**
         * Verifies an UpdateChannelConfigResponse message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates an UpdateChannelConfigResponse message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns UpdateChannelConfigResponse
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.UpdateChannelConfigResponse;

        /**
         * Creates a plain object from an UpdateChannelConfigResponse message. Also converts values to other types if specified.
         * @param message UpdateChannelConfigResponse
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.UpdateChannelConfigResponse,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this UpdateChannelConfigResponse to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for UpdateChannelConfigResponse
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a CloseChannelRequest. */
    interface ICloseChannelRequest {
        /** CloseChannelRequest user_channel_id */
        user_channel_id?: string | null;

        /** CloseChannelRequest counterparty_node_id */
        counterparty_node_id?: string | null;
    }

    /** Represents a CloseChannelRequest. */
    class CloseChannelRequest implements ICloseChannelRequest {
        /**
         * Constructs a new CloseChannelRequest.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.ICloseChannelRequest);

        /** CloseChannelRequest user_channel_id. */
        public user_channel_id: string;

        /** CloseChannelRequest counterparty_node_id. */
        public counterparty_node_id: string;

        /**
         * Creates a new CloseChannelRequest instance using the specified properties.
         * @param [properties] Properties to set
         * @returns CloseChannelRequest instance
         */
        public static create(
            properties?: api.ICloseChannelRequest
        ): api.CloseChannelRequest;

        /**
         * Encodes the specified CloseChannelRequest message. Does not implicitly {@link api.CloseChannelRequest.verify|verify} messages.
         * @param message CloseChannelRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.ICloseChannelRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified CloseChannelRequest message, length delimited. Does not implicitly {@link api.CloseChannelRequest.verify|verify} messages.
         * @param message CloseChannelRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.ICloseChannelRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a CloseChannelRequest message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns CloseChannelRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.CloseChannelRequest;

        /**
         * Decodes a CloseChannelRequest message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns CloseChannelRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.CloseChannelRequest;

        /**
         * Verifies a CloseChannelRequest message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a CloseChannelRequest message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns CloseChannelRequest
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.CloseChannelRequest;

        /**
         * Creates a plain object from a CloseChannelRequest message. Also converts values to other types if specified.
         * @param message CloseChannelRequest
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.CloseChannelRequest,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this CloseChannelRequest to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for CloseChannelRequest
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a CloseChannelResponse. */
    interface ICloseChannelResponse {}

    /** Represents a CloseChannelResponse. */
    class CloseChannelResponse implements ICloseChannelResponse {
        /**
         * Constructs a new CloseChannelResponse.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.ICloseChannelResponse);

        /**
         * Creates a new CloseChannelResponse instance using the specified properties.
         * @param [properties] Properties to set
         * @returns CloseChannelResponse instance
         */
        public static create(
            properties?: api.ICloseChannelResponse
        ): api.CloseChannelResponse;

        /**
         * Encodes the specified CloseChannelResponse message. Does not implicitly {@link api.CloseChannelResponse.verify|verify} messages.
         * @param message CloseChannelResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.ICloseChannelResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified CloseChannelResponse message, length delimited. Does not implicitly {@link api.CloseChannelResponse.verify|verify} messages.
         * @param message CloseChannelResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.ICloseChannelResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a CloseChannelResponse message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns CloseChannelResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.CloseChannelResponse;

        /**
         * Decodes a CloseChannelResponse message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns CloseChannelResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.CloseChannelResponse;

        /**
         * Verifies a CloseChannelResponse message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a CloseChannelResponse message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns CloseChannelResponse
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.CloseChannelResponse;

        /**
         * Creates a plain object from a CloseChannelResponse message. Also converts values to other types if specified.
         * @param message CloseChannelResponse
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.CloseChannelResponse,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this CloseChannelResponse to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for CloseChannelResponse
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a ForceCloseChannelRequest. */
    interface IForceCloseChannelRequest {
        /** ForceCloseChannelRequest user_channel_id */
        user_channel_id?: string | null;

        /** ForceCloseChannelRequest counterparty_node_id */
        counterparty_node_id?: string | null;

        /** ForceCloseChannelRequest force_close_reason */
        force_close_reason?: string | null;
    }

    /** Represents a ForceCloseChannelRequest. */
    class ForceCloseChannelRequest implements IForceCloseChannelRequest {
        /**
         * Constructs a new ForceCloseChannelRequest.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IForceCloseChannelRequest);

        /** ForceCloseChannelRequest user_channel_id. */
        public user_channel_id: string;

        /** ForceCloseChannelRequest counterparty_node_id. */
        public counterparty_node_id: string;

        /** ForceCloseChannelRequest force_close_reason. */
        public force_close_reason?: string | null;

        /**
         * Creates a new ForceCloseChannelRequest instance using the specified properties.
         * @param [properties] Properties to set
         * @returns ForceCloseChannelRequest instance
         */
        public static create(
            properties?: api.IForceCloseChannelRequest
        ): api.ForceCloseChannelRequest;

        /**
         * Encodes the specified ForceCloseChannelRequest message. Does not implicitly {@link api.ForceCloseChannelRequest.verify|verify} messages.
         * @param message ForceCloseChannelRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IForceCloseChannelRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified ForceCloseChannelRequest message, length delimited. Does not implicitly {@link api.ForceCloseChannelRequest.verify|verify} messages.
         * @param message ForceCloseChannelRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IForceCloseChannelRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a ForceCloseChannelRequest message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns ForceCloseChannelRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.ForceCloseChannelRequest;

        /**
         * Decodes a ForceCloseChannelRequest message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns ForceCloseChannelRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.ForceCloseChannelRequest;

        /**
         * Verifies a ForceCloseChannelRequest message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a ForceCloseChannelRequest message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns ForceCloseChannelRequest
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.ForceCloseChannelRequest;

        /**
         * Creates a plain object from a ForceCloseChannelRequest message. Also converts values to other types if specified.
         * @param message ForceCloseChannelRequest
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.ForceCloseChannelRequest,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this ForceCloseChannelRequest to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for ForceCloseChannelRequest
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a ForceCloseChannelResponse. */
    interface IForceCloseChannelResponse {}

    /** Represents a ForceCloseChannelResponse. */
    class ForceCloseChannelResponse implements IForceCloseChannelResponse {
        /**
         * Constructs a new ForceCloseChannelResponse.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IForceCloseChannelResponse);

        /**
         * Creates a new ForceCloseChannelResponse instance using the specified properties.
         * @param [properties] Properties to set
         * @returns ForceCloseChannelResponse instance
         */
        public static create(
            properties?: api.IForceCloseChannelResponse
        ): api.ForceCloseChannelResponse;

        /**
         * Encodes the specified ForceCloseChannelResponse message. Does not implicitly {@link api.ForceCloseChannelResponse.verify|verify} messages.
         * @param message ForceCloseChannelResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IForceCloseChannelResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified ForceCloseChannelResponse message, length delimited. Does not implicitly {@link api.ForceCloseChannelResponse.verify|verify} messages.
         * @param message ForceCloseChannelResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IForceCloseChannelResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a ForceCloseChannelResponse message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns ForceCloseChannelResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.ForceCloseChannelResponse;

        /**
         * Decodes a ForceCloseChannelResponse message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns ForceCloseChannelResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.ForceCloseChannelResponse;

        /**
         * Verifies a ForceCloseChannelResponse message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a ForceCloseChannelResponse message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns ForceCloseChannelResponse
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.ForceCloseChannelResponse;

        /**
         * Creates a plain object from a ForceCloseChannelResponse message. Also converts values to other types if specified.
         * @param message ForceCloseChannelResponse
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.ForceCloseChannelResponse,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this ForceCloseChannelResponse to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for ForceCloseChannelResponse
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a ListChannelsRequest. */
    interface IListChannelsRequest {}

    /** Represents a ListChannelsRequest. */
    class ListChannelsRequest implements IListChannelsRequest {
        /**
         * Constructs a new ListChannelsRequest.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IListChannelsRequest);

        /**
         * Creates a new ListChannelsRequest instance using the specified properties.
         * @param [properties] Properties to set
         * @returns ListChannelsRequest instance
         */
        public static create(
            properties?: api.IListChannelsRequest
        ): api.ListChannelsRequest;

        /**
         * Encodes the specified ListChannelsRequest message. Does not implicitly {@link api.ListChannelsRequest.verify|verify} messages.
         * @param message ListChannelsRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IListChannelsRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified ListChannelsRequest message, length delimited. Does not implicitly {@link api.ListChannelsRequest.verify|verify} messages.
         * @param message ListChannelsRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IListChannelsRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a ListChannelsRequest message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns ListChannelsRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.ListChannelsRequest;

        /**
         * Decodes a ListChannelsRequest message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns ListChannelsRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.ListChannelsRequest;

        /**
         * Verifies a ListChannelsRequest message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a ListChannelsRequest message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns ListChannelsRequest
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.ListChannelsRequest;

        /**
         * Creates a plain object from a ListChannelsRequest message. Also converts values to other types if specified.
         * @param message ListChannelsRequest
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.ListChannelsRequest,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this ListChannelsRequest to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for ListChannelsRequest
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a ListChannelsResponse. */
    interface IListChannelsResponse {
        /** ListChannelsResponse channels */
        channels?: types.IChannel[] | null;
    }

    /** Represents a ListChannelsResponse. */
    class ListChannelsResponse implements IListChannelsResponse {
        /**
         * Constructs a new ListChannelsResponse.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IListChannelsResponse);

        /** ListChannelsResponse channels. */
        public channels: types.IChannel[];

        /**
         * Creates a new ListChannelsResponse instance using the specified properties.
         * @param [properties] Properties to set
         * @returns ListChannelsResponse instance
         */
        public static create(
            properties?: api.IListChannelsResponse
        ): api.ListChannelsResponse;

        /**
         * Encodes the specified ListChannelsResponse message. Does not implicitly {@link api.ListChannelsResponse.verify|verify} messages.
         * @param message ListChannelsResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IListChannelsResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified ListChannelsResponse message, length delimited. Does not implicitly {@link api.ListChannelsResponse.verify|verify} messages.
         * @param message ListChannelsResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IListChannelsResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a ListChannelsResponse message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns ListChannelsResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.ListChannelsResponse;

        /**
         * Decodes a ListChannelsResponse message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns ListChannelsResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.ListChannelsResponse;

        /**
         * Verifies a ListChannelsResponse message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a ListChannelsResponse message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns ListChannelsResponse
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.ListChannelsResponse;

        /**
         * Creates a plain object from a ListChannelsResponse message. Also converts values to other types if specified.
         * @param message ListChannelsResponse
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.ListChannelsResponse,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this ListChannelsResponse to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for ListChannelsResponse
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a GetPaymentDetailsRequest. */
    interface IGetPaymentDetailsRequest {
        /** GetPaymentDetailsRequest payment_id */
        payment_id?: string | null;
    }

    /** Represents a GetPaymentDetailsRequest. */
    class GetPaymentDetailsRequest implements IGetPaymentDetailsRequest {
        /**
         * Constructs a new GetPaymentDetailsRequest.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IGetPaymentDetailsRequest);

        /** GetPaymentDetailsRequest payment_id. */
        public payment_id: string;

        /**
         * Creates a new GetPaymentDetailsRequest instance using the specified properties.
         * @param [properties] Properties to set
         * @returns GetPaymentDetailsRequest instance
         */
        public static create(
            properties?: api.IGetPaymentDetailsRequest
        ): api.GetPaymentDetailsRequest;

        /**
         * Encodes the specified GetPaymentDetailsRequest message. Does not implicitly {@link api.GetPaymentDetailsRequest.verify|verify} messages.
         * @param message GetPaymentDetailsRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IGetPaymentDetailsRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified GetPaymentDetailsRequest message, length delimited. Does not implicitly {@link api.GetPaymentDetailsRequest.verify|verify} messages.
         * @param message GetPaymentDetailsRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IGetPaymentDetailsRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a GetPaymentDetailsRequest message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns GetPaymentDetailsRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.GetPaymentDetailsRequest;

        /**
         * Decodes a GetPaymentDetailsRequest message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns GetPaymentDetailsRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.GetPaymentDetailsRequest;

        /**
         * Verifies a GetPaymentDetailsRequest message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a GetPaymentDetailsRequest message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns GetPaymentDetailsRequest
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.GetPaymentDetailsRequest;

        /**
         * Creates a plain object from a GetPaymentDetailsRequest message. Also converts values to other types if specified.
         * @param message GetPaymentDetailsRequest
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.GetPaymentDetailsRequest,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this GetPaymentDetailsRequest to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for GetPaymentDetailsRequest
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a GetPaymentDetailsResponse. */
    interface IGetPaymentDetailsResponse {
        /** GetPaymentDetailsResponse payment */
        payment?: types.IPayment | null;
    }

    /** Represents a GetPaymentDetailsResponse. */
    class GetPaymentDetailsResponse implements IGetPaymentDetailsResponse {
        /**
         * Constructs a new GetPaymentDetailsResponse.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IGetPaymentDetailsResponse);

        /** GetPaymentDetailsResponse payment. */
        public payment?: types.IPayment | null;

        /**
         * Creates a new GetPaymentDetailsResponse instance using the specified properties.
         * @param [properties] Properties to set
         * @returns GetPaymentDetailsResponse instance
         */
        public static create(
            properties?: api.IGetPaymentDetailsResponse
        ): api.GetPaymentDetailsResponse;

        /**
         * Encodes the specified GetPaymentDetailsResponse message. Does not implicitly {@link api.GetPaymentDetailsResponse.verify|verify} messages.
         * @param message GetPaymentDetailsResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IGetPaymentDetailsResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified GetPaymentDetailsResponse message, length delimited. Does not implicitly {@link api.GetPaymentDetailsResponse.verify|verify} messages.
         * @param message GetPaymentDetailsResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IGetPaymentDetailsResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a GetPaymentDetailsResponse message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns GetPaymentDetailsResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.GetPaymentDetailsResponse;

        /**
         * Decodes a GetPaymentDetailsResponse message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns GetPaymentDetailsResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.GetPaymentDetailsResponse;

        /**
         * Verifies a GetPaymentDetailsResponse message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a GetPaymentDetailsResponse message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns GetPaymentDetailsResponse
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.GetPaymentDetailsResponse;

        /**
         * Creates a plain object from a GetPaymentDetailsResponse message. Also converts values to other types if specified.
         * @param message GetPaymentDetailsResponse
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.GetPaymentDetailsResponse,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this GetPaymentDetailsResponse to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for GetPaymentDetailsResponse
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a ListPaymentsRequest. */
    interface IListPaymentsRequest {
        /** ListPaymentsRequest page_token */
        page_token?: types.IPageToken | null;
    }

    /** Represents a ListPaymentsRequest. */
    class ListPaymentsRequest implements IListPaymentsRequest {
        /**
         * Constructs a new ListPaymentsRequest.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IListPaymentsRequest);

        /** ListPaymentsRequest page_token. */
        public page_token?: types.IPageToken | null;

        /**
         * Creates a new ListPaymentsRequest instance using the specified properties.
         * @param [properties] Properties to set
         * @returns ListPaymentsRequest instance
         */
        public static create(
            properties?: api.IListPaymentsRequest
        ): api.ListPaymentsRequest;

        /**
         * Encodes the specified ListPaymentsRequest message. Does not implicitly {@link api.ListPaymentsRequest.verify|verify} messages.
         * @param message ListPaymentsRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IListPaymentsRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified ListPaymentsRequest message, length delimited. Does not implicitly {@link api.ListPaymentsRequest.verify|verify} messages.
         * @param message ListPaymentsRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IListPaymentsRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a ListPaymentsRequest message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns ListPaymentsRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.ListPaymentsRequest;

        /**
         * Decodes a ListPaymentsRequest message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns ListPaymentsRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.ListPaymentsRequest;

        /**
         * Verifies a ListPaymentsRequest message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a ListPaymentsRequest message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns ListPaymentsRequest
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.ListPaymentsRequest;

        /**
         * Creates a plain object from a ListPaymentsRequest message. Also converts values to other types if specified.
         * @param message ListPaymentsRequest
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.ListPaymentsRequest,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this ListPaymentsRequest to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for ListPaymentsRequest
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a ListPaymentsResponse. */
    interface IListPaymentsResponse {
        /** ListPaymentsResponse payments */
        payments?: types.IPayment[] | null;

        /** ListPaymentsResponse next_page_token */
        next_page_token?: types.IPageToken | null;
    }

    /** Represents a ListPaymentsResponse. */
    class ListPaymentsResponse implements IListPaymentsResponse {
        /**
         * Constructs a new ListPaymentsResponse.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IListPaymentsResponse);

        /** ListPaymentsResponse payments. */
        public payments: types.IPayment[];

        /** ListPaymentsResponse next_page_token. */
        public next_page_token?: types.IPageToken | null;

        /**
         * Creates a new ListPaymentsResponse instance using the specified properties.
         * @param [properties] Properties to set
         * @returns ListPaymentsResponse instance
         */
        public static create(
            properties?: api.IListPaymentsResponse
        ): api.ListPaymentsResponse;

        /**
         * Encodes the specified ListPaymentsResponse message. Does not implicitly {@link api.ListPaymentsResponse.verify|verify} messages.
         * @param message ListPaymentsResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IListPaymentsResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified ListPaymentsResponse message, length delimited. Does not implicitly {@link api.ListPaymentsResponse.verify|verify} messages.
         * @param message ListPaymentsResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IListPaymentsResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a ListPaymentsResponse message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns ListPaymentsResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.ListPaymentsResponse;

        /**
         * Decodes a ListPaymentsResponse message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns ListPaymentsResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.ListPaymentsResponse;

        /**
         * Verifies a ListPaymentsResponse message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a ListPaymentsResponse message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns ListPaymentsResponse
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.ListPaymentsResponse;

        /**
         * Creates a plain object from a ListPaymentsResponse message. Also converts values to other types if specified.
         * @param message ListPaymentsResponse
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.ListPaymentsResponse,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this ListPaymentsResponse to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for ListPaymentsResponse
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a ListForwardedPaymentsRequest. */
    interface IListForwardedPaymentsRequest {
        /** ListForwardedPaymentsRequest page_token */
        page_token?: types.IPageToken | null;
    }

    /** Represents a ListForwardedPaymentsRequest. */
    class ListForwardedPaymentsRequest
        implements IListForwardedPaymentsRequest
    {
        /**
         * Constructs a new ListForwardedPaymentsRequest.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IListForwardedPaymentsRequest);

        /** ListForwardedPaymentsRequest page_token. */
        public page_token?: types.IPageToken | null;

        /**
         * Creates a new ListForwardedPaymentsRequest instance using the specified properties.
         * @param [properties] Properties to set
         * @returns ListForwardedPaymentsRequest instance
         */
        public static create(
            properties?: api.IListForwardedPaymentsRequest
        ): api.ListForwardedPaymentsRequest;

        /**
         * Encodes the specified ListForwardedPaymentsRequest message. Does not implicitly {@link api.ListForwardedPaymentsRequest.verify|verify} messages.
         * @param message ListForwardedPaymentsRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IListForwardedPaymentsRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified ListForwardedPaymentsRequest message, length delimited. Does not implicitly {@link api.ListForwardedPaymentsRequest.verify|verify} messages.
         * @param message ListForwardedPaymentsRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IListForwardedPaymentsRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a ListForwardedPaymentsRequest message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns ListForwardedPaymentsRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.ListForwardedPaymentsRequest;

        /**
         * Decodes a ListForwardedPaymentsRequest message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns ListForwardedPaymentsRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.ListForwardedPaymentsRequest;

        /**
         * Verifies a ListForwardedPaymentsRequest message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a ListForwardedPaymentsRequest message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns ListForwardedPaymentsRequest
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.ListForwardedPaymentsRequest;

        /**
         * Creates a plain object from a ListForwardedPaymentsRequest message. Also converts values to other types if specified.
         * @param message ListForwardedPaymentsRequest
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.ListForwardedPaymentsRequest,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this ListForwardedPaymentsRequest to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for ListForwardedPaymentsRequest
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a ListForwardedPaymentsResponse. */
    interface IListForwardedPaymentsResponse {
        /** ListForwardedPaymentsResponse forwarded_payments */
        forwarded_payments?: types.IForwardedPayment[] | null;

        /** ListForwardedPaymentsResponse next_page_token */
        next_page_token?: types.IPageToken | null;
    }

    /** Represents a ListForwardedPaymentsResponse. */
    class ListForwardedPaymentsResponse
        implements IListForwardedPaymentsResponse
    {
        /**
         * Constructs a new ListForwardedPaymentsResponse.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IListForwardedPaymentsResponse);

        /** ListForwardedPaymentsResponse forwarded_payments. */
        public forwarded_payments: types.IForwardedPayment[];

        /** ListForwardedPaymentsResponse next_page_token. */
        public next_page_token?: types.IPageToken | null;

        /**
         * Creates a new ListForwardedPaymentsResponse instance using the specified properties.
         * @param [properties] Properties to set
         * @returns ListForwardedPaymentsResponse instance
         */
        public static create(
            properties?: api.IListForwardedPaymentsResponse
        ): api.ListForwardedPaymentsResponse;

        /**
         * Encodes the specified ListForwardedPaymentsResponse message. Does not implicitly {@link api.ListForwardedPaymentsResponse.verify|verify} messages.
         * @param message ListForwardedPaymentsResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IListForwardedPaymentsResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified ListForwardedPaymentsResponse message, length delimited. Does not implicitly {@link api.ListForwardedPaymentsResponse.verify|verify} messages.
         * @param message ListForwardedPaymentsResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IListForwardedPaymentsResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a ListForwardedPaymentsResponse message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns ListForwardedPaymentsResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.ListForwardedPaymentsResponse;

        /**
         * Decodes a ListForwardedPaymentsResponse message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns ListForwardedPaymentsResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.ListForwardedPaymentsResponse;

        /**
         * Verifies a ListForwardedPaymentsResponse message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a ListForwardedPaymentsResponse message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns ListForwardedPaymentsResponse
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.ListForwardedPaymentsResponse;

        /**
         * Creates a plain object from a ListForwardedPaymentsResponse message. Also converts values to other types if specified.
         * @param message ListForwardedPaymentsResponse
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.ListForwardedPaymentsResponse,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this ListForwardedPaymentsResponse to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for ListForwardedPaymentsResponse
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a SignMessageRequest. */
    interface ISignMessageRequest {
        /** SignMessageRequest message */
        message?: Uint8Array | null;
    }

    /** Represents a SignMessageRequest. */
    class SignMessageRequest implements ISignMessageRequest {
        /**
         * Constructs a new SignMessageRequest.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.ISignMessageRequest);

        /** SignMessageRequest message. */
        public message: Uint8Array;

        /**
         * Creates a new SignMessageRequest instance using the specified properties.
         * @param [properties] Properties to set
         * @returns SignMessageRequest instance
         */
        public static create(
            properties?: api.ISignMessageRequest
        ): api.SignMessageRequest;

        /**
         * Encodes the specified SignMessageRequest message. Does not implicitly {@link api.SignMessageRequest.verify|verify} messages.
         * @param message SignMessageRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.ISignMessageRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified SignMessageRequest message, length delimited. Does not implicitly {@link api.SignMessageRequest.verify|verify} messages.
         * @param message SignMessageRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.ISignMessageRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a SignMessageRequest message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns SignMessageRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.SignMessageRequest;

        /**
         * Decodes a SignMessageRequest message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns SignMessageRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.SignMessageRequest;

        /**
         * Verifies a SignMessageRequest message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a SignMessageRequest message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns SignMessageRequest
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.SignMessageRequest;

        /**
         * Creates a plain object from a SignMessageRequest message. Also converts values to other types if specified.
         * @param message SignMessageRequest
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.SignMessageRequest,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this SignMessageRequest to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for SignMessageRequest
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a SignMessageResponse. */
    interface ISignMessageResponse {
        /** SignMessageResponse signature */
        signature?: string | null;
    }

    /** Represents a SignMessageResponse. */
    class SignMessageResponse implements ISignMessageResponse {
        /**
         * Constructs a new SignMessageResponse.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.ISignMessageResponse);

        /** SignMessageResponse signature. */
        public signature: string;

        /**
         * Creates a new SignMessageResponse instance using the specified properties.
         * @param [properties] Properties to set
         * @returns SignMessageResponse instance
         */
        public static create(
            properties?: api.ISignMessageResponse
        ): api.SignMessageResponse;

        /**
         * Encodes the specified SignMessageResponse message. Does not implicitly {@link api.SignMessageResponse.verify|verify} messages.
         * @param message SignMessageResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.ISignMessageResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified SignMessageResponse message, length delimited. Does not implicitly {@link api.SignMessageResponse.verify|verify} messages.
         * @param message SignMessageResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.ISignMessageResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a SignMessageResponse message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns SignMessageResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.SignMessageResponse;

        /**
         * Decodes a SignMessageResponse message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns SignMessageResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.SignMessageResponse;

        /**
         * Verifies a SignMessageResponse message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a SignMessageResponse message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns SignMessageResponse
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.SignMessageResponse;

        /**
         * Creates a plain object from a SignMessageResponse message. Also converts values to other types if specified.
         * @param message SignMessageResponse
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.SignMessageResponse,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this SignMessageResponse to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for SignMessageResponse
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a VerifySignatureRequest. */
    interface IVerifySignatureRequest {
        /** VerifySignatureRequest message */
        message?: Uint8Array | null;

        /** VerifySignatureRequest signature */
        signature?: string | null;

        /** VerifySignatureRequest public_key */
        public_key?: string | null;
    }

    /** Represents a VerifySignatureRequest. */
    class VerifySignatureRequest implements IVerifySignatureRequest {
        /**
         * Constructs a new VerifySignatureRequest.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IVerifySignatureRequest);

        /** VerifySignatureRequest message. */
        public message: Uint8Array;

        /** VerifySignatureRequest signature. */
        public signature: string;

        /** VerifySignatureRequest public_key. */
        public public_key: string;

        /**
         * Creates a new VerifySignatureRequest instance using the specified properties.
         * @param [properties] Properties to set
         * @returns VerifySignatureRequest instance
         */
        public static create(
            properties?: api.IVerifySignatureRequest
        ): api.VerifySignatureRequest;

        /**
         * Encodes the specified VerifySignatureRequest message. Does not implicitly {@link api.VerifySignatureRequest.verify|verify} messages.
         * @param message VerifySignatureRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IVerifySignatureRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified VerifySignatureRequest message, length delimited. Does not implicitly {@link api.VerifySignatureRequest.verify|verify} messages.
         * @param message VerifySignatureRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IVerifySignatureRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a VerifySignatureRequest message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns VerifySignatureRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.VerifySignatureRequest;

        /**
         * Decodes a VerifySignatureRequest message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns VerifySignatureRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.VerifySignatureRequest;

        /**
         * Verifies a VerifySignatureRequest message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a VerifySignatureRequest message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns VerifySignatureRequest
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.VerifySignatureRequest;

        /**
         * Creates a plain object from a VerifySignatureRequest message. Also converts values to other types if specified.
         * @param message VerifySignatureRequest
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.VerifySignatureRequest,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this VerifySignatureRequest to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for VerifySignatureRequest
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a VerifySignatureResponse. */
    interface IVerifySignatureResponse {
        /** VerifySignatureResponse valid */
        valid?: boolean | null;
    }

    /** Represents a VerifySignatureResponse. */
    class VerifySignatureResponse implements IVerifySignatureResponse {
        /**
         * Constructs a new VerifySignatureResponse.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IVerifySignatureResponse);

        /** VerifySignatureResponse valid. */
        public valid: boolean;

        /**
         * Creates a new VerifySignatureResponse instance using the specified properties.
         * @param [properties] Properties to set
         * @returns VerifySignatureResponse instance
         */
        public static create(
            properties?: api.IVerifySignatureResponse
        ): api.VerifySignatureResponse;

        /**
         * Encodes the specified VerifySignatureResponse message. Does not implicitly {@link api.VerifySignatureResponse.verify|verify} messages.
         * @param message VerifySignatureResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IVerifySignatureResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified VerifySignatureResponse message, length delimited. Does not implicitly {@link api.VerifySignatureResponse.verify|verify} messages.
         * @param message VerifySignatureResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IVerifySignatureResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a VerifySignatureResponse message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns VerifySignatureResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.VerifySignatureResponse;

        /**
         * Decodes a VerifySignatureResponse message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns VerifySignatureResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.VerifySignatureResponse;

        /**
         * Verifies a VerifySignatureResponse message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a VerifySignatureResponse message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns VerifySignatureResponse
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.VerifySignatureResponse;

        /**
         * Creates a plain object from a VerifySignatureResponse message. Also converts values to other types if specified.
         * @param message VerifySignatureResponse
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.VerifySignatureResponse,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this VerifySignatureResponse to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for VerifySignatureResponse
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of an ExportPathfindingScoresRequest. */
    interface IExportPathfindingScoresRequest {}

    /** Represents an ExportPathfindingScoresRequest. */
    class ExportPathfindingScoresRequest
        implements IExportPathfindingScoresRequest
    {
        /**
         * Constructs a new ExportPathfindingScoresRequest.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IExportPathfindingScoresRequest);

        /**
         * Creates a new ExportPathfindingScoresRequest instance using the specified properties.
         * @param [properties] Properties to set
         * @returns ExportPathfindingScoresRequest instance
         */
        public static create(
            properties?: api.IExportPathfindingScoresRequest
        ): api.ExportPathfindingScoresRequest;

        /**
         * Encodes the specified ExportPathfindingScoresRequest message. Does not implicitly {@link api.ExportPathfindingScoresRequest.verify|verify} messages.
         * @param message ExportPathfindingScoresRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IExportPathfindingScoresRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified ExportPathfindingScoresRequest message, length delimited. Does not implicitly {@link api.ExportPathfindingScoresRequest.verify|verify} messages.
         * @param message ExportPathfindingScoresRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IExportPathfindingScoresRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes an ExportPathfindingScoresRequest message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns ExportPathfindingScoresRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.ExportPathfindingScoresRequest;

        /**
         * Decodes an ExportPathfindingScoresRequest message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns ExportPathfindingScoresRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.ExportPathfindingScoresRequest;

        /**
         * Verifies an ExportPathfindingScoresRequest message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates an ExportPathfindingScoresRequest message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns ExportPathfindingScoresRequest
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.ExportPathfindingScoresRequest;

        /**
         * Creates a plain object from an ExportPathfindingScoresRequest message. Also converts values to other types if specified.
         * @param message ExportPathfindingScoresRequest
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.ExportPathfindingScoresRequest,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this ExportPathfindingScoresRequest to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for ExportPathfindingScoresRequest
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of an ExportPathfindingScoresResponse. */
    interface IExportPathfindingScoresResponse {
        /** ExportPathfindingScoresResponse scores */
        scores?: Uint8Array | null;
    }

    /** Represents an ExportPathfindingScoresResponse. */
    class ExportPathfindingScoresResponse
        implements IExportPathfindingScoresResponse
    {
        /**
         * Constructs a new ExportPathfindingScoresResponse.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IExportPathfindingScoresResponse);

        /** ExportPathfindingScoresResponse scores. */
        public scores: Uint8Array;

        /**
         * Creates a new ExportPathfindingScoresResponse instance using the specified properties.
         * @param [properties] Properties to set
         * @returns ExportPathfindingScoresResponse instance
         */
        public static create(
            properties?: api.IExportPathfindingScoresResponse
        ): api.ExportPathfindingScoresResponse;

        /**
         * Encodes the specified ExportPathfindingScoresResponse message. Does not implicitly {@link api.ExportPathfindingScoresResponse.verify|verify} messages.
         * @param message ExportPathfindingScoresResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IExportPathfindingScoresResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified ExportPathfindingScoresResponse message, length delimited. Does not implicitly {@link api.ExportPathfindingScoresResponse.verify|verify} messages.
         * @param message ExportPathfindingScoresResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IExportPathfindingScoresResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes an ExportPathfindingScoresResponse message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns ExportPathfindingScoresResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.ExportPathfindingScoresResponse;

        /**
         * Decodes an ExportPathfindingScoresResponse message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns ExportPathfindingScoresResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.ExportPathfindingScoresResponse;

        /**
         * Verifies an ExportPathfindingScoresResponse message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates an ExportPathfindingScoresResponse message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns ExportPathfindingScoresResponse
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.ExportPathfindingScoresResponse;

        /**
         * Creates a plain object from an ExportPathfindingScoresResponse message. Also converts values to other types if specified.
         * @param message ExportPathfindingScoresResponse
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.ExportPathfindingScoresResponse,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this ExportPathfindingScoresResponse to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for ExportPathfindingScoresResponse
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a GetBalancesRequest. */
    interface IGetBalancesRequest {}

    /** Represents a GetBalancesRequest. */
    class GetBalancesRequest implements IGetBalancesRequest {
        /**
         * Constructs a new GetBalancesRequest.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IGetBalancesRequest);

        /**
         * Creates a new GetBalancesRequest instance using the specified properties.
         * @param [properties] Properties to set
         * @returns GetBalancesRequest instance
         */
        public static create(
            properties?: api.IGetBalancesRequest
        ): api.GetBalancesRequest;

        /**
         * Encodes the specified GetBalancesRequest message. Does not implicitly {@link api.GetBalancesRequest.verify|verify} messages.
         * @param message GetBalancesRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IGetBalancesRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified GetBalancesRequest message, length delimited. Does not implicitly {@link api.GetBalancesRequest.verify|verify} messages.
         * @param message GetBalancesRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IGetBalancesRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a GetBalancesRequest message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns GetBalancesRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.GetBalancesRequest;

        /**
         * Decodes a GetBalancesRequest message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns GetBalancesRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.GetBalancesRequest;

        /**
         * Verifies a GetBalancesRequest message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a GetBalancesRequest message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns GetBalancesRequest
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.GetBalancesRequest;

        /**
         * Creates a plain object from a GetBalancesRequest message. Also converts values to other types if specified.
         * @param message GetBalancesRequest
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.GetBalancesRequest,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this GetBalancesRequest to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for GetBalancesRequest
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a GetBalancesResponse. */
    interface IGetBalancesResponse {
        /** GetBalancesResponse total_onchain_balance_sats */
        total_onchain_balance_sats?: Long | null;

        /** GetBalancesResponse spendable_onchain_balance_sats */
        spendable_onchain_balance_sats?: Long | null;

        /** GetBalancesResponse total_anchor_channels_reserve_sats */
        total_anchor_channels_reserve_sats?: Long | null;

        /** GetBalancesResponse total_lightning_balance_sats */
        total_lightning_balance_sats?: Long | null;

        /** GetBalancesResponse lightning_balances */
        lightning_balances?: types.ILightningBalance[] | null;

        /** GetBalancesResponse pending_balances_from_channel_closures */
        pending_balances_from_channel_closures?:
            | types.IPendingSweepBalance[]
            | null;
    }

    /** Represents a GetBalancesResponse. */
    class GetBalancesResponse implements IGetBalancesResponse {
        /**
         * Constructs a new GetBalancesResponse.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IGetBalancesResponse);

        /** GetBalancesResponse total_onchain_balance_sats. */
        public total_onchain_balance_sats: Long;

        /** GetBalancesResponse spendable_onchain_balance_sats. */
        public spendable_onchain_balance_sats: Long;

        /** GetBalancesResponse total_anchor_channels_reserve_sats. */
        public total_anchor_channels_reserve_sats: Long;

        /** GetBalancesResponse total_lightning_balance_sats. */
        public total_lightning_balance_sats: Long;

        /** GetBalancesResponse lightning_balances. */
        public lightning_balances: types.ILightningBalance[];

        /** GetBalancesResponse pending_balances_from_channel_closures. */
        public pending_balances_from_channel_closures: types.IPendingSweepBalance[];

        /**
         * Creates a new GetBalancesResponse instance using the specified properties.
         * @param [properties] Properties to set
         * @returns GetBalancesResponse instance
         */
        public static create(
            properties?: api.IGetBalancesResponse
        ): api.GetBalancesResponse;

        /**
         * Encodes the specified GetBalancesResponse message. Does not implicitly {@link api.GetBalancesResponse.verify|verify} messages.
         * @param message GetBalancesResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IGetBalancesResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified GetBalancesResponse message, length delimited. Does not implicitly {@link api.GetBalancesResponse.verify|verify} messages.
         * @param message GetBalancesResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IGetBalancesResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a GetBalancesResponse message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns GetBalancesResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.GetBalancesResponse;

        /**
         * Decodes a GetBalancesResponse message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns GetBalancesResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.GetBalancesResponse;

        /**
         * Verifies a GetBalancesResponse message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a GetBalancesResponse message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns GetBalancesResponse
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.GetBalancesResponse;

        /**
         * Creates a plain object from a GetBalancesResponse message. Also converts values to other types if specified.
         * @param message GetBalancesResponse
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.GetBalancesResponse,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this GetBalancesResponse to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for GetBalancesResponse
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a ConnectPeerRequest. */
    interface IConnectPeerRequest {
        /** ConnectPeerRequest node_pubkey */
        node_pubkey?: string | null;

        /** ConnectPeerRequest address */
        address?: string | null;

        /** ConnectPeerRequest persist */
        persist?: boolean | null;
    }

    /** Represents a ConnectPeerRequest. */
    class ConnectPeerRequest implements IConnectPeerRequest {
        /**
         * Constructs a new ConnectPeerRequest.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IConnectPeerRequest);

        /** ConnectPeerRequest node_pubkey. */
        public node_pubkey: string;

        /** ConnectPeerRequest address. */
        public address: string;

        /** ConnectPeerRequest persist. */
        public persist: boolean;

        /**
         * Creates a new ConnectPeerRequest instance using the specified properties.
         * @param [properties] Properties to set
         * @returns ConnectPeerRequest instance
         */
        public static create(
            properties?: api.IConnectPeerRequest
        ): api.ConnectPeerRequest;

        /**
         * Encodes the specified ConnectPeerRequest message. Does not implicitly {@link api.ConnectPeerRequest.verify|verify} messages.
         * @param message ConnectPeerRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IConnectPeerRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified ConnectPeerRequest message, length delimited. Does not implicitly {@link api.ConnectPeerRequest.verify|verify} messages.
         * @param message ConnectPeerRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IConnectPeerRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a ConnectPeerRequest message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns ConnectPeerRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.ConnectPeerRequest;

        /**
         * Decodes a ConnectPeerRequest message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns ConnectPeerRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.ConnectPeerRequest;

        /**
         * Verifies a ConnectPeerRequest message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a ConnectPeerRequest message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns ConnectPeerRequest
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.ConnectPeerRequest;

        /**
         * Creates a plain object from a ConnectPeerRequest message. Also converts values to other types if specified.
         * @param message ConnectPeerRequest
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.ConnectPeerRequest,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this ConnectPeerRequest to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for ConnectPeerRequest
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a ConnectPeerResponse. */
    interface IConnectPeerResponse {}

    /** Represents a ConnectPeerResponse. */
    class ConnectPeerResponse implements IConnectPeerResponse {
        /**
         * Constructs a new ConnectPeerResponse.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IConnectPeerResponse);

        /**
         * Creates a new ConnectPeerResponse instance using the specified properties.
         * @param [properties] Properties to set
         * @returns ConnectPeerResponse instance
         */
        public static create(
            properties?: api.IConnectPeerResponse
        ): api.ConnectPeerResponse;

        /**
         * Encodes the specified ConnectPeerResponse message. Does not implicitly {@link api.ConnectPeerResponse.verify|verify} messages.
         * @param message ConnectPeerResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IConnectPeerResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified ConnectPeerResponse message, length delimited. Does not implicitly {@link api.ConnectPeerResponse.verify|verify} messages.
         * @param message ConnectPeerResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IConnectPeerResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a ConnectPeerResponse message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns ConnectPeerResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.ConnectPeerResponse;

        /**
         * Decodes a ConnectPeerResponse message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns ConnectPeerResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.ConnectPeerResponse;

        /**
         * Verifies a ConnectPeerResponse message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a ConnectPeerResponse message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns ConnectPeerResponse
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.ConnectPeerResponse;

        /**
         * Creates a plain object from a ConnectPeerResponse message. Also converts values to other types if specified.
         * @param message ConnectPeerResponse
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.ConnectPeerResponse,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this ConnectPeerResponse to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for ConnectPeerResponse
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a DisconnectPeerRequest. */
    interface IDisconnectPeerRequest {
        /** DisconnectPeerRequest node_pubkey */
        node_pubkey?: string | null;
    }

    /** Represents a DisconnectPeerRequest. */
    class DisconnectPeerRequest implements IDisconnectPeerRequest {
        /**
         * Constructs a new DisconnectPeerRequest.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IDisconnectPeerRequest);

        /** DisconnectPeerRequest node_pubkey. */
        public node_pubkey: string;

        /**
         * Creates a new DisconnectPeerRequest instance using the specified properties.
         * @param [properties] Properties to set
         * @returns DisconnectPeerRequest instance
         */
        public static create(
            properties?: api.IDisconnectPeerRequest
        ): api.DisconnectPeerRequest;

        /**
         * Encodes the specified DisconnectPeerRequest message. Does not implicitly {@link api.DisconnectPeerRequest.verify|verify} messages.
         * @param message DisconnectPeerRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IDisconnectPeerRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified DisconnectPeerRequest message, length delimited. Does not implicitly {@link api.DisconnectPeerRequest.verify|verify} messages.
         * @param message DisconnectPeerRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IDisconnectPeerRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a DisconnectPeerRequest message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns DisconnectPeerRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.DisconnectPeerRequest;

        /**
         * Decodes a DisconnectPeerRequest message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns DisconnectPeerRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.DisconnectPeerRequest;

        /**
         * Verifies a DisconnectPeerRequest message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a DisconnectPeerRequest message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns DisconnectPeerRequest
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.DisconnectPeerRequest;

        /**
         * Creates a plain object from a DisconnectPeerRequest message. Also converts values to other types if specified.
         * @param message DisconnectPeerRequest
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.DisconnectPeerRequest,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this DisconnectPeerRequest to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for DisconnectPeerRequest
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a DisconnectPeerResponse. */
    interface IDisconnectPeerResponse {}

    /** Represents a DisconnectPeerResponse. */
    class DisconnectPeerResponse implements IDisconnectPeerResponse {
        /**
         * Constructs a new DisconnectPeerResponse.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IDisconnectPeerResponse);

        /**
         * Creates a new DisconnectPeerResponse instance using the specified properties.
         * @param [properties] Properties to set
         * @returns DisconnectPeerResponse instance
         */
        public static create(
            properties?: api.IDisconnectPeerResponse
        ): api.DisconnectPeerResponse;

        /**
         * Encodes the specified DisconnectPeerResponse message. Does not implicitly {@link api.DisconnectPeerResponse.verify|verify} messages.
         * @param message DisconnectPeerResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IDisconnectPeerResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified DisconnectPeerResponse message, length delimited. Does not implicitly {@link api.DisconnectPeerResponse.verify|verify} messages.
         * @param message DisconnectPeerResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IDisconnectPeerResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a DisconnectPeerResponse message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns DisconnectPeerResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.DisconnectPeerResponse;

        /**
         * Decodes a DisconnectPeerResponse message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns DisconnectPeerResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.DisconnectPeerResponse;

        /**
         * Verifies a DisconnectPeerResponse message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a DisconnectPeerResponse message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns DisconnectPeerResponse
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.DisconnectPeerResponse;

        /**
         * Creates a plain object from a DisconnectPeerResponse message. Also converts values to other types if specified.
         * @param message DisconnectPeerResponse
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.DisconnectPeerResponse,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this DisconnectPeerResponse to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for DisconnectPeerResponse
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a ListPeersRequest. */
    interface IListPeersRequest {}

    /** Represents a ListPeersRequest. */
    class ListPeersRequest implements IListPeersRequest {
        /**
         * Constructs a new ListPeersRequest.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IListPeersRequest);

        /**
         * Creates a new ListPeersRequest instance using the specified properties.
         * @param [properties] Properties to set
         * @returns ListPeersRequest instance
         */
        public static create(
            properties?: api.IListPeersRequest
        ): api.ListPeersRequest;

        /**
         * Encodes the specified ListPeersRequest message. Does not implicitly {@link api.ListPeersRequest.verify|verify} messages.
         * @param message ListPeersRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IListPeersRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified ListPeersRequest message, length delimited. Does not implicitly {@link api.ListPeersRequest.verify|verify} messages.
         * @param message ListPeersRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IListPeersRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a ListPeersRequest message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns ListPeersRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.ListPeersRequest;

        /**
         * Decodes a ListPeersRequest message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns ListPeersRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.ListPeersRequest;

        /**
         * Verifies a ListPeersRequest message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a ListPeersRequest message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns ListPeersRequest
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.ListPeersRequest;

        /**
         * Creates a plain object from a ListPeersRequest message. Also converts values to other types if specified.
         * @param message ListPeersRequest
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.ListPeersRequest,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this ListPeersRequest to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for ListPeersRequest
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a ListPeersResponse. */
    interface IListPeersResponse {
        /** ListPeersResponse peers */
        peers?: types.IPeer[] | null;
    }

    /** Represents a ListPeersResponse. */
    class ListPeersResponse implements IListPeersResponse {
        /**
         * Constructs a new ListPeersResponse.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IListPeersResponse);

        /** ListPeersResponse peers. */
        public peers: types.IPeer[];

        /**
         * Creates a new ListPeersResponse instance using the specified properties.
         * @param [properties] Properties to set
         * @returns ListPeersResponse instance
         */
        public static create(
            properties?: api.IListPeersResponse
        ): api.ListPeersResponse;

        /**
         * Encodes the specified ListPeersResponse message. Does not implicitly {@link api.ListPeersResponse.verify|verify} messages.
         * @param message ListPeersResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IListPeersResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified ListPeersResponse message, length delimited. Does not implicitly {@link api.ListPeersResponse.verify|verify} messages.
         * @param message ListPeersResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IListPeersResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a ListPeersResponse message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns ListPeersResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.ListPeersResponse;

        /**
         * Decodes a ListPeersResponse message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns ListPeersResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.ListPeersResponse;

        /**
         * Verifies a ListPeersResponse message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a ListPeersResponse message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns ListPeersResponse
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.ListPeersResponse;

        /**
         * Creates a plain object from a ListPeersResponse message. Also converts values to other types if specified.
         * @param message ListPeersResponse
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.ListPeersResponse,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this ListPeersResponse to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for ListPeersResponse
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a GraphListChannelsRequest. */
    interface IGraphListChannelsRequest {}

    /** Represents a GraphListChannelsRequest. */
    class GraphListChannelsRequest implements IGraphListChannelsRequest {
        /**
         * Constructs a new GraphListChannelsRequest.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IGraphListChannelsRequest);

        /**
         * Creates a new GraphListChannelsRequest instance using the specified properties.
         * @param [properties] Properties to set
         * @returns GraphListChannelsRequest instance
         */
        public static create(
            properties?: api.IGraphListChannelsRequest
        ): api.GraphListChannelsRequest;

        /**
         * Encodes the specified GraphListChannelsRequest message. Does not implicitly {@link api.GraphListChannelsRequest.verify|verify} messages.
         * @param message GraphListChannelsRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IGraphListChannelsRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified GraphListChannelsRequest message, length delimited. Does not implicitly {@link api.GraphListChannelsRequest.verify|verify} messages.
         * @param message GraphListChannelsRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IGraphListChannelsRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a GraphListChannelsRequest message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns GraphListChannelsRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.GraphListChannelsRequest;

        /**
         * Decodes a GraphListChannelsRequest message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns GraphListChannelsRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.GraphListChannelsRequest;

        /**
         * Verifies a GraphListChannelsRequest message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a GraphListChannelsRequest message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns GraphListChannelsRequest
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.GraphListChannelsRequest;

        /**
         * Creates a plain object from a GraphListChannelsRequest message. Also converts values to other types if specified.
         * @param message GraphListChannelsRequest
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.GraphListChannelsRequest,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this GraphListChannelsRequest to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for GraphListChannelsRequest
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a GraphListChannelsResponse. */
    interface IGraphListChannelsResponse {
        /** GraphListChannelsResponse short_channel_ids */
        short_channel_ids?: Long[] | null;
    }

    /** Represents a GraphListChannelsResponse. */
    class GraphListChannelsResponse implements IGraphListChannelsResponse {
        /**
         * Constructs a new GraphListChannelsResponse.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IGraphListChannelsResponse);

        /** GraphListChannelsResponse short_channel_ids. */
        public short_channel_ids: Long[];

        /**
         * Creates a new GraphListChannelsResponse instance using the specified properties.
         * @param [properties] Properties to set
         * @returns GraphListChannelsResponse instance
         */
        public static create(
            properties?: api.IGraphListChannelsResponse
        ): api.GraphListChannelsResponse;

        /**
         * Encodes the specified GraphListChannelsResponse message. Does not implicitly {@link api.GraphListChannelsResponse.verify|verify} messages.
         * @param message GraphListChannelsResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IGraphListChannelsResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified GraphListChannelsResponse message, length delimited. Does not implicitly {@link api.GraphListChannelsResponse.verify|verify} messages.
         * @param message GraphListChannelsResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IGraphListChannelsResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a GraphListChannelsResponse message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns GraphListChannelsResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.GraphListChannelsResponse;

        /**
         * Decodes a GraphListChannelsResponse message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns GraphListChannelsResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.GraphListChannelsResponse;

        /**
         * Verifies a GraphListChannelsResponse message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a GraphListChannelsResponse message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns GraphListChannelsResponse
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.GraphListChannelsResponse;

        /**
         * Creates a plain object from a GraphListChannelsResponse message. Also converts values to other types if specified.
         * @param message GraphListChannelsResponse
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.GraphListChannelsResponse,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this GraphListChannelsResponse to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for GraphListChannelsResponse
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a GraphGetChannelRequest. */
    interface IGraphGetChannelRequest {
        /** GraphGetChannelRequest short_channel_id */
        short_channel_id?: Long | null;
    }

    /** Represents a GraphGetChannelRequest. */
    class GraphGetChannelRequest implements IGraphGetChannelRequest {
        /**
         * Constructs a new GraphGetChannelRequest.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IGraphGetChannelRequest);

        /** GraphGetChannelRequest short_channel_id. */
        public short_channel_id: Long;

        /**
         * Creates a new GraphGetChannelRequest instance using the specified properties.
         * @param [properties] Properties to set
         * @returns GraphGetChannelRequest instance
         */
        public static create(
            properties?: api.IGraphGetChannelRequest
        ): api.GraphGetChannelRequest;

        /**
         * Encodes the specified GraphGetChannelRequest message. Does not implicitly {@link api.GraphGetChannelRequest.verify|verify} messages.
         * @param message GraphGetChannelRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IGraphGetChannelRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified GraphGetChannelRequest message, length delimited. Does not implicitly {@link api.GraphGetChannelRequest.verify|verify} messages.
         * @param message GraphGetChannelRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IGraphGetChannelRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a GraphGetChannelRequest message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns GraphGetChannelRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.GraphGetChannelRequest;

        /**
         * Decodes a GraphGetChannelRequest message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns GraphGetChannelRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.GraphGetChannelRequest;

        /**
         * Verifies a GraphGetChannelRequest message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a GraphGetChannelRequest message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns GraphGetChannelRequest
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.GraphGetChannelRequest;

        /**
         * Creates a plain object from a GraphGetChannelRequest message. Also converts values to other types if specified.
         * @param message GraphGetChannelRequest
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.GraphGetChannelRequest,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this GraphGetChannelRequest to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for GraphGetChannelRequest
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a GraphGetChannelResponse. */
    interface IGraphGetChannelResponse {
        /** GraphGetChannelResponse channel */
        channel?: types.IGraphChannel | null;
    }

    /** Represents a GraphGetChannelResponse. */
    class GraphGetChannelResponse implements IGraphGetChannelResponse {
        /**
         * Constructs a new GraphGetChannelResponse.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IGraphGetChannelResponse);

        /** GraphGetChannelResponse channel. */
        public channel?: types.IGraphChannel | null;

        /**
         * Creates a new GraphGetChannelResponse instance using the specified properties.
         * @param [properties] Properties to set
         * @returns GraphGetChannelResponse instance
         */
        public static create(
            properties?: api.IGraphGetChannelResponse
        ): api.GraphGetChannelResponse;

        /**
         * Encodes the specified GraphGetChannelResponse message. Does not implicitly {@link api.GraphGetChannelResponse.verify|verify} messages.
         * @param message GraphGetChannelResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IGraphGetChannelResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified GraphGetChannelResponse message, length delimited. Does not implicitly {@link api.GraphGetChannelResponse.verify|verify} messages.
         * @param message GraphGetChannelResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IGraphGetChannelResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a GraphGetChannelResponse message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns GraphGetChannelResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.GraphGetChannelResponse;

        /**
         * Decodes a GraphGetChannelResponse message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns GraphGetChannelResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.GraphGetChannelResponse;

        /**
         * Verifies a GraphGetChannelResponse message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a GraphGetChannelResponse message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns GraphGetChannelResponse
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.GraphGetChannelResponse;

        /**
         * Creates a plain object from a GraphGetChannelResponse message. Also converts values to other types if specified.
         * @param message GraphGetChannelResponse
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.GraphGetChannelResponse,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this GraphGetChannelResponse to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for GraphGetChannelResponse
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a GraphListNodesRequest. */
    interface IGraphListNodesRequest {}

    /** Represents a GraphListNodesRequest. */
    class GraphListNodesRequest implements IGraphListNodesRequest {
        /**
         * Constructs a new GraphListNodesRequest.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IGraphListNodesRequest);

        /**
         * Creates a new GraphListNodesRequest instance using the specified properties.
         * @param [properties] Properties to set
         * @returns GraphListNodesRequest instance
         */
        public static create(
            properties?: api.IGraphListNodesRequest
        ): api.GraphListNodesRequest;

        /**
         * Encodes the specified GraphListNodesRequest message. Does not implicitly {@link api.GraphListNodesRequest.verify|verify} messages.
         * @param message GraphListNodesRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IGraphListNodesRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified GraphListNodesRequest message, length delimited. Does not implicitly {@link api.GraphListNodesRequest.verify|verify} messages.
         * @param message GraphListNodesRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IGraphListNodesRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a GraphListNodesRequest message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns GraphListNodesRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.GraphListNodesRequest;

        /**
         * Decodes a GraphListNodesRequest message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns GraphListNodesRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.GraphListNodesRequest;

        /**
         * Verifies a GraphListNodesRequest message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a GraphListNodesRequest message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns GraphListNodesRequest
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.GraphListNodesRequest;

        /**
         * Creates a plain object from a GraphListNodesRequest message. Also converts values to other types if specified.
         * @param message GraphListNodesRequest
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.GraphListNodesRequest,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this GraphListNodesRequest to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for GraphListNodesRequest
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a GraphListNodesResponse. */
    interface IGraphListNodesResponse {
        /** GraphListNodesResponse node_ids */
        node_ids?: string[] | null;
    }

    /** Represents a GraphListNodesResponse. */
    class GraphListNodesResponse implements IGraphListNodesResponse {
        /**
         * Constructs a new GraphListNodesResponse.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IGraphListNodesResponse);

        /** GraphListNodesResponse node_ids. */
        public node_ids: string[];

        /**
         * Creates a new GraphListNodesResponse instance using the specified properties.
         * @param [properties] Properties to set
         * @returns GraphListNodesResponse instance
         */
        public static create(
            properties?: api.IGraphListNodesResponse
        ): api.GraphListNodesResponse;

        /**
         * Encodes the specified GraphListNodesResponse message. Does not implicitly {@link api.GraphListNodesResponse.verify|verify} messages.
         * @param message GraphListNodesResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IGraphListNodesResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified GraphListNodesResponse message, length delimited. Does not implicitly {@link api.GraphListNodesResponse.verify|verify} messages.
         * @param message GraphListNodesResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IGraphListNodesResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a GraphListNodesResponse message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns GraphListNodesResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.GraphListNodesResponse;

        /**
         * Decodes a GraphListNodesResponse message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns GraphListNodesResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.GraphListNodesResponse;

        /**
         * Verifies a GraphListNodesResponse message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a GraphListNodesResponse message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns GraphListNodesResponse
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.GraphListNodesResponse;

        /**
         * Creates a plain object from a GraphListNodesResponse message. Also converts values to other types if specified.
         * @param message GraphListNodesResponse
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.GraphListNodesResponse,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this GraphListNodesResponse to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for GraphListNodesResponse
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of an UnifiedSendRequest. */
    interface IUnifiedSendRequest {
        /** UnifiedSendRequest uri */
        uri?: string | null;

        /** UnifiedSendRequest amount_msat */
        amount_msat?: Long | null;

        /** UnifiedSendRequest route_parameters */
        route_parameters?: types.IRouteParametersConfig | null;
    }

    /** Represents an UnifiedSendRequest. */
    class UnifiedSendRequest implements IUnifiedSendRequest {
        /**
         * Constructs a new UnifiedSendRequest.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IUnifiedSendRequest);

        /** UnifiedSendRequest uri. */
        public uri: string;

        /** UnifiedSendRequest amount_msat. */
        public amount_msat?: Long | null;

        /** UnifiedSendRequest route_parameters. */
        public route_parameters?: types.IRouteParametersConfig | null;

        /**
         * Creates a new UnifiedSendRequest instance using the specified properties.
         * @param [properties] Properties to set
         * @returns UnifiedSendRequest instance
         */
        public static create(
            properties?: api.IUnifiedSendRequest
        ): api.UnifiedSendRequest;

        /**
         * Encodes the specified UnifiedSendRequest message. Does not implicitly {@link api.UnifiedSendRequest.verify|verify} messages.
         * @param message UnifiedSendRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IUnifiedSendRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified UnifiedSendRequest message, length delimited. Does not implicitly {@link api.UnifiedSendRequest.verify|verify} messages.
         * @param message UnifiedSendRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IUnifiedSendRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes an UnifiedSendRequest message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns UnifiedSendRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.UnifiedSendRequest;

        /**
         * Decodes an UnifiedSendRequest message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns UnifiedSendRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.UnifiedSendRequest;

        /**
         * Verifies an UnifiedSendRequest message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates an UnifiedSendRequest message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns UnifiedSendRequest
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.UnifiedSendRequest;

        /**
         * Creates a plain object from an UnifiedSendRequest message. Also converts values to other types if specified.
         * @param message UnifiedSendRequest
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.UnifiedSendRequest,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this UnifiedSendRequest to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for UnifiedSendRequest
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of an UnifiedSendResponse. */
    interface IUnifiedSendResponse {
        /** UnifiedSendResponse txid */
        txid?: string | null;

        /** UnifiedSendResponse bolt11_payment_id */
        bolt11_payment_id?: string | null;

        /** UnifiedSendResponse bolt12_payment_id */
        bolt12_payment_id?: string | null;
    }

    /** Represents an UnifiedSendResponse. */
    class UnifiedSendResponse implements IUnifiedSendResponse {
        /**
         * Constructs a new UnifiedSendResponse.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IUnifiedSendResponse);

        /** UnifiedSendResponse txid. */
        public txid?: string | null;

        /** UnifiedSendResponse bolt11_payment_id. */
        public bolt11_payment_id?: string | null;

        /** UnifiedSendResponse bolt12_payment_id. */
        public bolt12_payment_id?: string | null;

        /** UnifiedSendResponse payment_result. */
        public payment_result?:
            | 'txid'
            | 'bolt11_payment_id'
            | 'bolt12_payment_id';

        /**
         * Creates a new UnifiedSendResponse instance using the specified properties.
         * @param [properties] Properties to set
         * @returns UnifiedSendResponse instance
         */
        public static create(
            properties?: api.IUnifiedSendResponse
        ): api.UnifiedSendResponse;

        /**
         * Encodes the specified UnifiedSendResponse message. Does not implicitly {@link api.UnifiedSendResponse.verify|verify} messages.
         * @param message UnifiedSendResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IUnifiedSendResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified UnifiedSendResponse message, length delimited. Does not implicitly {@link api.UnifiedSendResponse.verify|verify} messages.
         * @param message UnifiedSendResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IUnifiedSendResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes an UnifiedSendResponse message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns UnifiedSendResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.UnifiedSendResponse;

        /**
         * Decodes an UnifiedSendResponse message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns UnifiedSendResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.UnifiedSendResponse;

        /**
         * Verifies an UnifiedSendResponse message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates an UnifiedSendResponse message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns UnifiedSendResponse
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.UnifiedSendResponse;

        /**
         * Creates a plain object from an UnifiedSendResponse message. Also converts values to other types if specified.
         * @param message UnifiedSendResponse
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.UnifiedSendResponse,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this UnifiedSendResponse to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for UnifiedSendResponse
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a GraphGetNodeRequest. */
    interface IGraphGetNodeRequest {
        /** GraphGetNodeRequest node_id */
        node_id?: string | null;
    }

    /** Represents a GraphGetNodeRequest. */
    class GraphGetNodeRequest implements IGraphGetNodeRequest {
        /**
         * Constructs a new GraphGetNodeRequest.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IGraphGetNodeRequest);

        /** GraphGetNodeRequest node_id. */
        public node_id: string;

        /**
         * Creates a new GraphGetNodeRequest instance using the specified properties.
         * @param [properties] Properties to set
         * @returns GraphGetNodeRequest instance
         */
        public static create(
            properties?: api.IGraphGetNodeRequest
        ): api.GraphGetNodeRequest;

        /**
         * Encodes the specified GraphGetNodeRequest message. Does not implicitly {@link api.GraphGetNodeRequest.verify|verify} messages.
         * @param message GraphGetNodeRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IGraphGetNodeRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified GraphGetNodeRequest message, length delimited. Does not implicitly {@link api.GraphGetNodeRequest.verify|verify} messages.
         * @param message GraphGetNodeRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IGraphGetNodeRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a GraphGetNodeRequest message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns GraphGetNodeRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.GraphGetNodeRequest;

        /**
         * Decodes a GraphGetNodeRequest message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns GraphGetNodeRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.GraphGetNodeRequest;

        /**
         * Verifies a GraphGetNodeRequest message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a GraphGetNodeRequest message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns GraphGetNodeRequest
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.GraphGetNodeRequest;

        /**
         * Creates a plain object from a GraphGetNodeRequest message. Also converts values to other types if specified.
         * @param message GraphGetNodeRequest
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.GraphGetNodeRequest,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this GraphGetNodeRequest to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for GraphGetNodeRequest
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a GraphGetNodeResponse. */
    interface IGraphGetNodeResponse {
        /** GraphGetNodeResponse node */
        node?: types.IGraphNode | null;
    }

    /** Represents a GraphGetNodeResponse. */
    class GraphGetNodeResponse implements IGraphGetNodeResponse {
        /**
         * Constructs a new GraphGetNodeResponse.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IGraphGetNodeResponse);

        /** GraphGetNodeResponse node. */
        public node?: types.IGraphNode | null;

        /**
         * Creates a new GraphGetNodeResponse instance using the specified properties.
         * @param [properties] Properties to set
         * @returns GraphGetNodeResponse instance
         */
        public static create(
            properties?: api.IGraphGetNodeResponse
        ): api.GraphGetNodeResponse;

        /**
         * Encodes the specified GraphGetNodeResponse message. Does not implicitly {@link api.GraphGetNodeResponse.verify|verify} messages.
         * @param message GraphGetNodeResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IGraphGetNodeResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified GraphGetNodeResponse message, length delimited. Does not implicitly {@link api.GraphGetNodeResponse.verify|verify} messages.
         * @param message GraphGetNodeResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IGraphGetNodeResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a GraphGetNodeResponse message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns GraphGetNodeResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.GraphGetNodeResponse;

        /**
         * Decodes a GraphGetNodeResponse message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns GraphGetNodeResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.GraphGetNodeResponse;

        /**
         * Verifies a GraphGetNodeResponse message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a GraphGetNodeResponse message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns GraphGetNodeResponse
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.GraphGetNodeResponse;

        /**
         * Creates a plain object from a GraphGetNodeResponse message. Also converts values to other types if specified.
         * @param message GraphGetNodeResponse
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.GraphGetNodeResponse,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this GraphGetNodeResponse to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for GraphGetNodeResponse
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a DecodeInvoiceRequest. */
    interface IDecodeInvoiceRequest {
        /** DecodeInvoiceRequest invoice */
        invoice?: string | null;
    }

    /** Represents a DecodeInvoiceRequest. */
    class DecodeInvoiceRequest implements IDecodeInvoiceRequest {
        /**
         * Constructs a new DecodeInvoiceRequest.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IDecodeInvoiceRequest);

        /** DecodeInvoiceRequest invoice. */
        public invoice: string;

        /**
         * Creates a new DecodeInvoiceRequest instance using the specified properties.
         * @param [properties] Properties to set
         * @returns DecodeInvoiceRequest instance
         */
        public static create(
            properties?: api.IDecodeInvoiceRequest
        ): api.DecodeInvoiceRequest;

        /**
         * Encodes the specified DecodeInvoiceRequest message. Does not implicitly {@link api.DecodeInvoiceRequest.verify|verify} messages.
         * @param message DecodeInvoiceRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IDecodeInvoiceRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified DecodeInvoiceRequest message, length delimited. Does not implicitly {@link api.DecodeInvoiceRequest.verify|verify} messages.
         * @param message DecodeInvoiceRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IDecodeInvoiceRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a DecodeInvoiceRequest message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns DecodeInvoiceRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.DecodeInvoiceRequest;

        /**
         * Decodes a DecodeInvoiceRequest message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns DecodeInvoiceRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.DecodeInvoiceRequest;

        /**
         * Verifies a DecodeInvoiceRequest message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a DecodeInvoiceRequest message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns DecodeInvoiceRequest
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.DecodeInvoiceRequest;

        /**
         * Creates a plain object from a DecodeInvoiceRequest message. Also converts values to other types if specified.
         * @param message DecodeInvoiceRequest
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.DecodeInvoiceRequest,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this DecodeInvoiceRequest to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for DecodeInvoiceRequest
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a DecodeInvoiceResponse. */
    interface IDecodeInvoiceResponse {
        /** DecodeInvoiceResponse destination */
        destination?: string | null;

        /** DecodeInvoiceResponse payment_hash */
        payment_hash?: string | null;

        /** DecodeInvoiceResponse amount_msat */
        amount_msat?: Long | null;

        /** DecodeInvoiceResponse timestamp */
        timestamp?: Long | null;

        /** DecodeInvoiceResponse expiry */
        expiry?: Long | null;

        /** DecodeInvoiceResponse description */
        description?: string | null;

        /** DecodeInvoiceResponse description_hash */
        description_hash?: string | null;

        /** DecodeInvoiceResponse fallback_address */
        fallback_address?: string | null;

        /** DecodeInvoiceResponse min_final_cltv_expiry_delta */
        min_final_cltv_expiry_delta?: Long | null;

        /** DecodeInvoiceResponse payment_secret */
        payment_secret?: string | null;

        /** DecodeInvoiceResponse route_hints */
        route_hints?: types.IBolt11RouteHint[] | null;

        /** DecodeInvoiceResponse features */
        features?: { [k: string]: types.IBolt11Feature } | null;

        /** DecodeInvoiceResponse currency */
        currency?: string | null;

        /** DecodeInvoiceResponse payment_metadata */
        payment_metadata?: string | null;

        /** DecodeInvoiceResponse is_expired */
        is_expired?: boolean | null;
    }

    /** Represents a DecodeInvoiceResponse. */
    class DecodeInvoiceResponse implements IDecodeInvoiceResponse {
        /**
         * Constructs a new DecodeInvoiceResponse.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IDecodeInvoiceResponse);

        /** DecodeInvoiceResponse destination. */
        public destination: string;

        /** DecodeInvoiceResponse payment_hash. */
        public payment_hash: string;

        /** DecodeInvoiceResponse amount_msat. */
        public amount_msat?: Long | null;

        /** DecodeInvoiceResponse timestamp. */
        public timestamp: Long;

        /** DecodeInvoiceResponse expiry. */
        public expiry: Long;

        /** DecodeInvoiceResponse description. */
        public description?: string | null;

        /** DecodeInvoiceResponse description_hash. */
        public description_hash?: string | null;

        /** DecodeInvoiceResponse fallback_address. */
        public fallback_address?: string | null;

        /** DecodeInvoiceResponse min_final_cltv_expiry_delta. */
        public min_final_cltv_expiry_delta: Long;

        /** DecodeInvoiceResponse payment_secret. */
        public payment_secret: string;

        /** DecodeInvoiceResponse route_hints. */
        public route_hints: types.IBolt11RouteHint[];

        /** DecodeInvoiceResponse features. */
        public features: { [k: string]: types.IBolt11Feature };

        /** DecodeInvoiceResponse currency. */
        public currency: string;

        /** DecodeInvoiceResponse payment_metadata. */
        public payment_metadata?: string | null;

        /** DecodeInvoiceResponse is_expired. */
        public is_expired: boolean;

        /**
         * Creates a new DecodeInvoiceResponse instance using the specified properties.
         * @param [properties] Properties to set
         * @returns DecodeInvoiceResponse instance
         */
        public static create(
            properties?: api.IDecodeInvoiceResponse
        ): api.DecodeInvoiceResponse;

        /**
         * Encodes the specified DecodeInvoiceResponse message. Does not implicitly {@link api.DecodeInvoiceResponse.verify|verify} messages.
         * @param message DecodeInvoiceResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IDecodeInvoiceResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified DecodeInvoiceResponse message, length delimited. Does not implicitly {@link api.DecodeInvoiceResponse.verify|verify} messages.
         * @param message DecodeInvoiceResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IDecodeInvoiceResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a DecodeInvoiceResponse message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns DecodeInvoiceResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.DecodeInvoiceResponse;

        /**
         * Decodes a DecodeInvoiceResponse message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns DecodeInvoiceResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.DecodeInvoiceResponse;

        /**
         * Verifies a DecodeInvoiceResponse message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a DecodeInvoiceResponse message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns DecodeInvoiceResponse
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.DecodeInvoiceResponse;

        /**
         * Creates a plain object from a DecodeInvoiceResponse message. Also converts values to other types if specified.
         * @param message DecodeInvoiceResponse
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.DecodeInvoiceResponse,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this DecodeInvoiceResponse to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for DecodeInvoiceResponse
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a DecodeOfferRequest. */
    interface IDecodeOfferRequest {
        /** DecodeOfferRequest offer */
        offer?: string | null;
    }

    /** Represents a DecodeOfferRequest. */
    class DecodeOfferRequest implements IDecodeOfferRequest {
        /**
         * Constructs a new DecodeOfferRequest.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IDecodeOfferRequest);

        /** DecodeOfferRequest offer. */
        public offer: string;

        /**
         * Creates a new DecodeOfferRequest instance using the specified properties.
         * @param [properties] Properties to set
         * @returns DecodeOfferRequest instance
         */
        public static create(
            properties?: api.IDecodeOfferRequest
        ): api.DecodeOfferRequest;

        /**
         * Encodes the specified DecodeOfferRequest message. Does not implicitly {@link api.DecodeOfferRequest.verify|verify} messages.
         * @param message DecodeOfferRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IDecodeOfferRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified DecodeOfferRequest message, length delimited. Does not implicitly {@link api.DecodeOfferRequest.verify|verify} messages.
         * @param message DecodeOfferRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IDecodeOfferRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a DecodeOfferRequest message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns DecodeOfferRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.DecodeOfferRequest;

        /**
         * Decodes a DecodeOfferRequest message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns DecodeOfferRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.DecodeOfferRequest;

        /**
         * Verifies a DecodeOfferRequest message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a DecodeOfferRequest message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns DecodeOfferRequest
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.DecodeOfferRequest;

        /**
         * Creates a plain object from a DecodeOfferRequest message. Also converts values to other types if specified.
         * @param message DecodeOfferRequest
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.DecodeOfferRequest,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this DecodeOfferRequest to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for DecodeOfferRequest
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a DecodeOfferResponse. */
    interface IDecodeOfferResponse {
        /** DecodeOfferResponse offer_id */
        offer_id?: string | null;

        /** DecodeOfferResponse description */
        description?: string | null;

        /** DecodeOfferResponse issuer */
        issuer?: string | null;

        /** DecodeOfferResponse amount */
        amount?: types.IOfferAmount | null;

        /** DecodeOfferResponse issuer_signing_pubkey */
        issuer_signing_pubkey?: string | null;

        /** DecodeOfferResponse absolute_expiry */
        absolute_expiry?: Long | null;

        /** DecodeOfferResponse quantity */
        quantity?: types.IOfferQuantity | null;

        /** DecodeOfferResponse paths */
        paths?: types.IBlindedPath[] | null;

        /** DecodeOfferResponse features */
        features?: { [k: string]: types.IBolt11Feature } | null;

        /** DecodeOfferResponse chains */
        chains?: string[] | null;

        /** DecodeOfferResponse metadata */
        metadata?: string | null;

        /** DecodeOfferResponse is_expired */
        is_expired?: boolean | null;
    }

    /** Represents a DecodeOfferResponse. */
    class DecodeOfferResponse implements IDecodeOfferResponse {
        /**
         * Constructs a new DecodeOfferResponse.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.IDecodeOfferResponse);

        /** DecodeOfferResponse offer_id. */
        public offer_id: string;

        /** DecodeOfferResponse description. */
        public description?: string | null;

        /** DecodeOfferResponse issuer. */
        public issuer?: string | null;

        /** DecodeOfferResponse amount. */
        public amount?: types.IOfferAmount | null;

        /** DecodeOfferResponse issuer_signing_pubkey. */
        public issuer_signing_pubkey?: string | null;

        /** DecodeOfferResponse absolute_expiry. */
        public absolute_expiry?: Long | null;

        /** DecodeOfferResponse quantity. */
        public quantity?: types.IOfferQuantity | null;

        /** DecodeOfferResponse paths. */
        public paths: types.IBlindedPath[];

        /** DecodeOfferResponse features. */
        public features: { [k: string]: types.IBolt11Feature };

        /** DecodeOfferResponse chains. */
        public chains: string[];

        /** DecodeOfferResponse metadata. */
        public metadata?: string | null;

        /** DecodeOfferResponse is_expired. */
        public is_expired: boolean;

        /**
         * Creates a new DecodeOfferResponse instance using the specified properties.
         * @param [properties] Properties to set
         * @returns DecodeOfferResponse instance
         */
        public static create(
            properties?: api.IDecodeOfferResponse
        ): api.DecodeOfferResponse;

        /**
         * Encodes the specified DecodeOfferResponse message. Does not implicitly {@link api.DecodeOfferResponse.verify|verify} messages.
         * @param message DecodeOfferResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.IDecodeOfferResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified DecodeOfferResponse message, length delimited. Does not implicitly {@link api.DecodeOfferResponse.verify|verify} messages.
         * @param message DecodeOfferResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.IDecodeOfferResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a DecodeOfferResponse message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns DecodeOfferResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.DecodeOfferResponse;

        /**
         * Decodes a DecodeOfferResponse message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns DecodeOfferResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.DecodeOfferResponse;

        /**
         * Verifies a DecodeOfferResponse message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a DecodeOfferResponse message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns DecodeOfferResponse
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.DecodeOfferResponse;

        /**
         * Creates a plain object from a DecodeOfferResponse message. Also converts values to other types if specified.
         * @param message DecodeOfferResponse
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.DecodeOfferResponse,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this DecodeOfferResponse to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for DecodeOfferResponse
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a SubscribeEventsRequest. */
    interface ISubscribeEventsRequest {}

    /** Represents a SubscribeEventsRequest. */
    class SubscribeEventsRequest implements ISubscribeEventsRequest {
        /**
         * Constructs a new SubscribeEventsRequest.
         * @param [properties] Properties to set
         */
        constructor(properties?: api.ISubscribeEventsRequest);

        /**
         * Creates a new SubscribeEventsRequest instance using the specified properties.
         * @param [properties] Properties to set
         * @returns SubscribeEventsRequest instance
         */
        public static create(
            properties?: api.ISubscribeEventsRequest
        ): api.SubscribeEventsRequest;

        /**
         * Encodes the specified SubscribeEventsRequest message. Does not implicitly {@link api.SubscribeEventsRequest.verify|verify} messages.
         * @param message SubscribeEventsRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: api.ISubscribeEventsRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified SubscribeEventsRequest message, length delimited. Does not implicitly {@link api.SubscribeEventsRequest.verify|verify} messages.
         * @param message SubscribeEventsRequest message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: api.ISubscribeEventsRequest,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a SubscribeEventsRequest message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns SubscribeEventsRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): api.SubscribeEventsRequest;

        /**
         * Decodes a SubscribeEventsRequest message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns SubscribeEventsRequest
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): api.SubscribeEventsRequest;

        /**
         * Verifies a SubscribeEventsRequest message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a SubscribeEventsRequest message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns SubscribeEventsRequest
         */
        public static fromObject(object: {
            [k: string]: any;
        }): api.SubscribeEventsRequest;

        /**
         * Creates a plain object from a SubscribeEventsRequest message. Also converts values to other types if specified.
         * @param message SubscribeEventsRequest
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: api.SubscribeEventsRequest,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this SubscribeEventsRequest to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for SubscribeEventsRequest
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Represents a LightningNode */
    class LightningNode extends $protobuf.rpc.Service {
        /**
         * Constructs a new LightningNode service.
         * @param rpcImpl RPC implementation
         * @param [requestDelimited=false] Whether requests are length-delimited
         * @param [responseDelimited=false] Whether responses are length-delimited
         */
        constructor(
            rpcImpl: $protobuf.RPCImpl,
            requestDelimited?: boolean,
            responseDelimited?: boolean
        );

        /**
         * Creates new LightningNode service using the specified rpc implementation.
         * @param rpcImpl RPC implementation
         * @param [requestDelimited=false] Whether requests are length-delimited
         * @param [responseDelimited=false] Whether responses are length-delimited
         * @returns RPC service. Useful where requests and/or responses are streamed.
         */
        public static create(
            rpcImpl: $protobuf.RPCImpl,
            requestDelimited?: boolean,
            responseDelimited?: boolean
        ): LightningNode;

        /**
         * Calls GetNodeInfo.
         * @param request GetNodeInfoRequest message or plain object
         * @param callback Node-style callback called with the error, if any, and GetNodeInfoResponse
         */
        public getNodeInfo(
            request: api.IGetNodeInfoRequest,
            callback: api.LightningNode.GetNodeInfoCallback
        ): void;

        /**
         * Calls GetNodeInfo.
         * @param request GetNodeInfoRequest message or plain object
         * @returns Promise
         */
        public getNodeInfo(
            request: api.IGetNodeInfoRequest
        ): Promise<api.GetNodeInfoResponse>;

        /**
         * Calls GetBalances.
         * @param request GetBalancesRequest message or plain object
         * @param callback Node-style callback called with the error, if any, and GetBalancesResponse
         */
        public getBalances(
            request: api.IGetBalancesRequest,
            callback: api.LightningNode.GetBalancesCallback
        ): void;

        /**
         * Calls GetBalances.
         * @param request GetBalancesRequest message or plain object
         * @returns Promise
         */
        public getBalances(
            request: api.IGetBalancesRequest
        ): Promise<api.GetBalancesResponse>;

        /**
         * Calls OnchainReceive.
         * @param request OnchainReceiveRequest message or plain object
         * @param callback Node-style callback called with the error, if any, and OnchainReceiveResponse
         */
        public onchainReceive(
            request: api.IOnchainReceiveRequest,
            callback: api.LightningNode.OnchainReceiveCallback
        ): void;

        /**
         * Calls OnchainReceive.
         * @param request OnchainReceiveRequest message or plain object
         * @returns Promise
         */
        public onchainReceive(
            request: api.IOnchainReceiveRequest
        ): Promise<api.OnchainReceiveResponse>;

        /**
         * Calls OnchainSend.
         * @param request OnchainSendRequest message or plain object
         * @param callback Node-style callback called with the error, if any, and OnchainSendResponse
         */
        public onchainSend(
            request: api.IOnchainSendRequest,
            callback: api.LightningNode.OnchainSendCallback
        ): void;

        /**
         * Calls OnchainSend.
         * @param request OnchainSendRequest message or plain object
         * @returns Promise
         */
        public onchainSend(
            request: api.IOnchainSendRequest
        ): Promise<api.OnchainSendResponse>;

        /**
         * Calls Bolt11Receive.
         * @param request Bolt11ReceiveRequest message or plain object
         * @param callback Node-style callback called with the error, if any, and Bolt11ReceiveResponse
         */
        public bolt11Receive(
            request: api.IBolt11ReceiveRequest,
            callback: api.LightningNode.Bolt11ReceiveCallback
        ): void;

        /**
         * Calls Bolt11Receive.
         * @param request Bolt11ReceiveRequest message or plain object
         * @returns Promise
         */
        public bolt11Receive(
            request: api.IBolt11ReceiveRequest
        ): Promise<api.Bolt11ReceiveResponse>;

        /**
         * Calls Bolt11ReceiveForHash.
         * @param request Bolt11ReceiveForHashRequest message or plain object
         * @param callback Node-style callback called with the error, if any, and Bolt11ReceiveForHashResponse
         */
        public bolt11ReceiveForHash(
            request: api.IBolt11ReceiveForHashRequest,
            callback: api.LightningNode.Bolt11ReceiveForHashCallback
        ): void;

        /**
         * Calls Bolt11ReceiveForHash.
         * @param request Bolt11ReceiveForHashRequest message or plain object
         * @returns Promise
         */
        public bolt11ReceiveForHash(
            request: api.IBolt11ReceiveForHashRequest
        ): Promise<api.Bolt11ReceiveForHashResponse>;

        /**
         * Calls Bolt11ClaimForHash.
         * @param request Bolt11ClaimForHashRequest message or plain object
         * @param callback Node-style callback called with the error, if any, and Bolt11ClaimForHashResponse
         */
        public bolt11ClaimForHash(
            request: api.IBolt11ClaimForHashRequest,
            callback: api.LightningNode.Bolt11ClaimForHashCallback
        ): void;

        /**
         * Calls Bolt11ClaimForHash.
         * @param request Bolt11ClaimForHashRequest message or plain object
         * @returns Promise
         */
        public bolt11ClaimForHash(
            request: api.IBolt11ClaimForHashRequest
        ): Promise<api.Bolt11ClaimForHashResponse>;

        /**
         * Calls Bolt11FailForHash.
         * @param request Bolt11FailForHashRequest message or plain object
         * @param callback Node-style callback called with the error, if any, and Bolt11FailForHashResponse
         */
        public bolt11FailForHash(
            request: api.IBolt11FailForHashRequest,
            callback: api.LightningNode.Bolt11FailForHashCallback
        ): void;

        /**
         * Calls Bolt11FailForHash.
         * @param request Bolt11FailForHashRequest message or plain object
         * @returns Promise
         */
        public bolt11FailForHash(
            request: api.IBolt11FailForHashRequest
        ): Promise<api.Bolt11FailForHashResponse>;

        /**
         * Calls Bolt11ReceiveViaJitChannel.
         * @param request Bolt11ReceiveViaJitChannelRequest message or plain object
         * @param callback Node-style callback called with the error, if any, and Bolt11ReceiveViaJitChannelResponse
         */
        public bolt11ReceiveViaJitChannel(
            request: api.IBolt11ReceiveViaJitChannelRequest,
            callback: api.LightningNode.Bolt11ReceiveViaJitChannelCallback
        ): void;

        /**
         * Calls Bolt11ReceiveViaJitChannel.
         * @param request Bolt11ReceiveViaJitChannelRequest message or plain object
         * @returns Promise
         */
        public bolt11ReceiveViaJitChannel(
            request: api.IBolt11ReceiveViaJitChannelRequest
        ): Promise<api.Bolt11ReceiveViaJitChannelResponse>;

        /**
         * Calls Bolt11ReceiveVariableAmountViaJitChannel.
         * @param request Bolt11ReceiveVariableAmountViaJitChannelRequest message or plain object
         * @param callback Node-style callback called with the error, if any, and Bolt11ReceiveVariableAmountViaJitChannelResponse
         */
        public bolt11ReceiveVariableAmountViaJitChannel(
            request: api.IBolt11ReceiveVariableAmountViaJitChannelRequest,
            callback: api.LightningNode.Bolt11ReceiveVariableAmountViaJitChannelCallback
        ): void;

        /**
         * Calls Bolt11ReceiveVariableAmountViaJitChannel.
         * @param request Bolt11ReceiveVariableAmountViaJitChannelRequest message or plain object
         * @returns Promise
         */
        public bolt11ReceiveVariableAmountViaJitChannel(
            request: api.IBolt11ReceiveVariableAmountViaJitChannelRequest
        ): Promise<api.Bolt11ReceiveVariableAmountViaJitChannelResponse>;

        /**
         * Calls Bolt11Send.
         * @param request Bolt11SendRequest message or plain object
         * @param callback Node-style callback called with the error, if any, and Bolt11SendResponse
         */
        public bolt11Send(
            request: api.IBolt11SendRequest,
            callback: api.LightningNode.Bolt11SendCallback
        ): void;

        /**
         * Calls Bolt11Send.
         * @param request Bolt11SendRequest message or plain object
         * @returns Promise
         */
        public bolt11Send(
            request: api.IBolt11SendRequest
        ): Promise<api.Bolt11SendResponse>;

        /**
         * Calls Bolt12Receive.
         * @param request Bolt12ReceiveRequest message or plain object
         * @param callback Node-style callback called with the error, if any, and Bolt12ReceiveResponse
         */
        public bolt12Receive(
            request: api.IBolt12ReceiveRequest,
            callback: api.LightningNode.Bolt12ReceiveCallback
        ): void;

        /**
         * Calls Bolt12Receive.
         * @param request Bolt12ReceiveRequest message or plain object
         * @returns Promise
         */
        public bolt12Receive(
            request: api.IBolt12ReceiveRequest
        ): Promise<api.Bolt12ReceiveResponse>;

        /**
         * Calls Bolt12Send.
         * @param request Bolt12SendRequest message or plain object
         * @param callback Node-style callback called with the error, if any, and Bolt12SendResponse
         */
        public bolt12Send(
            request: api.IBolt12SendRequest,
            callback: api.LightningNode.Bolt12SendCallback
        ): void;

        /**
         * Calls Bolt12Send.
         * @param request Bolt12SendRequest message or plain object
         * @returns Promise
         */
        public bolt12Send(
            request: api.IBolt12SendRequest
        ): Promise<api.Bolt12SendResponse>;

        /**
         * Calls SpontaneousSend.
         * @param request SpontaneousSendRequest message or plain object
         * @param callback Node-style callback called with the error, if any, and SpontaneousSendResponse
         */
        public spontaneousSend(
            request: api.ISpontaneousSendRequest,
            callback: api.LightningNode.SpontaneousSendCallback
        ): void;

        /**
         * Calls SpontaneousSend.
         * @param request SpontaneousSendRequest message or plain object
         * @returns Promise
         */
        public spontaneousSend(
            request: api.ISpontaneousSendRequest
        ): Promise<api.SpontaneousSendResponse>;

        /**
         * Calls OpenChannel.
         * @param request OpenChannelRequest message or plain object
         * @param callback Node-style callback called with the error, if any, and OpenChannelResponse
         */
        public openChannel(
            request: api.IOpenChannelRequest,
            callback: api.LightningNode.OpenChannelCallback
        ): void;

        /**
         * Calls OpenChannel.
         * @param request OpenChannelRequest message or plain object
         * @returns Promise
         */
        public openChannel(
            request: api.IOpenChannelRequest
        ): Promise<api.OpenChannelResponse>;

        /**
         * Calls SpliceIn.
         * @param request SpliceInRequest message or plain object
         * @param callback Node-style callback called with the error, if any, and SpliceInResponse
         */
        public spliceIn(
            request: api.ISpliceInRequest,
            callback: api.LightningNode.SpliceInCallback
        ): void;

        /**
         * Calls SpliceIn.
         * @param request SpliceInRequest message or plain object
         * @returns Promise
         */
        public spliceIn(
            request: api.ISpliceInRequest
        ): Promise<api.SpliceInResponse>;

        /**
         * Calls SpliceOut.
         * @param request SpliceOutRequest message or plain object
         * @param callback Node-style callback called with the error, if any, and SpliceOutResponse
         */
        public spliceOut(
            request: api.ISpliceOutRequest,
            callback: api.LightningNode.SpliceOutCallback
        ): void;

        /**
         * Calls SpliceOut.
         * @param request SpliceOutRequest message or plain object
         * @returns Promise
         */
        public spliceOut(
            request: api.ISpliceOutRequest
        ): Promise<api.SpliceOutResponse>;

        /**
         * Calls UpdateChannelConfig.
         * @param request UpdateChannelConfigRequest message or plain object
         * @param callback Node-style callback called with the error, if any, and UpdateChannelConfigResponse
         */
        public updateChannelConfig(
            request: api.IUpdateChannelConfigRequest,
            callback: api.LightningNode.UpdateChannelConfigCallback
        ): void;

        /**
         * Calls UpdateChannelConfig.
         * @param request UpdateChannelConfigRequest message or plain object
         * @returns Promise
         */
        public updateChannelConfig(
            request: api.IUpdateChannelConfigRequest
        ): Promise<api.UpdateChannelConfigResponse>;

        /**
         * Calls CloseChannel.
         * @param request CloseChannelRequest message or plain object
         * @param callback Node-style callback called with the error, if any, and CloseChannelResponse
         */
        public closeChannel(
            request: api.ICloseChannelRequest,
            callback: api.LightningNode.CloseChannelCallback
        ): void;

        /**
         * Calls CloseChannel.
         * @param request CloseChannelRequest message or plain object
         * @returns Promise
         */
        public closeChannel(
            request: api.ICloseChannelRequest
        ): Promise<api.CloseChannelResponse>;

        /**
         * Calls ForceCloseChannel.
         * @param request ForceCloseChannelRequest message or plain object
         * @param callback Node-style callback called with the error, if any, and ForceCloseChannelResponse
         */
        public forceCloseChannel(
            request: api.IForceCloseChannelRequest,
            callback: api.LightningNode.ForceCloseChannelCallback
        ): void;

        /**
         * Calls ForceCloseChannel.
         * @param request ForceCloseChannelRequest message or plain object
         * @returns Promise
         */
        public forceCloseChannel(
            request: api.IForceCloseChannelRequest
        ): Promise<api.ForceCloseChannelResponse>;

        /**
         * Calls ListChannels.
         * @param request ListChannelsRequest message or plain object
         * @param callback Node-style callback called with the error, if any, and ListChannelsResponse
         */
        public listChannels(
            request: api.IListChannelsRequest,
            callback: api.LightningNode.ListChannelsCallback
        ): void;

        /**
         * Calls ListChannels.
         * @param request ListChannelsRequest message or plain object
         * @returns Promise
         */
        public listChannels(
            request: api.IListChannelsRequest
        ): Promise<api.ListChannelsResponse>;

        /**
         * Calls GetPaymentDetails.
         * @param request GetPaymentDetailsRequest message or plain object
         * @param callback Node-style callback called with the error, if any, and GetPaymentDetailsResponse
         */
        public getPaymentDetails(
            request: api.IGetPaymentDetailsRequest,
            callback: api.LightningNode.GetPaymentDetailsCallback
        ): void;

        /**
         * Calls GetPaymentDetails.
         * @param request GetPaymentDetailsRequest message or plain object
         * @returns Promise
         */
        public getPaymentDetails(
            request: api.IGetPaymentDetailsRequest
        ): Promise<api.GetPaymentDetailsResponse>;

        /**
         * Calls ListPayments.
         * @param request ListPaymentsRequest message or plain object
         * @param callback Node-style callback called with the error, if any, and ListPaymentsResponse
         */
        public listPayments(
            request: api.IListPaymentsRequest,
            callback: api.LightningNode.ListPaymentsCallback
        ): void;

        /**
         * Calls ListPayments.
         * @param request ListPaymentsRequest message or plain object
         * @returns Promise
         */
        public listPayments(
            request: api.IListPaymentsRequest
        ): Promise<api.ListPaymentsResponse>;

        /**
         * Calls ListForwardedPayments.
         * @param request ListForwardedPaymentsRequest message or plain object
         * @param callback Node-style callback called with the error, if any, and ListForwardedPaymentsResponse
         */
        public listForwardedPayments(
            request: api.IListForwardedPaymentsRequest,
            callback: api.LightningNode.ListForwardedPaymentsCallback
        ): void;

        /**
         * Calls ListForwardedPayments.
         * @param request ListForwardedPaymentsRequest message or plain object
         * @returns Promise
         */
        public listForwardedPayments(
            request: api.IListForwardedPaymentsRequest
        ): Promise<api.ListForwardedPaymentsResponse>;

        /**
         * Calls ConnectPeer.
         * @param request ConnectPeerRequest message or plain object
         * @param callback Node-style callback called with the error, if any, and ConnectPeerResponse
         */
        public connectPeer(
            request: api.IConnectPeerRequest,
            callback: api.LightningNode.ConnectPeerCallback
        ): void;

        /**
         * Calls ConnectPeer.
         * @param request ConnectPeerRequest message or plain object
         * @returns Promise
         */
        public connectPeer(
            request: api.IConnectPeerRequest
        ): Promise<api.ConnectPeerResponse>;

        /**
         * Calls DisconnectPeer.
         * @param request DisconnectPeerRequest message or plain object
         * @param callback Node-style callback called with the error, if any, and DisconnectPeerResponse
         */
        public disconnectPeer(
            request: api.IDisconnectPeerRequest,
            callback: api.LightningNode.DisconnectPeerCallback
        ): void;

        /**
         * Calls DisconnectPeer.
         * @param request DisconnectPeerRequest message or plain object
         * @returns Promise
         */
        public disconnectPeer(
            request: api.IDisconnectPeerRequest
        ): Promise<api.DisconnectPeerResponse>;

        /**
         * Calls ListPeers.
         * @param request ListPeersRequest message or plain object
         * @param callback Node-style callback called with the error, if any, and ListPeersResponse
         */
        public listPeers(
            request: api.IListPeersRequest,
            callback: api.LightningNode.ListPeersCallback
        ): void;

        /**
         * Calls ListPeers.
         * @param request ListPeersRequest message or plain object
         * @returns Promise
         */
        public listPeers(
            request: api.IListPeersRequest
        ): Promise<api.ListPeersResponse>;

        /**
         * Calls SignMessage.
         * @param request SignMessageRequest message or plain object
         * @param callback Node-style callback called with the error, if any, and SignMessageResponse
         */
        public signMessage(
            request: api.ISignMessageRequest,
            callback: api.LightningNode.SignMessageCallback
        ): void;

        /**
         * Calls SignMessage.
         * @param request SignMessageRequest message or plain object
         * @returns Promise
         */
        public signMessage(
            request: api.ISignMessageRequest
        ): Promise<api.SignMessageResponse>;

        /**
         * Calls VerifySignature.
         * @param request VerifySignatureRequest message or plain object
         * @param callback Node-style callback called with the error, if any, and VerifySignatureResponse
         */
        public verifySignature(
            request: api.IVerifySignatureRequest,
            callback: api.LightningNode.VerifySignatureCallback
        ): void;

        /**
         * Calls VerifySignature.
         * @param request VerifySignatureRequest message or plain object
         * @returns Promise
         */
        public verifySignature(
            request: api.IVerifySignatureRequest
        ): Promise<api.VerifySignatureResponse>;

        /**
         * Calls ExportPathfindingScores.
         * @param request ExportPathfindingScoresRequest message or plain object
         * @param callback Node-style callback called with the error, if any, and ExportPathfindingScoresResponse
         */
        public exportPathfindingScores(
            request: api.IExportPathfindingScoresRequest,
            callback: api.LightningNode.ExportPathfindingScoresCallback
        ): void;

        /**
         * Calls ExportPathfindingScores.
         * @param request ExportPathfindingScoresRequest message or plain object
         * @returns Promise
         */
        public exportPathfindingScores(
            request: api.IExportPathfindingScoresRequest
        ): Promise<api.ExportPathfindingScoresResponse>;

        /**
         * Calls UnifiedSend.
         * @param request UnifiedSendRequest message or plain object
         * @param callback Node-style callback called with the error, if any, and UnifiedSendResponse
         */
        public unifiedSend(
            request: api.IUnifiedSendRequest,
            callback: api.LightningNode.UnifiedSendCallback
        ): void;

        /**
         * Calls UnifiedSend.
         * @param request UnifiedSendRequest message or plain object
         * @returns Promise
         */
        public unifiedSend(
            request: api.IUnifiedSendRequest
        ): Promise<api.UnifiedSendResponse>;

        /**
         * Calls DecodeInvoice.
         * @param request DecodeInvoiceRequest message or plain object
         * @param callback Node-style callback called with the error, if any, and DecodeInvoiceResponse
         */
        public decodeInvoice(
            request: api.IDecodeInvoiceRequest,
            callback: api.LightningNode.DecodeInvoiceCallback
        ): void;

        /**
         * Calls DecodeInvoice.
         * @param request DecodeInvoiceRequest message or plain object
         * @returns Promise
         */
        public decodeInvoice(
            request: api.IDecodeInvoiceRequest
        ): Promise<api.DecodeInvoiceResponse>;

        /**
         * Calls DecodeOffer.
         * @param request DecodeOfferRequest message or plain object
         * @param callback Node-style callback called with the error, if any, and DecodeOfferResponse
         */
        public decodeOffer(
            request: api.IDecodeOfferRequest,
            callback: api.LightningNode.DecodeOfferCallback
        ): void;

        /**
         * Calls DecodeOffer.
         * @param request DecodeOfferRequest message or plain object
         * @returns Promise
         */
        public decodeOffer(
            request: api.IDecodeOfferRequest
        ): Promise<api.DecodeOfferResponse>;

        /**
         * Calls GraphListChannels.
         * @param request GraphListChannelsRequest message or plain object
         * @param callback Node-style callback called with the error, if any, and GraphListChannelsResponse
         */
        public graphListChannels(
            request: api.IGraphListChannelsRequest,
            callback: api.LightningNode.GraphListChannelsCallback
        ): void;

        /**
         * Calls GraphListChannels.
         * @param request GraphListChannelsRequest message or plain object
         * @returns Promise
         */
        public graphListChannels(
            request: api.IGraphListChannelsRequest
        ): Promise<api.GraphListChannelsResponse>;

        /**
         * Calls GraphGetChannel.
         * @param request GraphGetChannelRequest message or plain object
         * @param callback Node-style callback called with the error, if any, and GraphGetChannelResponse
         */
        public graphGetChannel(
            request: api.IGraphGetChannelRequest,
            callback: api.LightningNode.GraphGetChannelCallback
        ): void;

        /**
         * Calls GraphGetChannel.
         * @param request GraphGetChannelRequest message or plain object
         * @returns Promise
         */
        public graphGetChannel(
            request: api.IGraphGetChannelRequest
        ): Promise<api.GraphGetChannelResponse>;

        /**
         * Calls GraphListNodes.
         * @param request GraphListNodesRequest message or plain object
         * @param callback Node-style callback called with the error, if any, and GraphListNodesResponse
         */
        public graphListNodes(
            request: api.IGraphListNodesRequest,
            callback: api.LightningNode.GraphListNodesCallback
        ): void;

        /**
         * Calls GraphListNodes.
         * @param request GraphListNodesRequest message or plain object
         * @returns Promise
         */
        public graphListNodes(
            request: api.IGraphListNodesRequest
        ): Promise<api.GraphListNodesResponse>;

        /**
         * Calls GraphGetNode.
         * @param request GraphGetNodeRequest message or plain object
         * @param callback Node-style callback called with the error, if any, and GraphGetNodeResponse
         */
        public graphGetNode(
            request: api.IGraphGetNodeRequest,
            callback: api.LightningNode.GraphGetNodeCallback
        ): void;

        /**
         * Calls GraphGetNode.
         * @param request GraphGetNodeRequest message or plain object
         * @returns Promise
         */
        public graphGetNode(
            request: api.IGraphGetNodeRequest
        ): Promise<api.GraphGetNodeResponse>;

        /**
         * Calls SubscribeEvents.
         * @param request SubscribeEventsRequest message or plain object
         * @param callback Node-style callback called with the error, if any, and EventEnvelope
         */
        public subscribeEvents(
            request: api.ISubscribeEventsRequest,
            callback: api.LightningNode.SubscribeEventsCallback
        ): void;

        /**
         * Calls SubscribeEvents.
         * @param request SubscribeEventsRequest message or plain object
         * @returns Promise
         */
        public subscribeEvents(
            request: api.ISubscribeEventsRequest
        ): Promise<events.EventEnvelope>;
    }

    namespace LightningNode {
        /**
         * Callback as used by {@link api.LightningNode#getNodeInfo}.
         * @param error Error, if any
         * @param [response] GetNodeInfoResponse
         */
        type GetNodeInfoCallback = (
            error: Error | null,
            response?: api.GetNodeInfoResponse
        ) => void;

        /**
         * Callback as used by {@link api.LightningNode#getBalances}.
         * @param error Error, if any
         * @param [response] GetBalancesResponse
         */
        type GetBalancesCallback = (
            error: Error | null,
            response?: api.GetBalancesResponse
        ) => void;

        /**
         * Callback as used by {@link api.LightningNode#onchainReceive}.
         * @param error Error, if any
         * @param [response] OnchainReceiveResponse
         */
        type OnchainReceiveCallback = (
            error: Error | null,
            response?: api.OnchainReceiveResponse
        ) => void;

        /**
         * Callback as used by {@link api.LightningNode#onchainSend}.
         * @param error Error, if any
         * @param [response] OnchainSendResponse
         */
        type OnchainSendCallback = (
            error: Error | null,
            response?: api.OnchainSendResponse
        ) => void;

        /**
         * Callback as used by {@link api.LightningNode#bolt11Receive}.
         * @param error Error, if any
         * @param [response] Bolt11ReceiveResponse
         */
        type Bolt11ReceiveCallback = (
            error: Error | null,
            response?: api.Bolt11ReceiveResponse
        ) => void;

        /**
         * Callback as used by {@link api.LightningNode#bolt11ReceiveForHash}.
         * @param error Error, if any
         * @param [response] Bolt11ReceiveForHashResponse
         */
        type Bolt11ReceiveForHashCallback = (
            error: Error | null,
            response?: api.Bolt11ReceiveForHashResponse
        ) => void;

        /**
         * Callback as used by {@link api.LightningNode#bolt11ClaimForHash}.
         * @param error Error, if any
         * @param [response] Bolt11ClaimForHashResponse
         */
        type Bolt11ClaimForHashCallback = (
            error: Error | null,
            response?: api.Bolt11ClaimForHashResponse
        ) => void;

        /**
         * Callback as used by {@link api.LightningNode#bolt11FailForHash}.
         * @param error Error, if any
         * @param [response] Bolt11FailForHashResponse
         */
        type Bolt11FailForHashCallback = (
            error: Error | null,
            response?: api.Bolt11FailForHashResponse
        ) => void;

        /**
         * Callback as used by {@link api.LightningNode#bolt11ReceiveViaJitChannel}.
         * @param error Error, if any
         * @param [response] Bolt11ReceiveViaJitChannelResponse
         */
        type Bolt11ReceiveViaJitChannelCallback = (
            error: Error | null,
            response?: api.Bolt11ReceiveViaJitChannelResponse
        ) => void;

        /**
         * Callback as used by {@link api.LightningNode#bolt11ReceiveVariableAmountViaJitChannel}.
         * @param error Error, if any
         * @param [response] Bolt11ReceiveVariableAmountViaJitChannelResponse
         */
        type Bolt11ReceiveVariableAmountViaJitChannelCallback = (
            error: Error | null,
            response?: api.Bolt11ReceiveVariableAmountViaJitChannelResponse
        ) => void;

        /**
         * Callback as used by {@link api.LightningNode#bolt11Send}.
         * @param error Error, if any
         * @param [response] Bolt11SendResponse
         */
        type Bolt11SendCallback = (
            error: Error | null,
            response?: api.Bolt11SendResponse
        ) => void;

        /**
         * Callback as used by {@link api.LightningNode#bolt12Receive}.
         * @param error Error, if any
         * @param [response] Bolt12ReceiveResponse
         */
        type Bolt12ReceiveCallback = (
            error: Error | null,
            response?: api.Bolt12ReceiveResponse
        ) => void;

        /**
         * Callback as used by {@link api.LightningNode#bolt12Send}.
         * @param error Error, if any
         * @param [response] Bolt12SendResponse
         */
        type Bolt12SendCallback = (
            error: Error | null,
            response?: api.Bolt12SendResponse
        ) => void;

        /**
         * Callback as used by {@link api.LightningNode#spontaneousSend}.
         * @param error Error, if any
         * @param [response] SpontaneousSendResponse
         */
        type SpontaneousSendCallback = (
            error: Error | null,
            response?: api.SpontaneousSendResponse
        ) => void;

        /**
         * Callback as used by {@link api.LightningNode#openChannel}.
         * @param error Error, if any
         * @param [response] OpenChannelResponse
         */
        type OpenChannelCallback = (
            error: Error | null,
            response?: api.OpenChannelResponse
        ) => void;

        /**
         * Callback as used by {@link api.LightningNode#spliceIn}.
         * @param error Error, if any
         * @param [response] SpliceInResponse
         */
        type SpliceInCallback = (
            error: Error | null,
            response?: api.SpliceInResponse
        ) => void;

        /**
         * Callback as used by {@link api.LightningNode#spliceOut}.
         * @param error Error, if any
         * @param [response] SpliceOutResponse
         */
        type SpliceOutCallback = (
            error: Error | null,
            response?: api.SpliceOutResponse
        ) => void;

        /**
         * Callback as used by {@link api.LightningNode#updateChannelConfig}.
         * @param error Error, if any
         * @param [response] UpdateChannelConfigResponse
         */
        type UpdateChannelConfigCallback = (
            error: Error | null,
            response?: api.UpdateChannelConfigResponse
        ) => void;

        /**
         * Callback as used by {@link api.LightningNode#closeChannel}.
         * @param error Error, if any
         * @param [response] CloseChannelResponse
         */
        type CloseChannelCallback = (
            error: Error | null,
            response?: api.CloseChannelResponse
        ) => void;

        /**
         * Callback as used by {@link api.LightningNode#forceCloseChannel}.
         * @param error Error, if any
         * @param [response] ForceCloseChannelResponse
         */
        type ForceCloseChannelCallback = (
            error: Error | null,
            response?: api.ForceCloseChannelResponse
        ) => void;

        /**
         * Callback as used by {@link api.LightningNode#listChannels}.
         * @param error Error, if any
         * @param [response] ListChannelsResponse
         */
        type ListChannelsCallback = (
            error: Error | null,
            response?: api.ListChannelsResponse
        ) => void;

        /**
         * Callback as used by {@link api.LightningNode#getPaymentDetails}.
         * @param error Error, if any
         * @param [response] GetPaymentDetailsResponse
         */
        type GetPaymentDetailsCallback = (
            error: Error | null,
            response?: api.GetPaymentDetailsResponse
        ) => void;

        /**
         * Callback as used by {@link api.LightningNode#listPayments}.
         * @param error Error, if any
         * @param [response] ListPaymentsResponse
         */
        type ListPaymentsCallback = (
            error: Error | null,
            response?: api.ListPaymentsResponse
        ) => void;

        /**
         * Callback as used by {@link api.LightningNode#listForwardedPayments}.
         * @param error Error, if any
         * @param [response] ListForwardedPaymentsResponse
         */
        type ListForwardedPaymentsCallback = (
            error: Error | null,
            response?: api.ListForwardedPaymentsResponse
        ) => void;

        /**
         * Callback as used by {@link api.LightningNode#connectPeer}.
         * @param error Error, if any
         * @param [response] ConnectPeerResponse
         */
        type ConnectPeerCallback = (
            error: Error | null,
            response?: api.ConnectPeerResponse
        ) => void;

        /**
         * Callback as used by {@link api.LightningNode#disconnectPeer}.
         * @param error Error, if any
         * @param [response] DisconnectPeerResponse
         */
        type DisconnectPeerCallback = (
            error: Error | null,
            response?: api.DisconnectPeerResponse
        ) => void;

        /**
         * Callback as used by {@link api.LightningNode#listPeers}.
         * @param error Error, if any
         * @param [response] ListPeersResponse
         */
        type ListPeersCallback = (
            error: Error | null,
            response?: api.ListPeersResponse
        ) => void;

        /**
         * Callback as used by {@link api.LightningNode#signMessage}.
         * @param error Error, if any
         * @param [response] SignMessageResponse
         */
        type SignMessageCallback = (
            error: Error | null,
            response?: api.SignMessageResponse
        ) => void;

        /**
         * Callback as used by {@link api.LightningNode#verifySignature}.
         * @param error Error, if any
         * @param [response] VerifySignatureResponse
         */
        type VerifySignatureCallback = (
            error: Error | null,
            response?: api.VerifySignatureResponse
        ) => void;

        /**
         * Callback as used by {@link api.LightningNode#exportPathfindingScores}.
         * @param error Error, if any
         * @param [response] ExportPathfindingScoresResponse
         */
        type ExportPathfindingScoresCallback = (
            error: Error | null,
            response?: api.ExportPathfindingScoresResponse
        ) => void;

        /**
         * Callback as used by {@link api.LightningNode#unifiedSend}.
         * @param error Error, if any
         * @param [response] UnifiedSendResponse
         */
        type UnifiedSendCallback = (
            error: Error | null,
            response?: api.UnifiedSendResponse
        ) => void;

        /**
         * Callback as used by {@link api.LightningNode#decodeInvoice}.
         * @param error Error, if any
         * @param [response] DecodeInvoiceResponse
         */
        type DecodeInvoiceCallback = (
            error: Error | null,
            response?: api.DecodeInvoiceResponse
        ) => void;

        /**
         * Callback as used by {@link api.LightningNode#decodeOffer}.
         * @param error Error, if any
         * @param [response] DecodeOfferResponse
         */
        type DecodeOfferCallback = (
            error: Error | null,
            response?: api.DecodeOfferResponse
        ) => void;

        /**
         * Callback as used by {@link api.LightningNode#graphListChannels}.
         * @param error Error, if any
         * @param [response] GraphListChannelsResponse
         */
        type GraphListChannelsCallback = (
            error: Error | null,
            response?: api.GraphListChannelsResponse
        ) => void;

        /**
         * Callback as used by {@link api.LightningNode#graphGetChannel}.
         * @param error Error, if any
         * @param [response] GraphGetChannelResponse
         */
        type GraphGetChannelCallback = (
            error: Error | null,
            response?: api.GraphGetChannelResponse
        ) => void;

        /**
         * Callback as used by {@link api.LightningNode#graphListNodes}.
         * @param error Error, if any
         * @param [response] GraphListNodesResponse
         */
        type GraphListNodesCallback = (
            error: Error | null,
            response?: api.GraphListNodesResponse
        ) => void;

        /**
         * Callback as used by {@link api.LightningNode#graphGetNode}.
         * @param error Error, if any
         * @param [response] GraphGetNodeResponse
         */
        type GraphGetNodeCallback = (
            error: Error | null,
            response?: api.GraphGetNodeResponse
        ) => void;

        /**
         * Callback as used by {@link api.LightningNode#subscribeEvents}.
         * @param error Error, if any
         * @param [response] EventEnvelope
         */
        type SubscribeEventsCallback = (
            error: Error | null,
            response?: events.EventEnvelope
        ) => void;
    }
}

/** Namespace types. */
export namespace types {
    /** Properties of a Payment. */
    interface IPayment {
        /** Payment id */
        id?: string | null;

        /** Payment kind */
        kind?: types.IPaymentKind | null;

        /** Payment amount_msat */
        amount_msat?: Long | null;

        /** Payment fee_paid_msat */
        fee_paid_msat?: Long | null;

        /** Payment direction */
        direction?: types.PaymentDirection | null;

        /** Payment status */
        status?: types.PaymentStatus | null;

        /** Payment latest_update_timestamp */
        latest_update_timestamp?: Long | null;
    }

    /** Represents a Payment. */
    class Payment implements IPayment {
        /**
         * Constructs a new Payment.
         * @param [properties] Properties to set
         */
        constructor(properties?: types.IPayment);

        /** Payment id. */
        public id: string;

        /** Payment kind. */
        public kind?: types.IPaymentKind | null;

        /** Payment amount_msat. */
        public amount_msat?: Long | null;

        /** Payment fee_paid_msat. */
        public fee_paid_msat?: Long | null;

        /** Payment direction. */
        public direction: types.PaymentDirection;

        /** Payment status. */
        public status: types.PaymentStatus;

        /** Payment latest_update_timestamp. */
        public latest_update_timestamp: Long;

        /**
         * Creates a new Payment instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Payment instance
         */
        public static create(properties?: types.IPayment): types.Payment;

        /**
         * Encodes the specified Payment message. Does not implicitly {@link types.Payment.verify|verify} messages.
         * @param message Payment message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: types.IPayment,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified Payment message, length delimited. Does not implicitly {@link types.Payment.verify|verify} messages.
         * @param message Payment message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: types.IPayment,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a Payment message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Payment
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): types.Payment;

        /**
         * Decodes a Payment message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Payment
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): types.Payment;

        /**
         * Verifies a Payment message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a Payment message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Payment
         */
        public static fromObject(object: { [k: string]: any }): types.Payment;

        /**
         * Creates a plain object from a Payment message. Also converts values to other types if specified.
         * @param message Payment
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: types.Payment,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this Payment to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Payment
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a PaymentKind. */
    interface IPaymentKind {
        /** PaymentKind onchain */
        onchain?: types.IOnchain | null;

        /** PaymentKind bolt11 */
        bolt11?: types.IBolt11 | null;

        /** PaymentKind bolt11_jit */
        bolt11_jit?: types.IBolt11Jit | null;

        /** PaymentKind bolt12_offer */
        bolt12_offer?: types.IBolt12Offer | null;

        /** PaymentKind bolt12_refund */
        bolt12_refund?: types.IBolt12Refund | null;

        /** PaymentKind spontaneous */
        spontaneous?: types.ISpontaneous | null;
    }

    /** Represents a PaymentKind. */
    class PaymentKind implements IPaymentKind {
        /**
         * Constructs a new PaymentKind.
         * @param [properties] Properties to set
         */
        constructor(properties?: types.IPaymentKind);

        /** PaymentKind onchain. */
        public onchain?: types.IOnchain | null;

        /** PaymentKind bolt11. */
        public bolt11?: types.IBolt11 | null;

        /** PaymentKind bolt11_jit. */
        public bolt11_jit?: types.IBolt11Jit | null;

        /** PaymentKind bolt12_offer. */
        public bolt12_offer?: types.IBolt12Offer | null;

        /** PaymentKind bolt12_refund. */
        public bolt12_refund?: types.IBolt12Refund | null;

        /** PaymentKind spontaneous. */
        public spontaneous?: types.ISpontaneous | null;

        /** PaymentKind kind. */
        public kind?:
            | 'onchain'
            | 'bolt11'
            | 'bolt11_jit'
            | 'bolt12_offer'
            | 'bolt12_refund'
            | 'spontaneous';

        /**
         * Creates a new PaymentKind instance using the specified properties.
         * @param [properties] Properties to set
         * @returns PaymentKind instance
         */
        public static create(
            properties?: types.IPaymentKind
        ): types.PaymentKind;

        /**
         * Encodes the specified PaymentKind message. Does not implicitly {@link types.PaymentKind.verify|verify} messages.
         * @param message PaymentKind message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: types.IPaymentKind,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified PaymentKind message, length delimited. Does not implicitly {@link types.PaymentKind.verify|verify} messages.
         * @param message PaymentKind message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: types.IPaymentKind,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a PaymentKind message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns PaymentKind
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): types.PaymentKind;

        /**
         * Decodes a PaymentKind message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns PaymentKind
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): types.PaymentKind;

        /**
         * Verifies a PaymentKind message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a PaymentKind message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns PaymentKind
         */
        public static fromObject(object: {
            [k: string]: any;
        }): types.PaymentKind;

        /**
         * Creates a plain object from a PaymentKind message. Also converts values to other types if specified.
         * @param message PaymentKind
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: types.PaymentKind,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this PaymentKind to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for PaymentKind
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of an Onchain. */
    interface IOnchain {
        /** Onchain txid */
        txid?: string | null;

        /** Onchain status */
        status?: types.IConfirmationStatus | null;
    }

    /** Represents an Onchain. */
    class Onchain implements IOnchain {
        /**
         * Constructs a new Onchain.
         * @param [properties] Properties to set
         */
        constructor(properties?: types.IOnchain);

        /** Onchain txid. */
        public txid: string;

        /** Onchain status. */
        public status?: types.IConfirmationStatus | null;

        /**
         * Creates a new Onchain instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Onchain instance
         */
        public static create(properties?: types.IOnchain): types.Onchain;

        /**
         * Encodes the specified Onchain message. Does not implicitly {@link types.Onchain.verify|verify} messages.
         * @param message Onchain message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: types.IOnchain,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified Onchain message, length delimited. Does not implicitly {@link types.Onchain.verify|verify} messages.
         * @param message Onchain message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: types.IOnchain,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes an Onchain message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Onchain
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): types.Onchain;

        /**
         * Decodes an Onchain message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Onchain
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): types.Onchain;

        /**
         * Verifies an Onchain message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates an Onchain message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Onchain
         */
        public static fromObject(object: { [k: string]: any }): types.Onchain;

        /**
         * Creates a plain object from an Onchain message. Also converts values to other types if specified.
         * @param message Onchain
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: types.Onchain,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this Onchain to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Onchain
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a ConfirmationStatus. */
    interface IConfirmationStatus {
        /** ConfirmationStatus confirmed */
        confirmed?: types.IConfirmed | null;

        /** ConfirmationStatus unconfirmed */
        unconfirmed?: types.IUnconfirmed | null;
    }

    /** Represents a ConfirmationStatus. */
    class ConfirmationStatus implements IConfirmationStatus {
        /**
         * Constructs a new ConfirmationStatus.
         * @param [properties] Properties to set
         */
        constructor(properties?: types.IConfirmationStatus);

        /** ConfirmationStatus confirmed. */
        public confirmed?: types.IConfirmed | null;

        /** ConfirmationStatus unconfirmed. */
        public unconfirmed?: types.IUnconfirmed | null;

        /** ConfirmationStatus status. */
        public status?: 'confirmed' | 'unconfirmed';

        /**
         * Creates a new ConfirmationStatus instance using the specified properties.
         * @param [properties] Properties to set
         * @returns ConfirmationStatus instance
         */
        public static create(
            properties?: types.IConfirmationStatus
        ): types.ConfirmationStatus;

        /**
         * Encodes the specified ConfirmationStatus message. Does not implicitly {@link types.ConfirmationStatus.verify|verify} messages.
         * @param message ConfirmationStatus message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: types.IConfirmationStatus,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified ConfirmationStatus message, length delimited. Does not implicitly {@link types.ConfirmationStatus.verify|verify} messages.
         * @param message ConfirmationStatus message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: types.IConfirmationStatus,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a ConfirmationStatus message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns ConfirmationStatus
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): types.ConfirmationStatus;

        /**
         * Decodes a ConfirmationStatus message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns ConfirmationStatus
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): types.ConfirmationStatus;

        /**
         * Verifies a ConfirmationStatus message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a ConfirmationStatus message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns ConfirmationStatus
         */
        public static fromObject(object: {
            [k: string]: any;
        }): types.ConfirmationStatus;

        /**
         * Creates a plain object from a ConfirmationStatus message. Also converts values to other types if specified.
         * @param message ConfirmationStatus
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: types.ConfirmationStatus,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this ConfirmationStatus to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for ConfirmationStatus
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a Confirmed. */
    interface IConfirmed {
        /** Confirmed block_hash */
        block_hash?: string | null;

        /** Confirmed height */
        height?: number | null;

        /** Confirmed timestamp */
        timestamp?: Long | null;
    }

    /** Represents a Confirmed. */
    class Confirmed implements IConfirmed {
        /**
         * Constructs a new Confirmed.
         * @param [properties] Properties to set
         */
        constructor(properties?: types.IConfirmed);

        /** Confirmed block_hash. */
        public block_hash: string;

        /** Confirmed height. */
        public height: number;

        /** Confirmed timestamp. */
        public timestamp: Long;

        /**
         * Creates a new Confirmed instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Confirmed instance
         */
        public static create(properties?: types.IConfirmed): types.Confirmed;

        /**
         * Encodes the specified Confirmed message. Does not implicitly {@link types.Confirmed.verify|verify} messages.
         * @param message Confirmed message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: types.IConfirmed,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified Confirmed message, length delimited. Does not implicitly {@link types.Confirmed.verify|verify} messages.
         * @param message Confirmed message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: types.IConfirmed,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a Confirmed message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Confirmed
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): types.Confirmed;

        /**
         * Decodes a Confirmed message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Confirmed
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): types.Confirmed;

        /**
         * Verifies a Confirmed message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a Confirmed message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Confirmed
         */
        public static fromObject(object: { [k: string]: any }): types.Confirmed;

        /**
         * Creates a plain object from a Confirmed message. Also converts values to other types if specified.
         * @param message Confirmed
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: types.Confirmed,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this Confirmed to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Confirmed
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of an Unconfirmed. */
    interface IUnconfirmed {}

    /** Represents an Unconfirmed. */
    class Unconfirmed implements IUnconfirmed {
        /**
         * Constructs a new Unconfirmed.
         * @param [properties] Properties to set
         */
        constructor(properties?: types.IUnconfirmed);

        /**
         * Creates a new Unconfirmed instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Unconfirmed instance
         */
        public static create(
            properties?: types.IUnconfirmed
        ): types.Unconfirmed;

        /**
         * Encodes the specified Unconfirmed message. Does not implicitly {@link types.Unconfirmed.verify|verify} messages.
         * @param message Unconfirmed message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: types.IUnconfirmed,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified Unconfirmed message, length delimited. Does not implicitly {@link types.Unconfirmed.verify|verify} messages.
         * @param message Unconfirmed message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: types.IUnconfirmed,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes an Unconfirmed message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Unconfirmed
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): types.Unconfirmed;

        /**
         * Decodes an Unconfirmed message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Unconfirmed
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): types.Unconfirmed;

        /**
         * Verifies an Unconfirmed message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates an Unconfirmed message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Unconfirmed
         */
        public static fromObject(object: {
            [k: string]: any;
        }): types.Unconfirmed;

        /**
         * Creates a plain object from an Unconfirmed message. Also converts values to other types if specified.
         * @param message Unconfirmed
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: types.Unconfirmed,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this Unconfirmed to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Unconfirmed
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a Bolt11. */
    interface IBolt11 {
        /** Bolt11 hash */
        hash?: string | null;

        /** Bolt11 preimage */
        preimage?: string | null;

        /** Bolt11 secret */
        secret?: Uint8Array | null;
    }

    /** Represents a Bolt11. */
    class Bolt11 implements IBolt11 {
        /**
         * Constructs a new Bolt11.
         * @param [properties] Properties to set
         */
        constructor(properties?: types.IBolt11);

        /** Bolt11 hash. */
        public hash: string;

        /** Bolt11 preimage. */
        public preimage?: string | null;

        /** Bolt11 secret. */
        public secret?: Uint8Array | null;

        /**
         * Creates a new Bolt11 instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Bolt11 instance
         */
        public static create(properties?: types.IBolt11): types.Bolt11;

        /**
         * Encodes the specified Bolt11 message. Does not implicitly {@link types.Bolt11.verify|verify} messages.
         * @param message Bolt11 message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: types.IBolt11,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified Bolt11 message, length delimited. Does not implicitly {@link types.Bolt11.verify|verify} messages.
         * @param message Bolt11 message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: types.IBolt11,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a Bolt11 message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Bolt11
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): types.Bolt11;

        /**
         * Decodes a Bolt11 message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Bolt11
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): types.Bolt11;

        /**
         * Verifies a Bolt11 message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a Bolt11 message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Bolt11
         */
        public static fromObject(object: { [k: string]: any }): types.Bolt11;

        /**
         * Creates a plain object from a Bolt11 message. Also converts values to other types if specified.
         * @param message Bolt11
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: types.Bolt11,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this Bolt11 to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Bolt11
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a Bolt11Jit. */
    interface IBolt11Jit {
        /** Bolt11Jit hash */
        hash?: string | null;

        /** Bolt11Jit preimage */
        preimage?: string | null;

        /** Bolt11Jit secret */
        secret?: Uint8Array | null;

        /** Bolt11Jit lsp_fee_limits */
        lsp_fee_limits?: types.ILSPFeeLimits | null;

        /** Bolt11Jit counterparty_skimmed_fee_msat */
        counterparty_skimmed_fee_msat?: Long | null;
    }

    /** Represents a Bolt11Jit. */
    class Bolt11Jit implements IBolt11Jit {
        /**
         * Constructs a new Bolt11Jit.
         * @param [properties] Properties to set
         */
        constructor(properties?: types.IBolt11Jit);

        /** Bolt11Jit hash. */
        public hash: string;

        /** Bolt11Jit preimage. */
        public preimage?: string | null;

        /** Bolt11Jit secret. */
        public secret?: Uint8Array | null;

        /** Bolt11Jit lsp_fee_limits. */
        public lsp_fee_limits?: types.ILSPFeeLimits | null;

        /** Bolt11Jit counterparty_skimmed_fee_msat. */
        public counterparty_skimmed_fee_msat?: Long | null;

        /**
         * Creates a new Bolt11Jit instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Bolt11Jit instance
         */
        public static create(properties?: types.IBolt11Jit): types.Bolt11Jit;

        /**
         * Encodes the specified Bolt11Jit message. Does not implicitly {@link types.Bolt11Jit.verify|verify} messages.
         * @param message Bolt11Jit message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: types.IBolt11Jit,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified Bolt11Jit message, length delimited. Does not implicitly {@link types.Bolt11Jit.verify|verify} messages.
         * @param message Bolt11Jit message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: types.IBolt11Jit,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a Bolt11Jit message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Bolt11Jit
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): types.Bolt11Jit;

        /**
         * Decodes a Bolt11Jit message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Bolt11Jit
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): types.Bolt11Jit;

        /**
         * Verifies a Bolt11Jit message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a Bolt11Jit message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Bolt11Jit
         */
        public static fromObject(object: { [k: string]: any }): types.Bolt11Jit;

        /**
         * Creates a plain object from a Bolt11Jit message. Also converts values to other types if specified.
         * @param message Bolt11Jit
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: types.Bolt11Jit,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this Bolt11Jit to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Bolt11Jit
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a Bolt12Offer. */
    interface IBolt12Offer {
        /** Bolt12Offer hash */
        hash?: string | null;

        /** Bolt12Offer preimage */
        preimage?: string | null;

        /** Bolt12Offer secret */
        secret?: Uint8Array | null;

        /** Bolt12Offer offer_id */
        offer_id?: string | null;

        /** Bolt12Offer payer_note */
        payer_note?: string | null;

        /** Bolt12Offer quantity */
        quantity?: Long | null;
    }

    /** Represents a Bolt12Offer. */
    class Bolt12Offer implements IBolt12Offer {
        /**
         * Constructs a new Bolt12Offer.
         * @param [properties] Properties to set
         */
        constructor(properties?: types.IBolt12Offer);

        /** Bolt12Offer hash. */
        public hash?: string | null;

        /** Bolt12Offer preimage. */
        public preimage?: string | null;

        /** Bolt12Offer secret. */
        public secret?: Uint8Array | null;

        /** Bolt12Offer offer_id. */
        public offer_id: string;

        /** Bolt12Offer payer_note. */
        public payer_note?: string | null;

        /** Bolt12Offer quantity. */
        public quantity?: Long | null;

        /**
         * Creates a new Bolt12Offer instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Bolt12Offer instance
         */
        public static create(
            properties?: types.IBolt12Offer
        ): types.Bolt12Offer;

        /**
         * Encodes the specified Bolt12Offer message. Does not implicitly {@link types.Bolt12Offer.verify|verify} messages.
         * @param message Bolt12Offer message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: types.IBolt12Offer,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified Bolt12Offer message, length delimited. Does not implicitly {@link types.Bolt12Offer.verify|verify} messages.
         * @param message Bolt12Offer message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: types.IBolt12Offer,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a Bolt12Offer message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Bolt12Offer
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): types.Bolt12Offer;

        /**
         * Decodes a Bolt12Offer message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Bolt12Offer
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): types.Bolt12Offer;

        /**
         * Verifies a Bolt12Offer message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a Bolt12Offer message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Bolt12Offer
         */
        public static fromObject(object: {
            [k: string]: any;
        }): types.Bolt12Offer;

        /**
         * Creates a plain object from a Bolt12Offer message. Also converts values to other types if specified.
         * @param message Bolt12Offer
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: types.Bolt12Offer,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this Bolt12Offer to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Bolt12Offer
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a Bolt12Refund. */
    interface IBolt12Refund {
        /** Bolt12Refund hash */
        hash?: string | null;

        /** Bolt12Refund preimage */
        preimage?: string | null;

        /** Bolt12Refund secret */
        secret?: Uint8Array | null;

        /** Bolt12Refund payer_note */
        payer_note?: string | null;

        /** Bolt12Refund quantity */
        quantity?: Long | null;
    }

    /** Represents a Bolt12Refund. */
    class Bolt12Refund implements IBolt12Refund {
        /**
         * Constructs a new Bolt12Refund.
         * @param [properties] Properties to set
         */
        constructor(properties?: types.IBolt12Refund);

        /** Bolt12Refund hash. */
        public hash?: string | null;

        /** Bolt12Refund preimage. */
        public preimage?: string | null;

        /** Bolt12Refund secret. */
        public secret?: Uint8Array | null;

        /** Bolt12Refund payer_note. */
        public payer_note?: string | null;

        /** Bolt12Refund quantity. */
        public quantity?: Long | null;

        /**
         * Creates a new Bolt12Refund instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Bolt12Refund instance
         */
        public static create(
            properties?: types.IBolt12Refund
        ): types.Bolt12Refund;

        /**
         * Encodes the specified Bolt12Refund message. Does not implicitly {@link types.Bolt12Refund.verify|verify} messages.
         * @param message Bolt12Refund message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: types.IBolt12Refund,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified Bolt12Refund message, length delimited. Does not implicitly {@link types.Bolt12Refund.verify|verify} messages.
         * @param message Bolt12Refund message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: types.IBolt12Refund,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a Bolt12Refund message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Bolt12Refund
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): types.Bolt12Refund;

        /**
         * Decodes a Bolt12Refund message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Bolt12Refund
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): types.Bolt12Refund;

        /**
         * Verifies a Bolt12Refund message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a Bolt12Refund message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Bolt12Refund
         */
        public static fromObject(object: {
            [k: string]: any;
        }): types.Bolt12Refund;

        /**
         * Creates a plain object from a Bolt12Refund message. Also converts values to other types if specified.
         * @param message Bolt12Refund
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: types.Bolt12Refund,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this Bolt12Refund to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Bolt12Refund
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a Spontaneous. */
    interface ISpontaneous {
        /** Spontaneous hash */
        hash?: string | null;

        /** Spontaneous preimage */
        preimage?: string | null;
    }

    /** Represents a Spontaneous. */
    class Spontaneous implements ISpontaneous {
        /**
         * Constructs a new Spontaneous.
         * @param [properties] Properties to set
         */
        constructor(properties?: types.ISpontaneous);

        /** Spontaneous hash. */
        public hash: string;

        /** Spontaneous preimage. */
        public preimage?: string | null;

        /**
         * Creates a new Spontaneous instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Spontaneous instance
         */
        public static create(
            properties?: types.ISpontaneous
        ): types.Spontaneous;

        /**
         * Encodes the specified Spontaneous message. Does not implicitly {@link types.Spontaneous.verify|verify} messages.
         * @param message Spontaneous message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: types.ISpontaneous,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified Spontaneous message, length delimited. Does not implicitly {@link types.Spontaneous.verify|verify} messages.
         * @param message Spontaneous message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: types.ISpontaneous,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a Spontaneous message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Spontaneous
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): types.Spontaneous;

        /**
         * Decodes a Spontaneous message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Spontaneous
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): types.Spontaneous;

        /**
         * Verifies a Spontaneous message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a Spontaneous message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Spontaneous
         */
        public static fromObject(object: {
            [k: string]: any;
        }): types.Spontaneous;

        /**
         * Creates a plain object from a Spontaneous message. Also converts values to other types if specified.
         * @param message Spontaneous
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: types.Spontaneous,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this Spontaneous to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Spontaneous
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a LSPFeeLimits. */
    interface ILSPFeeLimits {
        /** LSPFeeLimits max_total_opening_fee_msat */
        max_total_opening_fee_msat?: Long | null;

        /** LSPFeeLimits max_proportional_opening_fee_ppm_msat */
        max_proportional_opening_fee_ppm_msat?: Long | null;
    }

    /** Represents a LSPFeeLimits. */
    class LSPFeeLimits implements ILSPFeeLimits {
        /**
         * Constructs a new LSPFeeLimits.
         * @param [properties] Properties to set
         */
        constructor(properties?: types.ILSPFeeLimits);

        /** LSPFeeLimits max_total_opening_fee_msat. */
        public max_total_opening_fee_msat?: Long | null;

        /** LSPFeeLimits max_proportional_opening_fee_ppm_msat. */
        public max_proportional_opening_fee_ppm_msat?: Long | null;

        /**
         * Creates a new LSPFeeLimits instance using the specified properties.
         * @param [properties] Properties to set
         * @returns LSPFeeLimits instance
         */
        public static create(
            properties?: types.ILSPFeeLimits
        ): types.LSPFeeLimits;

        /**
         * Encodes the specified LSPFeeLimits message. Does not implicitly {@link types.LSPFeeLimits.verify|verify} messages.
         * @param message LSPFeeLimits message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: types.ILSPFeeLimits,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified LSPFeeLimits message, length delimited. Does not implicitly {@link types.LSPFeeLimits.verify|verify} messages.
         * @param message LSPFeeLimits message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: types.ILSPFeeLimits,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a LSPFeeLimits message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns LSPFeeLimits
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): types.LSPFeeLimits;

        /**
         * Decodes a LSPFeeLimits message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns LSPFeeLimits
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): types.LSPFeeLimits;

        /**
         * Verifies a LSPFeeLimits message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a LSPFeeLimits message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns LSPFeeLimits
         */
        public static fromObject(object: {
            [k: string]: any;
        }): types.LSPFeeLimits;

        /**
         * Creates a plain object from a LSPFeeLimits message. Also converts values to other types if specified.
         * @param message LSPFeeLimits
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: types.LSPFeeLimits,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this LSPFeeLimits to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for LSPFeeLimits
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** PaymentDirection enum. */
    enum PaymentDirection {
        INBOUND = 0,
        OUTBOUND = 1
    }

    /** PaymentStatus enum. */
    enum PaymentStatus {
        PENDING = 0,
        SUCCEEDED = 1,
        FAILED = 2
    }

    /** Network enum. */
    enum Network {
        BITCOIN = 0,
        TESTNET = 1,
        TESTNET4 = 2,
        SIGNET = 3,
        REGTEST = 4
    }

    /** Properties of a ForwardedPayment. */
    interface IForwardedPayment {
        /** ForwardedPayment prev_channel_id */
        prev_channel_id?: string | null;

        /** ForwardedPayment next_channel_id */
        next_channel_id?: string | null;

        /** ForwardedPayment prev_user_channel_id */
        prev_user_channel_id?: string | null;

        /** ForwardedPayment prev_node_id */
        prev_node_id?: string | null;

        /** ForwardedPayment next_node_id */
        next_node_id?: string | null;

        /** ForwardedPayment next_user_channel_id */
        next_user_channel_id?: string | null;

        /** ForwardedPayment total_fee_earned_msat */
        total_fee_earned_msat?: Long | null;

        /** ForwardedPayment skimmed_fee_msat */
        skimmed_fee_msat?: Long | null;

        /** ForwardedPayment claim_from_onchain_tx */
        claim_from_onchain_tx?: boolean | null;

        /** ForwardedPayment outbound_amount_forwarded_msat */
        outbound_amount_forwarded_msat?: Long | null;
    }

    /** Represents a ForwardedPayment. */
    class ForwardedPayment implements IForwardedPayment {
        /**
         * Constructs a new ForwardedPayment.
         * @param [properties] Properties to set
         */
        constructor(properties?: types.IForwardedPayment);

        /** ForwardedPayment prev_channel_id. */
        public prev_channel_id: string;

        /** ForwardedPayment next_channel_id. */
        public next_channel_id: string;

        /** ForwardedPayment prev_user_channel_id. */
        public prev_user_channel_id: string;

        /** ForwardedPayment prev_node_id. */
        public prev_node_id: string;

        /** ForwardedPayment next_node_id. */
        public next_node_id: string;

        /** ForwardedPayment next_user_channel_id. */
        public next_user_channel_id?: string | null;

        /** ForwardedPayment total_fee_earned_msat. */
        public total_fee_earned_msat?: Long | null;

        /** ForwardedPayment skimmed_fee_msat. */
        public skimmed_fee_msat?: Long | null;

        /** ForwardedPayment claim_from_onchain_tx. */
        public claim_from_onchain_tx: boolean;

        /** ForwardedPayment outbound_amount_forwarded_msat. */
        public outbound_amount_forwarded_msat?: Long | null;

        /**
         * Creates a new ForwardedPayment instance using the specified properties.
         * @param [properties] Properties to set
         * @returns ForwardedPayment instance
         */
        public static create(
            properties?: types.IForwardedPayment
        ): types.ForwardedPayment;

        /**
         * Encodes the specified ForwardedPayment message. Does not implicitly {@link types.ForwardedPayment.verify|verify} messages.
         * @param message ForwardedPayment message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: types.IForwardedPayment,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified ForwardedPayment message, length delimited. Does not implicitly {@link types.ForwardedPayment.verify|verify} messages.
         * @param message ForwardedPayment message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: types.IForwardedPayment,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a ForwardedPayment message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns ForwardedPayment
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): types.ForwardedPayment;

        /**
         * Decodes a ForwardedPayment message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns ForwardedPayment
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): types.ForwardedPayment;

        /**
         * Verifies a ForwardedPayment message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a ForwardedPayment message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns ForwardedPayment
         */
        public static fromObject(object: {
            [k: string]: any;
        }): types.ForwardedPayment;

        /**
         * Creates a plain object from a ForwardedPayment message. Also converts values to other types if specified.
         * @param message ForwardedPayment
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: types.ForwardedPayment,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this ForwardedPayment to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for ForwardedPayment
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a Channel. */
    interface IChannel {
        /** Channel channel_id */
        channel_id?: string | null;

        /** Channel counterparty_node_id */
        counterparty_node_id?: string | null;

        /** Channel funding_txo */
        funding_txo?: types.IOutPoint | null;

        /** Channel user_channel_id */
        user_channel_id?: string | null;

        /** Channel unspendable_punishment_reserve */
        unspendable_punishment_reserve?: Long | null;

        /** Channel channel_value_sats */
        channel_value_sats?: Long | null;

        /** Channel feerate_sat_per_1000_weight */
        feerate_sat_per_1000_weight?: number | null;

        /** Channel outbound_capacity_msat */
        outbound_capacity_msat?: Long | null;

        /** Channel inbound_capacity_msat */
        inbound_capacity_msat?: Long | null;

        /** Channel confirmations_required */
        confirmations_required?: number | null;

        /** Channel confirmations */
        confirmations?: number | null;

        /** Channel is_outbound */
        is_outbound?: boolean | null;

        /** Channel is_channel_ready */
        is_channel_ready?: boolean | null;

        /** Channel is_usable */
        is_usable?: boolean | null;

        /** Channel is_announced */
        is_announced?: boolean | null;

        /** Channel channel_config */
        channel_config?: types.IChannelConfig | null;

        /** Channel next_outbound_htlc_limit_msat */
        next_outbound_htlc_limit_msat?: Long | null;

        /** Channel next_outbound_htlc_minimum_msat */
        next_outbound_htlc_minimum_msat?: Long | null;

        /** Channel force_close_spend_delay */
        force_close_spend_delay?: number | null;

        /** Channel counterparty_outbound_htlc_minimum_msat */
        counterparty_outbound_htlc_minimum_msat?: Long | null;

        /** Channel counterparty_outbound_htlc_maximum_msat */
        counterparty_outbound_htlc_maximum_msat?: Long | null;

        /** Channel counterparty_unspendable_punishment_reserve */
        counterparty_unspendable_punishment_reserve?: Long | null;

        /** Channel counterparty_forwarding_info_fee_base_msat */
        counterparty_forwarding_info_fee_base_msat?: number | null;

        /** Channel counterparty_forwarding_info_fee_proportional_millionths */
        counterparty_forwarding_info_fee_proportional_millionths?:
            | number
            | null;

        /** Channel counterparty_forwarding_info_cltv_expiry_delta */
        counterparty_forwarding_info_cltv_expiry_delta?: number | null;
    }

    /** Represents a Channel. */
    class Channel implements IChannel {
        /**
         * Constructs a new Channel.
         * @param [properties] Properties to set
         */
        constructor(properties?: types.IChannel);

        /** Channel channel_id. */
        public channel_id: string;

        /** Channel counterparty_node_id. */
        public counterparty_node_id: string;

        /** Channel funding_txo. */
        public funding_txo?: types.IOutPoint | null;

        /** Channel user_channel_id. */
        public user_channel_id: string;

        /** Channel unspendable_punishment_reserve. */
        public unspendable_punishment_reserve?: Long | null;

        /** Channel channel_value_sats. */
        public channel_value_sats: Long;

        /** Channel feerate_sat_per_1000_weight. */
        public feerate_sat_per_1000_weight: number;

        /** Channel outbound_capacity_msat. */
        public outbound_capacity_msat: Long;

        /** Channel inbound_capacity_msat. */
        public inbound_capacity_msat: Long;

        /** Channel confirmations_required. */
        public confirmations_required?: number | null;

        /** Channel confirmations. */
        public confirmations?: number | null;

        /** Channel is_outbound. */
        public is_outbound: boolean;

        /** Channel is_channel_ready. */
        public is_channel_ready: boolean;

        /** Channel is_usable. */
        public is_usable: boolean;

        /** Channel is_announced. */
        public is_announced: boolean;

        /** Channel channel_config. */
        public channel_config?: types.IChannelConfig | null;

        /** Channel next_outbound_htlc_limit_msat. */
        public next_outbound_htlc_limit_msat: Long;

        /** Channel next_outbound_htlc_minimum_msat. */
        public next_outbound_htlc_minimum_msat: Long;

        /** Channel force_close_spend_delay. */
        public force_close_spend_delay?: number | null;

        /** Channel counterparty_outbound_htlc_minimum_msat. */
        public counterparty_outbound_htlc_minimum_msat?: Long | null;

        /** Channel counterparty_outbound_htlc_maximum_msat. */
        public counterparty_outbound_htlc_maximum_msat?: Long | null;

        /** Channel counterparty_unspendable_punishment_reserve. */
        public counterparty_unspendable_punishment_reserve: Long;

        /** Channel counterparty_forwarding_info_fee_base_msat. */
        public counterparty_forwarding_info_fee_base_msat?: number | null;

        /** Channel counterparty_forwarding_info_fee_proportional_millionths. */
        public counterparty_forwarding_info_fee_proportional_millionths?:
            | number
            | null;

        /** Channel counterparty_forwarding_info_cltv_expiry_delta. */
        public counterparty_forwarding_info_cltv_expiry_delta?: number | null;

        /**
         * Creates a new Channel instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Channel instance
         */
        public static create(properties?: types.IChannel): types.Channel;

        /**
         * Encodes the specified Channel message. Does not implicitly {@link types.Channel.verify|verify} messages.
         * @param message Channel message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: types.IChannel,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified Channel message, length delimited. Does not implicitly {@link types.Channel.verify|verify} messages.
         * @param message Channel message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: types.IChannel,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a Channel message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Channel
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): types.Channel;

        /**
         * Decodes a Channel message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Channel
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): types.Channel;

        /**
         * Verifies a Channel message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a Channel message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Channel
         */
        public static fromObject(object: { [k: string]: any }): types.Channel;

        /**
         * Creates a plain object from a Channel message. Also converts values to other types if specified.
         * @param message Channel
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: types.Channel,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this Channel to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Channel
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a ChannelConfig. */
    interface IChannelConfig {
        /** ChannelConfig forwarding_fee_proportional_millionths */
        forwarding_fee_proportional_millionths?: number | null;

        /** ChannelConfig forwarding_fee_base_msat */
        forwarding_fee_base_msat?: number | null;

        /** ChannelConfig cltv_expiry_delta */
        cltv_expiry_delta?: number | null;

        /** ChannelConfig force_close_avoidance_max_fee_satoshis */
        force_close_avoidance_max_fee_satoshis?: Long | null;

        /** ChannelConfig accept_underpaying_htlcs */
        accept_underpaying_htlcs?: boolean | null;

        /** ChannelConfig fixed_limit_msat */
        fixed_limit_msat?: Long | null;

        /** ChannelConfig fee_rate_multiplier */
        fee_rate_multiplier?: Long | null;
    }

    /** Represents a ChannelConfig. */
    class ChannelConfig implements IChannelConfig {
        /**
         * Constructs a new ChannelConfig.
         * @param [properties] Properties to set
         */
        constructor(properties?: types.IChannelConfig);

        /** ChannelConfig forwarding_fee_proportional_millionths. */
        public forwarding_fee_proportional_millionths?: number | null;

        /** ChannelConfig forwarding_fee_base_msat. */
        public forwarding_fee_base_msat?: number | null;

        /** ChannelConfig cltv_expiry_delta. */
        public cltv_expiry_delta?: number | null;

        /** ChannelConfig force_close_avoidance_max_fee_satoshis. */
        public force_close_avoidance_max_fee_satoshis?: Long | null;

        /** ChannelConfig accept_underpaying_htlcs. */
        public accept_underpaying_htlcs?: boolean | null;

        /** ChannelConfig fixed_limit_msat. */
        public fixed_limit_msat?: Long | null;

        /** ChannelConfig fee_rate_multiplier. */
        public fee_rate_multiplier?: Long | null;

        /** ChannelConfig max_dust_htlc_exposure. */
        public max_dust_htlc_exposure?:
            | 'fixed_limit_msat'
            | 'fee_rate_multiplier';

        /**
         * Creates a new ChannelConfig instance using the specified properties.
         * @param [properties] Properties to set
         * @returns ChannelConfig instance
         */
        public static create(
            properties?: types.IChannelConfig
        ): types.ChannelConfig;

        /**
         * Encodes the specified ChannelConfig message. Does not implicitly {@link types.ChannelConfig.verify|verify} messages.
         * @param message ChannelConfig message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: types.IChannelConfig,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified ChannelConfig message, length delimited. Does not implicitly {@link types.ChannelConfig.verify|verify} messages.
         * @param message ChannelConfig message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: types.IChannelConfig,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a ChannelConfig message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns ChannelConfig
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): types.ChannelConfig;

        /**
         * Decodes a ChannelConfig message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns ChannelConfig
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): types.ChannelConfig;

        /**
         * Verifies a ChannelConfig message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a ChannelConfig message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns ChannelConfig
         */
        public static fromObject(object: {
            [k: string]: any;
        }): types.ChannelConfig;

        /**
         * Creates a plain object from a ChannelConfig message. Also converts values to other types if specified.
         * @param message ChannelConfig
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: types.ChannelConfig,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this ChannelConfig to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for ChannelConfig
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of an OutPoint. */
    interface IOutPoint {
        /** OutPoint txid */
        txid?: string | null;

        /** OutPoint vout */
        vout?: number | null;
    }

    /** Represents an OutPoint. */
    class OutPoint implements IOutPoint {
        /**
         * Constructs a new OutPoint.
         * @param [properties] Properties to set
         */
        constructor(properties?: types.IOutPoint);

        /** OutPoint txid. */
        public txid: string;

        /** OutPoint vout. */
        public vout: number;

        /**
         * Creates a new OutPoint instance using the specified properties.
         * @param [properties] Properties to set
         * @returns OutPoint instance
         */
        public static create(properties?: types.IOutPoint): types.OutPoint;

        /**
         * Encodes the specified OutPoint message. Does not implicitly {@link types.OutPoint.verify|verify} messages.
         * @param message OutPoint message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: types.IOutPoint,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified OutPoint message, length delimited. Does not implicitly {@link types.OutPoint.verify|verify} messages.
         * @param message OutPoint message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: types.IOutPoint,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes an OutPoint message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns OutPoint
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): types.OutPoint;

        /**
         * Decodes an OutPoint message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns OutPoint
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): types.OutPoint;

        /**
         * Verifies an OutPoint message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates an OutPoint message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns OutPoint
         */
        public static fromObject(object: { [k: string]: any }): types.OutPoint;

        /**
         * Creates a plain object from an OutPoint message. Also converts values to other types if specified.
         * @param message OutPoint
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: types.OutPoint,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this OutPoint to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for OutPoint
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a BestBlock. */
    interface IBestBlock {
        /** BestBlock block_hash */
        block_hash?: string | null;

        /** BestBlock height */
        height?: number | null;
    }

    /** Represents a BestBlock. */
    class BestBlock implements IBestBlock {
        /**
         * Constructs a new BestBlock.
         * @param [properties] Properties to set
         */
        constructor(properties?: types.IBestBlock);

        /** BestBlock block_hash. */
        public block_hash: string;

        /** BestBlock height. */
        public height: number;

        /**
         * Creates a new BestBlock instance using the specified properties.
         * @param [properties] Properties to set
         * @returns BestBlock instance
         */
        public static create(properties?: types.IBestBlock): types.BestBlock;

        /**
         * Encodes the specified BestBlock message. Does not implicitly {@link types.BestBlock.verify|verify} messages.
         * @param message BestBlock message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: types.IBestBlock,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified BestBlock message, length delimited. Does not implicitly {@link types.BestBlock.verify|verify} messages.
         * @param message BestBlock message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: types.IBestBlock,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a BestBlock message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns BestBlock
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): types.BestBlock;

        /**
         * Decodes a BestBlock message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns BestBlock
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): types.BestBlock;

        /**
         * Verifies a BestBlock message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a BestBlock message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns BestBlock
         */
        public static fromObject(object: { [k: string]: any }): types.BestBlock;

        /**
         * Creates a plain object from a BestBlock message. Also converts values to other types if specified.
         * @param message BestBlock
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: types.BestBlock,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this BestBlock to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for BestBlock
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a LightningBalance. */
    interface ILightningBalance {
        /** LightningBalance claimable_on_channel_close */
        claimable_on_channel_close?: types.IClaimableOnChannelClose | null;

        /** LightningBalance claimable_awaiting_confirmations */
        claimable_awaiting_confirmations?: types.IClaimableAwaitingConfirmations | null;

        /** LightningBalance contentious_claimable */
        contentious_claimable?: types.IContentiousClaimable | null;

        /** LightningBalance maybe_timeout_claimable_htlc */
        maybe_timeout_claimable_htlc?: types.IMaybeTimeoutClaimableHTLC | null;

        /** LightningBalance maybe_preimage_claimable_htlc */
        maybe_preimage_claimable_htlc?: types.IMaybePreimageClaimableHTLC | null;

        /** LightningBalance counterparty_revoked_output_claimable */
        counterparty_revoked_output_claimable?: types.ICounterpartyRevokedOutputClaimable | null;
    }

    /** Represents a LightningBalance. */
    class LightningBalance implements ILightningBalance {
        /**
         * Constructs a new LightningBalance.
         * @param [properties] Properties to set
         */
        constructor(properties?: types.ILightningBalance);

        /** LightningBalance claimable_on_channel_close. */
        public claimable_on_channel_close?: types.IClaimableOnChannelClose | null;

        /** LightningBalance claimable_awaiting_confirmations. */
        public claimable_awaiting_confirmations?: types.IClaimableAwaitingConfirmations | null;

        /** LightningBalance contentious_claimable. */
        public contentious_claimable?: types.IContentiousClaimable | null;

        /** LightningBalance maybe_timeout_claimable_htlc. */
        public maybe_timeout_claimable_htlc?: types.IMaybeTimeoutClaimableHTLC | null;

        /** LightningBalance maybe_preimage_claimable_htlc. */
        public maybe_preimage_claimable_htlc?: types.IMaybePreimageClaimableHTLC | null;

        /** LightningBalance counterparty_revoked_output_claimable. */
        public counterparty_revoked_output_claimable?: types.ICounterpartyRevokedOutputClaimable | null;

        /** LightningBalance balance_type. */
        public balance_type?:
            | 'claimable_on_channel_close'
            | 'claimable_awaiting_confirmations'
            | 'contentious_claimable'
            | 'maybe_timeout_claimable_htlc'
            | 'maybe_preimage_claimable_htlc'
            | 'counterparty_revoked_output_claimable';

        /**
         * Creates a new LightningBalance instance using the specified properties.
         * @param [properties] Properties to set
         * @returns LightningBalance instance
         */
        public static create(
            properties?: types.ILightningBalance
        ): types.LightningBalance;

        /**
         * Encodes the specified LightningBalance message. Does not implicitly {@link types.LightningBalance.verify|verify} messages.
         * @param message LightningBalance message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: types.ILightningBalance,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified LightningBalance message, length delimited. Does not implicitly {@link types.LightningBalance.verify|verify} messages.
         * @param message LightningBalance message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: types.ILightningBalance,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a LightningBalance message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns LightningBalance
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): types.LightningBalance;

        /**
         * Decodes a LightningBalance message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns LightningBalance
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): types.LightningBalance;

        /**
         * Verifies a LightningBalance message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a LightningBalance message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns LightningBalance
         */
        public static fromObject(object: {
            [k: string]: any;
        }): types.LightningBalance;

        /**
         * Creates a plain object from a LightningBalance message. Also converts values to other types if specified.
         * @param message LightningBalance
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: types.LightningBalance,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this LightningBalance to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for LightningBalance
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a ClaimableOnChannelClose. */
    interface IClaimableOnChannelClose {
        /** ClaimableOnChannelClose channel_id */
        channel_id?: string | null;

        /** ClaimableOnChannelClose counterparty_node_id */
        counterparty_node_id?: string | null;

        /** ClaimableOnChannelClose amount_satoshis */
        amount_satoshis?: Long | null;

        /** ClaimableOnChannelClose transaction_fee_satoshis */
        transaction_fee_satoshis?: Long | null;

        /** ClaimableOnChannelClose outbound_payment_htlc_rounded_msat */
        outbound_payment_htlc_rounded_msat?: Long | null;

        /** ClaimableOnChannelClose outbound_forwarded_htlc_rounded_msat */
        outbound_forwarded_htlc_rounded_msat?: Long | null;

        /** ClaimableOnChannelClose inbound_claiming_htlc_rounded_msat */
        inbound_claiming_htlc_rounded_msat?: Long | null;

        /** ClaimableOnChannelClose inbound_htlc_rounded_msat */
        inbound_htlc_rounded_msat?: Long | null;
    }

    /** Represents a ClaimableOnChannelClose. */
    class ClaimableOnChannelClose implements IClaimableOnChannelClose {
        /**
         * Constructs a new ClaimableOnChannelClose.
         * @param [properties] Properties to set
         */
        constructor(properties?: types.IClaimableOnChannelClose);

        /** ClaimableOnChannelClose channel_id. */
        public channel_id: string;

        /** ClaimableOnChannelClose counterparty_node_id. */
        public counterparty_node_id: string;

        /** ClaimableOnChannelClose amount_satoshis. */
        public amount_satoshis: Long;

        /** ClaimableOnChannelClose transaction_fee_satoshis. */
        public transaction_fee_satoshis: Long;

        /** ClaimableOnChannelClose outbound_payment_htlc_rounded_msat. */
        public outbound_payment_htlc_rounded_msat: Long;

        /** ClaimableOnChannelClose outbound_forwarded_htlc_rounded_msat. */
        public outbound_forwarded_htlc_rounded_msat: Long;

        /** ClaimableOnChannelClose inbound_claiming_htlc_rounded_msat. */
        public inbound_claiming_htlc_rounded_msat: Long;

        /** ClaimableOnChannelClose inbound_htlc_rounded_msat. */
        public inbound_htlc_rounded_msat: Long;

        /**
         * Creates a new ClaimableOnChannelClose instance using the specified properties.
         * @param [properties] Properties to set
         * @returns ClaimableOnChannelClose instance
         */
        public static create(
            properties?: types.IClaimableOnChannelClose
        ): types.ClaimableOnChannelClose;

        /**
         * Encodes the specified ClaimableOnChannelClose message. Does not implicitly {@link types.ClaimableOnChannelClose.verify|verify} messages.
         * @param message ClaimableOnChannelClose message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: types.IClaimableOnChannelClose,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified ClaimableOnChannelClose message, length delimited. Does not implicitly {@link types.ClaimableOnChannelClose.verify|verify} messages.
         * @param message ClaimableOnChannelClose message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: types.IClaimableOnChannelClose,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a ClaimableOnChannelClose message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns ClaimableOnChannelClose
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): types.ClaimableOnChannelClose;

        /**
         * Decodes a ClaimableOnChannelClose message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns ClaimableOnChannelClose
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): types.ClaimableOnChannelClose;

        /**
         * Verifies a ClaimableOnChannelClose message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a ClaimableOnChannelClose message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns ClaimableOnChannelClose
         */
        public static fromObject(object: {
            [k: string]: any;
        }): types.ClaimableOnChannelClose;

        /**
         * Creates a plain object from a ClaimableOnChannelClose message. Also converts values to other types if specified.
         * @param message ClaimableOnChannelClose
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: types.ClaimableOnChannelClose,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this ClaimableOnChannelClose to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for ClaimableOnChannelClose
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a ClaimableAwaitingConfirmations. */
    interface IClaimableAwaitingConfirmations {
        /** ClaimableAwaitingConfirmations channel_id */
        channel_id?: string | null;

        /** ClaimableAwaitingConfirmations counterparty_node_id */
        counterparty_node_id?: string | null;

        /** ClaimableAwaitingConfirmations amount_satoshis */
        amount_satoshis?: Long | null;

        /** ClaimableAwaitingConfirmations confirmation_height */
        confirmation_height?: number | null;

        /** ClaimableAwaitingConfirmations source */
        source?: types.BalanceSource | null;
    }

    /** Represents a ClaimableAwaitingConfirmations. */
    class ClaimableAwaitingConfirmations
        implements IClaimableAwaitingConfirmations
    {
        /**
         * Constructs a new ClaimableAwaitingConfirmations.
         * @param [properties] Properties to set
         */
        constructor(properties?: types.IClaimableAwaitingConfirmations);

        /** ClaimableAwaitingConfirmations channel_id. */
        public channel_id: string;

        /** ClaimableAwaitingConfirmations counterparty_node_id. */
        public counterparty_node_id: string;

        /** ClaimableAwaitingConfirmations amount_satoshis. */
        public amount_satoshis: Long;

        /** ClaimableAwaitingConfirmations confirmation_height. */
        public confirmation_height: number;

        /** ClaimableAwaitingConfirmations source. */
        public source: types.BalanceSource;

        /**
         * Creates a new ClaimableAwaitingConfirmations instance using the specified properties.
         * @param [properties] Properties to set
         * @returns ClaimableAwaitingConfirmations instance
         */
        public static create(
            properties?: types.IClaimableAwaitingConfirmations
        ): types.ClaimableAwaitingConfirmations;

        /**
         * Encodes the specified ClaimableAwaitingConfirmations message. Does not implicitly {@link types.ClaimableAwaitingConfirmations.verify|verify} messages.
         * @param message ClaimableAwaitingConfirmations message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: types.IClaimableAwaitingConfirmations,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified ClaimableAwaitingConfirmations message, length delimited. Does not implicitly {@link types.ClaimableAwaitingConfirmations.verify|verify} messages.
         * @param message ClaimableAwaitingConfirmations message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: types.IClaimableAwaitingConfirmations,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a ClaimableAwaitingConfirmations message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns ClaimableAwaitingConfirmations
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): types.ClaimableAwaitingConfirmations;

        /**
         * Decodes a ClaimableAwaitingConfirmations message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns ClaimableAwaitingConfirmations
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): types.ClaimableAwaitingConfirmations;

        /**
         * Verifies a ClaimableAwaitingConfirmations message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a ClaimableAwaitingConfirmations message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns ClaimableAwaitingConfirmations
         */
        public static fromObject(object: {
            [k: string]: any;
        }): types.ClaimableAwaitingConfirmations;

        /**
         * Creates a plain object from a ClaimableAwaitingConfirmations message. Also converts values to other types if specified.
         * @param message ClaimableAwaitingConfirmations
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: types.ClaimableAwaitingConfirmations,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this ClaimableAwaitingConfirmations to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for ClaimableAwaitingConfirmations
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** BalanceSource enum. */
    enum BalanceSource {
        HOLDER_FORCE_CLOSED = 0,
        COUNTERPARTY_FORCE_CLOSED = 1,
        COOP_CLOSE = 2,
        HTLC = 3
    }

    /** Properties of a ContentiousClaimable. */
    interface IContentiousClaimable {
        /** ContentiousClaimable channel_id */
        channel_id?: string | null;

        /** ContentiousClaimable counterparty_node_id */
        counterparty_node_id?: string | null;

        /** ContentiousClaimable amount_satoshis */
        amount_satoshis?: Long | null;

        /** ContentiousClaimable timeout_height */
        timeout_height?: number | null;

        /** ContentiousClaimable payment_hash */
        payment_hash?: string | null;

        /** ContentiousClaimable payment_preimage */
        payment_preimage?: string | null;
    }

    /** Represents a ContentiousClaimable. */
    class ContentiousClaimable implements IContentiousClaimable {
        /**
         * Constructs a new ContentiousClaimable.
         * @param [properties] Properties to set
         */
        constructor(properties?: types.IContentiousClaimable);

        /** ContentiousClaimable channel_id. */
        public channel_id: string;

        /** ContentiousClaimable counterparty_node_id. */
        public counterparty_node_id: string;

        /** ContentiousClaimable amount_satoshis. */
        public amount_satoshis: Long;

        /** ContentiousClaimable timeout_height. */
        public timeout_height: number;

        /** ContentiousClaimable payment_hash. */
        public payment_hash: string;

        /** ContentiousClaimable payment_preimage. */
        public payment_preimage: string;

        /**
         * Creates a new ContentiousClaimable instance using the specified properties.
         * @param [properties] Properties to set
         * @returns ContentiousClaimable instance
         */
        public static create(
            properties?: types.IContentiousClaimable
        ): types.ContentiousClaimable;

        /**
         * Encodes the specified ContentiousClaimable message. Does not implicitly {@link types.ContentiousClaimable.verify|verify} messages.
         * @param message ContentiousClaimable message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: types.IContentiousClaimable,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified ContentiousClaimable message, length delimited. Does not implicitly {@link types.ContentiousClaimable.verify|verify} messages.
         * @param message ContentiousClaimable message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: types.IContentiousClaimable,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a ContentiousClaimable message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns ContentiousClaimable
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): types.ContentiousClaimable;

        /**
         * Decodes a ContentiousClaimable message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns ContentiousClaimable
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): types.ContentiousClaimable;

        /**
         * Verifies a ContentiousClaimable message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a ContentiousClaimable message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns ContentiousClaimable
         */
        public static fromObject(object: {
            [k: string]: any;
        }): types.ContentiousClaimable;

        /**
         * Creates a plain object from a ContentiousClaimable message. Also converts values to other types if specified.
         * @param message ContentiousClaimable
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: types.ContentiousClaimable,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this ContentiousClaimable to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for ContentiousClaimable
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a MaybeTimeoutClaimableHTLC. */
    interface IMaybeTimeoutClaimableHTLC {
        /** MaybeTimeoutClaimableHTLC channel_id */
        channel_id?: string | null;

        /** MaybeTimeoutClaimableHTLC counterparty_node_id */
        counterparty_node_id?: string | null;

        /** MaybeTimeoutClaimableHTLC amount_satoshis */
        amount_satoshis?: Long | null;

        /** MaybeTimeoutClaimableHTLC claimable_height */
        claimable_height?: number | null;

        /** MaybeTimeoutClaimableHTLC payment_hash */
        payment_hash?: string | null;

        /** MaybeTimeoutClaimableHTLC outbound_payment */
        outbound_payment?: boolean | null;
    }

    /** Represents a MaybeTimeoutClaimableHTLC. */
    class MaybeTimeoutClaimableHTLC implements IMaybeTimeoutClaimableHTLC {
        /**
         * Constructs a new MaybeTimeoutClaimableHTLC.
         * @param [properties] Properties to set
         */
        constructor(properties?: types.IMaybeTimeoutClaimableHTLC);

        /** MaybeTimeoutClaimableHTLC channel_id. */
        public channel_id: string;

        /** MaybeTimeoutClaimableHTLC counterparty_node_id. */
        public counterparty_node_id: string;

        /** MaybeTimeoutClaimableHTLC amount_satoshis. */
        public amount_satoshis: Long;

        /** MaybeTimeoutClaimableHTLC claimable_height. */
        public claimable_height: number;

        /** MaybeTimeoutClaimableHTLC payment_hash. */
        public payment_hash: string;

        /** MaybeTimeoutClaimableHTLC outbound_payment. */
        public outbound_payment: boolean;

        /**
         * Creates a new MaybeTimeoutClaimableHTLC instance using the specified properties.
         * @param [properties] Properties to set
         * @returns MaybeTimeoutClaimableHTLC instance
         */
        public static create(
            properties?: types.IMaybeTimeoutClaimableHTLC
        ): types.MaybeTimeoutClaimableHTLC;

        /**
         * Encodes the specified MaybeTimeoutClaimableHTLC message. Does not implicitly {@link types.MaybeTimeoutClaimableHTLC.verify|verify} messages.
         * @param message MaybeTimeoutClaimableHTLC message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: types.IMaybeTimeoutClaimableHTLC,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified MaybeTimeoutClaimableHTLC message, length delimited. Does not implicitly {@link types.MaybeTimeoutClaimableHTLC.verify|verify} messages.
         * @param message MaybeTimeoutClaimableHTLC message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: types.IMaybeTimeoutClaimableHTLC,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a MaybeTimeoutClaimableHTLC message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns MaybeTimeoutClaimableHTLC
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): types.MaybeTimeoutClaimableHTLC;

        /**
         * Decodes a MaybeTimeoutClaimableHTLC message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns MaybeTimeoutClaimableHTLC
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): types.MaybeTimeoutClaimableHTLC;

        /**
         * Verifies a MaybeTimeoutClaimableHTLC message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a MaybeTimeoutClaimableHTLC message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns MaybeTimeoutClaimableHTLC
         */
        public static fromObject(object: {
            [k: string]: any;
        }): types.MaybeTimeoutClaimableHTLC;

        /**
         * Creates a plain object from a MaybeTimeoutClaimableHTLC message. Also converts values to other types if specified.
         * @param message MaybeTimeoutClaimableHTLC
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: types.MaybeTimeoutClaimableHTLC,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this MaybeTimeoutClaimableHTLC to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for MaybeTimeoutClaimableHTLC
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a MaybePreimageClaimableHTLC. */
    interface IMaybePreimageClaimableHTLC {
        /** MaybePreimageClaimableHTLC channel_id */
        channel_id?: string | null;

        /** MaybePreimageClaimableHTLC counterparty_node_id */
        counterparty_node_id?: string | null;

        /** MaybePreimageClaimableHTLC amount_satoshis */
        amount_satoshis?: Long | null;

        /** MaybePreimageClaimableHTLC expiry_height */
        expiry_height?: number | null;

        /** MaybePreimageClaimableHTLC payment_hash */
        payment_hash?: string | null;
    }

    /** Represents a MaybePreimageClaimableHTLC. */
    class MaybePreimageClaimableHTLC implements IMaybePreimageClaimableHTLC {
        /**
         * Constructs a new MaybePreimageClaimableHTLC.
         * @param [properties] Properties to set
         */
        constructor(properties?: types.IMaybePreimageClaimableHTLC);

        /** MaybePreimageClaimableHTLC channel_id. */
        public channel_id: string;

        /** MaybePreimageClaimableHTLC counterparty_node_id. */
        public counterparty_node_id: string;

        /** MaybePreimageClaimableHTLC amount_satoshis. */
        public amount_satoshis: Long;

        /** MaybePreimageClaimableHTLC expiry_height. */
        public expiry_height: number;

        /** MaybePreimageClaimableHTLC payment_hash. */
        public payment_hash: string;

        /**
         * Creates a new MaybePreimageClaimableHTLC instance using the specified properties.
         * @param [properties] Properties to set
         * @returns MaybePreimageClaimableHTLC instance
         */
        public static create(
            properties?: types.IMaybePreimageClaimableHTLC
        ): types.MaybePreimageClaimableHTLC;

        /**
         * Encodes the specified MaybePreimageClaimableHTLC message. Does not implicitly {@link types.MaybePreimageClaimableHTLC.verify|verify} messages.
         * @param message MaybePreimageClaimableHTLC message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: types.IMaybePreimageClaimableHTLC,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified MaybePreimageClaimableHTLC message, length delimited. Does not implicitly {@link types.MaybePreimageClaimableHTLC.verify|verify} messages.
         * @param message MaybePreimageClaimableHTLC message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: types.IMaybePreimageClaimableHTLC,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a MaybePreimageClaimableHTLC message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns MaybePreimageClaimableHTLC
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): types.MaybePreimageClaimableHTLC;

        /**
         * Decodes a MaybePreimageClaimableHTLC message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns MaybePreimageClaimableHTLC
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): types.MaybePreimageClaimableHTLC;

        /**
         * Verifies a MaybePreimageClaimableHTLC message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a MaybePreimageClaimableHTLC message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns MaybePreimageClaimableHTLC
         */
        public static fromObject(object: {
            [k: string]: any;
        }): types.MaybePreimageClaimableHTLC;

        /**
         * Creates a plain object from a MaybePreimageClaimableHTLC message. Also converts values to other types if specified.
         * @param message MaybePreimageClaimableHTLC
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: types.MaybePreimageClaimableHTLC,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this MaybePreimageClaimableHTLC to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for MaybePreimageClaimableHTLC
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a CounterpartyRevokedOutputClaimable. */
    interface ICounterpartyRevokedOutputClaimable {
        /** CounterpartyRevokedOutputClaimable channel_id */
        channel_id?: string | null;

        /** CounterpartyRevokedOutputClaimable counterparty_node_id */
        counterparty_node_id?: string | null;

        /** CounterpartyRevokedOutputClaimable amount_satoshis */
        amount_satoshis?: Long | null;
    }

    /** Represents a CounterpartyRevokedOutputClaimable. */
    class CounterpartyRevokedOutputClaimable
        implements ICounterpartyRevokedOutputClaimable
    {
        /**
         * Constructs a new CounterpartyRevokedOutputClaimable.
         * @param [properties] Properties to set
         */
        constructor(properties?: types.ICounterpartyRevokedOutputClaimable);

        /** CounterpartyRevokedOutputClaimable channel_id. */
        public channel_id: string;

        /** CounterpartyRevokedOutputClaimable counterparty_node_id. */
        public counterparty_node_id: string;

        /** CounterpartyRevokedOutputClaimable amount_satoshis. */
        public amount_satoshis: Long;

        /**
         * Creates a new CounterpartyRevokedOutputClaimable instance using the specified properties.
         * @param [properties] Properties to set
         * @returns CounterpartyRevokedOutputClaimable instance
         */
        public static create(
            properties?: types.ICounterpartyRevokedOutputClaimable
        ): types.CounterpartyRevokedOutputClaimable;

        /**
         * Encodes the specified CounterpartyRevokedOutputClaimable message. Does not implicitly {@link types.CounterpartyRevokedOutputClaimable.verify|verify} messages.
         * @param message CounterpartyRevokedOutputClaimable message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: types.ICounterpartyRevokedOutputClaimable,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified CounterpartyRevokedOutputClaimable message, length delimited. Does not implicitly {@link types.CounterpartyRevokedOutputClaimable.verify|verify} messages.
         * @param message CounterpartyRevokedOutputClaimable message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: types.ICounterpartyRevokedOutputClaimable,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a CounterpartyRevokedOutputClaimable message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns CounterpartyRevokedOutputClaimable
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): types.CounterpartyRevokedOutputClaimable;

        /**
         * Decodes a CounterpartyRevokedOutputClaimable message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns CounterpartyRevokedOutputClaimable
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): types.CounterpartyRevokedOutputClaimable;

        /**
         * Verifies a CounterpartyRevokedOutputClaimable message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a CounterpartyRevokedOutputClaimable message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns CounterpartyRevokedOutputClaimable
         */
        public static fromObject(object: {
            [k: string]: any;
        }): types.CounterpartyRevokedOutputClaimable;

        /**
         * Creates a plain object from a CounterpartyRevokedOutputClaimable message. Also converts values to other types if specified.
         * @param message CounterpartyRevokedOutputClaimable
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: types.CounterpartyRevokedOutputClaimable,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this CounterpartyRevokedOutputClaimable to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for CounterpartyRevokedOutputClaimable
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a PendingSweepBalance. */
    interface IPendingSweepBalance {
        /** PendingSweepBalance pending_broadcast */
        pending_broadcast?: types.IPendingBroadcast | null;

        /** PendingSweepBalance broadcast_awaiting_confirmation */
        broadcast_awaiting_confirmation?: types.IBroadcastAwaitingConfirmation | null;

        /** PendingSweepBalance awaiting_threshold_confirmations */
        awaiting_threshold_confirmations?: types.IAwaitingThresholdConfirmations | null;
    }

    /** Represents a PendingSweepBalance. */
    class PendingSweepBalance implements IPendingSweepBalance {
        /**
         * Constructs a new PendingSweepBalance.
         * @param [properties] Properties to set
         */
        constructor(properties?: types.IPendingSweepBalance);

        /** PendingSweepBalance pending_broadcast. */
        public pending_broadcast?: types.IPendingBroadcast | null;

        /** PendingSweepBalance broadcast_awaiting_confirmation. */
        public broadcast_awaiting_confirmation?: types.IBroadcastAwaitingConfirmation | null;

        /** PendingSweepBalance awaiting_threshold_confirmations. */
        public awaiting_threshold_confirmations?: types.IAwaitingThresholdConfirmations | null;

        /** PendingSweepBalance balance_type. */
        public balance_type?:
            | 'pending_broadcast'
            | 'broadcast_awaiting_confirmation'
            | 'awaiting_threshold_confirmations';

        /**
         * Creates a new PendingSweepBalance instance using the specified properties.
         * @param [properties] Properties to set
         * @returns PendingSweepBalance instance
         */
        public static create(
            properties?: types.IPendingSweepBalance
        ): types.PendingSweepBalance;

        /**
         * Encodes the specified PendingSweepBalance message. Does not implicitly {@link types.PendingSweepBalance.verify|verify} messages.
         * @param message PendingSweepBalance message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: types.IPendingSweepBalance,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified PendingSweepBalance message, length delimited. Does not implicitly {@link types.PendingSweepBalance.verify|verify} messages.
         * @param message PendingSweepBalance message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: types.IPendingSweepBalance,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a PendingSweepBalance message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns PendingSweepBalance
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): types.PendingSweepBalance;

        /**
         * Decodes a PendingSweepBalance message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns PendingSweepBalance
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): types.PendingSweepBalance;

        /**
         * Verifies a PendingSweepBalance message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a PendingSweepBalance message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns PendingSweepBalance
         */
        public static fromObject(object: {
            [k: string]: any;
        }): types.PendingSweepBalance;

        /**
         * Creates a plain object from a PendingSweepBalance message. Also converts values to other types if specified.
         * @param message PendingSweepBalance
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: types.PendingSweepBalance,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this PendingSweepBalance to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for PendingSweepBalance
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a PendingBroadcast. */
    interface IPendingBroadcast {
        /** PendingBroadcast channel_id */
        channel_id?: string | null;

        /** PendingBroadcast amount_satoshis */
        amount_satoshis?: Long | null;
    }

    /** Represents a PendingBroadcast. */
    class PendingBroadcast implements IPendingBroadcast {
        /**
         * Constructs a new PendingBroadcast.
         * @param [properties] Properties to set
         */
        constructor(properties?: types.IPendingBroadcast);

        /** PendingBroadcast channel_id. */
        public channel_id?: string | null;

        /** PendingBroadcast amount_satoshis. */
        public amount_satoshis: Long;

        /**
         * Creates a new PendingBroadcast instance using the specified properties.
         * @param [properties] Properties to set
         * @returns PendingBroadcast instance
         */
        public static create(
            properties?: types.IPendingBroadcast
        ): types.PendingBroadcast;

        /**
         * Encodes the specified PendingBroadcast message. Does not implicitly {@link types.PendingBroadcast.verify|verify} messages.
         * @param message PendingBroadcast message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: types.IPendingBroadcast,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified PendingBroadcast message, length delimited. Does not implicitly {@link types.PendingBroadcast.verify|verify} messages.
         * @param message PendingBroadcast message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: types.IPendingBroadcast,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a PendingBroadcast message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns PendingBroadcast
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): types.PendingBroadcast;

        /**
         * Decodes a PendingBroadcast message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns PendingBroadcast
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): types.PendingBroadcast;

        /**
         * Verifies a PendingBroadcast message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a PendingBroadcast message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns PendingBroadcast
         */
        public static fromObject(object: {
            [k: string]: any;
        }): types.PendingBroadcast;

        /**
         * Creates a plain object from a PendingBroadcast message. Also converts values to other types if specified.
         * @param message PendingBroadcast
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: types.PendingBroadcast,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this PendingBroadcast to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for PendingBroadcast
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a BroadcastAwaitingConfirmation. */
    interface IBroadcastAwaitingConfirmation {
        /** BroadcastAwaitingConfirmation channel_id */
        channel_id?: string | null;

        /** BroadcastAwaitingConfirmation latest_broadcast_height */
        latest_broadcast_height?: number | null;

        /** BroadcastAwaitingConfirmation latest_spending_txid */
        latest_spending_txid?: string | null;

        /** BroadcastAwaitingConfirmation amount_satoshis */
        amount_satoshis?: Long | null;
    }

    /** Represents a BroadcastAwaitingConfirmation. */
    class BroadcastAwaitingConfirmation
        implements IBroadcastAwaitingConfirmation
    {
        /**
         * Constructs a new BroadcastAwaitingConfirmation.
         * @param [properties] Properties to set
         */
        constructor(properties?: types.IBroadcastAwaitingConfirmation);

        /** BroadcastAwaitingConfirmation channel_id. */
        public channel_id?: string | null;

        /** BroadcastAwaitingConfirmation latest_broadcast_height. */
        public latest_broadcast_height: number;

        /** BroadcastAwaitingConfirmation latest_spending_txid. */
        public latest_spending_txid: string;

        /** BroadcastAwaitingConfirmation amount_satoshis. */
        public amount_satoshis: Long;

        /**
         * Creates a new BroadcastAwaitingConfirmation instance using the specified properties.
         * @param [properties] Properties to set
         * @returns BroadcastAwaitingConfirmation instance
         */
        public static create(
            properties?: types.IBroadcastAwaitingConfirmation
        ): types.BroadcastAwaitingConfirmation;

        /**
         * Encodes the specified BroadcastAwaitingConfirmation message. Does not implicitly {@link types.BroadcastAwaitingConfirmation.verify|verify} messages.
         * @param message BroadcastAwaitingConfirmation message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: types.IBroadcastAwaitingConfirmation,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified BroadcastAwaitingConfirmation message, length delimited. Does not implicitly {@link types.BroadcastAwaitingConfirmation.verify|verify} messages.
         * @param message BroadcastAwaitingConfirmation message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: types.IBroadcastAwaitingConfirmation,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a BroadcastAwaitingConfirmation message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns BroadcastAwaitingConfirmation
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): types.BroadcastAwaitingConfirmation;

        /**
         * Decodes a BroadcastAwaitingConfirmation message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns BroadcastAwaitingConfirmation
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): types.BroadcastAwaitingConfirmation;

        /**
         * Verifies a BroadcastAwaitingConfirmation message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a BroadcastAwaitingConfirmation message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns BroadcastAwaitingConfirmation
         */
        public static fromObject(object: {
            [k: string]: any;
        }): types.BroadcastAwaitingConfirmation;

        /**
         * Creates a plain object from a BroadcastAwaitingConfirmation message. Also converts values to other types if specified.
         * @param message BroadcastAwaitingConfirmation
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: types.BroadcastAwaitingConfirmation,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this BroadcastAwaitingConfirmation to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for BroadcastAwaitingConfirmation
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of an AwaitingThresholdConfirmations. */
    interface IAwaitingThresholdConfirmations {
        /** AwaitingThresholdConfirmations channel_id */
        channel_id?: string | null;

        /** AwaitingThresholdConfirmations latest_spending_txid */
        latest_spending_txid?: string | null;

        /** AwaitingThresholdConfirmations confirmation_hash */
        confirmation_hash?: string | null;

        /** AwaitingThresholdConfirmations confirmation_height */
        confirmation_height?: number | null;

        /** AwaitingThresholdConfirmations amount_satoshis */
        amount_satoshis?: Long | null;
    }

    /** Represents an AwaitingThresholdConfirmations. */
    class AwaitingThresholdConfirmations
        implements IAwaitingThresholdConfirmations
    {
        /**
         * Constructs a new AwaitingThresholdConfirmations.
         * @param [properties] Properties to set
         */
        constructor(properties?: types.IAwaitingThresholdConfirmations);

        /** AwaitingThresholdConfirmations channel_id. */
        public channel_id?: string | null;

        /** AwaitingThresholdConfirmations latest_spending_txid. */
        public latest_spending_txid: string;

        /** AwaitingThresholdConfirmations confirmation_hash. */
        public confirmation_hash: string;

        /** AwaitingThresholdConfirmations confirmation_height. */
        public confirmation_height: number;

        /** AwaitingThresholdConfirmations amount_satoshis. */
        public amount_satoshis: Long;

        /**
         * Creates a new AwaitingThresholdConfirmations instance using the specified properties.
         * @param [properties] Properties to set
         * @returns AwaitingThresholdConfirmations instance
         */
        public static create(
            properties?: types.IAwaitingThresholdConfirmations
        ): types.AwaitingThresholdConfirmations;

        /**
         * Encodes the specified AwaitingThresholdConfirmations message. Does not implicitly {@link types.AwaitingThresholdConfirmations.verify|verify} messages.
         * @param message AwaitingThresholdConfirmations message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: types.IAwaitingThresholdConfirmations,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified AwaitingThresholdConfirmations message, length delimited. Does not implicitly {@link types.AwaitingThresholdConfirmations.verify|verify} messages.
         * @param message AwaitingThresholdConfirmations message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: types.IAwaitingThresholdConfirmations,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes an AwaitingThresholdConfirmations message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns AwaitingThresholdConfirmations
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): types.AwaitingThresholdConfirmations;

        /**
         * Decodes an AwaitingThresholdConfirmations message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns AwaitingThresholdConfirmations
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): types.AwaitingThresholdConfirmations;

        /**
         * Verifies an AwaitingThresholdConfirmations message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates an AwaitingThresholdConfirmations message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns AwaitingThresholdConfirmations
         */
        public static fromObject(object: {
            [k: string]: any;
        }): types.AwaitingThresholdConfirmations;

        /**
         * Creates a plain object from an AwaitingThresholdConfirmations message. Also converts values to other types if specified.
         * @param message AwaitingThresholdConfirmations
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: types.AwaitingThresholdConfirmations,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this AwaitingThresholdConfirmations to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for AwaitingThresholdConfirmations
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a PageToken. */
    interface IPageToken {
        /** PageToken token */
        token?: string | null;

        /** PageToken index */
        index?: Long | null;
    }

    /** Represents a PageToken. */
    class PageToken implements IPageToken {
        /**
         * Constructs a new PageToken.
         * @param [properties] Properties to set
         */
        constructor(properties?: types.IPageToken);

        /** PageToken token. */
        public token: string;

        /** PageToken index. */
        public index: Long;

        /**
         * Creates a new PageToken instance using the specified properties.
         * @param [properties] Properties to set
         * @returns PageToken instance
         */
        public static create(properties?: types.IPageToken): types.PageToken;

        /**
         * Encodes the specified PageToken message. Does not implicitly {@link types.PageToken.verify|verify} messages.
         * @param message PageToken message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: types.IPageToken,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified PageToken message, length delimited. Does not implicitly {@link types.PageToken.verify|verify} messages.
         * @param message PageToken message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: types.IPageToken,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a PageToken message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns PageToken
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): types.PageToken;

        /**
         * Decodes a PageToken message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns PageToken
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): types.PageToken;

        /**
         * Verifies a PageToken message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a PageToken message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns PageToken
         */
        public static fromObject(object: { [k: string]: any }): types.PageToken;

        /**
         * Creates a plain object from a PageToken message. Also converts values to other types if specified.
         * @param message PageToken
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: types.PageToken,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this PageToken to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for PageToken
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a Bolt11InvoiceDescription. */
    interface IBolt11InvoiceDescription {
        /** Bolt11InvoiceDescription direct */
        direct?: string | null;

        /** Bolt11InvoiceDescription hash */
        hash?: string | null;
    }

    /** Represents a Bolt11InvoiceDescription. */
    class Bolt11InvoiceDescription implements IBolt11InvoiceDescription {
        /**
         * Constructs a new Bolt11InvoiceDescription.
         * @param [properties] Properties to set
         */
        constructor(properties?: types.IBolt11InvoiceDescription);

        /** Bolt11InvoiceDescription direct. */
        public direct?: string | null;

        /** Bolt11InvoiceDescription hash. */
        public hash?: string | null;

        /** Bolt11InvoiceDescription kind. */
        public kind?: 'direct' | 'hash';

        /**
         * Creates a new Bolt11InvoiceDescription instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Bolt11InvoiceDescription instance
         */
        public static create(
            properties?: types.IBolt11InvoiceDescription
        ): types.Bolt11InvoiceDescription;

        /**
         * Encodes the specified Bolt11InvoiceDescription message. Does not implicitly {@link types.Bolt11InvoiceDescription.verify|verify} messages.
         * @param message Bolt11InvoiceDescription message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: types.IBolt11InvoiceDescription,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified Bolt11InvoiceDescription message, length delimited. Does not implicitly {@link types.Bolt11InvoiceDescription.verify|verify} messages.
         * @param message Bolt11InvoiceDescription message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: types.IBolt11InvoiceDescription,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a Bolt11InvoiceDescription message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Bolt11InvoiceDescription
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): types.Bolt11InvoiceDescription;

        /**
         * Decodes a Bolt11InvoiceDescription message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Bolt11InvoiceDescription
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): types.Bolt11InvoiceDescription;

        /**
         * Verifies a Bolt11InvoiceDescription message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a Bolt11InvoiceDescription message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Bolt11InvoiceDescription
         */
        public static fromObject(object: {
            [k: string]: any;
        }): types.Bolt11InvoiceDescription;

        /**
         * Creates a plain object from a Bolt11InvoiceDescription message. Also converts values to other types if specified.
         * @param message Bolt11InvoiceDescription
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: types.Bolt11InvoiceDescription,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this Bolt11InvoiceDescription to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Bolt11InvoiceDescription
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a RouteParametersConfig. */
    interface IRouteParametersConfig {
        /** RouteParametersConfig max_total_routing_fee_msat */
        max_total_routing_fee_msat?: Long | null;

        /** RouteParametersConfig max_total_cltv_expiry_delta */
        max_total_cltv_expiry_delta?: number | null;

        /** RouteParametersConfig max_path_count */
        max_path_count?: number | null;

        /** RouteParametersConfig max_channel_saturation_power_of_half */
        max_channel_saturation_power_of_half?: number | null;
    }

    /** Represents a RouteParametersConfig. */
    class RouteParametersConfig implements IRouteParametersConfig {
        /**
         * Constructs a new RouteParametersConfig.
         * @param [properties] Properties to set
         */
        constructor(properties?: types.IRouteParametersConfig);

        /** RouteParametersConfig max_total_routing_fee_msat. */
        public max_total_routing_fee_msat?: Long | null;

        /** RouteParametersConfig max_total_cltv_expiry_delta. */
        public max_total_cltv_expiry_delta: number;

        /** RouteParametersConfig max_path_count. */
        public max_path_count: number;

        /** RouteParametersConfig max_channel_saturation_power_of_half. */
        public max_channel_saturation_power_of_half: number;

        /**
         * Creates a new RouteParametersConfig instance using the specified properties.
         * @param [properties] Properties to set
         * @returns RouteParametersConfig instance
         */
        public static create(
            properties?: types.IRouteParametersConfig
        ): types.RouteParametersConfig;

        /**
         * Encodes the specified RouteParametersConfig message. Does not implicitly {@link types.RouteParametersConfig.verify|verify} messages.
         * @param message RouteParametersConfig message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: types.IRouteParametersConfig,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified RouteParametersConfig message, length delimited. Does not implicitly {@link types.RouteParametersConfig.verify|verify} messages.
         * @param message RouteParametersConfig message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: types.IRouteParametersConfig,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a RouteParametersConfig message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns RouteParametersConfig
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): types.RouteParametersConfig;

        /**
         * Decodes a RouteParametersConfig message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns RouteParametersConfig
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): types.RouteParametersConfig;

        /**
         * Verifies a RouteParametersConfig message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a RouteParametersConfig message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns RouteParametersConfig
         */
        public static fromObject(object: {
            [k: string]: any;
        }): types.RouteParametersConfig;

        /**
         * Creates a plain object from a RouteParametersConfig message. Also converts values to other types if specified.
         * @param message RouteParametersConfig
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: types.RouteParametersConfig,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this RouteParametersConfig to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for RouteParametersConfig
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a GraphRoutingFees. */
    interface IGraphRoutingFees {
        /** GraphRoutingFees base_msat */
        base_msat?: number | null;

        /** GraphRoutingFees proportional_millionths */
        proportional_millionths?: number | null;
    }

    /** Represents a GraphRoutingFees. */
    class GraphRoutingFees implements IGraphRoutingFees {
        /**
         * Constructs a new GraphRoutingFees.
         * @param [properties] Properties to set
         */
        constructor(properties?: types.IGraphRoutingFees);

        /** GraphRoutingFees base_msat. */
        public base_msat: number;

        /** GraphRoutingFees proportional_millionths. */
        public proportional_millionths: number;

        /**
         * Creates a new GraphRoutingFees instance using the specified properties.
         * @param [properties] Properties to set
         * @returns GraphRoutingFees instance
         */
        public static create(
            properties?: types.IGraphRoutingFees
        ): types.GraphRoutingFees;

        /**
         * Encodes the specified GraphRoutingFees message. Does not implicitly {@link types.GraphRoutingFees.verify|verify} messages.
         * @param message GraphRoutingFees message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: types.IGraphRoutingFees,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified GraphRoutingFees message, length delimited. Does not implicitly {@link types.GraphRoutingFees.verify|verify} messages.
         * @param message GraphRoutingFees message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: types.IGraphRoutingFees,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a GraphRoutingFees message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns GraphRoutingFees
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): types.GraphRoutingFees;

        /**
         * Decodes a GraphRoutingFees message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns GraphRoutingFees
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): types.GraphRoutingFees;

        /**
         * Verifies a GraphRoutingFees message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a GraphRoutingFees message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns GraphRoutingFees
         */
        public static fromObject(object: {
            [k: string]: any;
        }): types.GraphRoutingFees;

        /**
         * Creates a plain object from a GraphRoutingFees message. Also converts values to other types if specified.
         * @param message GraphRoutingFees
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: types.GraphRoutingFees,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this GraphRoutingFees to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for GraphRoutingFees
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a GraphChannelUpdate. */
    interface IGraphChannelUpdate {
        /** GraphChannelUpdate last_update */
        last_update?: number | null;

        /** GraphChannelUpdate enabled */
        enabled?: boolean | null;

        /** GraphChannelUpdate cltv_expiry_delta */
        cltv_expiry_delta?: number | null;

        /** GraphChannelUpdate htlc_minimum_msat */
        htlc_minimum_msat?: Long | null;

        /** GraphChannelUpdate htlc_maximum_msat */
        htlc_maximum_msat?: Long | null;

        /** GraphChannelUpdate fees */
        fees?: types.IGraphRoutingFees | null;
    }

    /** Represents a GraphChannelUpdate. */
    class GraphChannelUpdate implements IGraphChannelUpdate {
        /**
         * Constructs a new GraphChannelUpdate.
         * @param [properties] Properties to set
         */
        constructor(properties?: types.IGraphChannelUpdate);

        /** GraphChannelUpdate last_update. */
        public last_update: number;

        /** GraphChannelUpdate enabled. */
        public enabled: boolean;

        /** GraphChannelUpdate cltv_expiry_delta. */
        public cltv_expiry_delta: number;

        /** GraphChannelUpdate htlc_minimum_msat. */
        public htlc_minimum_msat: Long;

        /** GraphChannelUpdate htlc_maximum_msat. */
        public htlc_maximum_msat: Long;

        /** GraphChannelUpdate fees. */
        public fees?: types.IGraphRoutingFees | null;

        /**
         * Creates a new GraphChannelUpdate instance using the specified properties.
         * @param [properties] Properties to set
         * @returns GraphChannelUpdate instance
         */
        public static create(
            properties?: types.IGraphChannelUpdate
        ): types.GraphChannelUpdate;

        /**
         * Encodes the specified GraphChannelUpdate message. Does not implicitly {@link types.GraphChannelUpdate.verify|verify} messages.
         * @param message GraphChannelUpdate message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: types.IGraphChannelUpdate,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified GraphChannelUpdate message, length delimited. Does not implicitly {@link types.GraphChannelUpdate.verify|verify} messages.
         * @param message GraphChannelUpdate message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: types.IGraphChannelUpdate,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a GraphChannelUpdate message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns GraphChannelUpdate
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): types.GraphChannelUpdate;

        /**
         * Decodes a GraphChannelUpdate message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns GraphChannelUpdate
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): types.GraphChannelUpdate;

        /**
         * Verifies a GraphChannelUpdate message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a GraphChannelUpdate message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns GraphChannelUpdate
         */
        public static fromObject(object: {
            [k: string]: any;
        }): types.GraphChannelUpdate;

        /**
         * Creates a plain object from a GraphChannelUpdate message. Also converts values to other types if specified.
         * @param message GraphChannelUpdate
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: types.GraphChannelUpdate,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this GraphChannelUpdate to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for GraphChannelUpdate
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a GraphChannel. */
    interface IGraphChannel {
        /** GraphChannel node_one */
        node_one?: string | null;

        /** GraphChannel node_two */
        node_two?: string | null;

        /** GraphChannel capacity_sats */
        capacity_sats?: Long | null;

        /** GraphChannel one_to_two */
        one_to_two?: types.IGraphChannelUpdate | null;

        /** GraphChannel two_to_one */
        two_to_one?: types.IGraphChannelUpdate | null;
    }

    /** Represents a GraphChannel. */
    class GraphChannel implements IGraphChannel {
        /**
         * Constructs a new GraphChannel.
         * @param [properties] Properties to set
         */
        constructor(properties?: types.IGraphChannel);

        /** GraphChannel node_one. */
        public node_one: string;

        /** GraphChannel node_two. */
        public node_two: string;

        /** GraphChannel capacity_sats. */
        public capacity_sats?: Long | null;

        /** GraphChannel one_to_two. */
        public one_to_two?: types.IGraphChannelUpdate | null;

        /** GraphChannel two_to_one. */
        public two_to_one?: types.IGraphChannelUpdate | null;

        /**
         * Creates a new GraphChannel instance using the specified properties.
         * @param [properties] Properties to set
         * @returns GraphChannel instance
         */
        public static create(
            properties?: types.IGraphChannel
        ): types.GraphChannel;

        /**
         * Encodes the specified GraphChannel message. Does not implicitly {@link types.GraphChannel.verify|verify} messages.
         * @param message GraphChannel message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: types.IGraphChannel,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified GraphChannel message, length delimited. Does not implicitly {@link types.GraphChannel.verify|verify} messages.
         * @param message GraphChannel message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: types.IGraphChannel,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a GraphChannel message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns GraphChannel
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): types.GraphChannel;

        /**
         * Decodes a GraphChannel message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns GraphChannel
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): types.GraphChannel;

        /**
         * Verifies a GraphChannel message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a GraphChannel message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns GraphChannel
         */
        public static fromObject(object: {
            [k: string]: any;
        }): types.GraphChannel;

        /**
         * Creates a plain object from a GraphChannel message. Also converts values to other types if specified.
         * @param message GraphChannel
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: types.GraphChannel,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this GraphChannel to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for GraphChannel
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a GraphNodeAnnouncement. */
    interface IGraphNodeAnnouncement {
        /** GraphNodeAnnouncement last_update */
        last_update?: number | null;

        /** GraphNodeAnnouncement alias */
        alias?: string | null;

        /** GraphNodeAnnouncement rgb */
        rgb?: string | null;

        /** GraphNodeAnnouncement addresses */
        addresses?: string[] | null;
    }

    /** Represents a GraphNodeAnnouncement. */
    class GraphNodeAnnouncement implements IGraphNodeAnnouncement {
        /**
         * Constructs a new GraphNodeAnnouncement.
         * @param [properties] Properties to set
         */
        constructor(properties?: types.IGraphNodeAnnouncement);

        /** GraphNodeAnnouncement last_update. */
        public last_update: number;

        /** GraphNodeAnnouncement alias. */
        public alias: string;

        /** GraphNodeAnnouncement rgb. */
        public rgb: string;

        /** GraphNodeAnnouncement addresses. */
        public addresses: string[];

        /**
         * Creates a new GraphNodeAnnouncement instance using the specified properties.
         * @param [properties] Properties to set
         * @returns GraphNodeAnnouncement instance
         */
        public static create(
            properties?: types.IGraphNodeAnnouncement
        ): types.GraphNodeAnnouncement;

        /**
         * Encodes the specified GraphNodeAnnouncement message. Does not implicitly {@link types.GraphNodeAnnouncement.verify|verify} messages.
         * @param message GraphNodeAnnouncement message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: types.IGraphNodeAnnouncement,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified GraphNodeAnnouncement message, length delimited. Does not implicitly {@link types.GraphNodeAnnouncement.verify|verify} messages.
         * @param message GraphNodeAnnouncement message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: types.IGraphNodeAnnouncement,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a GraphNodeAnnouncement message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns GraphNodeAnnouncement
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): types.GraphNodeAnnouncement;

        /**
         * Decodes a GraphNodeAnnouncement message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns GraphNodeAnnouncement
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): types.GraphNodeAnnouncement;

        /**
         * Verifies a GraphNodeAnnouncement message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a GraphNodeAnnouncement message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns GraphNodeAnnouncement
         */
        public static fromObject(object: {
            [k: string]: any;
        }): types.GraphNodeAnnouncement;

        /**
         * Creates a plain object from a GraphNodeAnnouncement message. Also converts values to other types if specified.
         * @param message GraphNodeAnnouncement
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: types.GraphNodeAnnouncement,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this GraphNodeAnnouncement to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for GraphNodeAnnouncement
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a Peer. */
    interface IPeer {
        /** Peer node_id */
        node_id?: string | null;

        /** Peer address */
        address?: string | null;

        /** Peer is_persisted */
        is_persisted?: boolean | null;

        /** Peer is_connected */
        is_connected?: boolean | null;
    }

    /** Represents a Peer. */
    class Peer implements IPeer {
        /**
         * Constructs a new Peer.
         * @param [properties] Properties to set
         */
        constructor(properties?: types.IPeer);

        /** Peer node_id. */
        public node_id: string;

        /** Peer address. */
        public address: string;

        /** Peer is_persisted. */
        public is_persisted: boolean;

        /** Peer is_connected. */
        public is_connected: boolean;

        /**
         * Creates a new Peer instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Peer instance
         */
        public static create(properties?: types.IPeer): types.Peer;

        /**
         * Encodes the specified Peer message. Does not implicitly {@link types.Peer.verify|verify} messages.
         * @param message Peer message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: types.IPeer,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified Peer message, length delimited. Does not implicitly {@link types.Peer.verify|verify} messages.
         * @param message Peer message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: types.IPeer,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a Peer message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Peer
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): types.Peer;

        /**
         * Decodes a Peer message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Peer
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): types.Peer;

        /**
         * Verifies a Peer message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a Peer message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Peer
         */
        public static fromObject(object: { [k: string]: any }): types.Peer;

        /**
         * Creates a plain object from a Peer message. Also converts values to other types if specified.
         * @param message Peer
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: types.Peer,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this Peer to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Peer
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a GraphNode. */
    interface IGraphNode {
        /** GraphNode channels */
        channels?: Long[] | null;

        /** GraphNode announcement_info */
        announcement_info?: types.IGraphNodeAnnouncement | null;
    }

    /** Represents a GraphNode. */
    class GraphNode implements IGraphNode {
        /**
         * Constructs a new GraphNode.
         * @param [properties] Properties to set
         */
        constructor(properties?: types.IGraphNode);

        /** GraphNode channels. */
        public channels: Long[];

        /** GraphNode announcement_info. */
        public announcement_info?: types.IGraphNodeAnnouncement | null;

        /**
         * Creates a new GraphNode instance using the specified properties.
         * @param [properties] Properties to set
         * @returns GraphNode instance
         */
        public static create(properties?: types.IGraphNode): types.GraphNode;

        /**
         * Encodes the specified GraphNode message. Does not implicitly {@link types.GraphNode.verify|verify} messages.
         * @param message GraphNode message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: types.IGraphNode,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified GraphNode message, length delimited. Does not implicitly {@link types.GraphNode.verify|verify} messages.
         * @param message GraphNode message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: types.IGraphNode,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a GraphNode message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns GraphNode
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): types.GraphNode;

        /**
         * Decodes a GraphNode message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns GraphNode
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): types.GraphNode;

        /**
         * Verifies a GraphNode message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a GraphNode message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns GraphNode
         */
        public static fromObject(object: { [k: string]: any }): types.GraphNode;

        /**
         * Creates a plain object from a GraphNode message. Also converts values to other types if specified.
         * @param message GraphNode
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: types.GraphNode,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this GraphNode to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for GraphNode
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a Bolt11RouteHint. */
    interface IBolt11RouteHint {
        /** Bolt11RouteHint hop_hints */
        hop_hints?: types.IBolt11HopHint[] | null;
    }

    /** Represents a Bolt11RouteHint. */
    class Bolt11RouteHint implements IBolt11RouteHint {
        /**
         * Constructs a new Bolt11RouteHint.
         * @param [properties] Properties to set
         */
        constructor(properties?: types.IBolt11RouteHint);

        /** Bolt11RouteHint hop_hints. */
        public hop_hints: types.IBolt11HopHint[];

        /**
         * Creates a new Bolt11RouteHint instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Bolt11RouteHint instance
         */
        public static create(
            properties?: types.IBolt11RouteHint
        ): types.Bolt11RouteHint;

        /**
         * Encodes the specified Bolt11RouteHint message. Does not implicitly {@link types.Bolt11RouteHint.verify|verify} messages.
         * @param message Bolt11RouteHint message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: types.IBolt11RouteHint,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified Bolt11RouteHint message, length delimited. Does not implicitly {@link types.Bolt11RouteHint.verify|verify} messages.
         * @param message Bolt11RouteHint message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: types.IBolt11RouteHint,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a Bolt11RouteHint message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Bolt11RouteHint
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): types.Bolt11RouteHint;

        /**
         * Decodes a Bolt11RouteHint message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Bolt11RouteHint
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): types.Bolt11RouteHint;

        /**
         * Verifies a Bolt11RouteHint message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a Bolt11RouteHint message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Bolt11RouteHint
         */
        public static fromObject(object: {
            [k: string]: any;
        }): types.Bolt11RouteHint;

        /**
         * Creates a plain object from a Bolt11RouteHint message. Also converts values to other types if specified.
         * @param message Bolt11RouteHint
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: types.Bolt11RouteHint,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this Bolt11RouteHint to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Bolt11RouteHint
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a Bolt11HopHint. */
    interface IBolt11HopHint {
        /** Bolt11HopHint node_id */
        node_id?: string | null;

        /** Bolt11HopHint short_channel_id */
        short_channel_id?: Long | null;

        /** Bolt11HopHint fee_base_msat */
        fee_base_msat?: number | null;

        /** Bolt11HopHint fee_proportional_millionths */
        fee_proportional_millionths?: number | null;

        /** Bolt11HopHint cltv_expiry_delta */
        cltv_expiry_delta?: number | null;
    }

    /** Represents a Bolt11HopHint. */
    class Bolt11HopHint implements IBolt11HopHint {
        /**
         * Constructs a new Bolt11HopHint.
         * @param [properties] Properties to set
         */
        constructor(properties?: types.IBolt11HopHint);

        /** Bolt11HopHint node_id. */
        public node_id: string;

        /** Bolt11HopHint short_channel_id. */
        public short_channel_id: Long;

        /** Bolt11HopHint fee_base_msat. */
        public fee_base_msat: number;

        /** Bolt11HopHint fee_proportional_millionths. */
        public fee_proportional_millionths: number;

        /** Bolt11HopHint cltv_expiry_delta. */
        public cltv_expiry_delta: number;

        /**
         * Creates a new Bolt11HopHint instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Bolt11HopHint instance
         */
        public static create(
            properties?: types.IBolt11HopHint
        ): types.Bolt11HopHint;

        /**
         * Encodes the specified Bolt11HopHint message. Does not implicitly {@link types.Bolt11HopHint.verify|verify} messages.
         * @param message Bolt11HopHint message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: types.IBolt11HopHint,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified Bolt11HopHint message, length delimited. Does not implicitly {@link types.Bolt11HopHint.verify|verify} messages.
         * @param message Bolt11HopHint message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: types.IBolt11HopHint,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a Bolt11HopHint message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Bolt11HopHint
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): types.Bolt11HopHint;

        /**
         * Decodes a Bolt11HopHint message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Bolt11HopHint
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): types.Bolt11HopHint;

        /**
         * Verifies a Bolt11HopHint message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a Bolt11HopHint message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Bolt11HopHint
         */
        public static fromObject(object: {
            [k: string]: any;
        }): types.Bolt11HopHint;

        /**
         * Creates a plain object from a Bolt11HopHint message. Also converts values to other types if specified.
         * @param message Bolt11HopHint
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: types.Bolt11HopHint,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this Bolt11HopHint to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Bolt11HopHint
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of an OfferAmount. */
    interface IOfferAmount {
        /** OfferAmount bitcoin_amount_msats */
        bitcoin_amount_msats?: Long | null;

        /** OfferAmount currency_amount */
        currency_amount?: types.ICurrencyAmount | null;
    }

    /** Represents an OfferAmount. */
    class OfferAmount implements IOfferAmount {
        /**
         * Constructs a new OfferAmount.
         * @param [properties] Properties to set
         */
        constructor(properties?: types.IOfferAmount);

        /** OfferAmount bitcoin_amount_msats. */
        public bitcoin_amount_msats?: Long | null;

        /** OfferAmount currency_amount. */
        public currency_amount?: types.ICurrencyAmount | null;

        /** OfferAmount amount. */
        public amount?: 'bitcoin_amount_msats' | 'currency_amount';

        /**
         * Creates a new OfferAmount instance using the specified properties.
         * @param [properties] Properties to set
         * @returns OfferAmount instance
         */
        public static create(
            properties?: types.IOfferAmount
        ): types.OfferAmount;

        /**
         * Encodes the specified OfferAmount message. Does not implicitly {@link types.OfferAmount.verify|verify} messages.
         * @param message OfferAmount message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: types.IOfferAmount,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified OfferAmount message, length delimited. Does not implicitly {@link types.OfferAmount.verify|verify} messages.
         * @param message OfferAmount message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: types.IOfferAmount,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes an OfferAmount message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns OfferAmount
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): types.OfferAmount;

        /**
         * Decodes an OfferAmount message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns OfferAmount
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): types.OfferAmount;

        /**
         * Verifies an OfferAmount message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates an OfferAmount message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns OfferAmount
         */
        public static fromObject(object: {
            [k: string]: any;
        }): types.OfferAmount;

        /**
         * Creates a plain object from an OfferAmount message. Also converts values to other types if specified.
         * @param message OfferAmount
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: types.OfferAmount,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this OfferAmount to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for OfferAmount
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a CurrencyAmount. */
    interface ICurrencyAmount {
        /** CurrencyAmount iso4217_code */
        iso4217_code?: string | null;

        /** CurrencyAmount amount */
        amount?: Long | null;
    }

    /** Represents a CurrencyAmount. */
    class CurrencyAmount implements ICurrencyAmount {
        /**
         * Constructs a new CurrencyAmount.
         * @param [properties] Properties to set
         */
        constructor(properties?: types.ICurrencyAmount);

        /** CurrencyAmount iso4217_code. */
        public iso4217_code: string;

        /** CurrencyAmount amount. */
        public amount: Long;

        /**
         * Creates a new CurrencyAmount instance using the specified properties.
         * @param [properties] Properties to set
         * @returns CurrencyAmount instance
         */
        public static create(
            properties?: types.ICurrencyAmount
        ): types.CurrencyAmount;

        /**
         * Encodes the specified CurrencyAmount message. Does not implicitly {@link types.CurrencyAmount.verify|verify} messages.
         * @param message CurrencyAmount message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: types.ICurrencyAmount,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified CurrencyAmount message, length delimited. Does not implicitly {@link types.CurrencyAmount.verify|verify} messages.
         * @param message CurrencyAmount message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: types.ICurrencyAmount,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a CurrencyAmount message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns CurrencyAmount
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): types.CurrencyAmount;

        /**
         * Decodes a CurrencyAmount message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns CurrencyAmount
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): types.CurrencyAmount;

        /**
         * Verifies a CurrencyAmount message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a CurrencyAmount message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns CurrencyAmount
         */
        public static fromObject(object: {
            [k: string]: any;
        }): types.CurrencyAmount;

        /**
         * Creates a plain object from a CurrencyAmount message. Also converts values to other types if specified.
         * @param message CurrencyAmount
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: types.CurrencyAmount,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this CurrencyAmount to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for CurrencyAmount
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of an OfferQuantity. */
    interface IOfferQuantity {
        /** OfferQuantity one */
        one?: boolean | null;

        /** OfferQuantity bounded */
        bounded?: Long | null;

        /** OfferQuantity unbounded */
        unbounded?: boolean | null;
    }

    /** Represents an OfferQuantity. */
    class OfferQuantity implements IOfferQuantity {
        /**
         * Constructs a new OfferQuantity.
         * @param [properties] Properties to set
         */
        constructor(properties?: types.IOfferQuantity);

        /** OfferQuantity one. */
        public one?: boolean | null;

        /** OfferQuantity bounded. */
        public bounded?: Long | null;

        /** OfferQuantity unbounded. */
        public unbounded?: boolean | null;

        /** OfferQuantity quantity. */
        public quantity?: 'one' | 'bounded' | 'unbounded';

        /**
         * Creates a new OfferQuantity instance using the specified properties.
         * @param [properties] Properties to set
         * @returns OfferQuantity instance
         */
        public static create(
            properties?: types.IOfferQuantity
        ): types.OfferQuantity;

        /**
         * Encodes the specified OfferQuantity message. Does not implicitly {@link types.OfferQuantity.verify|verify} messages.
         * @param message OfferQuantity message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: types.IOfferQuantity,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified OfferQuantity message, length delimited. Does not implicitly {@link types.OfferQuantity.verify|verify} messages.
         * @param message OfferQuantity message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: types.IOfferQuantity,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes an OfferQuantity message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns OfferQuantity
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): types.OfferQuantity;

        /**
         * Decodes an OfferQuantity message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns OfferQuantity
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): types.OfferQuantity;

        /**
         * Verifies an OfferQuantity message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates an OfferQuantity message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns OfferQuantity
         */
        public static fromObject(object: {
            [k: string]: any;
        }): types.OfferQuantity;

        /**
         * Creates a plain object from an OfferQuantity message. Also converts values to other types if specified.
         * @param message OfferQuantity
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: types.OfferQuantity,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this OfferQuantity to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for OfferQuantity
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a BlindedPath. */
    interface IBlindedPath {
        /** BlindedPath node_id */
        node_id?: string | null;

        /** BlindedPath directed_scid */
        directed_scid?: types.IDirectedShortChannelId | null;

        /** BlindedPath blinding_point */
        blinding_point?: string | null;

        /** BlindedPath num_hops */
        num_hops?: number | null;
    }

    /** Represents a BlindedPath. */
    class BlindedPath implements IBlindedPath {
        /**
         * Constructs a new BlindedPath.
         * @param [properties] Properties to set
         */
        constructor(properties?: types.IBlindedPath);

        /** BlindedPath node_id. */
        public node_id?: string | null;

        /** BlindedPath directed_scid. */
        public directed_scid?: types.IDirectedShortChannelId | null;

        /** BlindedPath blinding_point. */
        public blinding_point: string;

        /** BlindedPath num_hops. */
        public num_hops: number;

        /** BlindedPath introduction_node. */
        public introduction_node?: 'node_id' | 'directed_scid';

        /**
         * Creates a new BlindedPath instance using the specified properties.
         * @param [properties] Properties to set
         * @returns BlindedPath instance
         */
        public static create(
            properties?: types.IBlindedPath
        ): types.BlindedPath;

        /**
         * Encodes the specified BlindedPath message. Does not implicitly {@link types.BlindedPath.verify|verify} messages.
         * @param message BlindedPath message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: types.IBlindedPath,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified BlindedPath message, length delimited. Does not implicitly {@link types.BlindedPath.verify|verify} messages.
         * @param message BlindedPath message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: types.IBlindedPath,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a BlindedPath message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns BlindedPath
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): types.BlindedPath;

        /**
         * Decodes a BlindedPath message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns BlindedPath
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): types.BlindedPath;

        /**
         * Verifies a BlindedPath message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a BlindedPath message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns BlindedPath
         */
        public static fromObject(object: {
            [k: string]: any;
        }): types.BlindedPath;

        /**
         * Creates a plain object from a BlindedPath message. Also converts values to other types if specified.
         * @param message BlindedPath
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: types.BlindedPath,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this BlindedPath to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for BlindedPath
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a DirectedShortChannelId. */
    interface IDirectedShortChannelId {
        /** DirectedShortChannelId scid */
        scid?: Long | null;

        /** DirectedShortChannelId direction */
        direction?: types.ChannelDirection | null;
    }

    /** Represents a DirectedShortChannelId. */
    class DirectedShortChannelId implements IDirectedShortChannelId {
        /**
         * Constructs a new DirectedShortChannelId.
         * @param [properties] Properties to set
         */
        constructor(properties?: types.IDirectedShortChannelId);

        /** DirectedShortChannelId scid. */
        public scid: Long;

        /** DirectedShortChannelId direction. */
        public direction: types.ChannelDirection;

        /**
         * Creates a new DirectedShortChannelId instance using the specified properties.
         * @param [properties] Properties to set
         * @returns DirectedShortChannelId instance
         */
        public static create(
            properties?: types.IDirectedShortChannelId
        ): types.DirectedShortChannelId;

        /**
         * Encodes the specified DirectedShortChannelId message. Does not implicitly {@link types.DirectedShortChannelId.verify|verify} messages.
         * @param message DirectedShortChannelId message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: types.IDirectedShortChannelId,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified DirectedShortChannelId message, length delimited. Does not implicitly {@link types.DirectedShortChannelId.verify|verify} messages.
         * @param message DirectedShortChannelId message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: types.IDirectedShortChannelId,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a DirectedShortChannelId message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns DirectedShortChannelId
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): types.DirectedShortChannelId;

        /**
         * Decodes a DirectedShortChannelId message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns DirectedShortChannelId
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): types.DirectedShortChannelId;

        /**
         * Verifies a DirectedShortChannelId message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a DirectedShortChannelId message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns DirectedShortChannelId
         */
        public static fromObject(object: {
            [k: string]: any;
        }): types.DirectedShortChannelId;

        /**
         * Creates a plain object from a DirectedShortChannelId message. Also converts values to other types if specified.
         * @param message DirectedShortChannelId
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: types.DirectedShortChannelId,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this DirectedShortChannelId to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for DirectedShortChannelId
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** ChannelDirection enum. */
    enum ChannelDirection {
        NODE_ONE = 0,
        NODE_TWO = 1
    }

    /** Properties of a Bolt11Feature. */
    interface IBolt11Feature {
        /** Bolt11Feature name */
        name?: string | null;

        /** Bolt11Feature is_required */
        is_required?: boolean | null;

        /** Bolt11Feature is_known */
        is_known?: boolean | null;
    }

    /** Represents a Bolt11Feature. */
    class Bolt11Feature implements IBolt11Feature {
        /**
         * Constructs a new Bolt11Feature.
         * @param [properties] Properties to set
         */
        constructor(properties?: types.IBolt11Feature);

        /** Bolt11Feature name. */
        public name: string;

        /** Bolt11Feature is_required. */
        public is_required: boolean;

        /** Bolt11Feature is_known. */
        public is_known: boolean;

        /**
         * Creates a new Bolt11Feature instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Bolt11Feature instance
         */
        public static create(
            properties?: types.IBolt11Feature
        ): types.Bolt11Feature;

        /**
         * Encodes the specified Bolt11Feature message. Does not implicitly {@link types.Bolt11Feature.verify|verify} messages.
         * @param message Bolt11Feature message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: types.IBolt11Feature,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified Bolt11Feature message, length delimited. Does not implicitly {@link types.Bolt11Feature.verify|verify} messages.
         * @param message Bolt11Feature message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: types.IBolt11Feature,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a Bolt11Feature message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Bolt11Feature
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): types.Bolt11Feature;

        /**
         * Decodes a Bolt11Feature message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Bolt11Feature
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): types.Bolt11Feature;

        /**
         * Verifies a Bolt11Feature message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a Bolt11Feature message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Bolt11Feature
         */
        public static fromObject(object: {
            [k: string]: any;
        }): types.Bolt11Feature;

        /**
         * Creates a plain object from a Bolt11Feature message. Also converts values to other types if specified.
         * @param message Bolt11Feature
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: types.Bolt11Feature,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this Bolt11Feature to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Bolt11Feature
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }
}

/** Namespace events. */
export namespace events {
    /** Properties of an EventEnvelope. */
    interface IEventEnvelope {
        /** EventEnvelope payment_received */
        payment_received?: events.IPaymentReceived | null;

        /** EventEnvelope payment_successful */
        payment_successful?: events.IPaymentSuccessful | null;

        /** EventEnvelope payment_failed */
        payment_failed?: events.IPaymentFailed | null;

        /** EventEnvelope payment_forwarded */
        payment_forwarded?: events.IPaymentForwarded | null;

        /** EventEnvelope payment_claimable */
        payment_claimable?: events.IPaymentClaimable | null;

        /** EventEnvelope channel_state_changed */
        channel_state_changed?: events.IChannelStateChanged | null;
    }

    /** Represents an EventEnvelope. */
    class EventEnvelope implements IEventEnvelope {
        /**
         * Constructs a new EventEnvelope.
         * @param [properties] Properties to set
         */
        constructor(properties?: events.IEventEnvelope);

        /** EventEnvelope payment_received. */
        public payment_received?: events.IPaymentReceived | null;

        /** EventEnvelope payment_successful. */
        public payment_successful?: events.IPaymentSuccessful | null;

        /** EventEnvelope payment_failed. */
        public payment_failed?: events.IPaymentFailed | null;

        /** EventEnvelope payment_forwarded. */
        public payment_forwarded?: events.IPaymentForwarded | null;

        /** EventEnvelope payment_claimable. */
        public payment_claimable?: events.IPaymentClaimable | null;

        /** EventEnvelope channel_state_changed. */
        public channel_state_changed?: events.IChannelStateChanged | null;

        /** EventEnvelope event. */
        public event?:
            | 'payment_received'
            | 'payment_successful'
            | 'payment_failed'
            | 'payment_forwarded'
            | 'payment_claimable'
            | 'channel_state_changed';

        /**
         * Creates a new EventEnvelope instance using the specified properties.
         * @param [properties] Properties to set
         * @returns EventEnvelope instance
         */
        public static create(
            properties?: events.IEventEnvelope
        ): events.EventEnvelope;

        /**
         * Encodes the specified EventEnvelope message. Does not implicitly {@link events.EventEnvelope.verify|verify} messages.
         * @param message EventEnvelope message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: events.IEventEnvelope,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified EventEnvelope message, length delimited. Does not implicitly {@link events.EventEnvelope.verify|verify} messages.
         * @param message EventEnvelope message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: events.IEventEnvelope,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes an EventEnvelope message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns EventEnvelope
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): events.EventEnvelope;

        /**
         * Decodes an EventEnvelope message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns EventEnvelope
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): events.EventEnvelope;

        /**
         * Verifies an EventEnvelope message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates an EventEnvelope message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns EventEnvelope
         */
        public static fromObject(object: {
            [k: string]: any;
        }): events.EventEnvelope;

        /**
         * Creates a plain object from an EventEnvelope message. Also converts values to other types if specified.
         * @param message EventEnvelope
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: events.EventEnvelope,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this EventEnvelope to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for EventEnvelope
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** ChannelState enum. */
    enum ChannelState {
        CHANNEL_STATE_UNSPECIFIED = 0,
        CHANNEL_STATE_PENDING = 1,
        CHANNEL_STATE_READY = 2,
        CHANNEL_STATE_OPEN_FAILED = 3,
        CHANNEL_STATE_CLOSED = 4
    }

    /** ChannelClosureInitiator enum. */
    enum ChannelClosureInitiator {
        CHANNEL_CLOSURE_INITIATOR_UNSPECIFIED = 0,
        CHANNEL_CLOSURE_INITIATOR_LOCAL = 1,
        CHANNEL_CLOSURE_INITIATOR_REMOTE = 2,
        CHANNEL_CLOSURE_INITIATOR_UNKNOWN = 3
    }

    /** ChannelStateChangeReasonKind enum. */
    enum ChannelStateChangeReasonKind {
        CHANNEL_STATE_CHANGE_REASON_KIND_UNSPECIFIED = 0,
        CHANNEL_STATE_CHANGE_REASON_KIND_COUNTERPARTY_FORCE_CLOSED = 1,
        CHANNEL_STATE_CHANGE_REASON_KIND_HOLDER_FORCE_CLOSED = 2,
        CHANNEL_STATE_CHANGE_REASON_KIND_LEGACY_COOPERATIVE_CLOSURE = 3,
        CHANNEL_STATE_CHANGE_REASON_KIND_COUNTERPARTY_INITIATED_COOPERATIVE_CLOSURE = 4,
        CHANNEL_STATE_CHANGE_REASON_KIND_LOCALLY_INITIATED_COOPERATIVE_CLOSURE = 5,
        CHANNEL_STATE_CHANGE_REASON_KIND_COMMITMENT_TX_CONFIRMED = 6,
        CHANNEL_STATE_CHANGE_REASON_KIND_FUNDING_TIMED_OUT = 7,
        CHANNEL_STATE_CHANGE_REASON_KIND_PROCESSING_ERROR = 8,
        CHANNEL_STATE_CHANGE_REASON_KIND_DISCONNECTED_PEER = 9,
        CHANNEL_STATE_CHANGE_REASON_KIND_OUTDATED_CHANNEL_MANAGER = 10,
        CHANNEL_STATE_CHANGE_REASON_KIND_COUNTERPARTY_COOP_CLOSED_UNFUNDED_CHANNEL = 11,
        CHANNEL_STATE_CHANGE_REASON_KIND_LOCALLY_COOP_CLOSED_UNFUNDED_CHANNEL = 12,
        CHANNEL_STATE_CHANGE_REASON_KIND_FUNDING_BATCH_CLOSURE = 13,
        CHANNEL_STATE_CHANGE_REASON_KIND_HTLCS_TIMED_OUT = 14,
        CHANNEL_STATE_CHANGE_REASON_KIND_PEER_FEERATE_TOO_LOW = 15
    }

    /** Properties of a CounterpartyForceClosedDetails. */
    interface ICounterpartyForceClosedDetails {
        /** CounterpartyForceClosedDetails peer_msg */
        peer_msg?: string | null;
    }

    /** Represents a CounterpartyForceClosedDetails. */
    class CounterpartyForceClosedDetails
        implements ICounterpartyForceClosedDetails
    {
        /**
         * Constructs a new CounterpartyForceClosedDetails.
         * @param [properties] Properties to set
         */
        constructor(properties?: events.ICounterpartyForceClosedDetails);

        /** CounterpartyForceClosedDetails peer_msg. */
        public peer_msg: string;

        /**
         * Creates a new CounterpartyForceClosedDetails instance using the specified properties.
         * @param [properties] Properties to set
         * @returns CounterpartyForceClosedDetails instance
         */
        public static create(
            properties?: events.ICounterpartyForceClosedDetails
        ): events.CounterpartyForceClosedDetails;

        /**
         * Encodes the specified CounterpartyForceClosedDetails message. Does not implicitly {@link events.CounterpartyForceClosedDetails.verify|verify} messages.
         * @param message CounterpartyForceClosedDetails message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: events.ICounterpartyForceClosedDetails,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified CounterpartyForceClosedDetails message, length delimited. Does not implicitly {@link events.CounterpartyForceClosedDetails.verify|verify} messages.
         * @param message CounterpartyForceClosedDetails message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: events.ICounterpartyForceClosedDetails,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a CounterpartyForceClosedDetails message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns CounterpartyForceClosedDetails
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): events.CounterpartyForceClosedDetails;

        /**
         * Decodes a CounterpartyForceClosedDetails message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns CounterpartyForceClosedDetails
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): events.CounterpartyForceClosedDetails;

        /**
         * Verifies a CounterpartyForceClosedDetails message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a CounterpartyForceClosedDetails message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns CounterpartyForceClosedDetails
         */
        public static fromObject(object: {
            [k: string]: any;
        }): events.CounterpartyForceClosedDetails;

        /**
         * Creates a plain object from a CounterpartyForceClosedDetails message. Also converts values to other types if specified.
         * @param message CounterpartyForceClosedDetails
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: events.CounterpartyForceClosedDetails,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this CounterpartyForceClosedDetails to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for CounterpartyForceClosedDetails
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a HolderForceClosedDetails. */
    interface IHolderForceClosedDetails {
        /** HolderForceClosedDetails broadcasted_latest_txn */
        broadcasted_latest_txn?: boolean | null;

        /** HolderForceClosedDetails message */
        message?: string | null;
    }

    /** Represents a HolderForceClosedDetails. */
    class HolderForceClosedDetails implements IHolderForceClosedDetails {
        /**
         * Constructs a new HolderForceClosedDetails.
         * @param [properties] Properties to set
         */
        constructor(properties?: events.IHolderForceClosedDetails);

        /** HolderForceClosedDetails broadcasted_latest_txn. */
        public broadcasted_latest_txn?: boolean | null;

        /** HolderForceClosedDetails message. */
        public message: string;

        /**
         * Creates a new HolderForceClosedDetails instance using the specified properties.
         * @param [properties] Properties to set
         * @returns HolderForceClosedDetails instance
         */
        public static create(
            properties?: events.IHolderForceClosedDetails
        ): events.HolderForceClosedDetails;

        /**
         * Encodes the specified HolderForceClosedDetails message. Does not implicitly {@link events.HolderForceClosedDetails.verify|verify} messages.
         * @param message HolderForceClosedDetails message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: events.IHolderForceClosedDetails,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified HolderForceClosedDetails message, length delimited. Does not implicitly {@link events.HolderForceClosedDetails.verify|verify} messages.
         * @param message HolderForceClosedDetails message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: events.IHolderForceClosedDetails,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a HolderForceClosedDetails message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns HolderForceClosedDetails
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): events.HolderForceClosedDetails;

        /**
         * Decodes a HolderForceClosedDetails message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns HolderForceClosedDetails
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): events.HolderForceClosedDetails;

        /**
         * Verifies a HolderForceClosedDetails message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a HolderForceClosedDetails message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns HolderForceClosedDetails
         */
        public static fromObject(object: {
            [k: string]: any;
        }): events.HolderForceClosedDetails;

        /**
         * Creates a plain object from a HolderForceClosedDetails message. Also converts values to other types if specified.
         * @param message HolderForceClosedDetails
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: events.HolderForceClosedDetails,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this HolderForceClosedDetails to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for HolderForceClosedDetails
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a ProcessingErrorDetails. */
    interface IProcessingErrorDetails {
        /** ProcessingErrorDetails err */
        err?: string | null;
    }

    /** Represents a ProcessingErrorDetails. */
    class ProcessingErrorDetails implements IProcessingErrorDetails {
        /**
         * Constructs a new ProcessingErrorDetails.
         * @param [properties] Properties to set
         */
        constructor(properties?: events.IProcessingErrorDetails);

        /** ProcessingErrorDetails err. */
        public err: string;

        /**
         * Creates a new ProcessingErrorDetails instance using the specified properties.
         * @param [properties] Properties to set
         * @returns ProcessingErrorDetails instance
         */
        public static create(
            properties?: events.IProcessingErrorDetails
        ): events.ProcessingErrorDetails;

        /**
         * Encodes the specified ProcessingErrorDetails message. Does not implicitly {@link events.ProcessingErrorDetails.verify|verify} messages.
         * @param message ProcessingErrorDetails message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: events.IProcessingErrorDetails,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified ProcessingErrorDetails message, length delimited. Does not implicitly {@link events.ProcessingErrorDetails.verify|verify} messages.
         * @param message ProcessingErrorDetails message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: events.IProcessingErrorDetails,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a ProcessingErrorDetails message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns ProcessingErrorDetails
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): events.ProcessingErrorDetails;

        /**
         * Decodes a ProcessingErrorDetails message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns ProcessingErrorDetails
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): events.ProcessingErrorDetails;

        /**
         * Verifies a ProcessingErrorDetails message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a ProcessingErrorDetails message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns ProcessingErrorDetails
         */
        public static fromObject(object: {
            [k: string]: any;
        }): events.ProcessingErrorDetails;

        /**
         * Creates a plain object from a ProcessingErrorDetails message. Also converts values to other types if specified.
         * @param message ProcessingErrorDetails
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: events.ProcessingErrorDetails,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this ProcessingErrorDetails to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for ProcessingErrorDetails
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a HtlcsTimedOutDetails. */
    interface IHtlcsTimedOutDetails {
        /** HtlcsTimedOutDetails payment_hash */
        payment_hash?: string | null;
    }

    /** Represents a HtlcsTimedOutDetails. */
    class HtlcsTimedOutDetails implements IHtlcsTimedOutDetails {
        /**
         * Constructs a new HtlcsTimedOutDetails.
         * @param [properties] Properties to set
         */
        constructor(properties?: events.IHtlcsTimedOutDetails);

        /** HtlcsTimedOutDetails payment_hash. */
        public payment_hash?: string | null;

        /**
         * Creates a new HtlcsTimedOutDetails instance using the specified properties.
         * @param [properties] Properties to set
         * @returns HtlcsTimedOutDetails instance
         */
        public static create(
            properties?: events.IHtlcsTimedOutDetails
        ): events.HtlcsTimedOutDetails;

        /**
         * Encodes the specified HtlcsTimedOutDetails message. Does not implicitly {@link events.HtlcsTimedOutDetails.verify|verify} messages.
         * @param message HtlcsTimedOutDetails message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: events.IHtlcsTimedOutDetails,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified HtlcsTimedOutDetails message, length delimited. Does not implicitly {@link events.HtlcsTimedOutDetails.verify|verify} messages.
         * @param message HtlcsTimedOutDetails message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: events.IHtlcsTimedOutDetails,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a HtlcsTimedOutDetails message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns HtlcsTimedOutDetails
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): events.HtlcsTimedOutDetails;

        /**
         * Decodes a HtlcsTimedOutDetails message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns HtlcsTimedOutDetails
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): events.HtlcsTimedOutDetails;

        /**
         * Verifies a HtlcsTimedOutDetails message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a HtlcsTimedOutDetails message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns HtlcsTimedOutDetails
         */
        public static fromObject(object: {
            [k: string]: any;
        }): events.HtlcsTimedOutDetails;

        /**
         * Creates a plain object from a HtlcsTimedOutDetails message. Also converts values to other types if specified.
         * @param message HtlcsTimedOutDetails
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: events.HtlcsTimedOutDetails,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this HtlcsTimedOutDetails to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for HtlcsTimedOutDetails
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a PeerFeerateTooLowDetails. */
    interface IPeerFeerateTooLowDetails {
        /** PeerFeerateTooLowDetails peer_feerate_sat_per_kw */
        peer_feerate_sat_per_kw?: number | null;

        /** PeerFeerateTooLowDetails required_feerate_sat_per_kw */
        required_feerate_sat_per_kw?: number | null;
    }

    /** Represents a PeerFeerateTooLowDetails. */
    class PeerFeerateTooLowDetails implements IPeerFeerateTooLowDetails {
        /**
         * Constructs a new PeerFeerateTooLowDetails.
         * @param [properties] Properties to set
         */
        constructor(properties?: events.IPeerFeerateTooLowDetails);

        /** PeerFeerateTooLowDetails peer_feerate_sat_per_kw. */
        public peer_feerate_sat_per_kw: number;

        /** PeerFeerateTooLowDetails required_feerate_sat_per_kw. */
        public required_feerate_sat_per_kw: number;

        /**
         * Creates a new PeerFeerateTooLowDetails instance using the specified properties.
         * @param [properties] Properties to set
         * @returns PeerFeerateTooLowDetails instance
         */
        public static create(
            properties?: events.IPeerFeerateTooLowDetails
        ): events.PeerFeerateTooLowDetails;

        /**
         * Encodes the specified PeerFeerateTooLowDetails message. Does not implicitly {@link events.PeerFeerateTooLowDetails.verify|verify} messages.
         * @param message PeerFeerateTooLowDetails message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: events.IPeerFeerateTooLowDetails,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified PeerFeerateTooLowDetails message, length delimited. Does not implicitly {@link events.PeerFeerateTooLowDetails.verify|verify} messages.
         * @param message PeerFeerateTooLowDetails message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: events.IPeerFeerateTooLowDetails,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a PeerFeerateTooLowDetails message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns PeerFeerateTooLowDetails
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): events.PeerFeerateTooLowDetails;

        /**
         * Decodes a PeerFeerateTooLowDetails message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns PeerFeerateTooLowDetails
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): events.PeerFeerateTooLowDetails;

        /**
         * Verifies a PeerFeerateTooLowDetails message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a PeerFeerateTooLowDetails message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns PeerFeerateTooLowDetails
         */
        public static fromObject(object: {
            [k: string]: any;
        }): events.PeerFeerateTooLowDetails;

        /**
         * Creates a plain object from a PeerFeerateTooLowDetails message. Also converts values to other types if specified.
         * @param message PeerFeerateTooLowDetails
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: events.PeerFeerateTooLowDetails,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this PeerFeerateTooLowDetails to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for PeerFeerateTooLowDetails
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a ChannelStateChangeReason. */
    interface IChannelStateChangeReason {
        /** ChannelStateChangeReason kind */
        kind?: events.ChannelStateChangeReasonKind | null;

        /** ChannelStateChangeReason message */
        message?: string | null;

        /** ChannelStateChangeReason counterparty_force_closed */
        counterparty_force_closed?: events.ICounterpartyForceClosedDetails | null;

        /** ChannelStateChangeReason holder_force_closed */
        holder_force_closed?: events.IHolderForceClosedDetails | null;

        /** ChannelStateChangeReason processing_error */
        processing_error?: events.IProcessingErrorDetails | null;

        /** ChannelStateChangeReason htlcs_timed_out */
        htlcs_timed_out?: events.IHtlcsTimedOutDetails | null;

        /** ChannelStateChangeReason peer_feerate_too_low */
        peer_feerate_too_low?: events.IPeerFeerateTooLowDetails | null;
    }

    /** Represents a ChannelStateChangeReason. */
    class ChannelStateChangeReason implements IChannelStateChangeReason {
        /**
         * Constructs a new ChannelStateChangeReason.
         * @param [properties] Properties to set
         */
        constructor(properties?: events.IChannelStateChangeReason);

        /** ChannelStateChangeReason kind. */
        public kind: events.ChannelStateChangeReasonKind;

        /** ChannelStateChangeReason message. */
        public message: string;

        /** ChannelStateChangeReason counterparty_force_closed. */
        public counterparty_force_closed?: events.ICounterpartyForceClosedDetails | null;

        /** ChannelStateChangeReason holder_force_closed. */
        public holder_force_closed?: events.IHolderForceClosedDetails | null;

        /** ChannelStateChangeReason processing_error. */
        public processing_error?: events.IProcessingErrorDetails | null;

        /** ChannelStateChangeReason htlcs_timed_out. */
        public htlcs_timed_out?: events.IHtlcsTimedOutDetails | null;

        /** ChannelStateChangeReason peer_feerate_too_low. */
        public peer_feerate_too_low?: events.IPeerFeerateTooLowDetails | null;

        /** ChannelStateChangeReason details. */
        public details?:
            | 'counterparty_force_closed'
            | 'holder_force_closed'
            | 'processing_error'
            | 'htlcs_timed_out'
            | 'peer_feerate_too_low';

        /**
         * Creates a new ChannelStateChangeReason instance using the specified properties.
         * @param [properties] Properties to set
         * @returns ChannelStateChangeReason instance
         */
        public static create(
            properties?: events.IChannelStateChangeReason
        ): events.ChannelStateChangeReason;

        /**
         * Encodes the specified ChannelStateChangeReason message. Does not implicitly {@link events.ChannelStateChangeReason.verify|verify} messages.
         * @param message ChannelStateChangeReason message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: events.IChannelStateChangeReason,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified ChannelStateChangeReason message, length delimited. Does not implicitly {@link events.ChannelStateChangeReason.verify|verify} messages.
         * @param message ChannelStateChangeReason message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: events.IChannelStateChangeReason,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a ChannelStateChangeReason message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns ChannelStateChangeReason
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): events.ChannelStateChangeReason;

        /**
         * Decodes a ChannelStateChangeReason message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns ChannelStateChangeReason
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): events.ChannelStateChangeReason;

        /**
         * Verifies a ChannelStateChangeReason message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a ChannelStateChangeReason message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns ChannelStateChangeReason
         */
        public static fromObject(object: {
            [k: string]: any;
        }): events.ChannelStateChangeReason;

        /**
         * Creates a plain object from a ChannelStateChangeReason message. Also converts values to other types if specified.
         * @param message ChannelStateChangeReason
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: events.ChannelStateChangeReason,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this ChannelStateChangeReason to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for ChannelStateChangeReason
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a ChannelStateChanged. */
    interface IChannelStateChanged {
        /** ChannelStateChanged channel_id */
        channel_id?: string | null;

        /** ChannelStateChanged user_channel_id */
        user_channel_id?: string | null;

        /** ChannelStateChanged counterparty_node_id */
        counterparty_node_id?: string | null;

        /** ChannelStateChanged state */
        state?: events.ChannelState | null;

        /** ChannelStateChanged funding_txo */
        funding_txo?: string | null;

        /** ChannelStateChanged reason */
        reason?: events.IChannelStateChangeReason | null;

        /** ChannelStateChanged closure_initiator */
        closure_initiator?: events.ChannelClosureInitiator | null;
    }

    /** Represents a ChannelStateChanged. */
    class ChannelStateChanged implements IChannelStateChanged {
        /**
         * Constructs a new ChannelStateChanged.
         * @param [properties] Properties to set
         */
        constructor(properties?: events.IChannelStateChanged);

        /** ChannelStateChanged channel_id. */
        public channel_id: string;

        /** ChannelStateChanged user_channel_id. */
        public user_channel_id: string;

        /** ChannelStateChanged counterparty_node_id. */
        public counterparty_node_id?: string | null;

        /** ChannelStateChanged state. */
        public state: events.ChannelState;

        /** ChannelStateChanged funding_txo. */
        public funding_txo?: string | null;

        /** ChannelStateChanged reason. */
        public reason?: events.IChannelStateChangeReason | null;

        /** ChannelStateChanged closure_initiator. */
        public closure_initiator: events.ChannelClosureInitiator;

        /**
         * Creates a new ChannelStateChanged instance using the specified properties.
         * @param [properties] Properties to set
         * @returns ChannelStateChanged instance
         */
        public static create(
            properties?: events.IChannelStateChanged
        ): events.ChannelStateChanged;

        /**
         * Encodes the specified ChannelStateChanged message. Does not implicitly {@link events.ChannelStateChanged.verify|verify} messages.
         * @param message ChannelStateChanged message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: events.IChannelStateChanged,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified ChannelStateChanged message, length delimited. Does not implicitly {@link events.ChannelStateChanged.verify|verify} messages.
         * @param message ChannelStateChanged message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: events.IChannelStateChanged,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a ChannelStateChanged message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns ChannelStateChanged
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): events.ChannelStateChanged;

        /**
         * Decodes a ChannelStateChanged message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns ChannelStateChanged
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): events.ChannelStateChanged;

        /**
         * Verifies a ChannelStateChanged message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a ChannelStateChanged message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns ChannelStateChanged
         */
        public static fromObject(object: {
            [k: string]: any;
        }): events.ChannelStateChanged;

        /**
         * Creates a plain object from a ChannelStateChanged message. Also converts values to other types if specified.
         * @param message ChannelStateChanged
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: events.ChannelStateChanged,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this ChannelStateChanged to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for ChannelStateChanged
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a PaymentReceived. */
    interface IPaymentReceived {
        /** PaymentReceived payment */
        payment?: types.IPayment | null;
    }

    /** Represents a PaymentReceived. */
    class PaymentReceived implements IPaymentReceived {
        /**
         * Constructs a new PaymentReceived.
         * @param [properties] Properties to set
         */
        constructor(properties?: events.IPaymentReceived);

        /** PaymentReceived payment. */
        public payment?: types.IPayment | null;

        /**
         * Creates a new PaymentReceived instance using the specified properties.
         * @param [properties] Properties to set
         * @returns PaymentReceived instance
         */
        public static create(
            properties?: events.IPaymentReceived
        ): events.PaymentReceived;

        /**
         * Encodes the specified PaymentReceived message. Does not implicitly {@link events.PaymentReceived.verify|verify} messages.
         * @param message PaymentReceived message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: events.IPaymentReceived,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified PaymentReceived message, length delimited. Does not implicitly {@link events.PaymentReceived.verify|verify} messages.
         * @param message PaymentReceived message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: events.IPaymentReceived,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a PaymentReceived message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns PaymentReceived
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): events.PaymentReceived;

        /**
         * Decodes a PaymentReceived message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns PaymentReceived
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): events.PaymentReceived;

        /**
         * Verifies a PaymentReceived message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a PaymentReceived message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns PaymentReceived
         */
        public static fromObject(object: {
            [k: string]: any;
        }): events.PaymentReceived;

        /**
         * Creates a plain object from a PaymentReceived message. Also converts values to other types if specified.
         * @param message PaymentReceived
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: events.PaymentReceived,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this PaymentReceived to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for PaymentReceived
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a PaymentSuccessful. */
    interface IPaymentSuccessful {
        /** PaymentSuccessful payment */
        payment?: types.IPayment | null;
    }

    /** Represents a PaymentSuccessful. */
    class PaymentSuccessful implements IPaymentSuccessful {
        /**
         * Constructs a new PaymentSuccessful.
         * @param [properties] Properties to set
         */
        constructor(properties?: events.IPaymentSuccessful);

        /** PaymentSuccessful payment. */
        public payment?: types.IPayment | null;

        /**
         * Creates a new PaymentSuccessful instance using the specified properties.
         * @param [properties] Properties to set
         * @returns PaymentSuccessful instance
         */
        public static create(
            properties?: events.IPaymentSuccessful
        ): events.PaymentSuccessful;

        /**
         * Encodes the specified PaymentSuccessful message. Does not implicitly {@link events.PaymentSuccessful.verify|verify} messages.
         * @param message PaymentSuccessful message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: events.IPaymentSuccessful,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified PaymentSuccessful message, length delimited. Does not implicitly {@link events.PaymentSuccessful.verify|verify} messages.
         * @param message PaymentSuccessful message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: events.IPaymentSuccessful,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a PaymentSuccessful message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns PaymentSuccessful
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): events.PaymentSuccessful;

        /**
         * Decodes a PaymentSuccessful message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns PaymentSuccessful
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): events.PaymentSuccessful;

        /**
         * Verifies a PaymentSuccessful message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a PaymentSuccessful message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns PaymentSuccessful
         */
        public static fromObject(object: {
            [k: string]: any;
        }): events.PaymentSuccessful;

        /**
         * Creates a plain object from a PaymentSuccessful message. Also converts values to other types if specified.
         * @param message PaymentSuccessful
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: events.PaymentSuccessful,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this PaymentSuccessful to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for PaymentSuccessful
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a PaymentFailed. */
    interface IPaymentFailed {
        /** PaymentFailed payment */
        payment?: types.IPayment | null;
    }

    /** Represents a PaymentFailed. */
    class PaymentFailed implements IPaymentFailed {
        /**
         * Constructs a new PaymentFailed.
         * @param [properties] Properties to set
         */
        constructor(properties?: events.IPaymentFailed);

        /** PaymentFailed payment. */
        public payment?: types.IPayment | null;

        /**
         * Creates a new PaymentFailed instance using the specified properties.
         * @param [properties] Properties to set
         * @returns PaymentFailed instance
         */
        public static create(
            properties?: events.IPaymentFailed
        ): events.PaymentFailed;

        /**
         * Encodes the specified PaymentFailed message. Does not implicitly {@link events.PaymentFailed.verify|verify} messages.
         * @param message PaymentFailed message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: events.IPaymentFailed,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified PaymentFailed message, length delimited. Does not implicitly {@link events.PaymentFailed.verify|verify} messages.
         * @param message PaymentFailed message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: events.IPaymentFailed,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a PaymentFailed message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns PaymentFailed
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): events.PaymentFailed;

        /**
         * Decodes a PaymentFailed message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns PaymentFailed
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): events.PaymentFailed;

        /**
         * Verifies a PaymentFailed message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a PaymentFailed message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns PaymentFailed
         */
        public static fromObject(object: {
            [k: string]: any;
        }): events.PaymentFailed;

        /**
         * Creates a plain object from a PaymentFailed message. Also converts values to other types if specified.
         * @param message PaymentFailed
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: events.PaymentFailed,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this PaymentFailed to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for PaymentFailed
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a PaymentClaimable. */
    interface IPaymentClaimable {
        /** PaymentClaimable payment */
        payment?: types.IPayment | null;
    }

    /** Represents a PaymentClaimable. */
    class PaymentClaimable implements IPaymentClaimable {
        /**
         * Constructs a new PaymentClaimable.
         * @param [properties] Properties to set
         */
        constructor(properties?: events.IPaymentClaimable);

        /** PaymentClaimable payment. */
        public payment?: types.IPayment | null;

        /**
         * Creates a new PaymentClaimable instance using the specified properties.
         * @param [properties] Properties to set
         * @returns PaymentClaimable instance
         */
        public static create(
            properties?: events.IPaymentClaimable
        ): events.PaymentClaimable;

        /**
         * Encodes the specified PaymentClaimable message. Does not implicitly {@link events.PaymentClaimable.verify|verify} messages.
         * @param message PaymentClaimable message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: events.IPaymentClaimable,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified PaymentClaimable message, length delimited. Does not implicitly {@link events.PaymentClaimable.verify|verify} messages.
         * @param message PaymentClaimable message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: events.IPaymentClaimable,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a PaymentClaimable message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns PaymentClaimable
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): events.PaymentClaimable;

        /**
         * Decodes a PaymentClaimable message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns PaymentClaimable
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): events.PaymentClaimable;

        /**
         * Verifies a PaymentClaimable message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a PaymentClaimable message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns PaymentClaimable
         */
        public static fromObject(object: {
            [k: string]: any;
        }): events.PaymentClaimable;

        /**
         * Creates a plain object from a PaymentClaimable message. Also converts values to other types if specified.
         * @param message PaymentClaimable
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: events.PaymentClaimable,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this PaymentClaimable to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for PaymentClaimable
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a PaymentForwarded. */
    interface IPaymentForwarded {
        /** PaymentForwarded forwarded_payment */
        forwarded_payment?: types.IForwardedPayment | null;
    }

    /** Represents a PaymentForwarded. */
    class PaymentForwarded implements IPaymentForwarded {
        /**
         * Constructs a new PaymentForwarded.
         * @param [properties] Properties to set
         */
        constructor(properties?: events.IPaymentForwarded);

        /** PaymentForwarded forwarded_payment. */
        public forwarded_payment?: types.IForwardedPayment | null;

        /**
         * Creates a new PaymentForwarded instance using the specified properties.
         * @param [properties] Properties to set
         * @returns PaymentForwarded instance
         */
        public static create(
            properties?: events.IPaymentForwarded
        ): events.PaymentForwarded;

        /**
         * Encodes the specified PaymentForwarded message. Does not implicitly {@link events.PaymentForwarded.verify|verify} messages.
         * @param message PaymentForwarded message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: events.IPaymentForwarded,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified PaymentForwarded message, length delimited. Does not implicitly {@link events.PaymentForwarded.verify|verify} messages.
         * @param message PaymentForwarded message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: events.IPaymentForwarded,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes a PaymentForwarded message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns PaymentForwarded
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): events.PaymentForwarded;

        /**
         * Decodes a PaymentForwarded message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns PaymentForwarded
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): events.PaymentForwarded;

        /**
         * Verifies a PaymentForwarded message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates a PaymentForwarded message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns PaymentForwarded
         */
        public static fromObject(object: {
            [k: string]: any;
        }): events.PaymentForwarded;

        /**
         * Creates a plain object from a PaymentForwarded message. Also converts values to other types if specified.
         * @param message PaymentForwarded
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: events.PaymentForwarded,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this PaymentForwarded to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for PaymentForwarded
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }
}

/** Namespace error. */
export namespace error {
    /** Properties of an ErrorResponse. */
    interface IErrorResponse {
        /** ErrorResponse message */
        message?: string | null;

        /** ErrorResponse error_code */
        error_code?: error.ErrorCode | null;
    }

    /** Represents an ErrorResponse. */
    class ErrorResponse implements IErrorResponse {
        /**
         * Constructs a new ErrorResponse.
         * @param [properties] Properties to set
         */
        constructor(properties?: error.IErrorResponse);

        /** ErrorResponse message. */
        public message: string;

        /** ErrorResponse error_code. */
        public error_code: error.ErrorCode;

        /**
         * Creates a new ErrorResponse instance using the specified properties.
         * @param [properties] Properties to set
         * @returns ErrorResponse instance
         */
        public static create(
            properties?: error.IErrorResponse
        ): error.ErrorResponse;

        /**
         * Encodes the specified ErrorResponse message. Does not implicitly {@link error.ErrorResponse.verify|verify} messages.
         * @param message ErrorResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(
            message: error.IErrorResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Encodes the specified ErrorResponse message, length delimited. Does not implicitly {@link error.ErrorResponse.verify|verify} messages.
         * @param message ErrorResponse message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(
            message: error.IErrorResponse,
            writer?: $protobuf.Writer
        ): $protobuf.Writer;

        /**
         * Decodes an ErrorResponse message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns ErrorResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(
            reader: $protobuf.Reader | Uint8Array,
            length?: number
        ): error.ErrorResponse;

        /**
         * Decodes an ErrorResponse message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns ErrorResponse
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(
            reader: $protobuf.Reader | Uint8Array
        ): error.ErrorResponse;

        /**
         * Verifies an ErrorResponse message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): string | null;

        /**
         * Creates an ErrorResponse message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns ErrorResponse
         */
        public static fromObject(object: {
            [k: string]: any;
        }): error.ErrorResponse;

        /**
         * Creates a plain object from an ErrorResponse message. Also converts values to other types if specified.
         * @param message ErrorResponse
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(
            message: error.ErrorResponse,
            options?: $protobuf.IConversionOptions
        ): { [k: string]: any };

        /**
         * Converts this ErrorResponse to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for ErrorResponse
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** ErrorCode enum. */
    enum ErrorCode {
        UNKNOWN_ERROR = 0,
        INVALID_REQUEST_ERROR = 1,
        AUTH_ERROR = 2,
        LIGHTNING_ERROR = 3,
        INTERNAL_SERVER_ERROR = 4
    }
}
